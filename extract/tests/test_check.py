import pytest

from extract.check import main, parse_target
from extract.links import LINK_LISTS, link, write_link_list
from extract.pages import RefusedPageError
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
MATCH = f"{TM}/spielbericht/index/spielbericht/990248"


@pytest.mark.parametrize(
    ("target", "page"),
    [
        (MATCH, ("match", "990248")),
        ("match:990248", ("match", "990248")),
        ("player:411295", ("player", "411295")),
        ("fixture:CL-2000", ("fixture", "cl-2000")),
        ("crest:27", ("crest", "27")),
        (
            "https://img.a.transfermarkt.technology/portrait/header/206-1.jpg",
            ("photo", "206"),
        ),
    ],
)
def test_reads_a_link_or_kind_and_key(target: str, page: tuple[str, str]) -> None:
    assert parse_target(target) == page


@pytest.mark.parametrize("target", ["990248", "club:27", "match:"])
def test_refuses_other_targets(target: str) -> None:
    with pytest.raises(RefusedPageError, match="expected a Transfermarkt link"):
        parse_target(target)


def test_reports_every_location_of_a_parsed_page(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs.save("match-990248")
    dirs.run()
    write_link_list(dirs.work / LINK_LISTS, "sample", [link(MATCH)])

    assert main(["match:990248"], dirs.folders()) == 0

    out = capsys.readouterr().out
    assert "match:990248  parsed" in out
    assert "lists:   sample" in out
    assert "inbox:   no" in out
    assert "transfermarkt/match/990248.html" in out
    assert "records: probe.ndjson: 1" in out
    assert "2026-10-27T12:00:00Z imported (1 records)" in out


def test_a_page_in_the_inbox_is_not_done(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs.save("player-411295", "saved.html")

    assert main(["player:411295"], dirs.folders()) == 1

    out = capsys.readouterr().out
    assert "player:411295  inbox" in out
    assert "inbox:   saved.html" in out
    assert "log:     none" in out


def test_a_bad_target_exits_one(dirs: Dirs) -> None:
    assert main(["club:27"], dirs.folders()) == 1


def test_reports_a_filed_image(dirs: Dirs, capsys: pytest.CaptureFixture[str]) -> None:
    (dirs.inbox / "crest-36.png").write_bytes(b"\x89PNG\r\n\x1a\n")
    dirs.run()

    assert main(["crest:36"], dirs.folders()) == 0

    out = capsys.readouterr().out
    assert "crest:36  parsed" in out
    assert "transfermarkt/crest/36.png" in out
    assert "2026-10-27T12:00:00Z imported (0 records)" in out
