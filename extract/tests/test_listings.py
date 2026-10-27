import json
from collections import Counter
from pathlib import Path

import pytest

from extract.lists.listings import (
    clubs_without_id,
    listings,
    main,
    pilot,
    verify,
)
from extract.pool_config import (
    InvalidPoolConfigError,
    read_pool_config,
    season_label,
)
from extract.tests.saved_pages import Dirs

TM = "https://www.transfermarkt.com"
CONFIG = read_pool_config()


def test_lists_every_season_of_every_competition() -> None:
    links = listings(CONFIG)

    assert len(links) == 247
    per_code = Counter(item.competition for item in links)
    assert per_code == {
        **{code: 26 for code in ("GB1", "ES1", "IT1", "L1", "FR1", "PO1", "TR1")},
        "CL": 26,
        "EL": 26,
        "FIWC": 6,
        "EURO": 7,
    }
    assert len({item.page.id for item in links}) == 247


def test_builds_league_and_cup_links_with_their_tags() -> None:
    by_key = {item.page.key: item for item in listings(CONFIG)}

    serie_a = by_key["it1-2000"]
    assert (
        serie_a.page.url
        == f"{TM}/serie-a/gesamtspielplan/wettbewerb/IT1?saison_id=2000"
    )
    assert (serie_a.group, serie_a.season) == ("derbies+clashes", "2000-01")
    cl = by_key["cl-2025"]
    assert cl.page.url.endswith("/pokalwettbewerb/CL/saison_id/2025")
    assert (cl.group, cl.season) == ("ucl-knockouts+derbies", "2025-26")


def test_tournaments_use_the_year_before_as_saison_id() -> None:
    by_key = {item.page.key: item for item in listings(CONFIG)}

    assert by_key["fiwc-2005"].season == "2006"
    assert by_key["euro-1999"].season == "2000"
    assert by_key["euro-2023"].season == "2024"
    assert "fiwc-2025" not in by_key


def test_one_sample_per_unverified_pattern() -> None:
    samples = verify(CONFIG)

    assert [item.competition for item in samples] == [
        "GB1",
        "ES1",
        "L1",
        "FR1",
        "PO1",
        "EL",
    ]
    assert samples[0].group == "unverified-gb1"
    assert samples[0].page.key == "gb1-2000"


def test_the_pilot_pages_are_the_derby_season_and_euro_2004() -> None:
    assert [item.page.key for item in pilot(CONFIG)] == ["tr1-2002", "euro-2003"]


def test_reports_clubs_no_saved_page_has_shown() -> None:
    assert clubs_without_id(CONFIG) == [
        "liverpool",
        "chelsea",
        "tottenham",
        "marseille",
    ]


def test_season_labels() -> None:
    league, *_ = CONFIG["competitions"]
    assert season_label(league, 2009) == "2009-10"
    assert season_label(league, 2099) == "2099-00"


def test_writes_the_three_lists_identically_on_a_rerun(
    dirs: Dirs, capsys: pytest.CaptureFixture[str]
) -> None:
    folders = dirs.folders()
    lists = dirs.work / "link-lists"

    assert main([], folders) == 0
    first = {p.name: p.read_bytes() for p in lists.iterdir()}
    assert main([], folders) == 0

    assert sorted(first) == ["s07-listings.json", "s07-pilot.json", "s07-verify.json"]
    assert {p.name: p.read_bytes() for p in lists.iterdir()} == first
    assert len(json.loads(first["s07-listings.json"])) == 247
    assert "no Transfermarkt id yet: liverpool" in capsys.readouterr().out


def test_refuses_a_config_of_the_wrong_shape(
    dirs: Dirs, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    bad = tmp_path / "pool.json"
    config = json.loads(json.dumps(CONFIG))
    config["clubs"][0]["id"] = 985
    bad.write_text(json.dumps(config), encoding="utf-8")

    with pytest.raises(InvalidPoolConfigError, match=r"\$\.clubs\[0\]\.id"):
        read_pool_config(bad)
    assert main([], dirs.folders(), bad) == 1
    assert "Invalid pool config" in capsys.readouterr().err
    assert not (dirs.work / "link-lists").exists()


def test_takes_no_arguments(dirs: Dirs) -> None:
    assert main(["--all"], dirs.folders()) == 2
    assert not (dirs.work / "link-lists").exists()
