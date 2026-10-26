import pytest
from scrapy import Request
from scrapy.exceptions import IgnoreRequest
from scrapy.http import HtmlResponse, JsonResponse, Response

from extract.middlewares import BlockGuard, is_challenge_html, is_never_fetched

URL = "https://www.transfermarkt.com/spielbericht/index/spielbericht/1"


class Recorder:
    def __init__(self) -> None:
        self.closed: list[str] = []
        self.paused: list[float] = []

    def guard(self) -> BlockGuard:
        return BlockGuard(self.closed.append, self.paused.append)


def page(status: int, body: str = "<html></html>", **headers: str) -> Response:
    return HtmlResponse(
        URL, status=status, body=body.encode(), headers=headers, encoding="utf-8"
    )


def test_passes_an_ordinary_page() -> None:
    recorder = Recorder()
    response = page(200)
    assert recorder.guard().process_response(Request(URL), response) is response
    assert recorder.closed == [] and recorder.paused == []


@pytest.mark.parametrize(
    "response",
    [
        page(403),
        page(200, "<title>Just a moment...</title>"),
        page(200, '<script src="/cdn-cgi/challenge-platform/cf-chl"></script>'),
        page(503, "Please solve the CAPTCHA"),
    ],
)
def test_stops_at_once_on_a_block(response: Response) -> None:
    recorder = Recorder()
    with pytest.raises(IgnoreRequest):
        recorder.guard().process_response(Request(URL), response)
    assert recorder.closed == ["blocked"]


# The shape Transfermarkt served on 2026-10-26, token removed
AWS_WAF_BODY = (
    '<script src="https://x.token.awswaf.com/x/challenge.js"></script>'
    '<div id="challenge-container"></div>'
)


@pytest.mark.parametrize(
    "response",
    [
        page(202, AWS_WAF_BODY, **{"X-Amzn-Waf-Action": "challenge"}),
        page(202, "<html></html>"),
        page(200, "<html></html>", **{"X-Amzn-Waf-Action": "captcha"}),
        page(200, AWS_WAF_BODY),
    ],
)
def test_stops_on_an_aws_waf_challenge(response: Response) -> None:
    recorder = Recorder()
    with pytest.raises(IgnoreRequest):
        recorder.guard().process_response(Request(URL), response)
    assert recorder.closed == ["blocked"]


def test_honours_retry_after_and_lets_retry_run() -> None:
    recorder = Recorder()
    response = page(429, **{"Retry-After": "12"})
    assert recorder.guard().process_response(Request(URL), response) is response
    assert recorder.paused == [12.0]
    assert recorder.closed == []


def test_caps_a_long_retry_after() -> None:
    recorder = Recorder()
    recorder.guard().process_response(Request(URL), page(429, **{"Retry-After": "900"}))
    assert recorder.paused == [300]


@pytest.mark.parametrize("value", [None, "Wed, 21 Oct 2026 07:28:00 GMT"])
def test_leaves_backoff_to_retry_without_seconds(value: str | None) -> None:
    recorder = Recorder()
    headers = {} if value is None else {"Retry-After": value}
    recorder.guard().process_response(Request(URL), page(429, **headers))
    assert recorder.paused == []


def test_stops_after_three_429s_in_a_row() -> None:
    recorder = Recorder()
    guard = recorder.guard()
    guard.process_response(Request(URL), page(429))
    guard.process_response(Request(URL), page(429))
    with pytest.raises(IgnoreRequest):
        guard.process_response(Request(URL), page(429))
    assert recorder.closed == ["blocked_429"]


def test_a_good_page_resets_the_429_count() -> None:
    recorder = Recorder()
    guard = recorder.guard()
    for status in (429, 429, 200, 429, 429):
        guard.process_response(Request(URL), page(status))
    assert recorder.closed == []


@pytest.mark.parametrize(
    "url",
    [
        "https://www.transfermarkt.com/spielbericht/index/spielbericht/1",
        "https://transfermarkt.com/x",
        "https://www.TRANSFERMARKT.com/x",
    ],
)
def test_never_requests_transfermarkt(url: str) -> None:
    recorder = Recorder()
    assert is_never_fetched(url)
    with pytest.raises(IgnoreRequest):
        recorder.guard().process_request(Request(url))
    assert recorder.closed == ["forbidden_source"]


@pytest.mark.parametrize(
    "url",
    [
        "https://en.wikipedia.org/wiki/Transfermarkt",
        "https://www.wikidata.org/wiki/Q1",
        "https://transfermarkt.com.example.org/x",
    ],
)
def test_lets_other_hosts_through(url: str) -> None:
    recorder = Recorder()
    recorder.guard().process_request(Request(url))
    assert recorder.closed == []


def test_a_large_real_page_mentioning_captcha_passes() -> None:
    recorder = Recorder()
    body = "<html>" + "<p>The CAPTCHA article.</p>" * 2_000 + "</html>"
    response = page(200, body)
    assert recorder.guard().process_response(Request(URL), response) is response
    assert recorder.closed == []


def test_api_json_mentioning_a_challenge_passes() -> None:
    recorder = Recorder()
    response = JsonResponse(
        "https://en.wikipedia.org/w/api.php",
        body=b'{"extract": "Just a moment... captcha challenge.js"}',
    )
    assert recorder.guard().process_response(Request(URL), response) is response
    assert recorder.closed == []


def test_challenge_html_check_for_saved_pages() -> None:
    assert is_challenge_html(AWS_WAF_BODY)
    assert not is_challenge_html("<h1>Juventus FC</h1>")
    assert not is_challenge_html("<p>captcha</p>" * 5_000)
