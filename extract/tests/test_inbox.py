import json
import os
import shutil
from pathlib import Path

import pytest

from extract.inbox import RefusedPageError, Report, classify, import_inbox, main

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "transfermarkt"
SAVED_AT = 1_793_059_200  # 2026-10-27T00:00:00Z
TM = "https://www.transfermarkt.com"


class Dirs:
    def __init__(self, root: Path) -> None:
        self.inbox = root / "inbox"
        self.pages = root / "pages"
        self.raw = root / "raw"
        self.inbox.mkdir()

    def save(self, fixture: str, as_name: str | None = None) -> Path:
        target = self.inbox / (as_name or f"{fixture}.html")
        shutil.copyfile(FIXTURES / f"{fixture}.html", target)
        os.utime(target, (SAVED_AT, SAVED_AT))
        return target

    def run(self, expect: Path | None = None) -> Report:
        return import_inbox(self.inbox, self.pages, self.raw, "probe", expect)


@pytest.fixture
def dirs(tmp_path: Path) -> Dirs:
    return Dirs(tmp_path)


def test_imports_and_files_each_kind(dirs: Dirs) -> None:
    dirs.save("fixtures-it1-2000", "anything.html")
    dirs.save("match-990248", "Kaydet.htm")
    dirs.save("player-411295")

    report = dirs.run()

    assert dict(report.imported) == {"fixture": 1, "match": 1, "player": 1}
    assert report.refused == []
    assert list(dirs.inbox.iterdir()) == []
    stored = sorted(
        p.relative_to(dirs.pages).as_posix() for p in dirs.pages.rglob("*.html")
    )
    assert stored == [
        "transfermarkt/fixture/it1-2000.html",
        "transfermarkt/match/990248.html",
        "transfermarkt/player/411295.html",
    ]
    fixtures = (dirs.raw / "transfermarkt" / "fixture" / "it1-2000.ndjson").read_text()
    assert len(fixtures.splitlines()) == 306
    match_line = (dirs.raw / "transfermarkt" / "match" / "probe.ndjson").read_text()
    assert json.loads(match_line)["fetchedAt"] == "2026-10-27T00:00:00Z"


def test_files_the_world_cup_under_its_redirected_code(dirs: Dirs) -> None:
    dirs.save("fixtures-wm06")
    dirs.run()
    assert (dirs.pages / "transfermarkt" / "fixture" / "fiwc-2005.html").exists()


