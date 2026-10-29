import json
from typing import cast

import pytest

from extract.lists.images import image_links, latest_players, main
from extract.lists.match_reports import PoolMatch
from extract.lists.player_pages import latest_reports
from extract.pool_config import read_pool_config
from extract.tests.saved_pages import Dirs

IMG = "https://img.a.transfermarkt.technology"
COMPETITIONS = {c["code"]: c for c in read_pool_config()["competitions"]}


def pool_match(match_id: str, code: str, season: str, group: str) -> PoolMatch:
    return cast(
        PoolMatch,
        {
            "sourceId": match_id,
            "competitionCode": code,
            "seasonId": season,
            "groups": [group],
        },
    )


FINAL = pool_match("990248", "CL", "2000", "ucl-knockouts")
DERBY = pool_match("1118844", "TR1", "2002", "ucl-knockouts")
LATER = pool_match("4126774", "CL", "2023", "ucl-knockouts")


def saved(dirs: Dirs, *fixtures: str) -> None:
    for fixture in fixtures:
        dirs.save(fixture)
    dirs.run()


def test_lists_both_crests_then_each_saved_photo(dirs: Dirs) -> None:
    saved(dirs, "match-990248", "player-206")

    found = image_links(
        [FINAL], latest_reports(dirs.raw), latest_players(dirs.raw), COMPETITIONS
    )

    assert [(i.page.kind, i.page.key) for i in found.links] == [
        ("crest", "27"),
        ("crest", "1049"),
        ("photo", "206"),
    ]
    assert [i.page.save_as for i in found.links] == [
        "27_1400571853.png",
        "1049_1439122752.png",
        "206-1464084738.jpg",
    ]
    first = found.links[0]
    assert (first.group, first.competition, first.season) == (
        "ucl-knockouts",
        "CL",
        "2000-01",
    )
    # The other 21 starters have no saved profile
    assert len(found.no_profile) == 21
    assert found.no_crest == found.no_photo == []


def test_takes_each_clubs_crest_from_its_newest_report(dirs: Dirs) -> None:
    saved(dirs, "match-1118844", "match-4126774")

    found = image_links([DERBY, LATER], latest_reports(dirs.raw), {}, COMPETITIONS)

    crests = [(i.page.key, i.page.url) for i in found.links]
    assert crests == [
        ("36", f"{IMG}/wappen/normquad/36.png?lm=1789459168"),
        ("141", f"{IMG}/wappen/normquad/141.png?lm=1789459175"),
        ("3205", f"{IMG}/wappen/normquad/3205.png?lm=1789459336"),
    ]
    assert found.links[1].page.save_as == "crest-141.png"


def test_sets_apart_a_player_with_no_photo(dirs: Dirs) -> None:
    saved(dirs, "match-990248", "player-206")
    players = latest_players(dirs.raw)
    players["206"] = {**players["206"], "imageUrl": None}

    found = image_links([FINAL], latest_reports(dirs.raw), players, COMPETITIONS)

    assert found.no_photo == ["206"]
    assert [i.page.kind for i in found.links] == ["crest", "crest"]


def test_writes_both_lists_identically_on_a_rerun(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    saved(dirs, "match-990248", "player-206")
    pool = dirs.work / "pool" / "matches.json"
    pool.parent.mkdir(parents=True)
    row = {**FINAL, "away": "1049", "date": "2001-05-23", "home": "27"}
    row.update({"result": None, "round": None, "stage": None})
    pool.write_text(json.dumps([row]), encoding="utf-8")
    lists = dirs.work / "link-lists"

    assert main([], dirs.folders()) == 0
    first = {p.name: p.read_bytes() for p in lists.iterdir()}
    assert main([], dirs.folders()) == 0

    assert {p.name: p.read_bytes() for p in lists.iterdir()} == first
    assert sorted(first) == ["s18-images.json", "s18-pilot.json"]
    out = capsys.readouterr().out
    assert "s18-images: 2 crests, 1 photos" in out
    assert "profile not saved yet (s11b-players): 21" in out
    pilot = (dirs.work / "inbox-lists" / "s18-pilot.md").read_text(encoding="utf-8")
    assert "Save it with ⌘S" in pilot
    assert "`27_1400571853.png`" in pilot


def test_takes_no_arguments(dirs: Dirs) -> None:
    assert main(["--all"], dirs.folders()) == 2
