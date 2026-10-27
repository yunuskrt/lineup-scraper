import json

import pytest

from extract.links import (
    LINK_LISTS,
    link,
    main,
    open_next,
    read_link_list,
    show,
    write_link_list,
)
from extract.pages import RefusedPageError
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
MATCH = f"{TM}/spielbericht/index/spielbericht/990248"
OTHER_MATCH = f"{TM}/spielbericht/index/spielbericht/53491"
PLAYER = f"{TM}/raphinha/profil/spieler/411295"
FIXTURES = f"{TM}/super-lig/gesamtspielplan/wettbewerb/TR1?saison_id=2005"


def test_kind_key_and_save_as_come_from_the_link() -> None:
    assert link(MATCH).page.save_as == "match-990248.html"
    assert link(PLAYER).page.save_as == "player-411295.html"
    fixture = link(FIXTURES).page
    assert (fixture.kind, fixture.key, fixture.save_as) == (
        "fixture",
        "tr1-2005",
        "fixture-tr1-2005.html",
    )


@pytest.mark.parametrize(
    ("url", "reason"),
    [
        ("https://example.org/a/index/spielbericht/1", "not a single www"),
        (f"{MATCH}\n{PLAYER}", "not a single www"),
        (f"{TM}/laurent-blanc/profil/trainer/4589", "unknown page type"),
    ],
)
def test_refuses_a_link_it_cannot_file(url: str, reason: str) -> None:
    with pytest.raises(RefusedPageError, match=reason):
        link(url)


def test_writes_each_page_once_in_order(dirs: Dirs) -> None:
    lists = dirs.work / LINK_LISTS
    links = [
        link(PLAYER, group="pilot"),
        link(MATCH, competition="ucl", season="2000-01"),
        link(f"{TM}/a_b/index/spielbericht/990248"),
    ]

    path = write_link_list(lists, "sample", links)
    first = path.read_bytes()
    write_link_list(lists, "sample", links)

    assert path.read_bytes() == first
    assert first.endswith(b"]\n")
    entries = json.loads(first)
    assert entries == [
        {
            "group": "pilot",
            "key": "411295",
            "kind": "player",
            "saveAs": "player-411295.html",
            "url": PLAYER,
        },
        {
            "competition": "ucl",
            "key": "990248",
            "kind": "match",
            "saveAs": "match-990248.html",
            "season": "2000-01",
            "url": MATCH,
        },
    ]
    assert read_link_list(path) == links[:2]


def test_refuses_a_list_name_with_a_path(dirs: Dirs) -> None:
    with pytest.raises(ValueError, match="Invalid link list name"):
        write_link_list(dirs.work / LINK_LISTS, "../escape", [link(MATCH)])


def test_show_lists_only_what_is_still_to_save(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    dirs.save("player-411295")
    write_link_list(
        dirs.work / LINK_LISTS,
        "sample",
        [link(MATCH), link(PLAYER), link(OTHER_MATCH)],
    )

    text = show(dirs.folders(), "sample").read_text(encoding="utf-8")

    assert "Saved: 1/3. Still to save: 2." in text
    assert MATCH not in text
    assert f"| 1 | {PLAYER} | `player-411295.html` | `data/inbox/` | in inbox" in text
    assert (
        f"| 2 | {OTHER_MATCH} | `match-53491.html` | `data/inbox/` | to save |" in text
    )


def test_open_hands_only_unsaved_links_to_the_browser(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    dirs.save("player-411295")
    extra = f"{TM}/spielbericht/index/spielbericht/1"
    write_link_list(
        dirs.work / LINK_LISTS,
        "sample",
        [link(u) for u in (MATCH, PLAYER, OTHER_MATCH, extra)],
    )
    opened: list[str] = []

    pages = open_next(dirs.folders(), "sample", 1, opened.append)

    assert opened == [OTHER_MATCH]
    assert [page.save_as for page in pages] == ["match-53491.html"]


def test_cli_makes_a_list_and_reports_errors(dirs: Dirs) -> None:
    folders = dirs.folders()
    opened: list[str] = []

    assert main(["new", "sample", MATCH, PLAYER], folders) == 0
    assert (dirs.work / "inbox-lists" / "sample.md").exists()
    assert main(["open", "sample", "--count", "5"], folders, opened.append) == 0
    assert opened == [MATCH, PLAYER]
    assert main(["new", "bad", "https://example.org/x"], folders) == 1
    with pytest.raises(SystemExit):
        main(["open", "sample", "--count", "-1"], folders, opened.append)
    assert opened == [MATCH, PLAYER]
    assert main(["show", "nothing"], folders) == 1
