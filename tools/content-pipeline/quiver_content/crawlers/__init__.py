"""Web crawlers for gathering beach source material."""

from quiver_content.crawlers.base import (
    BaseCrawler,
    CrawlCache,
    CrawlImage,
    CrawlResult,
)
from quiver_content.crawlers.government import GovernmentCrawler
from quiver_content.crawlers.overpass import OverpassCrawler
from quiver_content.crawlers.wannasurf import WannasurfCrawler
from quiver_content.crawlers.wikipedia import WikipediaCrawler

__all__ = [
    "BaseCrawler",
    "CrawlCache",
    "CrawlImage",
    "CrawlResult",
    "GovernmentCrawler",
    "OverpassCrawler",
    "WannasurfCrawler",
    "WikipediaCrawler",
]
