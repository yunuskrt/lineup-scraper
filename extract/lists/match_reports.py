import json
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Final, NotRequired, TypedDict, cast

from jsonschema import Draft202012Validator

from extract.data_dirs import DATA_DIRS
from extract.links import LINK_LISTS, Link, link, write_link_list
from extract.pages import HOME
from extract.pool_config import (
    POOL_CONFIG,
    Competition,
    InvalidPoolConfigError,
    read_pool_config,
    season_label,
)

MATCH_REPORTS: Final = "s11-match-reports"
PILOT: Final = "s11-pilot"
# The 2001 CL final, the 2006 World Cup final, the derby
PILOT_MATCHES: Final = ("990248", "53491", "1118844")
POOL_MATCHES_SCHEMA: Final = (
    Path(__file__).resolve().parent.parent.parent
    / "schemas"
    / "work"
    / "pool-matches.schema.json"
)


class InvalidPoolMatchesError(ValueError):
    pass


class PoolMatch(TypedDict):
    sourceId: str
    competitionCode: str
    seasonId: str | None
    groups: list[str]
    date: NotRequired[str]


def pool_matches_path(dirs: Mapping[str, Path]) -> Path:
    return dirs["work"] / "pool" / "matches.json"


# The shape only; written by `npm run pool`
def read_pool_matches(
    path: Path, schema: Path = POOL_MATCHES_SCHEMA
) -> list[PoolMatch]:
    matches = json.loads(path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(json.loads(schema.read_text(encoding="utf-8")))
    errors = sorted(validator.iter_errors(matches), key=lambda e: e.json_path)
    if errors:
        lines = [f"  {error.json_path}: {error.validator}" for error in errors]
        raise InvalidPoolMatchesError("\n".join(["Invalid pool matches:", *lines]))
    return cast(list[PoolMatch], matches)


def match_report_url(match_id: str) -> str:
    return f"{HOME}spielbericht/index/spielbericht/{match_id}"


# 2002 → `2002-03`; None if unknown
def match_season(
    match: PoolMatch, competitions: Mapping[str, Competition]
) -> str | None:
    competition = competitions.get(match["competitionCode"])
    season_id = match["seasonId"]
    if competition is None or season_id is None:
        return None
    return season_label(competition, int(season_id))


def match_link(
    match: PoolMatch, competitions: Mapping[str, Competition], group: str
) -> Link:
    return link(
        match_report_url(match["sourceId"]),
        group=group,
        competition=match["competitionCode"],
        season=match_season(match, competitions),
    )


def match_reports(
    matches: list[PoolMatch], competitions: Mapping[str, Competition]
) -> list[Link]:
    return [match_link(m, competitions, "+".join(m["groups"])) for m in matches]


def pilot(
    matches: list[PoolMatch], competitions: Mapping[str, Competition]
) -> list[Link]:
    by_id = {m["sourceId"]: m for m in matches}
    return [
        match_link(by_id[match_id], competitions, "pilot")
        for match_id in PILOT_MATCHES
        if match_id in by_id
    ]


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.lists.match_reports", file=sys.stderr)
        return 2
    matches_path = pool_matches_path(dirs)
    if not matches_path.is_file():
        print(f"no pool match list: run `npm run pool` first ({matches_path})")
        return 1
    try:
        config = read_pool_config(config_path)
        matches = read_pool_matches(matches_path)
    except (InvalidPoolConfigError, InvalidPoolMatchesError) as error:
        print(error, file=sys.stderr)
        return 1
    competitions = {c["code"]: c for c in config["competitions"]}
    lists_dir = dirs["work"] / LINK_LISTS
    for name, links in (
        (MATCH_REPORTS, match_reports(matches, competitions)),
        (PILOT, pilot(matches, competitions)),
    ):
        path = write_link_list(lists_dir, name, links)
        print(f"{name}: {len(links)} pages -> {path}")
    in_pool = {m["sourceId"] for m in matches}
    missing = [match_id for match_id in PILOT_MATCHES if match_id not in in_pool]
    if missing:
        print(f"pilot matches not in the pool yet: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
