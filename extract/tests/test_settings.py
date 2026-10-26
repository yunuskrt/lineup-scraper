from extract import settings
from extract.data_dirs import DATA_DIRS


def test_fetches_politely_one_request_at_a_time() -> None:
    assert settings.ROBOTSTXT_OBEY is False
    assert settings.CONCURRENT_REQUESTS == 1
    assert settings.CONCURRENT_REQUESTS_PER_DOMAIN == 1
    assert settings.DOWNLOAD_DELAY == 3
    assert settings.AUTOTHROTTLE_ENABLED is True
    assert settings.AUTOTHROTTLE_START_DELAY == 3
    assert settings.AUTOTHROTTLE_MAX_DELAY == 60
    assert settings.AUTOTHROTTLE_TARGET_CONCURRENCY == 1.0


def test_sends_an_honest_english_request() -> None:
    assert settings.USER_AGENT == (
        "lineup-scraper/0.1 (personal, non-commercial; development)"
    )
    assert "Mozilla" not in settings.USER_AGENT
    assert "@" not in settings.USER_AGENT
    assert settings.DEFAULT_REQUEST_HEADERS["Accept-Language"] == "en-US,en;q=0.9"


def test_retries_transient_errors_and_429() -> None:
    assert settings.RETRY_ENABLED is True
    assert settings.RETRY_TIMES == 3
    assert sorted(settings.RETRY_HTTP_CODES) == [
        408,
        429,
        500,
        502,
        503,
        504,
        522,
        524,
    ]


def test_caches_every_page_forever_but_never_an_error() -> None:
    assert settings.HTTPCACHE_ENABLED is True
    assert str(DATA_DIRS["cache"]) == settings.HTTPCACHE_DIR
    assert settings.HTTPCACHE_POLICY == "extract.cache.GuardedCachePolicy"
    assert settings.HTTPCACHE_EXPIRATION_SECS == 0
    assert {202, 403} <= set(settings.HTTPCACHE_IGNORE_HTTP_CODES)
    assert set(settings.RETRY_HTTP_CODES) <= set(settings.HTTPCACHE_IGNORE_HTTP_CODES)


def test_wires_the_guard_and_the_record_pipeline() -> None:
    assert settings.SPIDER_MODULES == ["extract.spiders"]
    assert settings.DOWNLOADER_MIDDLEWARES == {"extract.middlewares.BlockGuard": 590}
    assert settings.ITEM_PIPELINES == {"extract.pipelines.RecordPipeline": 300}
    assert settings.FEED_EXPORT_ENCODING == "utf-8"
