import json
from pathlib import Path

import pytest

from extract.data_dirs import DATA_DIRS
from extract.images import RefusedImageError, check_name, image_from_url, name_id
from extract.import_log import read_log
from extract.lists.logos import (
    InvalidLogoLinksError,
    logo_links,
    main,
    page_logos,
    read_curated,
)
from extract.pages import classify
from extract.pool_config import read_pool_config
from extract.tests.saved_pages import FIXTURES, Dirs

HOST = "https://img.a.transfermarkt.technology/logo"
SQUARE = f"{HOST}/homepageWappen150x150/gb1.png?lm=1"
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00" * 8
SLUGS = {"gb1": "premier-league", "euro": "euro", "tr1": "super-lig"}


@pytest.mark.parametrize(
    ("url", "image"),
    [
        (SQUARE, ("logo", "premier-league")),
        (f"{HOST}/header/tr1.png?lm=1", ("logo", "super-lig")),
        (f"{HOST}/medium/euro_1763046126.png?lm=1", ("logo", "euro")),
        (f"{HOST}/header/xx9.png", None),
    ],
)
def test_reads_a_pool_logo_from_its_url(
    url: str, image: tuple[str, str] | None
) -> None:
    assert image_from_url(url) == image


def test_names_a_logo_by_its_competition_slug() -> None:
    assert classify(SQUARE).save_as == "logo-premier-league.png"
    assert name_id("logo-premier-league.png") == ("logo", "premier-league")
    assert check_name("logo-world-cup.png") == ("logo", "world-cup")


def test_refuses_a_logo_of_no_pool_competition() -> None:
    with pytest.raises(RefusedImageError, match="logo-premier-league"):
        check_name("logo-conference-league.png")


def test_files_a_logo_under_logos_by_slug(dirs: Dirs) -> None:
    (dirs.inbox / "logo-premier-league.png").write_bytes(PNG)
    (dirs.inbox / "logo-cup.png").write_bytes(PNG)

    report = dirs.run()

    assert report.imported["logo"] == 1
    assert (dirs.images / "logos" / "premier-league.png").read_bytes() == PNG
    assert [name for name, _ in report.refused] == ["logo-cup.png"]
    lines = {line["file"]: line for line in read_log(dirs.log)}
    assert lines["logo-premier-league.png"]["kind"] == "logo"
    assert lines["logo-premier-league.png"]["key"] == "premier-league"


def test_finds_the_logos_a_saved_page_shows(tmp_path: Path) -> None:
    (tmp_path / "cl-2000.html").write_bytes(
        (FIXTURES / "fixtures-cl-2000.html").read_bytes()
    )

    found = page_logos(tmp_path)

    assert found[("gb1", "homepageWappen150x150")].startswith(
        f"{HOST}/homepageWappen150x150/gb1.png"
    )


def test_reads_a_versioned_logo_name_from_a_page(tmp_path: Path) -> None:
    url = f"{HOST}/medium/euro_1763046126.png?lm=1"
    (tmp_path / "euro.html").write_text(f'<img src="{url}">', encoding="utf-8")

    assert page_logos(tmp_path) == {("euro", "medium"): url}


def test_takes_a_curated_link_then_the_square_then_the_header() -> None:
    config = read_pool_config()
    pages = {
        ("gb1", "header"): f"{HOST}/header/gb1.png",
        ("gb1", "homepageWappen150x150"): SQUARE,
        ("tr1", "header"): f"{HOST}/header/tr1.png",
        ("euro", "header"): f"{HOST}/header/euro.png",
    }
    curated = {"euro": f"{HOST}/medium/euro_1763046126.png"}

    found = logo_links(config, SLUGS, pages, curated)

    urls = {item.page.key: item.page.url for item in found.links}
    assert urls == {
        "premier-league": SQUARE,
        "super-lig": f"{HOST}/header/tr1.png",
        "euro": curated["euro"],
    }
    assert {item.competition for item in found.links} == {"GB1", "TR1", "EURO"}


def test_names_a_competition_with_no_link() -> None:
    found = logo_links(read_pool_config(), {"gb1": "premier-league"}, {}, {})

    assert found.links == []
    assert found.no_link[0][0] == "premier-league"
    assert "/gesamtspielplan/wettbewerb/GB1" in found.no_link[0][1]


@pytest.mark.parametrize(
    "links",
    [
        ["not", "a", "mapping"],
        {"euro": 7},
        {"euro": f"{HOST}/medium/el.png"},
        {"euro": "https://example.com/euro.png"},
    ],
)
def test_refuses_a_bad_curated_link(tmp_path: Path, links: object) -> None:
    path = tmp_path / "logos.json"
    path.write_text(json.dumps({"links": links}), encoding="utf-8")

    with pytest.raises(InvalidLogoLinksError):
        read_curated(path)


def test_reads_the_seeded_curated_links() -> None:
    curated = read_curated(DATA_DIRS["curation"] / "logos.json")

    assert sorted(curated) == ["euro", "uefa-cup-europa-league", "world-cup"]


def test_writes_the_list_and_names_competitions_with_no_link(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    dirs = {name: tmp_path / name for name in ("inbox", "pages", "raw", "work")}
    dirs["images"] = tmp_path / "images"
    dirs["curation"] = tmp_path / "curation"
    fixtures = dirs["pages"] / "transfermarkt" / "fixture"
    fixtures.mkdir(parents=True)
    (fixtures / "cl-2000.html").write_bytes(
        (FIXTURES / "fixtures-cl-2000.html").read_bytes()
    )
    dirs["curation"].mkdir()
    curated = {"euro": f"{HOST}/medium/euro_1763046126.png?lm=1"}
    (dirs["curation"] / "logos.json").write_text(
        json.dumps({"links": curated}), encoding="utf-8"
    )

    assert main([], dirs) == 0

    entries = json.loads(
        (dirs["work"] / "link-lists" / "s18c-logos.json").read_text(encoding="utf-8")
    )
    names = {e["saveAs"] for e in entries}
    assert {"logo-premier-league.png", "logo-euro.png"} <= names
    assert len(names) == 7
    out = capsys.readouterr().out
    assert "s18c-logos: 7 logos" in out
    assert out.count("no logo link for") == 4
    assert "no logo link for liga-portugal" in out


def test_takes_no_arguments() -> None:
    assert main(["extra"]) == 2
