import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Final

from extract.data_dirs import DATA_DIRS
from extract.links import LINK_LISTS, Link, link, write_link_list
from extract.pages import HOME
from extract.pool_config import (
    POOL_CONFIG,
    Competition,
    InvalidPoolConfigError,
    PoolConfig,
    read_pool_config,
    season_ids,
    season_label,
)

LISTINGS: Final = "s07-listings"
VERIFY: Final = "s07-verify"
PILOT: Final = "s07-pilot"
# The pilot derby's season and Euro 2004 (D2, D3)
PILOT_PAGES: Final = (("TR1", 2002), ("EURO", 2003))


def listing_url(competition: Competition, season_id: int) -> str:
    base = f"{HOME}{competition['urlSlug']}/gesamtspielplan"
    code = competition["code"]
    if competition["linkStyle"] == "league":
        return f"{base}/wettbewerb/{code}?saison_id={season_id}"
    return f"{base}/pokalwettbewerb/{code}/saison_id/{season_id}"


def listing_link(competition: Competition, season_id: int, group: str) -> Link:
    return link(
        listing_url(competition, season_id),
        group=group,
        competition=competition["code"],
        season=season_label(competition, season_id),
    )


def listings(config: PoolConfig) -> list[Link]:
    return [
        listing_link(c, season_id, "+".join(c["groups"]))
        for c in config["competitions"]
        for season_id in season_ids(c)
    ]


# One sample per unverified link pattern
def verify(config: PoolConfig) -> list[Link]:
    return [
        listing_link(c, season_ids(c)[0], f"unverified-{c['code'].lower()}")
        for c in config["competitions"]
        if not c["isVerified"]
    ]


def pilot(config: PoolConfig) -> list[Link]:
    by_code = {c["code"]: c for c in config["competitions"]}
    return [listing_link(by_code[code], sid, "pilot") for code, sid in PILOT_PAGES]


def clubs_without_id(config: PoolConfig) -> list[str]:
    return [club["key"] for club in config["clubs"] if club["id"] is None]


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.lists.listings", file=sys.stderr)
        return 2
    try:
        config = read_pool_config(config_path)
    except InvalidPoolConfigError as error:
        print(error, file=sys.stderr)
        return 1
    lists_dir = dirs["work"] / LINK_LISTS
    for name, links in (
        (LISTINGS, listings(config)),
        (VERIFY, verify(config)),
        (PILOT, pilot(config)),
    ):
        path = write_link_list(lists_dir, name, links)
        print(f"{name}: {len(links)} pages -> {path}")
    missing = clubs_without_id(config)
    if missing:
        print(f"clubs with no Transfermarkt id yet: {', '.join(missing)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
