import json

import pytest

from extract.lists.match_reports import (
    InvalidPoolMatchesError,
    PoolMatch,
    main,
    match_reports,
    pilot,
    read_pool_matches,
)
from extract.pool_config import read_pool_config
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
COMPETITIONS = {c["code"]: c for c in read_pool_config()["competitions"]}


def pool_match(
    source_id: str, code: str, season_id: str | None, groups: list[str]
) -> PoolMatch:
    return {
        "sourceId": source_id,
        "competitionCode": code,
        "seasonId": season_id,
        "groups": groups,
    }


# The full shape `npm run pool` writes
def written(match: PoolMatch) -> dict[str, object]:
    return {
        "away": "141",
        "competitionCode": match["competitionCode"],
        "date": "2002-11-06",
        "groups": match["groups"],
        "home": "36",
        "result": "6:0",
        "round": "6.Matchday",
        "seasonId": match["seasonId"],
        "sourceId": match["sourceId"],
        "stage": None,
    }


DERBY = pool_match("1118844", "TR1", "2002", ["derbies"])
FINAL = pool_match("53491", "FIWC", "2005", ["world-cup-knockouts"])
CLASICO = pool_match("2100000", "CL", "2010", ["derbies", "ucl-knockouts"])
UNDATED = pool_match("2100001", "CL", None, ["ucl-knockouts"])
POOL = [DERBY, FINAL, CLASICO, UNDATED]


def save_pool(dirs: Dirs, matches: list[PoolMatch]) -> None:
    path = dirs.work / "pool" / "matches.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps([written(m) for m in matches]), encoding="utf-8")


def test_one_match_report_link_per_pool_match() -> None:
    links = match_reports(POOL, COMPETITIONS)

    assert [item.page.key for item in links] == [
        "1118844",
        "53491",
        "2100000",
        "2100001",
    ]
    derby = links[0]
    assert derby.page.url == f"{TM}/spielbericht/index/spielbericht/1118844"
    assert derby.page.kind == "match"
    assert derby.page.save_as == "match-1118844.html"
    assert (derby.group, derby.competition, derby.season) == (
        "derbies",
        "TR1",
        "2002-03",
    )


def test_tags_tournaments_two_groups_and_a_match_with_no_season() -> None:
    _, final, clasico, undated = match_reports(POOL, COMPETITIONS)

    assert final.season == "2006"
    assert clasico.group == "derbies+ucl-knockouts"
    assert undated.season is None


def test_the_pilot_is_the_three_pilot_matches_in_the_pool() -> None:
    pool = [*POOL, pool_match("990248", "CL", "2000", ["ucl-knockouts"])]

    assert [item.page.key for item in pilot(pool, COMPETITIONS)] == [
        "990248",
        "53491",
        "1118844",
    ]
    assert {item.group for item in pilot(pool, COMPETITIONS)} == {"pilot"}


def test_writes_both_lists_once_per_match_identically_on_a_rerun(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    save_pool(dirs, POOL)
    lists = dirs.work / "link-lists"

    assert main([], dirs.folders()) == 0
    first = {p.name: p.read_bytes() for p in lists.iterdir()}
    assert main([], dirs.folders()) == 0

    assert sorted(first) == ["s11-match-reports.json", "s11-pilot.json"]
    assert {p.name: p.read_bytes() for p in lists.iterdir()} == first
    reports = json.loads(first["s11-match-reports.json"])
    assert len({entry["key"] for entry in reports}) == len(reports) == 4
    assert [e["key"] for e in json.loads(first["s11-pilot.json"])] == [
        "53491",
        "1118844",
    ]
    assert "not in the pool yet: 990248" in capsys.readouterr().out


def test_needs_the_pool_match_list(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    assert main([], dirs.folders()) == 1
    assert "npm run pool" in capsys.readouterr().out
    assert not (dirs.work / "link-lists").exists()


def test_refuses_a_pool_match_list_of_the_wrong_shape(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    save_pool(dirs, [DERBY])
    path = dirs.work / "pool" / "matches.json"
    broken = json.loads(path.read_text(encoding="utf-8"))
    broken[0]["sourceId"] = "x1"
    path.write_text(json.dumps(broken), encoding="utf-8")

    with pytest.raises(InvalidPoolMatchesError, match=r"\$\[0\]\.sourceId"):
        read_pool_matches(path)
    assert main([], dirs.folders()) == 1
    assert "Invalid pool matches" in capsys.readouterr().err


def test_takes_no_arguments(dirs: Dirs) -> None:
    assert main(["--all"], dirs.folders()) == 2
    assert not (dirs.work / "link-lists").exists()
