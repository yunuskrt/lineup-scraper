import json

import pytest

from extract.links import LINK_LISTS, link, read_link_list, write_link_list
from extract.pages import snapshot
from extract.progress import main, progress, share
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
PARSED = f"{TM}/spielbericht/index/spielbericht/990248"
UNPARSED = f"{TM}/raphinha/profil/spieler/411295"
IN_INBOX = f"{TM}/a_b/index/spielbericht/1153409"
MISSING = f"{TM}/spielbericht/index/spielbericht/53491"


@pytest.fixture
def sample(dirs: Dirs) -> Dirs:
    dirs.save("match-990248")
    dirs.save("player-411295")
    dirs.run()
    # As if data/raw/ had been cleared for players
    (dirs.raw / "transfermarkt" / "player" / "probe.ndjson").unlink()
    dirs.save("match-1153409")
    write_link_list(
        dirs.work / LINK_LISTS,
        "sample",
        [
            link(PARSED, group="finals"),
            link(UNPARSED, group="finals"),
            link(IN_INBOX, group="derbies"),
            link(MISSING),
        ],
    )
    return dirs


def test_counts_each_stage(sample: Dirs) -> None:
    links = read_link_list(sample.work / LINK_LISTS / "sample.json")
    state = snapshot(sample.inbox, sample.pages, sample.raw)

    result = progress("sample", links, state, None)

    assert result["tally"] == {
        "total": 4,
        "imported": 2,
        "parsed": 1,
        "inInbox": 1,
        "missing": 1,
        "unparsed": ["player:411295"],
    }
    assert result["by"] == {}


def test_share_formats_counts_and_percentages() -> None:
    assert share(23, 1000) == "23/1000 (2.3%)"
    assert share(8, 9) == "8/9 (88.9%)"
    assert share(0, 0) == "0/0 (0.0%)"


def test_by_splits_counts_and_names_entries_without_the_field(
    sample: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["--by", "group", "--json"], sample.folders()) == 0

    (result,) = json.loads(capsys.readouterr().out)["lists"]
    assert {label: t["total"] for label, t in result["by"].items()} == {
        "(none)": 1,
        "derbies": 1,
        "finals": 2,
    }
    assert result["by"]["finals"]["parsed"] == 1


def test_prints_a_readable_report(
    sample: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["sample"], sample.folders()) == 0

    out = capsys.readouterr().out
    assert "sample (4 pages)" in out
    assert "imported  2/4 (50.0%)" in out
    assert "missing   1/4 (25.0%)" in out
    assert "imported but not parsed: player:411295" in out


def test_no_lists_and_unknown_lists(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([], dirs.folders()) == 0
    assert "no link lists" in capsys.readouterr().out
    assert main(["nothing"], dirs.folders()) == 1


def test_the_text_report_splits_by_a_field(
    sample: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main(["sample", "--by", "group"], sample.folders()) == 0

    lines = capsys.readouterr().out.splitlines()
    finals = lines.index("  finals")
    assert lines[finals + 1] == "    imported  2/2 (100.0%)"
    assert lines[finals + 2] == "    parsed    1/2 (50.0%)"
    assert "    imported but not parsed: player:411295" in lines[finals:]
    assert lines.index("  (none)") < lines.index("  derbies") < finals


IMG = "https://img.a.transfermarkt.technology"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8


def test_counts_images_once_filed(dirs: Dirs) -> None:
    (dirs.inbox / "27_1.png").write_bytes(PNG)
    dirs.run()
    (dirs.inbox / "206-1.jpg").write_bytes(b"\xff\xd8\xff")
    links = [
        link(f"{IMG}/wappen/normquad/27_1.png"),
        link(f"{IMG}/portrait/header/206-1.jpg"),
        link(f"{IMG}/portrait/header/s_7573_123_2012_1.jpg"),
    ]
    state = snapshot(dirs.inbox, dirs.pages, dirs.raw, dirs.images)

    tally = progress("images", links, state, None)["tally"]

    assert (tally["imported"], tally["parsed"]) == (1, 1)
    assert (tally["inInbox"], tally["missing"]) == (1, 1)
    # An image has nothing to parse
    assert tally["unparsed"] == []
