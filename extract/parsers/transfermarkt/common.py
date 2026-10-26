import re
from typing import Final

from parsel import Selector, SelectorList

DATUM: Final = re.compile(r"datum/([0-9]{4}-[0-9]{2}-[0-9]{2})")
TEAM_ID: Final = re.compile(r"/verein/([0-9]+)")
PLAYER_ID: Final = re.compile(r"/profil/spieler/([0-9]+)")
# Event items also link /leistungsdatendetails/spieler/{id}
ANY_PLAYER_ID: Final = re.compile(r"/spieler/([0-9]+)")
MATCH_ID: Final = re.compile(r"/spielbericht/([0-9]+)")


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


def require[T](value: T | None, what: str) -> T:
    if value is None:
        raise ParseError(f"Missing {what}")
    return value
