from parsel import Selector

from extract.parsers.transfermarkt.common import (
    PHOTO_ID,
    PLAYER_ID,
    id_in,
    image_url,
    require,
    text,
    text_or_none,
)
from extract.parsers.transfermarkt.records import TransfermarktPlayer


def info_table(page: Selector) -> dict[str, str]:
    spans = [
        text(span) for span in page.xpath('//div[contains(@class, "info-table")]/span')
    ]
    return {
        label: value
        for label, value in zip(spans, spans[1:], strict=False)
        if label.endswith(":") and value
    }


def header_label(page: Selector, label: str) -> str | None:
    for item in page.xpath('//li[contains(@class, "data-header__label")]'):
        if label in text(item).lower():
            return text_or_none(
                item.xpath('.//span[contains(@class, "data-header__content")]')
            )
    return None


# A header item's text after its label
def header_value(page: Selector, label: str) -> str | None:
    for item in page.xpath('//li[contains(@class, "data-header__label")]'):
        shown = text(item)
        if shown.lower().startswith(label):
            return shown[len(label) :].strip() or None
    return None


# The info table is richer (dual citizenship); the header is a fallback
def parse_player(html: str, url: str, fetched_at: str) -> TransfermarktPlayer:
    page = Selector(text=html)
    info = info_table(page)
    headline = page.xpath(
        '//div[contains(@class, "data-header__headline-container")]//h1'
    )
    return {
        "source": "transfermarkt",
        "sourceId": require(id_in(url, PLAYER_ID), "player id in the URL"),
        "sourceUrl": url,
        "fetchedAt": fetched_at,
        "headline": require(text_or_none(headline), "data-header h1"),
        "dateOfBirth": info.get("Date of birth/Age:")
        or header_label(page, "date of birth"),
        "citizenship": info.get("Citizenship:") or header_label(page, "citizenship"),
        "position": info.get("Position:") or header_label(page, "position"),
        "fullName": info.get("Full name:"),
        "nameInHomeCountry": info.get("Name in home country:"),
        "capsGoals": header_value(page, "caps/goals:"),
        "imageUrl": image_url(
            page.xpath(
                '//img[contains(@class, "data-header__profile-image")]/@src'
            ).get(),
            PHOTO_ID,
        ),
    }
