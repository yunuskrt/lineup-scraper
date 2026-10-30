import re
from collections import Counter
from pathlib import Path
from typing import cast

import pytest

from extract.parsers.transfermarkt.common import PHOTO_ID, ParseError, image_url
from extract.parsers.transfermarkt.fixtures import parse_fixture_list
from extract.parsers.transfermarkt.match import parse_match_report
from extract.parsers.transfermarkt.player import parse_player
from extract.parsers.transfermarkt.records import TransfermarktMatch
from extract.records import JsonValue, validate_record

FIXTURES = Path(__file__).resolve().parent / "fixtures" / "transfermarkt"
BASE = "https://www.transfermarkt.com"
FETCHED = "2026-10-27T00:00:00Z"
ISO_DATE = re.compile(r"^[0-9]{4}-[0-9]{2}-[0-9]{2}$")


def page(name: str) -> str:
    return (FIXTURES / f"{name}.html").read_text(encoding="utf-8")


def match(match_id: str) -> TransfermarktMatch:
    url = f"{BASE}/spielbericht/index/spielbericht/{match_id}"
    return parse_match_report(page(f"match-{match_id}"), url, FETCHED)


@pytest.mark.parametrize(
    ("name", "code", "season", "count"),
    [
        ("fixtures-it1-2000", "IT1", "2000", 306),
        ("fixtures-cl-2000", "CL", "2000", 157),
        ("fixtures-cl-2023", "CL", "2023", 125),
        ("fixtures-wm06", "FIWC", "2005", 64),
    ],
)
def test_reads_every_fixture_row(name: str, code: str, season: str, count: int) -> None:
    records = parse_fixture_list(page(name), f"{BASE}/x", FETCHED, code, season)
    assert len(records) == count
    assert len({r["sourceId"] for r in records}) == count
    for record in records:
        assert record["date"] is not None and ISO_DATE.match(record["date"])
        assert record["home"]["sourceId"].isdigit()
        assert record["away"]["sourceId"].isdigit()
        validate_record("transfermarkt-fixture", cast(dict[str, JsonValue], record))


def test_refuses_a_list_that_shows_another_season() -> None:
    # Transfermarkt's fallback for a season it doesn't have
    with pytest.raises(ParseError, match="Shows season 2000, not 2001"):
        parse_fixture_list(page("fixtures-cl-2000"), BASE, FETCHED, "CL", "2001")


def test_dates_a_league_row_from_its_own_datum_link() -> None:
    first = parse_fixture_list(page("fixtures-it1-2000"), BASE, FETCHED, "IT1", "2000")[
        0
    ]
    assert (first["date"], first["round"], first["stage"]) == (
        "2000-09-30",
        "1.Matchday",
        None,
    )
    assert (first["home"]["name"], first["away"]["name"]) == (
        "AS Bari",
        "Hellas Verona",
    )


def test_dates_a_cup_row_from_the_header_above_it() -> None:
    records = parse_fixture_list(page("fixtures-cl-2000"), BASE, FETCHED, "CL", "2000")
    final = next(r for r in records if r["sourceId"] == "990248")
    assert final["date"] == "2001-05-23"
    assert (final["round"], final["stage"], final["result"]) == (
        "Knockout stage",
        "FI",
        "5:4 on pens",
    )
    assert Counter(r["stage"] for r in records) == {
        None: 144,
        "QF": 8,
        "SF": 4,
        "FI": 1,
    }


def test_reads_the_2001_final() -> None:
    final = match("990248")
    assert (final["round"], final["date"]) == ("Final", "2001-05-23")
    # Here the score box is the shootout alone
    assert (final["result"], final["resultNote"]) == ("5:4", "on pens")
    assert final["home"]["formation"] == "Starting Line-up: 5-4-1"
    assert final["away"]["formation"] == "Starting Line-up: 4-4-2 Diamond"
    assert [len(final[side]["starters"]) for side in ("home", "away")] == [11, 11]
    assert final["home"]["starters"][0]["style"] == "top: 80%; left: 40%;"
    assert final["home"]["tablePosition"] is None
    assert [e["box"] for e in final["events"]].count("goal") == 2


def test_reads_each_sides_own_table_position_and_added_time() -> None:
    juve = match("1153409")
    assert (juve["home"]["tablePosition"], juve["away"]["tablePosition"]) == (
        "Position: 2",
        "Position: 16",
    )
    assert juve["resultNote"] == "(1:0)"
    goals = [e for e in juve["events"] if e["box"] == "goal"]
    assert [e["addedTime"] for e in goals] == [None, "+2"]
    assert goals[1]["players"] == [{"sourceId": "3111", "name": "Zinédine Zidane"}]


