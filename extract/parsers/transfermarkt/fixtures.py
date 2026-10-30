from parsel import Selector

from extract.parsers.transfermarkt.common import (
    DATUM,
    MATCH_ID,
    TEAM_ID,
    ParseError,
    id_in,
    text,
    text_or_none,
)
from extract.parsers.transfermarkt.records import Ref, TransfermarktFixture

MATCH_LINK = './/a[contains(@href, "/spielbericht/")]'
SHOWN_SEASON = '//select[@name="saison_id"]/option[@selected]/@value'
HEADLINE = (
    'ancestor::div[.//*[contains(@class, "content-box-headline")]][1]'
    '//*[contains(@class, "content-box-headline")][1]'
)


def teams(row: Selector) -> tuple[Ref, Ref]:
    found: dict[str, str] = {}
    for link in row.xpath('.//a[contains(@href, "/verein/")]'):
        team_id = id_in(link.attrib.get("href"), TEAM_ID)
        if team_id and team_id not in found:
            found[team_id] = link.attrib.get("title") or text(link)
    if len(found) != 2 or not all(found.values()):
        raise ParseError("Fixture row needs two a[href*=/verein/] teams")
    (home_id, home), (away_id, away) = found.items()
    return {"sourceId": home_id, "name": home}, {"sourceId": away_id, "name": away}


# Every match row; the date is the last datum/ link above it
def parse_fixture_list(
    html: str,
    url: str,
    fetched_at: str,
    competition_code: str,
    season_id: str | None,
) -> list[TransfermarktFixture]:
    page = Selector(text=html)
    # Transfermarkt shows another season for a missing one
    shown = page.xpath(SHOWN_SEASON).get()
    if season_id is not None and shown is not None and shown != season_id:
        raise ParseError(f"Shows season {shown}, not {season_id}: no such page")
    records: list[TransfermarktFixture] = []
    seen: set[str] = set()
    tables = page.xpath(f"//table[{MATCH_LINK}][not(.//table)]")
    for table in tables:
        date: str | None = None
        round_name = text_or_none(table.xpath(HEADLINE))
        for row in table.xpath("./tr | ./tbody/tr"):
            datum = id_in(
                row.xpath('.//a[contains(@href, "datum/")]/@href').get(), DATUM
            )
            date = datum or date
            link = row.xpath(MATCH_LINK)
            match_id = id_in(link.attrib.get("href"), MATCH_ID) if link else None
            if match_id is None or match_id in seen:
                continue
            seen.add(match_id)
            home, away = teams(row)
            records.append(
                {
                    "source": "transfermarkt",
                    "sourceId": match_id,
                    "sourceUrl": url,
                    "fetchedAt": fetched_at,
                    "competitionCode": competition_code,
                    "seasonId": season_id,
                    "round": round_name,
                    "stage": text_or_none(row.xpath('./td[@class="zentriert"]')),
                    "date": date,
                    "home": home,
                    "away": away,
                    "result": text_or_none(link[0]),
                }
            )
    if not records:
        raise ParseError("No match rows (a[href*=/spielbericht/])")
    return records
