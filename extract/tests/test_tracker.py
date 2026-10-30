import csv
import json
from collections import Counter
from pathlib import Path
from typing import cast

import pytest

from extract.import_log import IMPORT_LOG
from extract.links import main as links_main
from extract.lists.images import latest_players
from extract.lists.match_reports import PoolMatch
from extract.lists.player_pages import latest_reports
from extract.pages import Page, PageId, Snapshot, classify
from extract.parsers.transfermarkt.records import (
    TransfermarktMatch,
    TransfermarktPlayer,
)
from extract.pool_config import read_pool_config
from extract.tests.saved_pages import Dirs
from extract.tracker import (
    NO_REMOTE,
    InvalidRemoteStatusError,
    Remote,
    balanced,
    general_pages,
    main,
    match_block,
    next_to_save,
    read_remote,
    refusals,
    status_of,
)

CONFIG = read_pool_config()
COMPETITIONS = {c["code"]: c for c in CONFIG["competitions"]}
LISTINGS = 238


def pool_match(
    match_id: str, code: str, season: str, group: str, date: str = "2001-01-01"
) -> PoolMatch:
    return cast(
        PoolMatch,
        {
            "sourceId": match_id,
            "competitionCode": code,
            "seasonId": season,
            "groups": [group],
            "date": date,
        },
    )


FINAL = pool_match("990248", "CL", "2000", "ucl-knockouts", "2001-05-23")
DERBY = pool_match("1118844", "TR1", "2002", "derbies", "2002-11-06")


def folders(dirs: Dirs) -> dict[str, Path]:
    return {**dirs.folders(), "inbox-lists": dirs.work.parent / "inbox-lists"}


def write_pool(dirs: Dirs, *matches: PoolMatch) -> None:
    rows = [
        {
            "away": "2",
            "competitionCode": m["competitionCode"],
            "date": m.get("date", "2001-01-01"),
            "groups": m["groups"],
            "home": "1",
            "result": "1:0",
            "round": "Final",
            "seasonId": m["seasonId"],
            "sourceId": m["sourceId"],
            "stage": None,
        }
        for m in matches
    ]
    path = dirs.work / "pool" / "matches.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(rows), encoding="utf-8")


def write_remote(dirs: Dirs, remote: object) -> None:
    path = dirs.work / "status" / "remote.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(remote), encoding="utf-8")


def read_rows(path: Path) -> list[dict[str, str]]:
    with path.open(encoding="utf-8", newline="") as file:
        return list(csv.DictReader(file))


def remote(**changes: object) -> Remote:
    base = {
        "validated": {"match": [], "player": []},
        "errors": {"match": {}},
        "uploaded": None,
        "ingested": None,
        "notes": [],
    }
    return cast(Remote, {**base, **changes})


def test_puts_the_pilot_first_then_rotates_groups_then_eras() -> None:
    old = pool_match("1", "TR1", "2002", "derbies", "2002-09-01")
    later = pool_match("2", "TR1", "2003", "derbies", "2003-09-01")
    middle = pool_match("3", "TR1", "2010", "derbies", "2010-09-01")
    clash = pool_match("4", "IT1", "2000", "clashes", "2000-10-21")
    recent = pool_match("5", "CL", "2023", "ucl-knockouts", "2024-04-09")
    wc = pool_match("53491", "FIWC", "2005", "world-cup-knockouts", "2006-07-09")

    order = balanced([later, recent, middle, clash, old, wc], COMPETITIONS)

    # Derbies run era 2000–07, 2008–15, then 2000–07 again
    assert [m["sourceId"] for m in order] == ["53491", "1", "4", "5", "3", "2"]


