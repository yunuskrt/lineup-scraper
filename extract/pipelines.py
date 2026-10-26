import logging
from collections.abc import Mapping
from pathlib import Path
from typing import Self

from scrapy.crawler import Crawler
from scrapy.exceptions import DropItem

from extract.closing import CloseSpider, spider_closer
from extract.data_dirs import DATA_DIRS
from extract.records import InvalidRecordError, JsonValue, RecordWriter

logger = logging.getLogger(__name__)


def unpack(item: Mapping[str, object]) -> tuple[str, str, Mapping[str, JsonValue]]:
    kind, partition, record = (
        item.get("kind"),
        item.get("partition"),
        item.get("record"),
    )
    if not isinstance(kind, str) or not isinstance(partition, str):
        raise InvalidRecordError("Item needs string kind and partition")
    if not isinstance(record, dict):
        raise InvalidRecordError(f"Item record for {kind} is not an object")
    return kind, partition, record


# Writes every item; an invalid record fails the run
class RecordPipeline:
    def __init__(self, close: CloseSpider, raw_dir: Path = DATA_DIRS["raw"]) -> None:
        self._close = close
        self._raw_dir = raw_dir
        self._writers: dict[tuple[str, str], RecordWriter] = {}

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> Self:
        return cls(spider_closer(crawler))

    def process_item(self, item: Mapping[str, object]) -> Mapping[str, object]:
        try:
            kind, partition, record = unpack(item)
            writer = self._writers.get((kind, partition))
            if writer is None:
                writer = RecordWriter(kind, partition, raw_dir=self._raw_dir)
                self._writers[(kind, partition)] = writer
            writer.write(record)
        except InvalidRecordError as error:
            logger.error("%s", error)
            self._close("invalid_record")
            raise DropItem("invalid_record") from error
        return item
