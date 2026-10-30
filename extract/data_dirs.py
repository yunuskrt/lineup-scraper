from collections.abc import Mapping
from pathlib import Path
from typing import Final

DATA_ROOT: Final = Path(__file__).resolve().parent.parent / "data"

DATA_DIRS: Final[Mapping[str, Path]] = {
    "cache": DATA_ROOT / "cache",
    "raw": DATA_ROOT / "raw",
    "work": DATA_ROOT / "work",
    "reports": DATA_ROOT / "reports",
    "curation": DATA_ROOT / "curation",
    "dataset": DATA_ROOT / "dataset",
    # Pages the user saved, before and after import
    "inbox": DATA_ROOT / "inbox",
    "pages": DATA_ROOT / "pages",
    # Crests and photos the user saved, by id
    "images": DATA_ROOT / "images",
    # The 5 link CSVs `npm run status` writes
    "inbox-lists": DATA_ROOT / "inbox-lists",
}