def test_a_match_block_lists_crests_then_each_starter_and_photo(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.save("player-206")
    dirs.run()

    pages = match_block(FINAL, latest_reports(dirs.raw), latest_players(dirs.raw))

    assert [p.id for p in pages[:3]] == [
        ("match", "990248"),
        ("crest", "27"),
        ("crest", "1049"),
    ]
    kinds = Counter(p.kind for p in pages)
    assert kinds == {"match": 1, "crest": 2, "player": 22, "photo": 1}
    kahn = pages.index(next(p for p in pages if p.id == ("player", "206")))
    assert pages[kahn + 1].id == ("photo", "206")


def test_an_unsaved_report_is_its_own_block() -> None:
    assert [p.id for p in match_block(FINAL, {}, {})] == [("match", "990248")]


def test_lists_the_listings_first_and_every_link_once(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.save("match-1118844")
    dirs.run()
    reports = latest_reports(dirs.raw)

    pages = general_pages(CONFIG, [FINAL, DERBY, FINAL], reports, {})

    assert all(p.kind == "fixture" for p in pages[:LISTINGS])
    assert len({p.id for p in pages}) == len(pages)
    assert pages[LISTINGS].id == ("match", "990248")


def snapshot_with(
    stored: dict[PageId, str] | None = None,
    inbox: tuple[PageId, ...] = (),
) -> Snapshot:
    stored = stored or {}
    return Snapshot(
        inbox={i: "file" for i in inbox},
        stored={i: Path("x") for i in stored},
        records={
            i: Counter({"p": 1}) for i, state in stored.items() if state == "parsed"
        },
    )


MATCH = classify("https://www.transfermarkt.com/spielbericht/index/spielbericht/1")
PLAYER = classify("https://www.transfermarkt.com/x/profil/spieler/2")
PHOTO = Page("photo", "2", "https://img.a.transfermarkt.technology/p/2.jpg")
LISTING = classify(
    "https://www.transfermarkt.com/x/gesamtspielplan/pokalwettbewerb/CL/saison_id/2000"
)


@pytest.mark.parametrize(
    ("page", "state", "refused", "known", "expected"),
    [
        (MATCH, snapshot_with(), {}, remote(), "to save"),
        (
            MATCH,
            snapshot_with(),
            {MATCH.id: "challenge page"},
            remote(),
            "error: challenge page",
        ),
        (MATCH, snapshot_with(inbox=(MATCH.id,)), {}, remote(), "saved"),
        (MATCH, snapshot_with({MATCH.id: "imported"}), {}, remote(), "saved"),
        (MATCH, snapshot_with({MATCH.id: "parsed"}), {}, remote(), "parsed"),
        (LISTING, snapshot_with({LISTING.id: "parsed"}), {}, remote(), "parsed"),
        (
            MATCH,
            snapshot_with({MATCH.id: "parsed"}),
            {},
            remote(validated={"match": ["1"], "player": []}),
            "validated",
        ),
        (
            MATCH,
            snapshot_with({MATCH.id: "parsed"}),
            {},
            remote(
                validated={"match": ["1"], "player": []},
                ingested={"match": ["1"], "player": [], "crest": [], "photo": []},
            ),
            "ingested",
        ),
        (
            MATCH,
            snapshot_with({MATCH.id: "parsed"}),
            {},
            remote(errors={"match": {"1": "gate: home slot 4: no alias"}}),
            "error: gate: home slot 4: no alias",
        ),
        (
            PLAYER,
            snapshot_with({PLAYER.id: "parsed"}),
            {},
            remote(
                validated={"match": [], "player": ["2"]},
                ingested={"match": [], "player": ["2"], "crest": [], "photo": []},
            ),
            "ingested",
        ),
        (PHOTO, snapshot_with({PHOTO.id: "parsed"}), {}, remote(), "saved"),
        (
            PHOTO,
            snapshot_with({PHOTO.id: "parsed"}),
            {},
            remote(uploaded={"crest": [], "photo": ["2"]}),
            "uploaded",
        ),
        (
            PHOTO,
            snapshot_with({PHOTO.id: "parsed"}),
            {},
            remote(
                uploaded={"crest": [], "photo": ["2"]},
                ingested={"match": [], "player": [], "crest": [], "photo": ["2"]},
            ),
            "ingested",
        ),
    ],
)
def test_each_status_comes_from_the_real_state(
    page: Page,
    state: Snapshot,
    refused: dict[PageId, str],
    known: Remote,
    expected: str,
) -> None:
    assert status_of(page, state, refused, known) == expected


def test_a_refusal_counts_until_the_page_is_imported(tmp_path: Path) -> None:
    log = tmp_path / IMPORT_LOG
    lines = [
        {"kind": "match", "key": "1", "result": "refused", "reason": "challenge page"},
        {"kind": "match", "key": "2", "result": "refused", "reason": "challenge page"},
        {"kind": "match", "key": "2", "result": "imported", "reason": None},
        {"kind": None, "key": None, "result": "refused", "reason": "unknown"},
    ]
    log.write_text("".join(json.dumps(line) + "\n" for line in lines))

    assert refusals(log) == {("match", "1"): "challenge page"}


def test_writes_the_five_csvs_and_a_rerun_changes_nothing(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs.save("fixtures-cl-2000")
    dirs.save("match-990248")
    dirs.save("player-206")
    dirs.run()
    write_pool(dirs, FINAL)
    write_remote(
        dirs,
        remote(
            validated={"match": ["990248"], "player": ["206"]},
            notes=["database not checked: test"],
        ),
    )
    lists = folders(dirs)["inbox-lists"]

    assert main([], folders(dirs)) == 0
    first = {p.name: p.read_bytes() for p in lists.iterdir()}
    assert main([], folders(dirs)) == 0

    assert {p.name: p.read_bytes() for p in lists.iterdir()} == first
    assert sorted(first) == [
        "general.csv",
        "images.csv",
        "listings.csv",
        "match-reports.csv",
        "players.csv",
    ]
    general = read_rows(lists / "general.csv")
    assert list(general[0]) == ["#", "Type", "Link", "Save as", "Folder", "Status"]
    types = {r["Save as"]: r["Type"] for r in general}
    assert types["fixture-cl-2000.html"] == "Fixture"
    assert types["match-990248.html"] == "Match Report"
    assert types["player-206.html"] == "Player"
    assert types["206-1464084738.jpg"] == "PlayerPhoto"
    assert types["27_1400571853.png"] == "Crest"
    players = read_rows(lists / "players.csv")
    assert list(players[0]) == ["#", "Link", "Save as", "Folder", "Status"]
    assert len(general) == LISTINGS + 1 + 2 + 22 + 1
    statuses = {r["Save as"]: r["Status"] for r in general}
    assert statuses["fixture-cl-2000.html"] == "parsed"
    assert statuses["match-990248.html"] == "validated"
    assert statuses["player-206.html"] == "validated"
    assert statuses["206-1464084738.jpg"] == "to save"
    assert players[0]["#"] == "1"
    out = capsys.readouterr().out
    assert "match-reports.csv: 1 rows: 1 validated" in out
    assert "database not checked: test" in out


def test_without_a_remote_status_pages_stop_at_parsed(dirs: Dirs) -> None:
    dirs.save("match-990248")
    dirs.run()
    write_pool(dirs, FINAL)

    assert main([], folders(dirs)) == 0

    rows = read_rows(folders(dirs)["inbox-lists"] / "match-reports.csv")
    assert rows[0]["Status"] == "parsed"
    assert NO_REMOTE["uploaded"] is None


def test_refuses_an_invalid_remote_status(tmp_path: Path) -> None:
    path = tmp_path / "remote.json"
    path.write_text('{"validated": {}}')

    with pytest.raises(InvalidRemoteStatusError):
        read_remote(path)


def test_opens_the_next_rows_of_general_still_to_save(dirs: Dirs) -> None:
    write_pool(dirs, FINAL)
    main([], folders(dirs))
    opened: list[str] = []

    pages = next_to_save(folders(dirs)["inbox-lists"], 2)
    code = links_main(["open", "general", "--count", "1"], folders(dirs), opened.append)

    assert [p.save_as for p in pages] == [
        "fixture-gb1-2000.html",
        "fixture-gb1-2001.html",
    ]
    assert code == 0
    assert opened == [pages[0].url]


def test_open_general_needs_the_csv(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        next_to_save(tmp_path, 1)


def test_a_placeholder_image_gives_no_row() -> None:
    starter = {"sourceId": "2", "profilePath": "/x/profil/spieler/2"}
    home = {"sourceId": "9", "crestUrl": None, "starters": [starter]}
    away: dict[str, object] = {"sourceId": "8", "crestUrl": None, "starters": []}
    report = cast(TransfermarktMatch, {"home": home, "away": away})
    player = cast(TransfermarktPlayer, {"sourceId": "2", "imageUrl": None})

    pages = match_block(FINAL, {"990248": report}, {"2": player})

    assert [p.id for p in pages] == [("match", "990248"), ("player", "2")]


def test_names_each_error_row_and_the_files_waiting(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    write_pool(dirs, FINAL)
    dirs.log.parent.mkdir(parents=True, exist_ok=True)
    refused = {"kind": "match", "key": "990248", "result": "refused"}
    dirs.log.write_text(json.dumps({**refused, "reason": "challenge page"}) + "\n")
    dirs.save("player-206")

    assert main([], folders(dirs)) == 0

    out = capsys.readouterr().out
    assert f"  #{LISTINGS + 1} match 990248: error: challenge page" in out
    assert "in data/inbox/: 1, run `uv run python -m extract.inbox`" in out
