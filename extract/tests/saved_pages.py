import os
import shutil
from datetime import UTC, datetime
from pathlib import Path
from typing import Final

from extract.import_log import IMPORT_LOG
from extract.inbox import Report, import_inbox

FIXTURES: Final = Path(__file__).resolve().parent / "fixtures" / "transfermarkt"
SAVED_AT: Final = 1_793_059_200  # 2026-10-27T00:00:00Z
RUN_AT: Final = datetime(2026, 10, 27, 12, 0, tzinfo=UTC)


# Temporary data folders, filled from the saved fixtures
class Dirs:
    def __init__(self, root: Path) -> None:
        self.inbox = root / "inbox"
        self.pages = root / "pages"
        self.raw = root / "raw"
        self.work = root / "work"
        self.images = root / "images"
        self.log = self.work / IMPORT_LOG
        self.inbox.mkdir()

    def folders(self) -> dict[str, Path]:
        return {
            "inbox": self.inbox,
            "pages": self.pages,
            "raw": self.raw,
            "work": self.work,
            "images": self.images,
        }

    def save(self, fixture: str, as_name: str | None = None) -> Path:
        target = self.inbox / (as_name or f"{fixture}.html")
        shutil.copyfile(FIXTURES / f"{fixture}.html", target)
        os.utime(target, (SAVED_AT, SAVED_AT))
        return target

    def run(self, expect: Path | None = None) -> Report:
        return import_inbox(
            self.inbox,
            self.pages,
            self.raw,
            "probe",
            expect,
            self.log,
            RUN_AT,
            images_dir=self.images,
        )
