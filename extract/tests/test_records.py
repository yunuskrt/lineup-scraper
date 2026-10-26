import copy
import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

from extract.records import (
    SCHEMAS_RAW_DIR,
    InvalidRecordError,
    JsonValue,
    RecordWriter,
    validate_record,
)

EXAMPLES_DIR = SCHEMAS_RAW_DIR / "examples"
KINDS = sorted(
    p.name.removesuffix(".schema.json") for p in SCHEMAS_RAW_DIR.glob("*.schema.json")
)


def examples(verdict: str) -> list[tuple[str, str, dict[str, JsonValue]]]:
    cases = []
    for kind in KINDS:
        path = EXAMPLES_DIR / f"{kind}.{verdict}.json"
        for case in json.loads(path.read_text(encoding="utf-8")):
            cases.append((kind, case["name"], case["record"]))
    return cases


def first_valid(kind: str) -> dict[str, JsonValue]:
    return copy.deepcopy(next(r for k, _, r in examples("valid") if k == kind))


def read_lines(path: Path) -> list[dict[str, JsonValue]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines()]


def starter(
    record: dict[str, JsonValue], side: str, index: int
) -> dict[str, JsonValue]:
    team = record[side]
    assert isinstance(team, dict)
    starters = team["starters"]
    assert isinstance(starters, list)
    player = starters[index]
    assert isinstance(player, dict)
    return player


def test_finds_the_schema_files() -> None:
    assert KINDS == [
        "transfermarkt-fixture",
        "transfermarkt-match",
        "transfermarkt-player",
    ]


@pytest.mark.parametrize("kind", KINDS)
def test_each_schema_is_valid_draft_2020_12(kind: str) -> None:
    schema = json.loads((SCHEMAS_RAW_DIR / f"{kind}.schema.json").read_text())
    assert schema["$schema"] == "https://json-schema.org/draft/2020-12/schema"
    Draft202012Validator.check_schema(schema)


@pytest.mark.parametrize("kind", KINDS)
def test_each_kind_has_both_example_files(kind: str) -> None:
    for verdict in ("valid", "invalid"):
        assert (EXAMPLES_DIR / f"{kind}.{verdict}.json").is_file()


@pytest.mark.parametrize(("kind", "name", "record"), examples("valid"))
def test_accepts_valid_example(
    kind: str, name: str, record: dict[str, JsonValue]
) -> None:
    validate_record(kind, record)


@pytest.mark.parametrize(("kind", "name", "record"), examples("invalid"))
def test_rejects_invalid_example(
    kind: str, name: str, record: dict[str, JsonValue]
) -> None:
    with pytest.raises(InvalidRecordError):
        validate_record(kind, record)


def test_error_names_the_path_and_keyword_never_the_value() -> None:
    record = first_valid("transfermarkt-match")
    player = starter(record, "home", 2)
    player["name"] = ""
    player["isCaptain"] = "-73"
    record["sourceUrl"] = "secret-host/path"

    with pytest.raises(InvalidRecordError) as raised:
        validate_record("transfermarkt-match", record)

    message = str(raised.value)
    assert message.splitlines() == [
        "Invalid transfermarkt-match record:",
        "  $.home.starters[2].isCaptain: type",
        "  $.home.starters[2].name: minLength",
        "  $.sourceUrl: pattern",
    ]
    assert "secret" not in message
    assert "-73" not in message


def test_unknown_kind_is_refused() -> None:
    with pytest.raises(InvalidRecordError, match="Unknown record kind"):
        validate_record("transfermarkt-standings", {})


def test_writer_appends_nfc_lines_with_sorted_keys(tmp_path: Path) -> None:
    writer = RecordWriter("transfermarkt-fixture", "uel-2004-05", raw_dir=tmp_path)
    record = first_valid("transfermarkt-fixture")
    record["round"] = "\u00d6rnek Su\u0308per Lig"

    writer.write(record)
    writer.write(first_valid("transfermarkt-fixture"))

    path = tmp_path / "transfermarkt" / "fixture" / "uel-2004-05.ndjson"
    assert writer.path == path
    lines = path.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert "\u00d6rnek S\u00fcper Lig" in lines[0]
    assert "\\u" not in lines[0]
    assert list(json.loads(lines[0])) == sorted(json.loads(lines[0]))
    assert read_lines(path)[0]["round"] == "\u00d6rnek S\u00fcper Lig"


def test_writer_composes_nested_names(tmp_path: Path) -> None:
    writer = RecordWriter("transfermarkt-match", "ucl-2005", raw_dir=tmp_path)
    record = first_valid("transfermarkt-match")
    starter(record, "away", 4)["name"] = "S\u0327ahin Gu\u0308rses"

    writer.write(record)

    written = read_lines(writer.path)[0]
    assert starter(written, "away", 4)["name"] == "\u015eahin G\u00fcrses"


def test_writer_refuses_a_kind_without_a_source(tmp_path: Path) -> None:
    with pytest.raises(InvalidRecordError, match="Kind must be"):
        RecordWriter("match", "ucl-2005", raw_dir=tmp_path)


def test_writer_keeps_earlier_lines(tmp_path: Path) -> None:
    RecordWriter("transfermarkt-fixture", "ucl-2005", raw_dir=tmp_path).write(
        first_valid("transfermarkt-fixture")
    )
    RecordWriter("transfermarkt-fixture", "ucl-2005", raw_dir=tmp_path).write(
        first_valid("transfermarkt-fixture")
    )
    path = tmp_path / "transfermarkt" / "fixture" / "ucl-2005.ndjson"
    assert len(read_lines(path)) == 2


def test_writer_writes_nothing_for_an_invalid_record(tmp_path: Path) -> None:
    writer = RecordWriter("transfermarkt-fixture", "ucl-2005", raw_dir=tmp_path)
    record = first_valid("transfermarkt-fixture")
    record["sourceId"] = 900001

    with pytest.raises(InvalidRecordError):
        writer.write(record)
    assert not writer.path.exists()


@pytest.mark.parametrize("number", [float("nan"), float("inf")])
def test_writer_refuses_a_non_finite_number(tmp_path: Path, number: float) -> None:
    writer = RecordWriter("transfermarkt-match", "ucl-2005", raw_dir=tmp_path)
    record = first_valid("transfermarkt-match")
    starter(record, "home", 0)["isCaptain"] = number

    with pytest.raises(InvalidRecordError):
        writer.write(record)
    assert not writer.path.exists()


@pytest.mark.parametrize(
    "partition", ["", "../escape", "UCL-2005", "ucl/2005", "ucl.2005", "-ucl"]
)
def test_writer_refuses_a_bad_partition(tmp_path: Path, partition: str) -> None:
    with pytest.raises(InvalidRecordError, match="Invalid partition"):
        RecordWriter("transfermarkt-fixture", partition, raw_dir=tmp_path)


def test_writer_refuses_an_unknown_kind(tmp_path: Path) -> None:
    with pytest.raises(InvalidRecordError, match="Unknown record kind"):
        RecordWriter("transfermarkt-standings", "ucl-2005", raw_dir=tmp_path)