def test_reads_a_goalless_2023_match() -> None:
    goalless = match("4126774")
    assert (goalless["date"], goalless["result"]) == ("2023-08-12", "0:0")
    assert not [e for e in goalless["events"] if e["box"] == "goal"]
    assert (
        sum(
            s["isCaptain"]
            for side in ("home", "away")
            for s in goalless[side]["starters"]
        )
        == 2
    )


def kick_count(record: TransfermarktMatch) -> Counter[tuple[str, str]]:
    return Counter((k["side"], k["outcome"]) for k in record["shootout"])


def test_reads_every_shootout_kick_in_order() -> None:
    final = match("990248")
    assert len(final["shootout"]) == 14
    assert final["shootout"][:2] == [
        {"side": "home", "outcome": "Missed"},
        {"side": "away", "outcome": "Scored"},
    ]
    assert kick_count(final) == {
        ("home", "Scored"): 5,
        ("home", "Missed"): 1,
        ("home", "Saved"): 1,
        ("away", "Scored"): 4,
        ("away", "Saved"): 3,
    }
    assert match("1153409")["shootout"] == []


def test_reads_the_2006_final_whose_box_adds_the_score() -> None:
    final = match("53491")
    # 1:1 after extra time, 5:3 on kicks, shown as 6:4
    assert (final["result"], final["resultNote"]) == ("6:4", "on pens")
    assert kick_count(final) == {
        ("home", "Scored"): 5,
        ("away", "Scored"): 3,
        ("away", "Missed"): 1,
    }
    cards = [e for e in final["events"] if e["box"] == "card"]
    red = next(e for e in cards if "Red card" in e["text"])
    assert (red["side"], red["clock"]) == (
        "away",
        "background-position: -324px -360px;",
    )


def test_reads_the_derby_half_time_note_and_two_red_cards() -> None:
    derby = match("1118844")
    assert (derby["result"], derby["resultNote"]) == ("6:0", "(2:0)")
    assert [e["box"] for e in derby["events"]].count("goal") == 6
    reds = [e["side"] for e in derby["events"] if "Red card" in e["text"]]
    assert reds == ["home", "away"]


@pytest.mark.parametrize(
    "match_id", ["990248", "1153409", "4126774", "53491", "1118844"]
)
def test_every_match_record_is_valid(match_id: str) -> None:
    validate_record("transfermarkt-match", cast(dict[str, JsonValue], match(match_id)))


def test_reads_a_player_page() -> None:
    player = parse_player(
        page("player-411295"), f"{BASE}/raphinha/profil/spieler/411295", FETCHED
    )
    assert player["headline"] == "#11 Raphinha"
    assert player["dateOfBirth"] == "14/12/1996 (29)"
    assert player["citizenship"] == "Brazil Italy"
    assert player["position"] == "Attack - Centre-Forward"
    assert player["fullName"] == "Raphael Dias Belloli"
    assert player["nameInHomeCountry"] is None
    assert player["capsGoals"] == "43 / 12"
    validate_record("transfermarkt-player", cast(dict[str, JsonValue], player))


@pytest.mark.parametrize(
    ("name", "path", "full_name", "home_name", "caps"),
    [
        # Retired; the full name under the home label
        ("player-206", "oliver-kahn", None, "Oliver Rolf Kahn", "86 / 0"),
        # Never capped: no caps line at all
        ("player-6877", "batista", "Joao Casemiro Marques Batista", None, None),
    ],
)
def test_reads_a_retired_players_names_and_caps(
    name: str, path: str, full_name: str | None, home_name: str | None, caps: str | None
) -> None:
    player_id = name.removeprefix("player-")
    url = f"{BASE}/{path}/profil/spieler/{player_id}"
    player = parse_player(page(name), url, FETCHED)
    assert (player["fullName"], player["nameInHomeCountry"]) == (full_name, home_name)
    assert player["capsGoals"] == caps
    validate_record("transfermarkt-player", cast(dict[str, JsonValue], player))


def test_a_player_page_without_caps_or_full_name_gives_null() -> None:
    html = (
        page("player-411295")
        .replace("Caps/Goals:", "Something:")
        .replace("Full name:", "Other:")
    )
    player = parse_player(html, f"{BASE}/raphinha/profil/spieler/411295", FETCHED)
    assert (player["fullName"], player["capsGoals"]) == (None, None)


@pytest.mark.parametrize(
    "match_id", ["990248", "1153409", "4126774", "53491", "1118844"]
)
def test_every_starter_keeps_its_profile_link(match_id: str) -> None:
    report = match(match_id)
    starters = report["home"]["starters"] + report["away"]["starters"]
    assert len(starters) == 22
    for starter in starters:
        assert re.fullmatch(
            rf"/[a-z0-9-]+/profil/spieler/{starter['sourceId']}",
            starter["profilePath"],
        )
    if match_id == "990248":
        assert starters[0]["profilePath"] == "/oliver-kahn/profil/spieler/206"


