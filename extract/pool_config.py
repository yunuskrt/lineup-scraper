import json
from pathlib import Path
from typing import Final, Literal, TypedDict, cast

from jsonschema import Draft202012Validator

from extract.data_dirs import DATA_DIRS

POOL_CONFIG: Final = DATA_DIRS["curation"] / "pool.json"
POOL_SCHEMA: Final = (
    Path(__file__).resolve().parent.parent / "schemas" / "curation" / "pool.schema.json"
)
YEAR_BEFORE_KINDS: Final = frozenset({"world_cup", "euro"})
# Euro 2020 (Covid): saison_id 2020, played in 2021
SEASON_ID_FIXES: Final = {("euro", 2019): 2020}
# Those ids name their own year
SAME_YEAR_IDS: Final = frozenset(
    (kind, fixed) for (kind, _), fixed in SEASON_ID_FIXES.items()
)


class InvalidPoolConfigError(ValueError):
    pass


class Seasons(TypedDict):
    first: int
    last: int
    step: int


class Competition(TypedDict):
    code: str
    kind: str
    name: str
    urlSlug: str
    linkStyle: Literal["league", "cup"]
    seasons: Seasons
    groups: list[str]
    isVerified: bool


class Club(TypedDict):
    key: str
    name: str
    league: str
    id: str | None


class PoolConfig(TypedDict):
    competitions: list[Competition]
    clubs: list[Club]


# The shape only; cross-checks live in src/pool/config.ts
def read_pool_config(
    path: Path = POOL_CONFIG, schema: Path = POOL_SCHEMA
) -> PoolConfig:
    config = json.loads(path.read_text(encoding="utf-8"))
    validator = Draft202012Validator(json.loads(schema.read_text(encoding="utf-8")))
    errors = sorted(validator.iter_errors(config), key=lambda e: e.json_path)
    if errors:
        lines = [f"  {error.json_path}: {error.validator}" for error in errors]
        raise InvalidPoolConfigError("\n".join(["Invalid pool config:", *lines]))
    return cast(PoolConfig, config)


def season_ids(competition: Competition) -> list[int]:
    seasons = competition["seasons"]
    kind = competition["kind"]
    ids = range(seasons["first"], seasons["last"] + 1, seasons["step"])
    return [SEASON_ID_FIXES.get((kind, season_id), season_id) for season_id in ids]


# 2002 -> 2002-03; a World Cup or Euro saison_id is the year before
def season_label(competition: Competition, season_id: int) -> str:
    if (competition["kind"], season_id) in SAME_YEAR_IDS:
        return str(season_id)
    if competition["kind"] in YEAR_BEFORE_KINDS:
        return str(season_id + 1)
    return f"{season_id}-{(season_id + 1) % 100:02d}"
