import re
from typing import Final

from parsel import Selector, SelectorList

DATUM: Final = re.compile(r"datum/([0-9]{4}-[0-9]{2}-[0-9]{2})")
TEAM_ID: Final = re.compile(r"/verein/([0-9]+)")
PLAYER_ID: Final = re.compile(r"/profil/spieler/([0-9]+)")
# Event items also link /leistungsdatendetails/spieler/{id}
ANY_PLAYER_ID: Final = re.compile(r"/spieler/([0-9]+)")
MATCH_ID: Final = re.compile(r"/spielbericht/([0-9]+)")
IMAGE_HOST: Final = "https://img.a.transfermarkt.technology/"
# `…/wappen/normquad/27_1400571853.png`
CREST_ID: Final = re.compile(r"/wappen/[a-z]+/([0-9]+)(?:_[0-9]+)?\.[a-z]+(?:\?|$)")
# `206-1663667692.jpg` or `s_7573_123_2012_1.jpg`
PHOTO_ID: Final = re.compile(
    r"/portrait/[a-z]+/(?:s_)?([0-9]+)(?:[-_][0-9_]+)?\.[a-z]+(?:\?|$)"
)


# Names a selector or field, never page text
class ParseError(ValueError):
    pass


def text(node: Selector | SelectorList[Selector], sep: str = " ") -> str:
    return " ".join(sep.join(node.xpath(".//text()").getall()).split())


# sep="" keeps `(<span>1:</span>0)` as `(1:0)`
def text_or_none(node: Selector | SelectorList[Selector], sep: str = " ") -> str | None:
    return text(node, sep) or None


def id_in(href: str | None, pattern: re.Pattern[str]) -> str | None:
    match = pattern.search(href or "")
    return match.group(1) if match else None


# Placeholders (`default.jpg`) give None
def image_url(src: str | None, pattern: re.Pattern[str]) -> str | None:
    if not src or not src.startswith(IMAGE_HOST):
        return None
    return src if id_in(src, pattern) is not None else None


def require[T](value: T | None, what: str) -> T:
    if value is None:
        raise ParseError(f"Missing {what}")
    return value
