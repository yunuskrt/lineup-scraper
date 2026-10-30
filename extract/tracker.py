import csv
import io
import json
import sys
from collections.abc import Collection, Iterable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Final, TypedDict, cast

from jsonschema import Draft202012Validator

from extract.data_dirs import DATA_DIRS
from extract.images import IMAGE_KINDS
from extract.import_log import IMPORT_LOG, read_log
from extract.links import INBOX_FOLDER, link
from extract.lists.images import latest_players
from extract.lists.listings import listings
from extract.lists.match_reports import (
    PILOT_MATCHES,
    InvalidPoolMatchesError,
    PoolMatch,
    match_report_url,
    match_season,
    pool_matches_path,
    read_pool_matches,
)
from extract.lists.player_pages import latest_reports
from extract.pages import HOME, Kind, Page, PageId, Snapshot, classify, snapshot
from extract.parsers.transfermarkt.records import (
    TransfermarktMatch,
    TransfermarktPlayer,
)
from extract.pool_config import (
    POOL_CONFIG,
    Competition,
    InvalidPoolConfigError,
    PoolConfig,
    read_pool_config,
)
from extract.records import InvalidRecordError

LISTS: Final = "inbox-lists"
GENERAL: Final = "general.csv"
FILES: Final = {
    "fixture": "listings.csv",
    "match": "match-reports.csv",
    "player": "players.csv",
    "image": "images.csv",
}
HEADER: Final = ("#", "Link", "Save as", "Folder", "Status")
GENERAL_HEADER: Final = ("#", "Type", "Link", "Save as", "Folder", "Status")
TYPE_NAMES: Final[Mapping[Kind, str]] = {
    "fixture": "Fixture",
    "match": "Match Report",
    "player": "Player",
    "crest": "Crest",
    "photo": "PlayerPhoto",
}
TO_SAVE: Final = "to save"
GROUP_ORDER: Final = (
    "derbies",
    "clashes",
    "ucl-knockouts",
    "uel-finals",
    "world-cup-knockouts",
    "euro-knockouts",
)
# Same as ERA_BUCKETS in src/score/pool-rules.ts
ERA_STARTS: Final = (2000, 2008, 2016)
REMOTE_SCHEMA: Final = (
    Path(__file__).resolve().parent.parent
    / "schemas"
    / "work"
    / "status-remote.schema.json"
)


class InvalidRemoteStatusError(ValueError):
    pass


class Remote(TypedDict):
    validated: dict[str, Collection[str]]
    errors: dict[str, dict[str, str]]
    uploaded: dict[str, Collection[str]] | None
    ingested: dict[str, Collection[str]] | None
    notes: list[str]


NO_REMOTE: Final[Remote] = {
    "validated": {"match": [], "player": []},
    "errors": {"match": {}},
    "uploaded": None,
    "ingested": None,
    "notes": ["no remote status: run `npm run status`, not this module alone"],
}


@dataclass(frozen=True)
class Row:
    page: Page
    status: str


def remote_path(dirs: Mapping[str, Path]) -> Path:
    return dirs["work"] / "status" / "remote.json"


