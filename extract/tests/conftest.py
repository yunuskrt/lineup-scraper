from pathlib import Path

import pytest

from extract.tests.saved_pages import Dirs


@pytest.fixture
def dirs(tmp_path: Path) -> Dirs:
    return Dirs(tmp_path)
