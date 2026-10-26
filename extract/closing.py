import asyncio
from collections.abc import Callable

from scrapy.crawler import Crawler
from scrapy.utils.defer import deferred_from_coro

type CloseSpider = Callable[[str], None]
type PauseEngine = Callable[[float], None]


def spider_closer(crawler: Crawler) -> CloseSpider:
    def close(reason: str) -> None:
        engine = crawler.engine
        if engine is None:
            raise RuntimeError("Crawler has no engine")
        deferred_from_coro(engine.close_spider_async(reason=reason))

    return close


def engine_pauser(crawler: Crawler) -> PauseEngine:
    def pause(seconds: float) -> None:
        engine = crawler.engine
        if engine is None:
            raise RuntimeError("Crawler has no engine")
        engine.pause()
        asyncio.get_running_loop().call_later(seconds, engine.unpause)

    return pause
