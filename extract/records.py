import json
import re
import unicodedata
from collections.abc import Mapping
from functools import cache
from pathlib import Path
from typing import Final

from jsonschema import Draft202012Validator

from extract.data_dirs import DATA_DIRS

SCHEMAS_RAW_DIR: Final = Path(__file__).resolve().parent.parent / "schemas" / "raw"

# Lower-case words: no path separators or dots
PARTITION: Final = re.compile(r"^[a-z0-9]+([_-][a-z0-9]+)*$")

type JsonValue = (
    None | bool | int | float | str | list[JsonValue] | dict[str, JsonValue]
)
type Record = Mapping[str, JsonValue]


class InvalidRecordError(ValueError):
    pass


def schema_path(kind: str) -> Path:
    return SCHEMAS_RAW_DIR / f"{kind}.schema.json"


@cache
def _validator(kind: str) -> Draft202012Validator:
    path = schema_path(kind)
    if not path.is_file():
        raise InvalidRecordError(f"Unknown record kind: {kind}")
    schema = json.loads(path.read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def validate_record(kind: str, record: Record) -> None:
    errors = sorted(_validator(kind).iter_errors(record), key=lambda e: e.json_path)
    if errors:
        # The keyword, not e.message: it quotes the value
        lines = [f"  {error.json_path}: {error.validator}" for error in errors]
        raise InvalidRecordError("\n".join([f"Invalid {kind} record:", *lines]))


def nfc_record(record: Record) -> dict[str, JsonValue]:
    return {unicodedata.normalize("NFC", k): nfc(v) for k, v in record.items()}


def nfc(value: JsonValue) -> JsonValue:
    if isinstance(value, str):
        return unicodedata.normalize("NFC", value)
    if isinstance(value, list):
        return [nfc(item) for item in value]
    if isinstance(value, dict):
        return nfc_record(value)
    return value


# Appends validated records to one NDJSON partition
class RecordWriter:
    def __init__(
        self, kind: str, partition: str, raw_dir: Path = DATA_DIRS["raw"]
    ) -> None:
        source, _, name = kind.partition("-")
        if not name:
            raise InvalidRecordError(f"Kind must be <source>-<kind>: {kind}")
        if not PARTITION.match(partition):
            raise InvalidRecordError(f"Invalid partition name for {kind}")
        _validator(kind)
        self.kind: Final = kind
        self.path: Final = raw_dir / source / name / f"{partition}.ndjson"

    def write(self, record: Record) -> None:
        normalized = nfc_record(record)
        validate_record(self.kind, normalized)
        try:
            line = json.dumps(
                normalized, ensure_ascii=False, sort_keys=True, allow_nan=False
            )
        except ValueError as error:
            # NaN passes jsonschema but isn't JSON
            raise InvalidRecordError(f"Invalid {self.kind} record: NaN") from error
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("a", encoding="utf-8", newline="\n") as file:
            file.write(f"{line}\n")
