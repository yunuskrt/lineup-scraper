import asyncio
from pathlib import Path

import pytest
from scrapy import Request
from scrapy.http import HtmlResponse

from extract.spiders import capture
from extract.spiders.capture import CaptureSpider

PAGES = "article=https://en.wikipedia.org/wiki/A api=https://en.wikipedia.org/w/api.php"


def test_requests_each_page_with_its_fixture_name() -> None:
    spider = CaptureSpider(source="wikipedia", pages=PAGES)

    async def collect() -> list[Request]:
        return [request async for request in spider.start()]

    requests = asyncio.run(collect())
    assert [(r.url, r.cb_kwargs["fixture"]) for r in requests] == [
        ("https://en.wikipedia.org/wiki/A", "article"),
        ("https://en.wikipedia.org/w/api.php", "api"),
    ]


def test_writes_the_body_unchanged(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(capture, "FIXTURES_ROOT", tmp_path)
    spider = CaptureSpider(source="wikipedia", pages=PAGES)
    body = "<h1>Ğ İ ş</h1>\r\n".encode()
    response = HtmlResponse("https://en.wikipedia.org/wiki/A", body=body)

    spider.parse(response, fixture="article")

    assert (tmp_path / "wikipedia" / "article.html").read_bytes() == body


@pytest.mark.parametrize("source", ["", "Wiki", "../up", "a/b"])
def test_refuses_a_bad_source_folder(source: str) -> None:
    with pytest.raises(ValueError, match="source"):
        CaptureSpider(source=source, pages=PAGES)
