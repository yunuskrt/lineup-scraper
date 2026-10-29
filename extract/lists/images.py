import sys
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final, cast

from extract.data_dirs import DATA_DIRS
from extract.links import LINK_LISTS, Link, link, show, write_link_list
from extract.lists.match_reports import (
    PILOT_MATCHES,
    InvalidPoolMatchesError,
    PoolMatch,
    match_season,
    pool_matches_path,
    read_pool_matches,
)
from extract.lists.player_pages import latest_reports
from extract.parsers.transfermarkt.records import (
    TransfermarktMatch,
    TransfermarktPlayer,
)
from extract.pool_config import (
    POOL_CONFIG,
    Competition,
    InvalidPoolConfigError,
    read_pool_config,
)
from extract.records import InvalidRecordError, read_records

IMAGES: Final = "s18-images"
PILOT: Final = "s18-pilot"


@dataclass
class ImageLinks:
    links: list[Link] = field(default_factory=list)
    # Ids Transfermarkt shows no image for
    no_crest: list[str] = field(default_factory=list)
    no_photo: list[str] = field(default_factory=list)
    # Starters whose profile isn't saved yet (S11b)
    no_profile: list[str] = field(default_factory=list)


def latest_players(raw_dir: Path) -> dict[str, TransfermarktPlayer]:
    players: dict[str, TransfermarktPlayer] = {}
    for record in read_records("transfermarkt-player", raw_dir):
        player = cast(TransfermarktPlayer, record)
        kept = players.get(player["sourceId"])
        if kept is None or player["fetchedAt"] > kept["fetchedAt"]:
            players[player["sourceId"]] = player
    return players


def add_once(ids: list[str], value: str) -> None:
    if value not in ids:
        ids.append(value)


# Crests, then photos, each once, in match order
def image_links(
    matches: list[PoolMatch],
    reports: Mapping[str, TransfermarktMatch],
    players: Mapping[str, TransfermarktPlayer],
    competitions: Mapping[str, Competition],
    group: str | None = None,
) -> ImageLinks:
    found = ImageLinks()
    # The newest report's crest, per club
    crests: dict[str, tuple[str, Link]] = {}
    photos: dict[str, Link] = {}
    for match in matches:
        report = reports.get(match["sourceId"])
        if report is None:
            continue
        where = {
            "group": group or "+".join(match["groups"]),
            "competition": match["competitionCode"],
            "season": match_season(match, competitions),
        }
        for side in ("home", "away"):
            club = report[side]
            crest = club["crestUrl"]
            kept = crests.get(club["sourceId"])
            if crest is None:
                if kept is None:
                    add_once(found.no_crest, club["sourceId"])
            elif kept is None or report["date"] > kept[0]:
                crests[club["sourceId"]] = (report["date"], link(crest, **where))
            for starter in club["starters"]:
                player = players.get(starter["sourceId"])
                if player is None:
                    add_once(found.no_profile, starter["sourceId"])
                elif player["imageUrl"] is None:
                    add_once(found.no_photo, starter["sourceId"])
                elif starter["sourceId"] not in photos:
                    photos[starter["sourceId"]] = link(player["imageUrl"], **where)
    found.no_crest = [c for c in found.no_crest if c not in crests]
    found.links = [kept for _, kept in crests.values()] + list(photos.values())
    return found


def print_missing(found: ImageLinks) -> None:
    for label, ids in (
        ("no crest on Transfermarkt", found.no_crest),
        ("no photo on Transfermarkt", found.no_photo),
        ("profile not saved yet (s11b-players)", found.no_profile),
    ):
        if ids:
            print(f"  {label}: {len(ids)} ({', '.join(ids)})")


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.lists.images", file=sys.stderr)
        return 2
    matches_path = pool_matches_path(dirs)
    if not matches_path.is_file():
        print(f"no pool match list: run `npm run pool` first ({matches_path})")
        return 1
    try:
        config = read_pool_config(config_path)
        matches = read_pool_matches(matches_path)
        reports = latest_reports(dirs["raw"])
        players = latest_players(dirs["raw"])
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
    for name, found in (
        (IMAGES, image_links(matches, reports, players, competitions)),
        (PILOT, image_links(pilot, reports, players, competitions, "pilot")),
    ):
        write_link_list(lists_dir, name, found.links)
        kinds = [item.page.kind for item in found.links]
        print(
            f"{name}: {kinds.count('crest')} crests, {kinds.count('photo')} photos"
            f" -> {show(dirs, name)}"
        )
        print_missing(found)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
