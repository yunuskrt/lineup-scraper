from pathlib import Path

from extract.data_dirs import DATA_DIRS

REPO_ROOT = Path(__file__).resolve().parents[2]


def test_names_the_six_data_folders() -> None:
    assert sorted(DATA_DIRS) == [
        "cache",
        "curation",
        "dataset",
        "raw",
        "reports",
        "work",
    ]


def test_resolves_each_folder_under_the_repo_data_directory() -> None:
    for name, path in DATA_DIRS.items():
        assert path == REPO_ROOT / "data" / name
