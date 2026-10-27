import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Final, cast

from extract.data_dirs import DATA_DIRS
from extract.links import LINK_LISTS, Link, link, write_link_list
from extract.lists.match_reports import (
    PILOT_MATCHES,
    InvalidPoolMatchesError,
    PoolMatch,
    match_season,
    pool_matches_path,
    read_pool_matches,
)
from extract.pages import HOME
from extract.parsers.transfermarkt.records import TransfermarktMatch
from extract.pool_config import (
    POOL_CONFIG,
    Competition,
    InvalidPoolConfigError,
    read_pool_config,
)
from extract.records import InvalidRecordError, read_records

PLAYERS: Final = "s11b-players"
PILOT: Final = "s11b-pilot"


# The latest saved copy of each match report
def latest_reports(raw_dir: Path) -> dict[str, TransfermarktMatch]:
    reports: dict[str, TransfermarktMatch] = {}
    for record in read_records("transfermarkt-match", raw_dir):
        report = cast(TransfermarktMatch, record)
        kept = reports.get(report["sourceId"])
        if kept is None or report["fetchedAt"] > kept["fetchedAt"]:
            reports[report["sourceId"]] = report
    return reports


# Starters, home XI then away XI; each kept once
def player_links(
    matches: list[PoolMatch],
    reports: Mapping[str, TransfermarktMatch],
    competitions: Mapping[str, Competition],
    group: str | None = None,
) -> list[Link]:
    links: list[Link] = []
    for match in matches:
        report = reports.get(match["sourceId"])
        if report is None:
            continue
        season = match_season(match, competitions)
        for side in ("home", "away"):
            for starter in report[side]["starters"]:
                links.append(
                    link(
                        f"{HOME.rstrip('/')}{starter['profilePath']}",
                        group=group or "+".join(match["groups"]),
                        competition=match["competitionCode"],
                        season=season,
                    )
                )
    return links


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.lists.player_pages", file=sys.stderr)
        return 2
    matches_path = pool_matches_path(dirs)
    if not matches_path.is_file():
        print(f"no pool match list: run `npm run pool` first ({matches_path})")
        return 1
    try:
        config = read_pool_config(config_path)
        matches = read_pool_matches(matches_path)
        reports = latest_reports(dirs["raw"])
    except (
        InvalidPoolConfigError,
        InvalidPoolMatchesError,
        InvalidRecordError,
    ) as error:
        print(error, file=sys.stderr)
        return 1
    competitions = {c["code"]: c for c in config["competitions"]}
    pilot = [m for m in matches if m["sourceId"] in PILOT_MATCHES]
    lists_dir = dirs["work"] / LINK_LISTS
    for name, links in (
        (PLAYERS, player_links(matches, reports, competitions)),
        (PILOT, player_links(pilot, reports, competitions, "pilot")),
    ):
        path = write_link_list(lists_dir, name, links)
        players = len({item.page.id for item in links})
        print(f"{name}: {players} players -> {path}")
    with_report = sum(m["sourceId"] in reports for m in matches)
    print(f"pool matches with a saved report: {with_report}/{len(matches)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
