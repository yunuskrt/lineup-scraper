import json
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, Literal, TypedDict, cast

from extract.pages import Kind

type Result = Literal["imported", "duplicate", "refused"]

IMPORT_LOG: Final = "import-log.ndjson"


# Ids and outcomes only, never page text or a name
class LogLine(TypedDict):
    at: str
    file: str
    url: str | None
    kind: Kind | None
    key: str | None
    result: Result
    reason: str | None
    records: int
    backfilled: bool


def timestamp(moment: datetime) -> str:
    return moment.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def read_log(path: Path) -> list[LogLine]:
    if not path.is_file():
        return []
    lines = path.read_text(encoding="utf-8").splitlines()
    return [cast(LogLine, json.loads(line)) for line in lines if line.strip()]


def append_log(path: Path, lines: Iterable[LogLine]) -> int:
    rows = [json.dumps(line, ensure_ascii=False, sort_keys=True) for line in lines]
    if not rows:
        return 0
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8", newline="\n") as file:
        file.writelines(f"{row}\n" for row in rows)
    return len(rows)
