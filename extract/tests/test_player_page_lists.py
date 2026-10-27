import copy
import json
from collections.abc import Mapping
from typing import cast

import pytest

from extract.lists.match_reports import PoolMatch
from extract.lists.player_pages import latest_reports, main, player_links
from extract.parsers.transfermarkt.records import TransfermarktMatch
from extract.pool_config import read_pool_config
from extract.records import InvalidRecordError
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
COMPETITIONS = {c["code"]: c for c in read_pool_config()["competitions"]}
FINAL = cast(
    PoolMatch,
    {
        "sourceId": "990248",
        "competitionCode": "CL",
        "seasonId": "2000",
        "groups": ["ucl-knockouts"],
    },
)
WORLD_CUP = cast(
    PoolMatch,
    {
        "sourceId": "53491",
        "competitionCode": "FIWC",
        "seasonId": "2005",
        "groups": ["world-cup-knockouts"],
    },
)


def imported(dirs: Dirs, *fixtures: str) -> Mapping[str, TransfermarktMatch]:
    for fixture in fixtures:
        dirs.save(fixture)
    dirs.run()
    return latest_reports(dirs.raw)


def test_lists_each_starter_once_across_matches(dirs: Dirs) -> None:
    reports = imported(dirs, "match-990248", "match-53491")

    links = player_links([FINAL, WORLD_CUP], reports, COMPETITIONS)

    assert len(links) == 44
    assert len({item.page.id for item in links}) == 43
    first = links[0]
    assert first.page.url == f"{TM}/oliver-kahn/profil/spieler/206"
    assert (first.page.kind, first.page.save_as) == ("player", "player-206.html")
    assert (first.group, first.competition, first.season) == (
        "ucl-knockouts",
        "CL",
        "2000-01",
    )
    # 213 starts both finals: tagged by the first
    repeated = [item for item in links if item.page.key == "213"]
    assert [item.season for item in repeated] == ["2000-01", "2006"]


def test_skips_matches_with_no_saved_report_and_tags_the_pilot(dirs: Dirs) -> None:
    reports = imported(dirs, "match-990248")

    links = player_links([WORLD_CUP, FINAL], reports, COMPETITIONS, "pilot")

    assert len(links) == 22
    assert {item.group for item in links} == {"pilot"}


def test_writes_both_lists_identically_on_a_rerun(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    # 1153409 is saved but not in the pool
    imported(dirs, "match-990248", "match-1153409")
    pool = dirs.work / "pool" / "matches.json"
    pool.parent.mkdir(parents=True)
    rows = [{**FINAL, "away": "1049", "date": "2001-05-23", "home": "27"}]
    for row in rows:
        row.update({"result": None, "round": None, "stage": None})
    pool.write_text(json.dumps(rows), encoding="utf-8")
    lists = dirs.work / "link-lists"

    assert main([], dirs.folders()) == 0
    first = {p.name: p.read_bytes() for p in lists.iterdir()}
    assert main([], dirs.folders()) == 0

    assert {p.name: p.read_bytes() for p in lists.iterdir()} == first
    players = json.loads(first["s11b-players.json"])
    assert len(players) == 22
    assert "s11b-pilot.json" in first
    out = capsys.readouterr().out
    assert "s11b-players: 22 players" in out
    assert "with a saved report: 1/1" in out


def test_keeps_the_newest_copy_of_a_report(dirs: Dirs) -> None:
    imported(dirs, "match-990248")
    raw = dirs.raw / "transfermarkt" / "match" / "probe.ndjson"
    record = json.loads(raw.read_text(encoding="utf-8"))
    newer = copy.deepcopy(record) | {"fetchedAt": "2026-10-28T00:00:00Z"}
    newer["home"]["starters"][0]["name"] = "Newer"
    older = record | {"fetchedAt": "2026-10-26T00:00:00Z"}
    lines = [json.dumps(r) for r in (record, newer, older)]
    raw.write_text("\n".join(lines) + "\n", encoding="utf-8")

    report = latest_reports(dirs.raw)["990248"]

    assert report["fetchedAt"] == "2026-10-28T00:00:00Z"
    assert report["home"]["starters"][0]["name"] == "Newer"


def test_refuses_raw_records_from_an_older_parser(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    imported(dirs, "match-990248")
    raw = dirs.raw / "transfermarkt" / "match" / "probe.ndjson"
    record = json.loads(raw.read_text(encoding="utf-8"))
    del record["home"]["starters"][0]["profilePath"]
    raw.write_text(json.dumps(record) + "\n", encoding="utf-8")

    with pytest.raises(InvalidRecordError, match=r"match/probe\.ndjson:1.*--reparse"):
        latest_reports(dirs.raw)
    pool = dirs.work / "pool" / "matches.json"
    pool.parent.mkdir(parents=True)
    pool.write_text("[]", encoding="utf-8")
    assert main([], dirs.folders()) == 1
    assert "--reparse" in capsys.readouterr().err


def test_takes_no_arguments(dirs: Dirs) -> None:
    assert main(["--all"], dirs.folders()) == 2
