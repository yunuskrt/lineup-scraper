import pytest

from extract.crawl import exit_code, parse_args
from extract.spiders.capture import parse_pages


def test_parses_a_spider_and_its_arguments() -> None:
    assert parse_args(
        ["transfermarkt_matches", "-a", "ids=1,2", "-a", "partition=x"]
    ) == (
        "transfermarkt_matches",
        {"ids": "1,2", "partition": "x"},
    )
    assert parse_args(["capture"]) == ("capture", {})


@pytest.mark.parametrize(
    "argv", [[], ["-a", "x=1"], ["spider", "-a"], ["spider", "-o", "out.json"]]
)
def test_refuses_bad_arguments(argv: list[str]) -> None:
    with pytest.raises(SystemExit):
        parse_args(argv)


@pytest.mark.parametrize(
    ("reason", "code"),
    [
        ("finished", 0),
        ("blocked", 1),
        ("blocked_429", 1),
        ("invalid_record", 1),
        ("shutdown", 1),
        (None, 1),
    ],
)
def test_only_a_finished_run_exits_zero(reason: object, code: int) -> None:
    assert exit_code(reason) == code


def test_parses_capture_pages() -> None:
    assert parse_pages(
        "article=https://en.wikipedia.org/wiki/2005_UEFA_Champions_League_final "
        "api=https://en.wikipedia.org/w/api.php?action=query&titles=A|B"
    ) == [
        ("article", "https://en.wikipedia.org/wiki/2005_UEFA_Champions_League_final"),
        ("api", "https://en.wikipedia.org/w/api.php?action=query&titles=A|B"),
    ]


@pytest.mark.parametrize(
    "pages",
    [
        "",
        "no-equals",
        "Bad=https://x.example/a",
        "a=http://x.example/plain-http",
        "a=/relative/path",
        "../up=https://x.example/a",
    ],
)
def test_refuses_bad_capture_pages(pages: str) -> None:
    with pytest.raises(ValueError):
        parse_pages(pages)


@pytest.mark.parametrize(
    "url",
    [
        "https://www.transfermarkt.com/spielbericht/index/spielbericht/1",
        "https://transfermarkt.com/x",
        "https://img.a.transfermarkt.technology.transfermarkt.com/x",
    ],
)
def test_refuses_transfermarkt_capture(url: str) -> None:
    with pytest.raises(ValueError, match="never fetched by code"):
        parse_pages(f"page={url}")
