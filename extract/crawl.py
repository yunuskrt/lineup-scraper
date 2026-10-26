import sys

from scrapy.crawler import CrawlerProcess
from scrapy.settings import Settings


def parse_args(argv: list[str]) -> tuple[str, dict[str, str]]:
    if not argv or argv[0].startswith("-"):
        raise SystemExit("Usage: python -m extract.crawl <spider> [-a key=value ...]")
    spider, rest, kwargs = argv[0], argv[1:], {}
    while rest:
        flag, *rest = rest
        if flag != "-a" or not rest or "=" not in rest[0]:
            raise SystemExit(f"Expected -a key=value, got {flag!r}")
        key, _, value = rest.pop(0).partition("=")
        kwargs[key] = value
    return spider, kwargs


# `scrapy crawl` exits 0 even when a spider was blocked
def exit_code(finish_reason: object) -> int:
    return 0 if finish_reason == "finished" else 1


def main(argv: list[str]) -> int:
    spider, kwargs = parse_args(argv)
    settings = Settings()
    settings.setmodule("extract.settings", priority="project")
    process = CrawlerProcess(settings)
    crawler = process.create_crawler(spider)
    process.crawl(crawler, **kwargs)
    process.start()
    reason = crawler.stats.get_value("finish_reason") if crawler.stats else None
    return exit_code(reason)


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