def test_a_page_without_starters_raises_a_named_error() -> None:
    broken = page("match-990248").replace("formation-player-container", "removed")
    with pytest.raises(ParseError, match="formation-player-container"):
        parse_match_report(
            broken, f"{BASE}/spielbericht/index/spielbericht/990248", FETCHED
        )


def test_a_page_without_matches_raises_a_named_error() -> None:
    with pytest.raises(ParseError, match="spielbericht"):
        parse_fixture_list("<html><table></table></html>", BASE, FETCHED, "IT1", "2000")


def test_text_joins_nodes_with_the_chosen_separator() -> None:
    from parsel import Selector

    from extract.parsers.transfermarkt.common import text, text_or_none

    node = Selector(text='<div class="x">(<span>1:</span>0)</div>').xpath("//div")
    assert text(node) == "( 1: 0)"
    assert text(node, sep="") == "(1:0)"
    assert text_or_none(Selector(text="<div> </div>").xpath("//div")) is None


def test_a_fixture_row_without_two_teams_raises() -> None:
    html = (
        "<table><tr><td><a href='/aktuell/datum/2000-09-30'>x</a></td>"
        "<td><a href='/a/startseite/verein/1'>A</a></td>"
        "<td><a href='/a_b/index/spielbericht/5'>1:0</a></td></tr></table>"
    )
    with pytest.raises(ParseError, match="two"):
        parse_fixture_list(html, BASE, FETCHED, "IT1", "2000")


def test_a_match_without_its_datum_link_raises() -> None:
    broken = page("match-1153409").replace("datum/", "dateless/")
    with pytest.raises(ParseError, match="datum"):
        parse_match_report(
            broken, f"{BASE}/spielbericht/index/spielbericht/1153409", FETCHED
        )


def test_reads_the_bench_and_event_details() -> None:
    final = match("990248")
    assert [len(final[side]["bench"]) for side in ("home", "away")] == [7, 7]
    assert final["home"]["bench"][0] == {
        "sourceId": "196",
        "name": "Bernd Dreher",
        "shirtNumber": "22",
        "position": "GK",
    }
    swap = next(e for e in final["events"] if e["box"] == "substitution")
    assert len(swap["players"]) == 2
    card = next(e for e in final["events"] if e["box"] == "card")
    assert card["players"] == [{"sourceId": "7562", "name": "Santiago Cañizares"}]
    assert all(e["clock"] for e in final["events"] if e["box"] != "substitution")


def test_falls_back_to_the_header_without_the_info_table() -> None:
    html = page("player-411295").replace("info-table", "gone")
    player = parse_player(html, f"{BASE}/raphinha/profil/spieler/411295", FETCHED)
    assert player["dateOfBirth"] == "14/12/1996 (29)"
    assert player["citizenship"] == "Brazil"
    assert player["position"] == "Centre-Forward"


IMG = "https://img.a.transfermarkt.technology"


def test_reads_each_sides_crest() -> None:
    final = match("990248")
    derby = match("1118844")
    assert final["home"]["crestUrl"] == (
        f"{IMG}/wappen/normquad/27_1400571853.png?lm=1789459168"
    )
    assert final["away"]["crestUrl"] == (
        f"{IMG}/wappen/normquad/1049_1439122752.png?lm=1789459228"
    )
    # Some crests have no stamp in the name
    assert derby["home"]["crestUrl"] == f"{IMG}/wappen/normquad/36.png?lm=1789459168"


def test_reads_the_header_photo() -> None:
    player = parse_player(page("player-206"), f"{BASE}/x/profil/spieler/206", FETCHED)
    assert player["imageUrl"] == (f"{IMG}/portrait/header/206-1464084738.jpg?lm=4711")


@pytest.mark.parametrize(
    ("src", "is_kept"),
    [
        (f"{IMG}/portrait/header/206-1464084738.jpg?lm=4711", True),
        # The older naming, still a real photo
        (f"{IMG}/portrait/header/s_7573_123_2012_10_23_1.jpg?lm=4711", True),
        (f"{IMG}/portrait/header/default.jpg?lm=1", False),
        ("https://example.org/portrait/header/206-1.jpg", False),
    ],
)
def test_keeps_only_a_real_photo(src: str, is_kept: bool) -> None:
    assert image_url(src, PHOTO_ID) == (src if is_kept else None)
    assert image_url(None, PHOTO_ID) is None
