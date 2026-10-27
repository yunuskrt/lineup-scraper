import argparse
import sys
from collections.abc import Mapping
from pathlib import Path
from typing import Final

from extract.data_dirs import DATA_DIRS
from extract.import_log import IMPORT_LOG, read_log
from extract.links import LINK_LISTS, list_names, list_path, read_link_list
from extract.pages import KINDS, PageId, RefusedPageError, classify, snapshot

USAGE: Final = "a Transfermarkt link, or kind:key (match:990248, fixture:cl-2000)"


def parse_target(target: str) -> PageId:
    if target.startswith("http"):
        return classify(target).id
    kind, _, key = target.partition(":")
    for known in KINDS:
        if kind == known and key:
            return (known, key.lower())
    raise RefusedPageError(f"expected {USAGE}")


def check_lines(page: PageId, dirs: Mapping[str, Path]) -> tuple[list[str], bool]:
    kind, key = page
    state = snapshot(dirs["inbox"], dirs["pages"], dirs["raw"])
    lists_dir = dirs["work"] / LINK_LISTS
    holding = [
        name
        for name in list_names(lists_dir)
        if any(
            item.page.id == page for item in read_link_list(list_path(lists_dir, name))
        )
    ]
    stored = state.stored.get(page)
    records = state.records.get(page)
    log = [
        line
        for line in read_log(dirs["work"] / IMPORT_LOG)
        if (line["kind"], line["key"]) == page
    ]
    found = ", ".join(f"{part}: {n}" for part, n in sorted((records or {}).items()))
    lines = [
        f"{kind}:{key}  {state.status(page)}",
        f"  lists:   {', '.join(holding) or 'none'}",
        f"  inbox:   {state.inbox.get(page, 'no')}",
        f"  stored:  {stored or 'no'}",
        f"  records: {found or 'none'}",
        "  log:" if log else "  log:     none",
    ]
    for line in log:
        extra = f", {line['reason']}" if line["reason"] else ""
        extra += ", backfilled" if line["backfilled"] else ""
        lines.append(
            f"    {line['at']} {line['result']} ({line['records']} records{extra})"
        )
    return lines, state.status(page) == "parsed"


def main(argv: list[str], dirs: Mapping[str, Path] = DATA_DIRS) -> int:
    parser = argparse.ArgumentParser(prog="python -m extract.check")
    parser.add_argument("target", help=USAGE)
    args = parser.parse_args(argv)
    try:
        lines, is_done = check_lines(parse_target(args.target), dirs)
    except (RefusedPageError, ValueError) as error:
        print(f"error: {error}", file=sys.stderr)
        return 1
    print("\n".join(lines))
    return 0 if is_done else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
