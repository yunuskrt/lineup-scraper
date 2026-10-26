from datetime import UTC
from email.utils import parsedate_to_datetime

from scrapy.http import Response


class MissingDateError(ValueError):
    pass


# The server's Date header; the cache keeps it on rerun
def fetched_at(response: Response) -> str:
    value = response.headers.get("Date")
    if value is None:
        raise MissingDateError(f"No Date header on {response.url}")
    moment = parsedate_to_datetime(value.decode("ascii")).astimezone(UTC)
    return moment.strftime("%Y-%m-%dT%H:%M:%SZ")
