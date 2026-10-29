import argparse
import re
import shutil
import sys
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, cast

from extract.data_dirs import DATA_DIRS
from extract.images import (
    IMAGE_KINDS,
    ImageId,
    RefusedImageError,
    check_name,
    image_files,
    images_root,
    name_id,
    sniff,
    stored_image,
    stored_images,
)
from extract.import_log import (
    IMPORT_LOG,
    LogLine,
    Result,
    append_log,
    read_log,
    timestamp,
)
from extract.pages import (
    HOME,
    Page,
    RefusedPageError,
    classify,
    inbox_files,
    og_url,
    raw_counts,
    read_page,
    stored_pages,
    stored_path,
)
from extract.parsers.transfermarkt.common import ParseError
from extract.parsers.transfermarkt.fixtures import parse_fixture_list
from extract.parsers.transfermarkt.match import parse_match_report
from extract.parsers.transfermarkt.player import parse_player
from extract.records import InvalidRecordError, JsonValue, RecordWriter, validate_record

LINK: Final = re.compile(
    r"https://(?:www\.transfermarkt\.com|img\.a\.transfermarkt\.technology)/\S+"
)


@dataclass
class Report:
    imported: Counter[str] = field(default_factory=Counter)
    duplicates: list[str] = field(default_factory=list)
    refused: list[tuple[str, str]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    log: list[LogLine] = field(default_factory=list)


# When the user saved the file
def saved_at(path: Path) -> str:
    return timestamp(datetime.fromtimestamp(path.stat().st_mtime, UTC))


def log_line(
    at: str,
    file: str,
    page: Page | None,
    result: Result,
    reason: str | None = None,
    records: int = 0,
    url: str | None = None,
) -> LogLine:
    return {
        "at": at,
        "file": file,
        "url": page.url if page else url,
        "kind": page.kind if page else None,
        "key": page.key if page else None,
        "result": result,
        "reason": reason,
        "records": records,
        "backfilled": False,
    }


# Best effort: a refused file may still name its page
def identify(path: Path) -> tuple[str | None, Page | None]:
    try:
        url = og_url(path.read_text(encoding="utf-8"))
    except UnicodeDecodeError:
        return None, None
    if url is None or not url.startswith(HOME):
        return url, None
    try:
        return url, classify(url)
    except RefusedPageError:
        return url, None


def parse_page(page: Page, html: str, fetched_at: str) -> list[Mapping[str, JsonValue]]:
    if page.kind == "fixture":
        code, _, season = page.key.upper().partition("-")
        fixtures = parse_fixture_list(html, page.url, fetched_at, code, season or None)
        return [cast(Mapping[str, JsonValue], record) for record in fixtures]
    if page.kind == "match":
        return [
            cast(
                Mapping[str, JsonValue], parse_match_report(html, page.url, fetched_at)
            )
        ]
    return [cast(Mapping[str, JsonValue], parse_player(html, page.url, fetched_at))]


class Importer:
    def __init__(self, pages_dir: Path, raw_dir: Path, partition: str) -> None:
        self._pages_dir = pages_dir
        self._raw_dir = raw_dir
        self._partition = partition
        self._writers: dict[tuple[str, str], RecordWriter] = {}

    def stored(self, page: Page) -> Path:
        return stored_path(self._pages_dir, page.kind, page.key)

    def write(self, page: Page, records: Sequence[Mapping[str, JsonValue]]) -> None:
        kind = f"transfermarkt-{page.kind}"
        partition = page.key if page.kind == "fixture" else self._partition
        # Validate all first: a page is written whole or not at all
        for record in records:
            validate_record(kind, record)
        writer = self._writers.get((kind, partition))
        if writer is None:
            writer = RecordWriter(kind, partition, raw_dir=self._raw_dir)
            self._writers[(kind, partition)] = writer
        for record in records:
            writer.write(record)

    def take(self, path: Path, report: Report, at: str) -> None:
        raw = path.read_bytes()
        page = read_page(raw.decode("utf-8"))
        target = self.stored(page)
        if target.exists():
            if target.read_bytes() != raw:
                raise RefusedPageError(f"differs from the stored page {target.name}")
            path.unlink()
            report.duplicates.append(path.name)
            report.log.append(log_line(at, path.name, page, "duplicate"))
            return
        records = parse_page(page, raw.decode("utf-8"), saved_at(path))
        self.write(page, records)
        target.parent.mkdir(parents=True, exist_ok=True)
        path.replace(target)
        report.imported[page.kind] += 1
        report.log.append(
            log_line(at, path.name, page, "imported", records=len(records))
        )


def image_line(
    at: str, file: str, image: ImageId | None, result: Result, reason: str | None = None
) -> LogLine:
    return {
        "at": at,
        "file": file,
        "url": None,
        "kind": image[0] if image else None,
        "key": image[1] if image else None,
        "result": result,
        "reason": reason,
        "records": 0,
        "backfilled": False,
    }


# Filed by id; new bytes for a filed id replace it
def take_image(path: Path, images_dir: Path, report: Report, at: str) -> None:
    image = check_name(path.name)
    data = path.read_bytes()
    suffix = sniff(data)
    kind, key = image
    old = stored_image(images_dir, image)
    if old is not None and old.read_bytes() == data:
        path.unlink()
        report.duplicates.append(path.name)
        report.log.append(image_line(at, path.name, image, "duplicate"))
        return
    target = images_root(images_dir) / kind / f"{key}.{suffix}"
    target.parent.mkdir(parents=True, exist_ok=True)
    if old is not None:
        old.unlink()
    path.replace(target)
    report.imported[kind] += 1
    reason = "replaced the filed image" if old is not None else None
    report.log.append(image_line(at, path.name, image, "imported", reason))


def import_images(inbox: Path, images_dir: Path, report: Report, at: str) -> None:
    for path in image_files(inbox):
        try:
            take_image(path, images_dir, report, at)
        except RefusedImageError as error:
            report.refused.append((path.name, str(error)))
            report.log.append(
                image_line(at, path.name, name_id(path.name), "refused", str(error))
            )


def expected_missing(
    link_list: Path, pages_dir: Path, images_dir: Path | None = None
) -> list[str]:
    importer = Importer(pages_dir, pages_dir, "inbox")
    images = stored_images(images_dir) if images_dir is not None else {}
    missing = []
    for found in LINK.findall(link_list.read_text(encoding="utf-8")):
        # Markdown links and tables leave trailing punctuation
        link = found.rstrip(").,;>|]")
        try:
            page = classify(link)
            if page.kind in IMAGE_KINDS:
                is_saved = page.id in images
            else:
                is_saved = importer.stored(page).exists()
            if not is_saved:
                missing.append(link)
        except RefusedPageError:
            missing.append(f"{link} (unrecognised link)")
    return missing


def import_inbox(
    inbox: Path,
    pages_dir: Path,
    raw_dir: Path,
    partition: str = "inbox",
    expect: Path | None = None,
    log: Path | None = None,
    now: datetime | None = None,
    images_dir: Path | None = None,
) -> Report:
    report = Report()
    at = timestamp(now or datetime.now(UTC))
    importer = Importer(pages_dir, raw_dir, partition)
    # Without an images folder, images wait in the inbox
    if images_dir is not None:
        import_images(inbox, images_dir, report, at)
    for path in inbox_files(inbox):
        try:
            importer.take(path, report, at)
        except (
            RefusedPageError,
            ParseError,
            InvalidRecordError,
            UnicodeDecodeError,
        ) as error:
            reason = str(error).splitlines()[0]
            report.refused.append((path.name, reason))
            url, page = identify(path)
            report.log.append(log_line(at, path.name, page, "refused", reason, url=url))
    if expect is not None:
        report.missing = expected_missing(expect, pages_dir, images_dir)
    if log is not None:
        append_log(log, report.log)
    return report


# Rebuilds raw records from every stored page, after a parser change
def reparse_store(pages_dir: Path, raw_dir: Path, partition: str) -> Counter[str]:
    importer = Importer(pages_dir, raw_dir, partition)
    parsed: list[tuple[Page, list[Mapping[str, JsonValue]]]] = []
    for path in stored_pages(pages_dir).values():
        html = path.read_text(encoding="utf-8")
        page = read_page(html)
        records = parse_page(page, html, saved_at(path))
        for record in records:
            validate_record(f"transfermarkt-{page.kind}", record)
        parsed.append((page, records))
    # Every page parsed: only now replace the old records
    shutil.rmtree(raw_dir / "transfermarkt", ignore_errors=True)
    counts: Counter[str] = Counter()
    for page, records in parsed:
        importer.write(page, records)
        counts[page.kind] += 1
    return counts


# Log lines for pages imported before the log existed
def backfill_log(pages_dir: Path, raw_dir: Path, log: Path) -> int:
    logged = {
        (line["kind"], line["key"])
        for line in read_log(log)
        if line["result"] == "imported"
    }
    records = raw_counts(raw_dir)
    lines: list[LogLine] = []
    for (kind, key), path in stored_pages(pages_dir).items():
        if (kind, key) in logged:
            continue
        lines.append(
            {
                "at": saved_at(path),
                "file": path.name,
                "url": og_url(path.read_text(encoding="utf-8")),
                "kind": kind,
                "key": key,
                "result": "imported",
                "reason": None,
                "records": sum(records.get((kind, key), Counter()).values()),
                "backfilled": True,
            }
        )
    return append_log(log, lines)


def print_report(report: Report) -> None:
    counts = ", ".join(f"{n} {kind}" for kind, n in sorted(report.imported.items()))
    print(f"imported: {counts or 'nothing'}")
    if report.duplicates:
        print(f"already imported: {len(report.duplicates)}")
    for name, reason in report.refused:
        print(f"refused {name}: {reason}")
    if report.missing:
        print(f"still to save: {len(report.missing)}")
        for link in report.missing:
            print(f"  {link}")


def main(argv: list[str], dirs: Mapping[str, Path] = DATA_DIRS) -> int:
    parser = argparse.ArgumentParser(prog="python -m extract.inbox")
    parser.add_argument("--partition", default="inbox")
    parser.add_argument("--expect", type=Path)
    parser.add_argument("--backfill-log", action="store_true")
    parser.add_argument("--reparse", action="store_true")
    args = parser.parse_args(argv)
    log = dirs["work"] / IMPORT_LOG
    if args.backfill_log:
        added = backfill_log(dirs["pages"], dirs["raw"], log)
        print(f"backfilled: {added} log lines")
        return 0
    if args.reparse:
        try:
            counts = reparse_store(dirs["pages"], dirs["raw"], args.partition)
        except (RefusedPageError, ParseError, InvalidRecordError) as error:
            print(f"reparse stopped, raw records unchanged: {error}", file=sys.stderr)
            return 1
        parts = ", ".join(f"{n} {kind}" for kind, n in sorted(counts.items()))
        print(f"reparsed: {parts or 'nothing'}")
        return 0
    report = import_inbox(
        dirs["inbox"],
        dirs["pages"],
        dirs["raw"],
        partition=args.partition,
        expect=args.expect,
        log=log,
        images_dir=dirs["images"],
    )
    print_report(report)
    return 1 if report.refused else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
