from scrapy import Request
from scrapy.http import HtmlResponse
from scrapy.settings import Settings

from extract.cache import GuardedCachePolicy

URL = "https://www.transfermarkt.com/spielbericht/index/spielbericht/1"


def should_cache(status: int, body: str = "<html></html>", **headers: str) -> bool:
    response = HtmlResponse(
        URL, status=status, body=body.encode(), headers=headers, encoding="utf-8"
    )
    return GuardedCachePolicy(Settings()).should_cache_response(response, Request(URL))


def test_caches_an_ordinary_page() -> None:
    assert should_cache(200, "<h1>Juventus FC</h1>") is True


def test_never_caches_a_challenge() -> None:
    assert (
        should_cache(202, "<html></html>", **{"X-Amzn-Waf-Action": "challenge"})
        is False
    )
    assert should_cache(200, '<script src="/x/challenge.js"></script>') is False
    assert should_cache(403) is False
