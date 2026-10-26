import pytest
from scrapy.http import HtmlResponse

from extract.http import MissingDateError, fetched_at

URL = "https://www.transfermarkt.com/spielbericht/index/spielbericht/1"


def test_uses_the_date_header_in_utc() -> None:
    response = HtmlResponse(URL, headers={"Date": "Mon, 26 Oct 2026 10:15:30 GMT"})
    assert fetched_at(response) == "2026-10-26T10:15:30Z"


def test_converts_an_offset_date_to_utc() -> None:
    response = HtmlResponse(URL, headers={"Date": "Mon, 26 Oct 2026 13:15:30 +0300"})
    assert fetched_at(response) == "2026-10-26T10:15:30Z"


def test_refuses_a_response_without_a_date() -> None:
    with pytest.raises(MissingDateError, match="No Date header"):
        fetched_at(HtmlResponse(URL))
