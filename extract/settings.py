from typing import Final

from extract.data_dirs import DATA_DIRS

BOT_NAME: Final = "lineup_scraper"
SPIDER_MODULES: Final = ["extract.spiders"]
NEWSPIDER_MODULE: Final = "extract.spiders"

# Dev phase: robots.txt and terms don't block
ROBOTSTXT_OBEY: Final = False
USER_AGENT: Final = "lineup-scraper/0.1 (personal, non-commercial; development)"
DEFAULT_REQUEST_HEADERS: Final = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    # Labels and formats are English-dependent
    "Accept-Language": "en-US,en;q=0.9",
}

CONCURRENT_REQUESTS: Final = 1
CONCURRENT_REQUESTS_PER_DOMAIN: Final = 1
DOWNLOAD_DELAY: Final = 3
AUTOTHROTTLE_ENABLED: Final = True
AUTOTHROTTLE_START_DELAY: Final = 3
AUTOTHROTTLE_MAX_DELAY: Final = 60
AUTOTHROTTLE_TARGET_CONCURRENCY: Final = 1.0

RETRY_ENABLED: Final = True
RETRY_TIMES: Final = 3
RETRY_HTTP_CODES: Final = [408, 429, 500, 502, 503, 504, 522, 524]

# Each page is fetched once, forever
HTTPCACHE_ENABLED: Final = True
HTTPCACHE_DIR: Final = str(DATA_DIRS["cache"])
HTTPCACHE_POLICY: Final = "extract.cache.GuardedCachePolicy"
HTTPCACHE_EXPIRATION_SECS: Final = 0
# Errors and blocks are never cached
HTTPCACHE_IGNORE_HTTP_CODES: Final = [202, 403, 408, 429, 500, 502, 503, 504, 522, 524]

FEED_EXPORT_ENCODING: Final = "utf-8"
ITEM_PIPELINES: Final = {"extract.pipelines.RecordPipeline": 300}
DOWNLOADER_MIDDLEWARES: Final = {"extract.middlewares.BlockGuard": 590}
