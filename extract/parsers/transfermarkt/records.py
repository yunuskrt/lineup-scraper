from typing import Literal, TypedDict

# Field for field with src/raw/transfermarkt-*.ts

type Source = Literal["transfermarkt"]


class Ref(TypedDict):
    sourceId: str
    name: str


class TransfermarktFixture(TypedDict):
    source: Source
    sourceId: str
    sourceUrl: str
    fetchedAt: str
    competitionCode: str
    seasonId: str | None
    round: str | None
    stage: str | None
    date: str | None
    home: Ref
    away: Ref
    result: str | None


class Starter(TypedDict):
    sourceId: str
    name: str
    shirtNumber: str | None
    style: str
    isCaptain: bool


class BenchPlayer(TypedDict):
    sourceId: str
    name: str
    shirtNumber: str | None
    position: str | None


class Side(TypedDict):
    sourceId: str
    name: str
    tablePosition: str | None
    formation: str | None
    starters: list[Starter]
    bench: list[BenchPlayer]


class Event(TypedDict):
    box: Literal["goal", "card", "substitution"]
    side: Literal["home", "away"]
    clock: str | None
    addedTime: str | None
    players: list[Ref]
    text: str


class Kick(TypedDict):
    side: Literal["home", "away"]
    outcome: str


class TransfermarktMatch(TypedDict):
    source: Source
    sourceId: str
    sourceUrl: str
    fetchedAt: str
    round: str
    date: str
    result: str
    resultNote: str | None
    home: Side
    away: Side
    events: list[Event]
    shootout: list[Kick]


class TransfermarktPlayer(TypedDict):
    source: Source
    sourceId: str
    sourceUrl: str
    fetchedAt: str
    headline: str
    dateOfBirth: str | None
    citizenship: str | None
    position: str | None