def test_skips_an_identical_page_saved_twice(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    dirs.save("match-990248", "again.html")

    report = dirs.run()

    assert report.duplicates == ["again.html"]
    assert not report.imported
    assert list(dirs.inbox.iterdir()) == []
    lines = (dirs.raw / "transfermarkt" / "match" / "probe.ndjson").read_text()
    assert len(lines.splitlines()) == 1


def test_leaves_a_differing_page_with_the_same_key(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    changed = dirs.save("match-990248", "changed.html")
    changed.write_text(
        changed.read_text(encoding="utf-8") + "<!-- x -->", encoding="utf-8"
    )

    report = dirs.run()

    assert report.refused == [
        ("changed.html", "differs from the stored page 990248.html")
    ]
    assert changed.exists()


@pytest.mark.parametrize(
    ("body", "reason"),
    [
        (
            '<script src="https://x.token.awswaf.com/x/challenge.js"></script>',
            "challenge page",
        ),
        ("<html><title>Some site</title></html>", "no og:url"),
        (
            '<meta property="og:url" content="https://www.transfermarkt.com/x/startseite/verein/1">',
            "unknown page type",
        ),
    ],
)
def test_refuses_and_keeps_pages_it_cannot_use(
    dirs: Dirs, body: str, reason: str
) -> None:
    bad = dirs.inbox / "bad.html"
    bad.write_text(body, encoding="utf-8")

    report = dirs.run()

    assert len(report.refused) == 1 and report.refused[0][1].startswith(reason)
    assert bad.exists()
    assert not dirs.raw.exists()


def test_a_broken_page_writes_nothing(dirs: Dirs) -> None:
    broken = dirs.save("match-990248")
    broken.write_text(
        broken.read_text(encoding="utf-8").replace("formation-player-container", "x"),
        encoding="utf-8",
    )

    report = dirs.run()

    assert report.refused and "formation-player-container" in report.refused[0][1]
    assert broken.exists()
    assert not dirs.raw.exists()


def test_lists_links_not_yet_saved(dirs: Dirs, tmp_path: Path) -> None:
    dirs.save("match-990248")
    links = tmp_path / "links.md"
    links.write_text(
        "- https://www.transfermarkt.com/spielbericht/index/spielbericht/990248\n"
        "- https://www.transfermarkt.com/a_b/index/spielbericht/1153409\n",
        encoding="utf-8",
    )

    report = dirs.run(expect=links)

    assert report.missing == [
        "https://www.transfermarkt.com/a_b/index/spielbericht/1153409"
    ]


@pytest.mark.parametrize(
    ("url", "kind", "key"),
    [
        (
            "https://www.transfermarkt.com/serie-a/gesamtspielplan/wettbewerb/IT1?saison_id=2000",
            "fixture",
            "it1-2000",
        ),
        (
            "https://www.transfermarkt.com/x/gesamtspielplan/pokalwettbewerb/CL/saison_id/2023",
            "fixture",
            "cl-2023",
        ),
        (
            "https://www.transfermarkt.com/x/gesamtspielplan/pokalwettbewerb/FIWC",
            "fixture",
            "fiwc",
        ),
        (
            "https://www.transfermarkt.com/spielbericht/index/spielbericht/990248",
            "match",
            "990248",
        ),
        (
            "https://www.transfermarkt.com/raphinha/profil/spieler/411295",
            "player",
            "411295",
        ),
    ],
)
def test_classifies_a_page_by_its_url(url: str, kind: str, key: str) -> None:
    page = classify(url)
    assert (page.kind, page.key) == (kind, key)


def test_refuses_an_unknown_url() -> None:
    with pytest.raises(RefusedPageError, match="unknown page type"):
        classify("https://www.transfermarkt.com/laurent-blanc/profil/trainer/4589")


def test_exit_code_is_one_when_a_page_is_refused(dirs: Dirs) -> None:
    folders = {"inbox": dirs.inbox, "pages": dirs.pages, "raw": dirs.raw}
    dirs.save("player-411295")
    assert main([], folders) == 0
    (dirs.inbox / "bad.html").write_text("<html></html>", encoding="utf-8")
    assert main([], folders) == 1


def test_refuses_a_page_from_another_site(dirs: Dirs) -> None:
    other = dirs.inbox / "other.html"
    other.write_text(
        '<meta property="og:url" content="https://example.org/a/index/spielbericht/1">',
        encoding="utf-8",
    )

    report = dirs.run()

    assert report.refused == [("other.html", "og:url is not on www.transfermarkt.com")]
    assert other.exists()


def test_a_link_list_survives_markdown_and_unknown_links(
    dirs: Dirs, tmp_path: Path
) -> None:
    links = tmp_path / "links.md"
    links.write_text(
        f"| 1 | [match]({TM}/spielbericht/index/spielbericht/7) |\n"
        f"- {TM}/laurent-blanc/profil/trainer/4589\n",
        encoding="utf-8",
    )

    report = dirs.run(expect=links)

    assert report.missing == [
        f"{TM}/spielbericht/index/spielbericht/7",
        f"{TM}/laurent-blanc/profil/trainer/4589 (unrecognised link)",
    ]


def test_refuses_a_file_that_is_not_utf8(dirs: Dirs) -> None:
    latin = dirs.inbox / "latin.html"
    latin.write_bytes("<html>Çalhanoğlu</html>".encode("utf-16"))

    report = dirs.run()

    assert [name for name, _ in report.refused] == ["latin.html"]
    assert latin.exists()


def test_a_bad_partition_refuses_without_writing(dirs: Dirs) -> None:
    dirs.save("match-990248")

    report = import_inbox(dirs.inbox, dirs.pages, dirs.raw, "../escape")

    assert report.refused == [
        ("match-990248.html", "Invalid partition name for transfermarkt-match")
    ]
    assert not dirs.raw.exists()
    assert not dirs.pages.exists()
