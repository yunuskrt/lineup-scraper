from typing import Final, Literal

from parsel import Selector, SelectorList

from extract.parsers.transfermarkt.common import (
    ANY_PLAYER_ID,
    DATUM,
    MATCH_ID,
    PLAYER_ID,
    TEAM_ID,
    ParseError,
    id_in,
    require,
    text,
    text_or_none,
)
from extract.parsers.transfermarkt.records import (
    BenchPlayer,
    Event,
    Kick,
    Ref,
    Side,
    Starter,
    TransfermarktMatch,
)

HOME_TEAM: Final = '//div[@class="sb-team sb-heim"]'
AWAY_TEAM: Final = '//div[@class="sb-team sb-gast"]'
LINEUP: Final = (
    '//h2[contains(@class, "content-box-headline")]'
    '[contains(translate(., "LINEUP", "lineup"), "line")]'
    '[contains(translate(., "LINEUP", "lineup"), "up")]/..'
)
HOME_LINEUP: Final = './/div[@class="large-6 columns aufstellung-box"]'
AWAY_LINEUP: Final = './/div[@class="large-6 columns"]'
EVENT_BOXES: Final[tuple[tuple[str, Literal["goal", "card", "substitution"]], ...]] = (
    ("sb-tore", "goal"),
    ("sb-karten", "card"),
    ("sb-wechsel", "substitution"),
)


def player_ref(link: Selector, what: str) -> Ref:
    player_id = require(id_in(link.attrib.get("href"), PLAYER_ID), what)
    return {"sourceId": player_id, "name": require(text_or_none(link), what)}


def starters(box: SelectorList[Selector], side: str) -> list[Starter]:
    found: list[Starter] = []
    for player in box.xpath('.//div[@class="formation-player-container"]'):
        link = player.xpath('.//span[@class="formation-number-name"]/a')[0]
        ref = player_ref(link, f"{side} starter span.formation-number-name > a")
        found.append(
            {
                **ref,
                "profilePath": require(
                    link.attrib.get("href"), f"{side} starter profile link"
                ),
                "shirtNumber": text_or_none(
                    player.xpath('.//div[contains(@class, "tm-shirt-number")]')
                ),
                "style": require(player.attrib.get("style"), f"{side} starter style"),
                "isCaptain": bool(
                    player.xpath('.//*[contains(@class, "kapitaenicon")]')
                ),
            }
        )
    if not found:
        raise ParseError(f"No {side} starters (div.formation-player-container)")
    return found


def bench(box: SelectorList[Selector], side: str) -> list[BenchPlayer]:
    rows = box.xpath('.//table[contains(@class, "ersatzbank")]//tr')
    found: list[BenchPlayer] = []
    # The last row is the coach
    for row in rows[:-1]:
        links = row.xpath('.//a[contains(@href, "/profil/spieler/")]')
        if not links:
            continue
        ref = player_ref(links[0], f"{side} bench table.ersatzbank a")
        cells = row.xpath("./td")
        found.append(
            {
                **ref,
                "shirtNumber": text_or_none(
                    row.xpath('.//div[contains(@class, "tm-shirt-number")]')
                ),
                "position": text_or_none(cells[-1]) if cells else None,
            }
        )
    return found


def team_side(
    page: Selector, team_xpath: str, lineup: SelectorList[Selector], side: str
) -> Side:
    team = page.xpath(team_xpath)
    link = team.xpath('.//a[contains(@class, "sb-vereinslink")]')
    team_id = require(
        id_in(link.attrib.get("href") if link else None, TEAM_ID),
        f"{side} a.sb-vereinslink",
    )
    return {
        "sourceId": team_id,
        "name": require(text_or_none(link), f"{side} team name"),
        # Each side's own box (reference § 12 #1)
        "tablePosition": text_or_none(team.xpath("(.//p)[1]")),
        "formation": text_or_none(
            lineup.xpath('.//div[contains(@class, "formation-subtitle")]')
        ),
        "starters": starters(lineup, side),
        "bench": bench(lineup, side),
    }


def event_players(item: Selector) -> list[Ref]:
    names: dict[str, str] = {}
    for link in item.xpath('.//a[contains(@href, "/spieler/")]'):
        player_id = id_in(link.attrib.get("href"), ANY_PLAYER_ID)
        if player_id is None or names.get(player_id):
            continue
        image = link.xpath(".//img")
        names[player_id] = (
            text(link)
            or link.attrib.get("title", "")
            or (image.attrib.get("title", "") if image else "")
        )
    return [{"sourceId": pid, "name": name} for pid, name in names.items() if name]


def events(page: Selector) -> list[Event]:
    found: list[Event] = []
    for box_id, box in EVENT_BOXES:
        for item in page.xpath(f'//div[@id="{box_id}"]//li'):
            classes = item.attrib.get("class", "")
            if "sb-aktion-heim" not in classes and "sb-aktion-gast" not in classes:
                continue
            clock = item.xpath('.//span[contains(@class, "sb-sprite-uhr-klein")]')
            found.append(
                {
                    "box": box,
                    "side": "home" if "sb-aktion-heim" in classes else "away",
                    "clock": clock.attrib.get("style") if clock else None,
                    "addedTime": text_or_none(clock) if clock else None,
                    "players": event_players(item),
                    "text": require(text_or_none(item), f"{box_id} li text"),
                }
            )
    return found


# The box id is misspelt on the page
def shootout(page: Selector) -> list[Kick]:
    kicks: list[Kick] = []
    for item in page.xpath('//div[@id="sb-elfmeterscheissen"]//li'):
        classes = item.attrib.get("class", "")
        if "sb-aktion-heim" not in classes and "sb-aktion-gast" not in classes:
            continue
        outcome = item.xpath('.//div[@class="sb-aktion-uhr"]/span/@title').get()
        kicks.append(
            {
                "side": "home" if "sb-aktion-heim" in classes else "away",
                "outcome": require(outcome, "sb-elfmeterscheissen kick title"),
            }
        )
    return kicks


def parse_match_report(html: str, url: str, fetched_at: str) -> TransfermarktMatch:
    page = Selector(text=html)
    match_id = require(id_in(url, MATCH_ID), "match id in the URL")
    when = page.xpath('//p[@class="sb-datum hide-for-small"]')
    lineup = page.xpath(LINEUP)
    # Desktop and mobile both carry a score box
    score = page.xpath('//div[@class="sb-endstand"]')[:1]
    return {
        "source": "transfermarkt",
        "sourceId": match_id,
        "sourceUrl": url,
        "fetchedAt": fetched_at,
        "round": require(text(when).split("|")[0].strip() or None, "p.sb-datum round"),
        "date": require(
            id_in(when.xpath('.//a[contains(@href, "datum/")]/@href').get(), DATUM),
            "p.sb-datum datum/ link",
        ),
        "result": require(
            " ".join(" ".join(score.xpath("./text()").getall()).split()) or None,
            "div.sb-endstand",
        ),
        "resultNote": text_or_none(score.xpath('./div[@class="sb-halbzeit"]'), sep=""),
        "home": team_side(page, HOME_TEAM, lineup.xpath(HOME_LINEUP), "home"),
        "away": team_side(page, AWAY_TEAM, lineup.xpath(AWAY_LINEUP)[:1], "away"),
        "events": events(page),
        "shootout": shootout(page),
    }
