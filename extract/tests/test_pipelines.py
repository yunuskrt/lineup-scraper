import json
from pathlib import Path

import pytest
from scrapy.exceptions import DropItem

from extract.pipelines import RecordPipeline
from extract.records import JsonValue

EXAMPLES = Path(__file__).resolve().parents[2] / "schemas" / "raw" / "examples"


def valid_player() -> dict[str, JsonValue]:
    path = EXAMPLES / "transfermarkt-player.valid.json"
    record: dict[str, JsonValue] = json.loads(path.read_text(encoding="utf-8"))[0][
        "record"
    ]
    return record


def pipeline(tmp_path: Path, closed: list[str]) -> RecordPipeline:
    return RecordPipeline(closed.append, raw_dir=tmp_path)


def test_writes_valid_items_to_their_partition(tmp_path: Path) -> None:
    closed: list[str] = []
    records = pipeline(tmp_path, closed)
    item = {
        "kind": "transfermarkt-player",
        "partition": "pool",
        "record": valid_player(),
    }

    assert records.process_item(item) is item
    records.process_item(item)

    path = tmp_path / "transfermarkt" / "player" / "pool.ndjson"
    assert len(path.read_text(encoding="utf-8").splitlines()) == 2
    assert closed == []


def test_an_invalid_record_fails_the_run(tmp_path: Path) -> None:
    closed: list[str] = []
    record = valid_player()
    record["headline"] = ""
    item = {"kind": "transfermarkt-player", "partition": "pool", "record": record}

    with pytest.raises(DropItem, match="invalid_record"):
        pipeline(tmp_path, closed).process_item(item)

    assert closed == ["invalid_record"]
    assert not (tmp_path / "transfermarkt").exists()


@pytest.mark.parametrize(
    "item",
    [
        {"partition": "pool", "record": {}},
        {"kind": "transfermarkt-player", "record": {}},
        {"kind": "transfermarkt-player", "partition": "pool", "record": []},
        {"kind": "transfermarkt-player", "partition": "../up", "record": {}},
        {"kind": "transfermarkt-standings", "partition": "pool", "record": {}},
    ],
)
def test_a_malformed_item_fails_the_run(
    tmp_path: Path, item: dict[str, object]
) -> None:
    closed: list[str] = []
    with pytest.raises(DropItem):
        pipeline(tmp_path, closed).process_item(item)
    assert closed == ["invalid_record"]
