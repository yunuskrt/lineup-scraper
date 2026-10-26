from scrapy import Request
from scrapy.extensions.httpcache import DummyPolicy
from scrapy.http import Response

from extract.middlewares import is_block


# The cache stores before BlockGuard runs; skip blocks
class GuardedCachePolicy(DummyPolicy):
    def should_cache_response(self, response: Response, request: Request) -> bool:
        if is_block(response):
            return False
        return super().should_cache_response(response, request)
