import argparse
import json
import sys
import webbrowser
from collections.abc import Callable, Iterable, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Final, Literal, TypedDict, cast

from extract.data_dirs import DATA_DIRS
from extract.images import IMAGE_KINDS
from extract.pages import (
    HOME,
    Kind,
    Page,
    PageId,
    RefusedPageError,
    Snapshot,
    classify,
    snapshot,
)
from extract.parsers.transfermarkt.common import IMAGE_HOST
from extract.records import PARTITION

LINK_LISTS: Final = "link-lists"
INBOX_LISTS: Final = "inbox-lists"
INBOX_FOLDER: Final = "data/inbox/"
OPEN_COUNT: Final = 5
# `open general` reads inbox-lists/general.csv
GENERAL_LIST: Final = "general"

type Opener = Callable[[str], object]
type GroupField = Literal["group", "competition", "season"]


class ListEntry(TypedDict, total=False):
    url: str
    kind: Kind
    key: str
    saveAs: str
    group: str
    competition: str
    season: str


@dataclass(frozen=True)
class Link:
    page: Page
    group: str | None = None
    competition: str | None = None
    season: str | None = None

    def field(self, name: GroupField) -> str | None:
        return {
            "group": self.group,
            "competition": self.competition,
            "season": self.season,
        }[name]


def link(
    url: str,
    group: str | None = None,
    competition: str | None = None,
    season: str | None = None,
) -> Link:
    is_known = url.startswith(HOME) or url.startswith(IMAGE_HOST)
    if not is_known or url.split() != [url]:
        raise RefusedPageError(
            f"not a single Transfermarkt page or image link: {url!r}"
        )
    return Link(classify(url), group, competition, season)


def list_path(lists_dir: Path, name: str) -> Path:
    if not PARTITION.match(name):
        raise ValueError(f"Invalid link list name: {name}")
    return lists_dir / f"{name}.json"


def to_entry(item: Link) -> ListEntry:
    entry: ListEntry = {
        "url": item.page.url,
        "kind": item.page.kind,
        "key": item.page.key,
        "saveAs": item.page.save_as,
    }
    if item.group is not None:
        entry["group"] = item.group
    if item.competition is not None:
        entry["competition"] = item.competition
    if item.season is not None:
        entry["season"] = item.season
    return entry


# Each page once, in the caller's order
def write_link_list(lists_dir: Path, name: str, links: Iterable[Link]) -> Path:
    path = list_path(lists_dir, name)
    seen: set[PageId] = set()
    entries: list[ListEntry] = []
    for item in links:
        if item.page.id not in seen:
            seen.add(item.page.id)
            entries.append(to_entry(item))
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(entries, ensure_ascii=False, indent=2, sort_keys=True)
    path.write_text(f"{text}\n", encoding="utf-8")
    return path


def read_link_list(path: Path) -> list[Link]:
    entries = cast(list[ListEntry], json.loads(path.read_text(encoding="utf-8")))
    return [
        link(e["url"], e.get("group"), e.get("competition"), e.get("season"))
        for e in entries
    ]


def list_names(lists_dir: Path) -> list[str]:
    return sorted(path.stem for path in lists_dir.glob("*.json"))


def how_to_save(links: list[Link]) -> list[str]:
    if links and all(item.page.kind in IMAGE_KINDS for item in links):
        return [
            "Open each link: it shows the image alone. Save it with ⌘S (Ctrl+S)",
            f"into `{INBOX_FOLDER}` under the name shown (the browser's own name,",
            "or `crest-<id>` / `photo-<id>` where that one can't say which),",
            "then run `uv run python -m extract.inbox`.",
        ]
    return [
        f"Save each page as **HTML only** into `{INBOX_FOLDER}`, under the name shown,",
        "then run `uv run python -m extract.inbox` (`context/docs/manual-work.md`).",
    ]


def render(name: str, links: list[Link], state: Snapshot) -> str:
    saved = sum(state.status(item.page.id) in {"imported", "parsed"} for item in links)
    rows = []
    for item in links:
        status = state.status(item.page.id)
        if status == "missing":
            rows.append((item, "to save"))
        elif status == "inbox":
            rows.append((item, "in inbox, run the import"))
    lines = [
        f"# Link list: {name}",
        "",
        f"Saved: {saved}/{len(links)}. Still to save: {len(rows)}.",
        "",
        *how_to_save(links),
        "",
        "| # | Link | Save as | Folder | Status |",
        "| --- | --- | --- | --- | --- |",
    ]
    for index, (item, note) in enumerate(rows, start=1):
        page = item.page
        lines.append(
            f"| {index} | {page.url} | `{page.save_as}` | `{INBOX_FOLDER}` | {note} |"
        )
    return "\n".join(lines) + "\n"


def show(dirs: Mapping[str, Path], name: str) -> Path:
    links = read_link_list(list_path(dirs["work"] / LINK_LISTS, name))
    state = snapshot(dirs["inbox"], dirs["pages"], dirs["raw"], dirs.get("images"))
    target = dirs["work"] / INBOX_LISTS / f"{name}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(render(name, links, state), encoding="utf-8")
    return target


# Hands links to the user's browser; never reads a page
def open_next(
    dirs: Mapping[str, Path], name: str, count: int, opener: Opener
) -> list[Page]:
    if name == GENERAL_LIST:
        # Imported here: the tracker imports this module
        from extract.tracker import next_to_save

        pages = next_to_save(dirs["inbox-lists"], count)
        for page in pages:
            opener(page.url)
        return pages
    links = read_link_list(list_path(dirs["work"] / LINK_LISTS, name))
    state = snapshot(dirs["inbox"], dirs["pages"], dirs["raw"], dirs.get("images"))
    pages = [i.page for i in links if state.status(i.page.id) == "missing"][:count]
    for page in pages:
        opener(page.url)
    return pages


def positive(value: str) -> int:
    count = int(value)
    if count < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return count


def main(
    argv: list[str],
    dirs: Mapping[str, Path] = DATA_DIRS,
    opener: Opener = webbrowser.open,
) -> int:
    parser = argparse.ArgumentParser(prog="python -m extract.links")
    commands = parser.add_subparsers(dest="command", required=True)
    new = commands.add_parser("new", help="make a list from links")
    new.add_argument("name")
    new.add_argument("urls", nargs="+")
    commands.add_parser("show", help="write the to-save Markdown").add_argument("name")
    opening = commands.add_parser("open", help="open unsaved links in your browser")
    opening.add_argument("name")
    opening.add_argument("--count", type=positive, default=OPEN_COUNT)
    args = parser.parse_args(argv)
    lists_dir = dirs["work"] / LINK_LISTS
    try:
        if args.command == "new":
            path = write_link_list(lists_dir, args.name, [link(u) for u in args.urls])
            print(f"wrote {path}")
            print(f"wrote {show(dirs, args.name)}")
        elif args.command == "show":
            print(f"wrote {show(dirs, args.name)}")
        else:
            pages = open_next(dirs, args.name, args.count, opener)
            print(f"opened {len(pages)}; save each into {INBOX_FOLDER} as:")
            for page in pages:
                print(f"  {page.save_as}")
    except (RefusedPageError, ValueError, FileNotFoundError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