# Written by `npm run status` before this runs
def read_remote(path: Path, schema: Path = REMOTE_SCHEMA) -> Remote:
    if not path.is_file():
        return NO_REMOTE
    remote = json.loads(path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(json.loads(schema.read_text(encoding="utf-8")))
    errors = sorted(validator.iter_errors(remote), key=lambda e: e.json_path)
    if errors:
        lines = [f"  {error.json_path}: {error.validator}" for error in errors]
        raise InvalidRemoteStatusError("\n".join(["Invalid remote status:", *lines]))
    return indexed(cast(Remote, remote))


# Sets: one lookup per row, at 10,000 rows
def indexed(remote: Remote) -> Remote:
    def sets(
        ids: Mapping[str, Collection[str]] | None,
    ) -> dict[str, Collection[str]] | None:
        return None if ids is None else {k: frozenset(v) for k, v in ids.items()}

    return {
        **remote,
        "validated": sets(remote["validated"]) or {},
        "uploaded": sets(remote["uploaded"]),
        "ingested": sets(remote["ingested"]),
    }


def era(match: PoolMatch, competitions: Mapping[str, Competition]) -> int:
    label = match_season(match, competitions) or match.get("date", "2000")
    year = int(label[:4])
    return max(i for i, start in enumerate(ERA_STARTS) if year >= start or i == 0)


def group_rank(match: PoolMatch) -> int:
    ranks = [GROUP_ORDER.index(g) for g in match["groups"] if g in GROUP_ORDER]
    return min(ranks, default=len(GROUP_ORDER))


def round_robin[T](queues: Sequence[Sequence[T]]) -> list[T]:
    merged: list[T] = []
    for index in range(max((len(q) for q in queues), default=0)):
        merged.extend(q[index] for q in queues if index < len(q))
    return merged


# Pilot first; then group by group, era by era
def balanced(
    matches: Sequence[PoolMatch], competitions: Mapping[str, Competition]
) -> list[PoolMatch]:
    by_id = {m["sourceId"]: m for m in matches}
    pilot = [by_id[i] for i in PILOT_MATCHES if i in by_id]
    cells: dict[int, dict[int, list[PoolMatch]]] = {}
    for match in matches:
        if match["sourceId"] in PILOT_MATCHES:
            continue
        group = cells.setdefault(group_rank(match), {})
        group.setdefault(era(match, competitions), []).append(match)
    groups = [
        round_robin(
            [
                sorted(eras[e], key=lambda m: (m.get("date", ""), m["sourceId"]))
                for e in sorted(eras)
            ]
        )
        for _, eras in sorted(cells.items())
    ]
    return pilot + round_robin(groups)


# A report, then its crests, starters, photos
def match_block(
    match: PoolMatch,
    reports: Mapping[str, TransfermarktMatch],
    players: Mapping[str, TransfermarktPlayer],
) -> list[Page]:
    pages = [classify(match_report_url(match["sourceId"]))]
    report = reports.get(match["sourceId"])
    if report is None:
        return pages
    clubs = (report["home"], report["away"])
    for club in clubs:
        if (crest := club["crestUrl"]) is not None:
            pages.append(link(crest).page)
    for club in clubs:
        for starter in club["starters"]:
            pages.append(link(f"{HOME.rstrip('/')}{starter['profilePath']}").page)
            player = players.get(starter["sourceId"])
            if player is not None and player["imageUrl"] is not None:
                pages.append(link(player["imageUrl"]).page)
    return pages


# Every link once, in the order to save
def general_pages(
    config: PoolConfig,
    matches: Sequence[PoolMatch],
    reports: Mapping[str, TransfermarktMatch],
    players: Mapping[str, TransfermarktPlayer],
) -> list[Page]:
    competitions = {c["code"]: c for c in config["competitions"]}
    seen: set[PageId] = set()
    ordered: list[Page] = []

    def add(pages: Iterable[Page]) -> None:
        for page in pages:
            if page.id not in seen:
                seen.add(page.id)
                ordered.append(page)

    add(item.page for item in listings(config))
    for match in balanced(matches, competitions):
        add(match_block(match, reports, players))
    return ordered


# The last import-log reason, if still not saved
def refusals(log: Path) -> dict[PageId, str]:
    refused: dict[PageId, str] = {}
    for line in read_log(log):
        kind, key = line["kind"], line["key"]
        if kind is None or key is None:
            continue
        if line["result"] == "refused":
            refused[(kind, key)] = line["reason"] or "refused"
        else:
            refused.pop((kind, key), None)
    return refused


def status_of(
    page: Page, state: Snapshot, refused: Mapping[PageId, str], remote: Remote
) -> str:
    base = state.status(page.id)
    if base == "missing":
        reason = refused.get(page.id)
        return f"error: {reason}" if reason else TO_SAVE
    if base in ("inbox", "imported"):
        return "saved"
    kind, key = page.id
    uploaded, ingested = remote["uploaded"], remote["ingested"]
    if kind in IMAGE_KINDS:
        if uploaded is None or key not in uploaded[kind]:
            return "saved"
        return "ingested" if ingested and key in ingested[kind] else "uploaded"
    if kind == "fixture":
        return "parsed"
    if (error := remote["errors"].get(kind, {}).get(key)) is not None:
        return f"error: {error}"
    if key not in remote["validated"].get(kind, []):
        return "parsed"
    return "ingested" if ingested and key in ingested[kind] else "validated"


def file_for(page: Page) -> str:
    return FILES["image" if page.kind in IMAGE_KINDS else page.kind]


def render_csv(rows: Sequence[Row], with_type: bool = False) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(GENERAL_HEADER if with_type else HEADER)
    for index, row in enumerate(rows, start=1):
        page = row.page
        cells = (page.url, page.save_as, INBOX_FOLDER, row.status)
        kind = (TYPE_NAMES[page.kind],) if with_type else ()
        writer.writerow((index, *kind, *cells))
    return out.getvalue()


# general.csv and the four per type, by file name
def tracker_files(rows: Sequence[Row]) -> dict[str, str]:
    files = {GENERAL: render_csv(rows, with_type=True)}
    for name in FILES.values():
        files[name] = render_csv([r for r in rows if file_for(r.page) == name])
    return files


def tally(rows: Sequence[Row]) -> str:
    counts: dict[str, int] = {}
    for row in rows:
        label = "error" if row.status.startswith("error") else row.status
        counts[label] = counts.get(label, 0) + 1
    return ", ".join(f"{n} {label}" for label, n in sorted(counts.items()))


def summary(rows: Sequence[Row], remote: Remote, waiting: int) -> list[str]:
    lines = []
    for name in FILES.values():
        mine = [r for r in rows if file_for(r.page) == name]
        lines.append(f"{name}: {len(mine)} rows: {tally(mine) or 'none'}")
    lines.append(f"{GENERAL}: {len(rows)} rows")
    if waiting:
        lines.append(
            f"in {INBOX_FOLDER}: {waiting}, run `uv run python -m extract.inbox`"
        )
    for index, row in enumerate(rows, start=1):
        if row.status.startswith("error"):
            kind, key = row.page.id
            lines.append(f"  #{index} {kind} {key}: {row.status}")
    lines.extend(remote["notes"])
    return lines


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.tracker (run by npm run status)")
        return 2
    try:
        config = read_pool_config(config_path)
        matches_path = pool_matches_path(dirs)
        matches = read_pool_matches(matches_path) if matches_path.is_file() else []
        reports = latest_reports(dirs["raw"])
        players = latest_players(dirs["raw"])
        remote = read_remote(remote_path(dirs))
    except (
        InvalidPoolConfigError,
        InvalidPoolMatchesError,
        InvalidRecordError,
        InvalidRemoteStatusError,
    ) as error:
        print(error, file=sys.stderr)
        return 1
    state = snapshot(dirs["inbox"], dirs["pages"], dirs["raw"], dirs["images"])
    refused = refusals(dirs["work"] / IMPORT_LOG)
    rows = [
        Row(page, status_of(page, state, refused, remote))
        for page in general_pages(config, matches, reports, players)
    ]
    target = dirs[LISTS]
    target.mkdir(parents=True, exist_ok=True)
    for name, text in tracker_files(rows).items():
        (target / name).write_text(text, encoding="utf-8")
    for line in summary(rows, remote, len(state.inbox)):
        print(line)
    return 0


# The next rows of general.csv still to save
def next_to_save(lists_dir: Path, count: int) -> list[Page]:
    path = lists_dir / GENERAL
    if not path.is_file():
        raise FileNotFoundError(f"{path}: run `npm run status` first")
    with path.open(encoding="utf-8", newline="") as file:
        rows = list(csv.DictReader(file))
    links = [row["Link"] for row in rows if row["Status"] == TO_SAVE]
    return [classify(url) for url in links[:count]]


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
