import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Final, Literal

from parsel import Selector

from extract.images import (
    IMAGE_KINDS,
    ImageKind,
    image_files,
    image_from_url,
    name_id,
    save_as,
    stored_images,
)
from extract.middlewares import is_challenge_html
from extract.parsers.transfermarkt.common import (
    IMAGE_HOST,
    MATCH_ID,
    PLAYER_ID,
    id_in,
)

type PageKind = Literal["fixture", "match", "player"]
type Kind = PageKind | ImageKind
type PageId = tuple[Kind, str]
type Status = Literal["missing", "inbox", "imported", "parsed"]

PAGE_KINDS: Final[tuple[PageKind, ...]] = ("fixture", "match", "player")
KINDS: Final[tuple[Kind, ...]] = (*PAGE_KINDS, *IMAGE_KINDS)
COMPETITION: Final = re.compile(r"/(?:pokal)?wettbewerb/([A-Z0-9]+)")
SEASON: Final = re.compile(r"saison_id[=/]([0-9]+)")
OG_URL: Final = '//meta[@property="og:url"]/@content'
HOME: Final = "https://www.transfermarkt.com/"
PAGE_SUFFIXES: Final = frozenset({".html", ".htm"})


class RefusedPageError(ValueError):
    pass


@dataclass(frozen=True)
class Page:
    kind: Kind
    key: str
    url: str

    @property
    def id(self) -> PageId:
        return (self.kind, self.key)

    @property
    def save_as(self) -> str:
        if self.kind == "crest" or self.kind == "photo":
            return save_as(self.kind, self.key, self.url)
        return f"{self.kind}-{self.key}.html"


def classify(url: str) -> Page:
    if url.startswith(IMAGE_HOST):
        image = image_from_url(url)
        if image is None:
            raise RefusedPageError("image link that is not a crest or a photo")
        return Page(image[0], image[1], url)
    if "/gesamtspielplan/" in url:
        code = id_in(url, COMPETITION)
        if code is None:
            raise RefusedPageError("fixture list without a competition code")
        season = id_in(url, SEASON)
        key = f"{code}-{season}" if season else code
        return Page("fixture", key.lower(), url)
    if (match_id := id_in(url, MATCH_ID)) is not None:
        return Page("match", match_id, url)
    if (player_id := id_in(url, PLAYER_ID)) is not None:
        return Page("player", player_id, url)
    raise RefusedPageError("unknown page type (not a fixture list, match or player)")


def og_url(html: str) -> str | None:
    return Selector(text=html).xpath(OG_URL).get() or None


def read_page(html: str) -> Page:
    if is_challenge_html(html):
        raise RefusedPageError("challenge page, save it again")
    url = og_url(html)
    if not url:
        raise RefusedPageError("no og:url: not a Transfermarkt page saved as HTML")
    if not url.startswith(HOME):
        raise RefusedPageError("og:url is not on www.transfermarkt.com")
    return classify(url)


def stored_path(pages_dir: Path, kind: Kind, key: str) -> Path:
    return pages_dir / "transfermarkt" / kind / f"{key}.html"


def inbox_files(inbox: Path) -> list[Path]:
    if not inbox.is_dir():
        return []
    return sorted(p for p in inbox.iterdir() if p.suffix.lower() in PAGE_SUFFIXES)


def stored_pages(pages_dir: Path) -> dict[PageId, Path]:
    found: dict[PageId, Path] = {}
    for kind in PAGE_KINDS:
        for path in sorted((pages_dir / "transfermarkt" / kind).glob("*.html")):
            found[(kind, path.stem)] = path
    return found


# Records per page, per raw partition
def raw_counts(raw_dir: Path) -> dict[PageId, Counter[str]]:
    counts: dict[PageId, Counter[str]] = {}
    base = raw_dir / "transfermarkt"
    # A fixture partition is the list page's key
    for path in sorted((base / "fixture").glob("*.ndjson")):
        lines = path.read_text(encoding="utf-8").splitlines()
        counts.setdefault(("fixture", path.stem), Counter())[path.name] += len(lines)
    for kind in ("match", "player"):
        for path in sorted((base / kind).glob("*.ndjson")):
            for line in path.read_text(encoding="utf-8").splitlines():
                key = str(json.loads(line)["sourceId"])
                counts.setdefault((kind, key), Counter())[path.name] += 1
    return counts


@dataclass(frozen=True)
class Snapshot:
    inbox: dict[PageId, str] = field(default_factory=dict)
    stored: dict[PageId, Path] = field(default_factory=dict)
    records: dict[PageId, Counter[str]] = field(default_factory=dict)

    def status(self, page: PageId) -> Status:
        if page in self.stored:
            # An image has nothing to parse
            if page[0] in IMAGE_KINDS or self.records.get(page):
                return "parsed"
            return "imported"
        return "inbox" if page in self.inbox else "missing"


def snapshot(
    inbox: Path, pages_dir: Path, raw_dir: Path, images_dir: Path | None = None
) -> Snapshot:
    waiting: dict[PageId, str] = {}
    for path in inbox_files(inbox):
        try:
            waiting.setdefault(
                read_page(path.read_text(encoding="utf-8")).id, path.name
            )
        except (RefusedPageError, UnicodeDecodeError):
            continue
    for path in image_files(inbox):
        if (image := name_id(path.name)) is not None:
            waiting.setdefault(image, path.name)
    stored: dict[PageId, Path] = {**stored_pages(pages_dir)}
    if images_dir is not None:
        for image, path in stored_images(images_dir).items():
            stored[image] = path
    return Snapshot(waiting, stored, raw_counts(raw_dir))
