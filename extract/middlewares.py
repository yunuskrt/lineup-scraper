import logging
from typing import Final, Self
from urllib.parse import urlsplit

from scrapy import Request
from scrapy.crawler import Crawler
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, Response

from extract.closing import CloseSpider, PauseEngine, engine_pauser, spider_closer

logger = logging.getLogger(__name__)

# Cloudflare and AWS WAF interstitials
CHALLENGE_MARKERS: Final = (
    "just a moment...",
    "cf-chl",
    "captcha",
    "awswaf",
    "challenge.js",
)
BLOCK_STATUSES: Final = (202, 403)
# Interstitials are small; real pages and API data aren't
MAX_CHALLENGE_BYTES: Final = 20_000
# Blocks automated clients; the user saves its pages
NEVER_FETCH_DOMAINS: Final = ("transfermarkt.com",)
MAX_RETRY_AFTER: Final = 300
MAX_CONSECUTIVE_429: Final = 3


# Also used on pages the user saved (S06b inbox)
def is_challenge_html(html: str) -> bool:
    if len(html.encode("utf-8")) > MAX_CHALLENGE_BYTES:
        return False
    text = html.lower()
    return any(marker in text for marker in CHALLENGE_MARKERS)


def is_block(response: Response) -> bool:
    if response.status in BLOCK_STATUSES:
        return True
    if response.headers.get("X-Amzn-Waf-Action") is not None:
        return True
    return isinstance(response, HtmlResponse) and is_challenge_html(response.text)


def is_never_fetched(url: str) -> bool:
    host = (urlsplit(url).hostname or "").lower()
    return any(host == d or host.endswith(f".{d}") for d in NEVER_FETCH_DOMAINS)


def retry_after(response: Response) -> float | None:
    value = response.headers.get("Retry-After")
    if value is None:
        return None
    try:
        return min(float(value.decode("ascii")), MAX_RETRY_AFTER)
    except ValueError:
        return None


# A technical block stops the spider; never a workaround
class BlockGuard:
    def __init__(self, close: CloseSpider, pause: PauseEngine) -> None:
        self._close = close
        self._pause = pause
        self._consecutive_429 = 0

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> Self:
        return cls(spider_closer(crawler), engine_pauser(crawler))

    def process_request(self, request: Request) -> None:
        if is_never_fetched(request.url):
            logger.error("forbidden_source: %s", request.url)
            self._close("forbidden_source")
            raise IgnoreRequest("forbidden_source")

    def process_response(self, request: Request, response: Response) -> Response:
        if is_block(response):
            self._stop("blocked", request, response)
        if response.status != 429:
            self._consecutive_429 = 0
            return response
        self._consecutive_429 += 1
        if self._consecutive_429 >= MAX_CONSECUTIVE_429:
            self._stop("blocked_429", request, response)
        delay = retry_after(response)
        if delay is not None:
            self._pause(delay)
        return response

    def _stop(self, reason: str, request: Request, response: Response) -> None:
        logger.error("%s: %s returned %s", reason, request.url, response.status)
        self._close(reason)
        raise IgnoreRequest(reason)
