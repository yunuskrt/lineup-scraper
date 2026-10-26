import argparse
import re
import sys
from collections import Counter
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Final, Literal, cast

from parsel import Selector

from extract.data_dirs import DATA_DIRS
from extract.middlewares import is_challenge_html
from extract.parsers.transfermarkt.common import MATCH_ID, PLAYER_ID, ParseError, id_in
from extract.parsers.transfermarkt.fixtures import parse_fixture_list
from extract.parsers.transfermarkt.match import parse_match_report
from extract.parsers.transfermarkt.player import parse_player
from extract.records import InvalidRecordError, JsonValue, RecordWriter, validate_record

type Kind = Literal["fixture", "match", "player"]

COMPETITION: Final = re.compile(r"/(?:pokal)?wettbewerb/([A-Z0-9]+)")
SEASON: Final = re.compile(r"saison_id[=/]([0-9]+)")
OG_URL: Final = '//meta[@property="og:url"]/@content'
LINK: Final = re.compile(r"https://www\.transfermarkt\.com/\S+")
HOME: Final = "https://www.transfermarkt.com/"


class RefusedPageError(ValueError):
    pass


@dataclass(frozen=True)
class Page:
    kind: Kind
    key: str
    url: str


@dataclass
class Report:
    imported: Counter[str] = field(default_factory=Counter)
    duplicates: list[str] = field(default_factory=list)
    refused: list[tuple[str, str]] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)


def classify(url: str) -> Page:
    if "/gesamtspielplan/" in url:
        code = id_in(url, COMPETITION)
        if code is None:
            raise RefusedPageError("fixture list without a competition code")
        season = id_in(url, SEASON)
        key = f"{code}-{season}" if season else code
        return Page("fixture", key.lower(), url)
    if (match_id := id_in(url, MATCH_ID)) is not None:
        return Page("match", match_id, url)
    if (player_id := id_in(url, PLAYER_ID)) is not None:
        return Page("player", player_id, url)
    raise RefusedPageError("unknown page type (not a fixture list, match or player)")


# When the user saved the file
def saved_at(path: Path) -> str:
    moment = datetime.fromtimestamp(path.stat().st_mtime, UTC)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")


def read_page(html: str) -> Page:
    if is_challenge_html(html):
        raise RefusedPageError("challenge page, save it again")
    url = Selector(text=html).xpath(OG_URL).get()
    if not url:
        raise RefusedPageError("no og:url: not a Transfermarkt page saved as HTML")
    if not url.startswith(HOME):
        raise RefusedPageError("og:url is not on www.transfermarkt.com")
    return classify(url)


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
        return self._pages_dir / "transfermarkt" / page.kind / f"{page.key}.html"

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

    def take(self, path: Path, report: Report) -> None:
        raw = path.read_bytes()
        page = read_page(raw.decode("utf-8"))
        target = self.stored(page)
        if target.exists():
            if target.read_bytes() != raw:
                raise RefusedPageError(f"differs from the stored page {target.name}")
            path.unlink()
            report.duplicates.append(path.name)
            return
        self.write(page, parse_page(page, raw.decode("utf-8"), saved_at(path)))
        target.parent.mkdir(parents=True, exist_ok=True)
        path.replace(target)
        report.imported[page.kind] += 1


def expected_missing(link_list: Path, pages_dir: Path) -> list[str]:
    importer = Importer(pages_dir, pages_dir, "inbox")
    missing = []
    for found in LINK.findall(link_list.read_text(encoding="utf-8")):
        # Markdown links and tables leave trailing punctuation
        link = found.rstrip(").,;>|]")
        try:
            if not importer.stored(classify(link)).exists():
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
) -> Report:
    report = Report()
    importer = Importer(pages_dir, raw_dir, partition)
    files = sorted(p for p in inbox.glob("*") if p.suffix.lower() in {".html", ".htm"})
    for path in files:
        try:
            importer.take(path, report)
        except (
            RefusedPageError,
            ParseError,
            InvalidRecordError,
            UnicodeDecodeError,
        ) as error:
            report.refused.append((path.name, str(error).splitlines()[0]))
    if expect is not None:
        report.missing = expected_missing(expect, pages_dir)
    return report


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
    args = parser.parse_args(argv)
    report = import_inbox(
        dirs["inbox"],
        dirs["pages"],
        dirs["raw"],
        partition=args.partition,
        expect=args.expect,
    )
    print_report(report)
    return 1 if report.refused else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
