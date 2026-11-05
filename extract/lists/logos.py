import html
import json
import re
import sys
from collections.abc import Mapping
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final

from extract.data_dirs import DATA_DIRS
from extract.images import image_from_url, logo_slugs
from extract.links import LINK_LISTS, Link, link, show, write_link_list
from extract.lists.listings import listing_url
from extract.pool_config import (
    POOL_CONFIG,
    InvalidPoolConfigError,
    PoolConfig,
    read_pool_config,
    season_ids,
)

LOGOS: Final = "s18c-logos"
CURATED: Final = "logos.json"
# Square first, as the web asks (display § 1)
VARIANTS: Final = ("homepageWappen150x150", "header")
LOGO_SRC: Final = re.compile(
    r'src="(https://img\.a\.transfermarkt\.technology/logo/'
    r'([A-Za-z0-9]+)/([a-z0-9]+)(?:_[0-9]+)?\.[a-z]+[^"]*)"'
)


class InvalidLogoLinksError(ValueError):
    pass


@dataclass
class LogoLinks:
    links: list[Link] = field(default_factory=list)
    # Each slug with no link, and its fixture list
    no_link: list[tuple[str, str]] = field(default_factory=list)


def fixture_dir(dirs: Mapping[str, Path]) -> Path:
    return dirs["pages"] / "transfermarkt" / "fixture"


# (code, variant) → the first URL seen
def page_logos(folder: Path) -> dict[tuple[str, str], str]:
    found: dict[tuple[str, str], str] = {}
    for path in sorted(folder.glob("*.html")):
        text = path.read_text(encoding="utf-8")
        for url, variant, code in LOGO_SRC.findall(text):
            found.setdefault((code, variant), html.unescape(url))
    return found


def curated_path(dirs: Mapping[str, Path]) -> Path | None:
    return dirs["curation"] / CURATED if "curation" in dirs else None


# data/curation/logos.json: links found by hand
def read_curated(path: Path | None) -> dict[str, str]:
    if path is None or not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    links = data.get("links") if isinstance(data, dict) else None
    if not isinstance(links, dict) or not all(
        isinstance(slug, str) and isinstance(url, str) for slug, url in links.items()
    ):
        raise InvalidLogoLinksError(f'{path}: expected {{"links": {{slug: url}}}}')
    for slug, url in links.items():
        if image_from_url(url) != ("logo", slug):
            raise InvalidLogoLinksError(
                f"{path}: links.{slug} is not a Transfermarkt logo of {slug}"
            )
    return links


# One per pool competition; a curated link wins
def logo_links(
    config: PoolConfig,
    slugs: Mapping[str, str],
    pages: Mapping[tuple[str, str], str],
    curated: Mapping[str, str],
) -> LogoLinks:
    found = LogoLinks()
    for competition in config["competitions"]:
        code = competition["code"].lower()
        slug = slugs.get(code)
        if slug is None:
            continue
        seen = (pages[(code, v)] for v in VARIANTS if (code, v) in pages)
        url = curated.get(slug) or next(seen, None)
        if url is None:
            fixture = listing_url(competition, season_ids(competition)[-1])
            found.no_link.append((slug, fixture))
            continue
        found.links.append(link(url, group="logos", competition=competition["code"]))
    return found


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    config_path: Path = POOL_CONFIG,
) -> int:
    if argv:
        print("usage: python -m extract.lists.logos", file=sys.stderr)
        return 2
    try:
        config = read_pool_config(config_path)
        curated = read_curated(curated_path(dirs))
    except (InvalidPoolConfigError, InvalidLogoLinksError) as error:
        print(error, file=sys.stderr)
        return 1
    found = logo_links(config, logo_slugs(), page_logos(fixture_dir(dirs)), curated)
    write_link_list(dirs["work"] / LINK_LISTS, LOGOS, found.links)
    print(f"{LOGOS}: {len(found.links)} logos -> {show(dirs, LOGOS)}")
    for slug, fixture in found.no_link:
        print(f"  no logo link for {slug}: find one on {fixture}")
        print("    and add it to data/curation/logos.json")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
