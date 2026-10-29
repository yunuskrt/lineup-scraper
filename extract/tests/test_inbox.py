import json
from pathlib import Path

import pytest

from extract.import_log import LogLine, read_log
from extract.inbox import backfill_log, import_inbox, main
from extract.pages import RefusedPageError, classify
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"


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
    dirs.save("player-411295")
    folders = dirs.folders()
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


def test_logs_one_line_per_file_with_the_run_time(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    dirs.save("match-990248", "again.html")
    (dirs.inbox / "bad.html").write_text(
        '<meta property="og:url" content="https://www.transfermarkt.com/x/startseite/verein/1">',
        encoding="utf-8",
    )

    dirs.run()

    lines = read_log(dirs.log)
    assert [(line["file"], line["result"]) for line in lines] == [
        ("match-990248.html", "imported"),
        ("again.html", "duplicate"),
        ("bad.html", "refused"),
    ]
    assert {line["at"] for line in lines} == {"2026-10-27T12:00:00Z"}
    imported, duplicate, refused = lines
    assert (imported["kind"], imported["key"], imported["records"]) == (
        "match",
        "990248",
        1,
    )
    assert imported["url"] == f"{TM}/spielbericht/index/spielbericht/990248"
    assert duplicate["records"] == 0
    assert refused["url"] == f"{TM}/x/startseite/verein/1"
    assert refused["kind"] is None
    assert refused["reason"] is not None
    assert refused["reason"].startswith("unknown page type")
    assert not any(line["backfilled"] for line in lines)


def test_a_refused_page_with_a_known_key_logs_it(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    changed = dirs.save("match-990248", "changed.html")
    changed.write_text(
        changed.read_text(encoding="utf-8") + "<!-- x -->", encoding="utf-8"
    )

    dirs.run()

    last = read_log(dirs.log)[-1]
    assert (last["result"], last["kind"], last["key"]) == ("refused", "match", "990248")


def test_the_log_holds_no_page_text(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.save("player-411295")

    dirs.run()

    text = dirs.log.read_text(encoding="utf-8")
    assert "Kahn" not in text and "Raphinha" not in text
    assert all(set(line) == set(LogLine.__annotations__) for line in read_log(dirs.log))


def test_an_empty_inbox_adds_no_log_lines(dirs: Dirs) -> None:
    dirs.run()
    dirs.run()
    assert not dirs.log.exists()


def test_backfill_logs_pages_imported_before_the_log(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.save("fixtures-cl-2000")
    import_inbox(dirs.inbox, dirs.pages, dirs.raw, "probe")
    dirs.save("player-411295")
    dirs.run()

    assert main(["--backfill-log"], dirs.folders()) == 0

    backfilled = [line for line in read_log(dirs.log) if line["backfilled"]]
    assert [(line["kind"], line["key"], line["records"]) for line in backfilled] == [
        ("fixture", "cl-2000", 157),
        ("match", "990248", 1),
    ]
    assert {line["at"] for line in backfilled} == {"2026-10-27T00:00:00Z"}
    assert backfilled[1]["url"] == f"{TM}/spielbericht/index/spielbericht/990248"
    assert backfill_log(dirs.pages, dirs.raw, dirs.log) == 0


def raw_files(dirs: Dirs) -> dict[str, bytes]:
    root = dirs.raw / "transfermarkt"
    return {
        p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob("*.ndjson")
    }


def test_reparse_rebuilds_raw_records_from_the_stored_pages(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs.save("match-990248")
    dirs.save("match-53491")
    dirs.save("fixtures-cl-2000")
    dirs.run()
    fresh = raw_files(dirs)
    # Records written by an older parser, and a stray partition
    match_file = dirs.raw / "transfermarkt" / "match" / "probe.ndjson"
    old = [json.loads(line) for line in match_file.read_text().splitlines()]
    for record in old:
        del record["shootout"]
    match_file.write_text("".join(json.dumps(r) + "\n" for r in old))
    (dirs.raw / "transfermarkt" / "match" / "stray.ndjson").write_text("{}\n")

    assert main(["--reparse", "--partition", "probe"], dirs.folders()) == 0

    assert raw_files(dirs) == fresh
    assert "reparsed: 1 fixture, 2 match" in capsys.readouterr().out
    assert not dirs.log.read_text().count("reparse")


def test_reparse_changes_nothing_when_a_stored_page_fails(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs.save("match-990248")
    dirs.save("match-1118844")
    dirs.run()
    before = raw_files(dirs)
    stored = dirs.pages / "transfermarkt" / "match" / "990248.html"
    stored.write_text(
        stored.read_text(encoding="utf-8").replace("formation-player-container", "x"),
        encoding="utf-8",
    )

    assert main(["--reparse"], dirs.folders()) == 1

    assert raw_files(dirs) == before
    assert "raw records unchanged" in capsys.readouterr().err


PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
JPEG = b"\xff\xd8\xff\xe0" + b"\x00" * 8


def save_image(dirs: Dirs, name: str, data: bytes) -> None:
    (dirs.inbox / name).write_bytes(data)


def filed(dirs: Dirs) -> list[str]:
    return sorted(
        p.relative_to(dirs.images).as_posix() for p in dirs.images.rglob("*.*")
    )


def test_files_crests_and_photos_by_id(dirs: Dirs) -> None:
    save_image(dirs, "27_1400571853.png", PNG)
    save_image(dirs, "crest-36.png", PNG + b"36")
    save_image(dirs, "206-1663667692.jpg", JPEG)
    save_image(dirs, "s_7573_123_2012_1.jpg", JPEG + b"7573")

    report = dirs.run()

    assert dict(report.imported) == {"crest": 2, "photo": 2}
    assert report.refused == []
    assert list(dirs.inbox.iterdir()) == []
    assert filed(dirs) == [
        "transfermarkt/crest/27.png",
        "transfermarkt/crest/36.png",
        "transfermarkt/photo/206.jpg",
        "transfermarkt/photo/7573.jpg",
    ]
    lines = read_log(dirs.log)
    # Inbox order: by file name
    assert [(line["kind"], line["key"], line["result"]) for line in lines] == [
        ("photo", "206", "imported"),
        ("crest", "27", "imported"),
        ("crest", "36", "imported"),
        ("photo", "7573", "imported"),
    ]


def test_files_by_the_bytes_not_the_name(dirs: Dirs) -> None:
    save_image(dirs, "photo-411295.jpg", PNG)
    dirs.run()
    assert filed(dirs) == ["transfermarkt/photo/411295.png"]


def test_skips_the_same_image_and_replaces_a_new_one(dirs: Dirs) -> None:
    save_image(dirs, "27_1.png", PNG)
    dirs.run()
    save_image(dirs, "crest-27.png", PNG)
    again = dirs.run()
    save_image(dirs, "crest-27.jpg", JPEG)
    newer = dirs.run()

    assert again.duplicates == ["crest-27.png"]
    assert dict(newer.imported) == {"crest": 1}
    assert filed(dirs) == ["transfermarkt/crest/27.jpg"]
    results = [(line["result"], line["reason"]) for line in read_log(dirs.log)]
    assert results[-1] == ("imported", "replaced the filed image")


@pytest.mark.parametrize(
    ("name", "data", "reason"),
    [
        ("27_1.png", b"<!DOCTYPE html><html></html>", "an HTML page"),
        ("27_1.png", b"", "empty file"),
        ("36.png", PNG, "rename it crest-36 or photo-36"),
        ("kahn.jpg", JPEG, "unknown image name"),
    ],
)
def test_refuses_and_keeps_a_bad_image(
    dirs: Dirs, name: str, data: bytes, reason: str
) -> None:
    save_image(dirs, name, data)

    report = dirs.run()

    assert [n for n, _ in report.refused] == [name]
    assert reason in report.refused[0][1]
    assert (dirs.inbox / name).exists()
    assert filed(dirs) == []
    assert read_log(dirs.log)[-1]["result"] == "refused"
    assert main([], dirs.folders()) == 1


def test_counts_saved_images_against_an_expected_list(dirs: Dirs) -> None:
    save_image(dirs, "27_1.png", PNG)
    expect = dirs.work / "expect.md"
    expect.parent.mkdir(parents=True)
    expect.write_text(
        "| https://img.a.transfermarkt.technology/wappen/normquad/27_1.png?lm=1 |\n"
        "| https://img.a.transfermarkt.technology/portrait/header/206-1.jpg |\n",
        encoding="utf-8",
    )

    report = dirs.run(expect)

    assert report.missing == [
        "https://img.a.transfermarkt.technology/portrait/header/206-1.jpg"
    ]


def test_leaves_images_waiting_without_an_images_folder(dirs: Dirs) -> None:
    save_image(dirs, "27_1.png", PNG)
    dirs.save("match-990248")

    report = import_inbox(dirs.inbox, dirs.pages, dirs.raw, "probe")

    assert dict(report.imported) == {"match": 1}
    assert [p.name for p in dirs.inbox.iterdir()] == ["27_1.png"]
