"""Wikipedia & Wikimedia Commons crawler for beach content and images."""

from __future__ import annotations

import asyncio
import re
from urllib.parse import quote_plus

import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from quiver_content.config import CRAWL_USER_AGENT
from quiver_content.crawlers.base import (
    BaseCrawler,
    CrawlCache,
    CrawlImage,
    CrawlResult,
)

# Wikipedia API endpoint
_WIKI_SEARCH_URL = "https://en.wikipedia.org/w/api.php"
# Wikimedia Commons API endpoint
_COMMONS_API_URL = "https://commons.wikimedia.org/w/api.php"
# Seconds between requests (10 req/min ceiling)
_RATE_LIMIT_SECS = 6.0


class WikipediaCrawler(BaseCrawler):
    """Crawl Wikipedia articles and Wikimedia Commons images for a beach."""

    def __init__(self, cache: CrawlCache | None = None, verbose: bool = False):
        super().__init__(cache=cache, verbose=verbose)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def crawl(
        self,
        beach_name: str,
        lat: float,
        lon: float,
        *,
        city: str | None = None,
        state: str | None = None,
        **kwargs,
    ) -> list[CrawlResult]:
        """Fetch the Wikipedia article and nearby Wikimedia images."""
        results: list[CrawlResult] = []

        browser_cfg = BrowserConfig(headless=True, verbose=False)

        async with AsyncWebCrawler(config=browser_cfg) as browser:
            article_result = await self._crawl_article(
                beach_name, browser, city=city, state=state
            )
            if article_result is not None:
                results.append(article_result)

        await asyncio.sleep(_RATE_LIMIT_SECS)

        # Wikimedia images use httpx (not browser), so no browser needed
        images_result = await self._crawl_wikimedia_images(beach_name, lat, lon)
        if images_result is not None:
            results.append(images_result)

        return results

    # ------------------------------------------------------------------
    # Wikipedia article search + crawl
    # ------------------------------------------------------------------

    async def _crawl_article(
        self,
        beach_name: str,
        browser: AsyncWebCrawler,
        *,
        city: str | None = None,
        state: str | None = None,
    ) -> CrawlResult | None:
        """Search Wikipedia for the beach article, then crawl it."""
        article_url = await self._find_article_url(beach_name, city=city, state=state)
        if article_url is None:
            self._log(f"No Wikipedia article found for '{beach_name}'")
            return None

        # Check cache first
        cached = self.cache.get(article_url)
        if cached is not None:
            self._log(f"Cache hit: {article_url}")
            return cached

        self._log(f"Crawling Wikipedia article: {article_url}")

        crawl_cfg = CrawlerRunConfig(
            word_count_threshold=50,
            excluded_tags=["nav", "footer", "aside"],
            exclude_external_links=True,
        )

        try:
            response = await browser.arun(url=article_url, config=crawl_cfg)

            if not response.success:
                return CrawlResult(
                    source="wikipedia",
                    url=article_url,
                    error=f"Crawl failed: {response.error_message}",
                )

            result = CrawlResult(
                source="wikipedia",
                url=article_url,
                title=response.metadata.get("title") if response.metadata else None,
                raw_text=self._extract_markdown(response),
                metadata={
                    "search_term": beach_name,
                },
            )
            self.cache.put(article_url, result)
            return result

        except Exception as exc:
            return CrawlResult(
                source="wikipedia",
                url=article_url,
                error=str(exc),
            )

    async def _find_article_url(
        self,
        beach_name: str,
        *,
        city: str | None = None,
        state: str | None = None,
    ) -> str | None:
        """Use the Wikipedia opensearch API to locate an article URL.

        Tries progressively broader queries:
        1. "{beach_name} beach"
        2. "{beach_name} {city}" (if city provided)
        3. "{beach_name} {state}" (if state provided)
        """
        queries = [f"{beach_name} beach"]
        if city:
            queries.append(f"{beach_name} {city}")
        if state:
            queries.append(f"{beach_name} {state}")

        headers = {"User-Agent": CRAWL_USER_AGENT}

        async with httpx.AsyncClient(headers=headers, timeout=15) as client:
            for i, query in enumerate(queries):
                if i > 0:
                    await asyncio.sleep(_RATE_LIMIT_SECS)
                params = {
                    "action": "opensearch",
                    "search": query,
                    "limit": "3",
                    "format": "json",
                }
                try:
                    resp = await client.get(_WIKI_SEARCH_URL, params=params)
                    resp.raise_for_status()
                    data = resp.json()
                    # opensearch returns [query, [titles], [descriptions], [urls]]
                    urls: list[str] = data[3] if len(data) > 3 else []
                    if urls:
                        self._log(f"Wikipedia search '{query}' -> {urls[0]}")
                        return urls[0]
                except (httpx.HTTPError, IndexError, KeyError) as exc:
                    self._log(f"Wikipedia search error for '{query}': {exc}")
                    continue

        return None

    # ------------------------------------------------------------------
    # Wikimedia Commons geo-tagged images
    # ------------------------------------------------------------------

    async def _crawl_wikimedia_images(
        self,
        beach_name: str,
        lat: float,
        lon: float,
        radius_m: int = 2000,
    ) -> CrawlResult | None:
        """Query Wikimedia Commons for geo-tagged images near the beach."""
        cache_key = f"wikimedia_geo:{lat:.4f},{lon:.4f}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            self._log(f"Cache hit for Wikimedia images near ({lat}, {lon})")
            return cached

        params = {
            "action": "query",
            "generator": "geosearch",
            "ggscoord": f"{lat}|{lon}",
            "ggsradius": str(radius_m),
            "ggslimit": "20",
            "ggsnamespace": "6",  # File namespace
            "prop": "imageinfo",
            "iiprop": "url|extmetadata|size",
            "iiurlwidth": "1920",
            "format": "json",
        }
        headers = {"User-Agent": CRAWL_USER_AGENT}

        self._log(f"Querying Wikimedia Commons geo-images near ({lat}, {lon})")

        try:
            async with httpx.AsyncClient(headers=headers, timeout=20) as client:
                resp = await client.get(_COMMONS_API_URL, params=params)
                resp.raise_for_status()
                data = resp.json()

            pages = data.get("query", {}).get("pages", {})
            if not pages:
                self._log("No Wikimedia images found nearby")
                return None

            images = self._parse_commons_pages(pages)
            result = CrawlResult(
                source="wikimedia_commons",
                url=f"https://commons.wikimedia.org/wiki/Special:Nearby#{lat},{lon}",
                title=f"Wikimedia images near {beach_name}",
                images=images,
                metadata={
                    "lat": lat,
                    "lon": lon,
                    "radius_m": radius_m,
                    "image_count": len(images),
                },
            )
            self.cache.put(cache_key, result)
            return result

        except (httpx.HTTPError, KeyError, ValueError) as exc:
            self._log(f"Wikimedia Commons API error: {exc}")
            return CrawlResult(
                source="wikimedia_commons",
                url=f"https://commons.wikimedia.org/wiki/Special:Nearby#{lat},{lon}",
                error=str(exc),
            )

    @staticmethod
    def _parse_commons_pages(pages: dict) -> list[CrawlImage]:
        """Parse Wikimedia Commons API page objects into CrawlImage list."""
        images: list[CrawlImage] = []
        for page in pages.values():
            image_info_list = page.get("imageinfo", [])
            if not image_info_list:
                continue
            info = image_info_list[0]
            ext = info.get("extmetadata", {})

            # Extract creator info (HTML may be present, take raw text)
            artist_html = ext.get("Artist", {}).get("value", "")
            # Simple strip of HTML tags for creator name
            creator_name = artist_html
            if "<" in artist_html:
                creator_name = re.sub(r"<[^>]+>", "", artist_html).strip()

            license_code = ext.get("LicenseShortName", {}).get("value")
            license_url = ext.get("LicenseUrl", {}).get("value")
            description = ext.get("ImageDescription", {}).get("value", "")
            if "<" in description:
                description = re.sub(r"<[^>]+>", "", description).strip()

            # Prefer the thumbnail URL at requested width, fall back to full URL
            image_url = info.get("thumburl") or info.get("url", "")

            images.append(
                CrawlImage(
                    url=image_url,
                    title=page.get("title", "").replace("File:", ""),
                    alt_text=description or None,
                    width=info.get("width"),
                    height=info.get("height"),
                    source="wikimedia",
                    license_code=license_code,
                    license_url=license_url,
                    creator_name=creator_name or None,
                )
            )
        return images
