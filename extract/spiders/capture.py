import re
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Final

import scrapy
from scrapy.http import Response

from extract.middlewares import is_never_fetched

FIXTURES_ROOT: Final = Path(__file__).resolve().parent.parent / "tests" / "fixtures"
NAME: Final = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def parse_pages(pages: str) -> list[tuple[str, str]]:
    parsed = []
    for entry in pages.split():
        name, sep, url = entry.partition("=")
        if not sep or not NAME.match(name) or not url.startswith("https://"):
            raise ValueError(f"Bad page entry {entry!r}: use name=https://...")
        if is_never_fetched(url):
            raise ValueError(f"{url} is never fetched by code; save it by hand")
        parsed.append((name, url))
    if not parsed:
        raise ValueError("No pages: pass -a pages='name=https://... name=...'")
    return parsed


# Saves responses as parser fixtures; yields no records
class CaptureSpider(scrapy.Spider):
    name = "capture"

    # Scrapy passes every -a argument as a string
    def __init__(self, source: str = "", pages: str = "", **kwargs: str) -> None:
        super().__init__(**kwargs)
        if not NAME.match(source):
            raise ValueError("Pass -a source=<folder>, such as wikipedia")
        self.folder = FIXTURES_ROOT / source
        self.pages = parse_pages(pages)

    async def start(self) -> AsyncIterator[scrapy.Request]:
        for fixture, url in self.pages:
            yield scrapy.Request(url, cb_kwargs={"fixture": fixture})

    def parse(self, response: Response, fixture: str) -> None:
        self.folder.mkdir(parents=True, exist_ok=True)
        (self.folder / f"{fixture}.html").write_bytes(response.body)
        self.logger.info("saved %s (%d bytes)", fixture, len(response.body))
