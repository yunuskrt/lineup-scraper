import asyncio
from typing import cast

import pytest
from scrapy.crawler import Crawler

from extract.closing import engine_pauser, spider_closer


class FakeEngine:
    def __init__(self) -> None:
        self.paused = False
        self.close_reasons: list[str] = []

    def pause(self) -> None:
        self.paused = True

    def unpause(self) -> None:
        self.paused = False

    async def close_spider_async(self, *, reason: str) -> None:
        self.close_reasons.append(reason)


class FakeCrawler:
    def __init__(self, engine: FakeEngine | None) -> None:
        self.engine = engine


def crawler(engine: FakeEngine | None) -> Crawler:
    return cast(Crawler, FakeCrawler(engine))


# A crawl always runs inside the asyncio reactor's loop
def test_closes_the_spider_with_a_reason() -> None:
    engine = FakeEngine()

    async def run() -> None:
        spider_closer(crawler(engine))("blocked")
        await asyncio.sleep(0.01)

    asyncio.run(run())
    assert engine.close_reasons == ["blocked"]


def test_pauses_then_resumes_after_the_delay() -> None:
    engine = FakeEngine()

    async def run() -> list[bool]:
        engine_pauser(crawler(engine))(0.01)
        states = [engine.paused]
        await asyncio.sleep(0.05)
        return [*states, engine.paused]

    assert asyncio.run(run()) == [True, False]


@pytest.mark.parametrize("factory", [spider_closer, engine_pauser])
def test_refuses_a_crawler_without_an_engine(factory: object) -> None:
    action = factory(crawler(None))  # type: ignore[operator]
    with pytest.raises(RuntimeError, match="no engine"):
        action("blocked" if factory is spider_closer else 1.0)
