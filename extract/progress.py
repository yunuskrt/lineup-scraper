import argparse
import json
import sys
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Final, TypedDict

from extract.data_dirs import DATA_DIRS
from extract.links import (
    LINK_LISTS,
    GroupField,
    Link,
    list_names,
    list_path,
    read_link_list,
)
from extract.pages import RefusedPageError, Snapshot, snapshot

NONE_LABEL: Final = "(none)"


class Tally(TypedDict):
    total: int
    imported: int
    parsed: int
    inInbox: int
    missing: int
    unparsed: list[str]


class ListProgress(TypedDict):
    name: str
    tally: Tally
    by: dict[str, Tally]


def tally(links: Sequence[Link], state: Snapshot) -> Tally:
    statuses = [state.status(item.page.id) for item in links]
    return {
        "total": len(links),
        "imported": sum(s in {"imported", "parsed"} for s in statuses),
        "parsed": statuses.count("parsed"),
        "inInbox": statuses.count("inbox"),
        "missing": statuses.count("missing"),
        "unparsed": [
            f"{item.page.kind}:{item.page.key}"
            for item, status in zip(links, statuses, strict=True)
            if status == "imported"
        ],
    }


def progress(
    name: str, links: Sequence[Link], state: Snapshot, by: GroupField | None
) -> ListProgress:
    groups: dict[str, list[Link]] = {}
    if by is not None:
        for item in links:
            groups.setdefault(item.field(by) or NONE_LABEL, []).append(item)
    return {
        "name": name,
        "tally": tally(links, state),
        "by": {label: tally(group, state) for label, group in sorted(groups.items())},
    }


def share(count: int, total: int) -> str:
    percent = 100 * count / total if total else 0.0
    return f"{count}/{total} ({percent:.1f}%)"


def tally_lines(counts: Tally, indent: str) -> list[str]:
    stages = [
        ("imported", counts["imported"]),
        ("parsed", counts["parsed"]),
        ("in inbox", counts["inInbox"]),
        ("missing", counts["missing"]),
    ]
    lines = [f"{indent}{label:<9} {share(n, counts['total'])}" for label, n in stages]
    if counts["unparsed"]:
        lines.append(
            f"{indent}imported but not parsed: {', '.join(counts['unparsed'])}"
        )
    return lines


def report_lines(result: ListProgress) -> list[str]:
    lines = [f"{result['name']} ({result['tally']['total']} pages)"]
    lines += tally_lines(result["tally"], "  ")
    for label, counts in result["by"].items():
        lines.append(f"  {label}")
        lines += tally_lines(counts, "    ")
    return lines


def main(argv: list[str], dirs: Mapping[str, Path] = DATA_DIRS) -> int:
    parser = argparse.ArgumentParser(prog="python -m extract.progress")
    parser.add_argument("names", nargs="*")
    parser.add_argument("--by", choices=["group", "competition", "season"])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    lists_dir = dirs["work"] / LINK_LISTS
    names = args.names or list_names(lists_dir)
    state = snapshot(dirs["inbox"], dirs["pages"], dirs["raw"])
    try:
        results = [
            progress(name, read_link_list(list_path(lists_dir, name)), state, args.by)
            for name in names
        ]
    except (RefusedPageError, ValueError, FileNotFoundError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"lists": results}, ensure_ascii=False, indent=2))
    elif not results:
        print(f"no link lists in {lists_dir}")
    else:
        print("\n\n".join("\n".join(report_lines(result)) for result in results))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
