from extract.pages import PageId, raw_counts, snapshot
from extract.tests.saved_pages import Dirs


def test_status_follows_a_page_from_inbox_to_parsed(dirs: Dirs) -> None:
    dirs.save("match-990248")
    page: PageId = ("match", "990248")

    assert snapshot(dirs.inbox, dirs.pages, dirs.raw).status(page) == "inbox"
    dirs.run()
    assert snapshot(dirs.inbox, dirs.pages, dirs.raw).status(page) == "parsed"
    (dirs.raw / "transfermarkt" / "match" / "probe.ndjson").unlink()
    assert snapshot(dirs.inbox, dirs.pages, dirs.raw).status(page) == "imported"
    assert snapshot(dirs.inbox, dirs.pages, dirs.raw).status(("match", "1")) == (
        "missing"
    )


def test_counts_records_per_page_and_partition(dirs: Dirs) -> None:
    dirs.save("fixtures-cl-2000")
    dirs.save("player-411295")
    dirs.run()

    counts = raw_counts(dirs.raw)

    assert counts[("fixture", "cl-2000")] == {"cl-2000.ndjson": 157}
    assert counts[("player", "411295")] == {"probe.ndjson": 1}


def test_an_unusable_inbox_file_is_ignored(dirs: Dirs) -> None:
    (dirs.inbox / "bad.html").write_text("<html></html>", encoding="utf-8")
    assert snapshot(dirs.inbox, dirs.pages, dirs.raw).inbox == {}
