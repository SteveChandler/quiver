"""Government and public agency beach page crawler."""

from __future__ import annotations

import asyncio
from urllib.parse import quote_plus

import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from quiver_content.config import CRAWL_USER_AGENT
from quiver_content.crawlers.base import (
    BaseCrawler,
    CrawlCache,
    CrawlResult,
)

# Seconds between requests (10 req/min ceiling)
_RATE_LIMIT_SECS = 6.0

# State-specific domain allow-lists for government beach pages
_STATE_DOMAINS: dict[str, list[str]] = {
    "CA": [
        "https://www.parks.ca.gov",
        "https://www.coastal.ca.gov",
    ],
    "HI": [
        "https://dlnr.hawaii.gov",
        "https://hawaiibeachsafety.com",
    ],
    "OR": [
        "https://oregonstateparks.org",
        "https://www.oregon.gov/oprd",
    ],
    "WA": [
        "https://parks.wa.gov",
    ],
}

# Universal domains checked for every beach regardless of state
_UNIVERSAL_DOMAINS: list[str] = [
    "https://www.nps.gov",
]


class GovernmentCrawler(BaseCrawler):
    """Crawl government and public agency websites for beach information."""

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
        state: str | None = None,
        city: str | None = None,
        **kwargs,
    ) -> list[CrawlResult]:
        """Search government domains for beach pages and crawl them.

        Args:
            beach_name: Human-readable beach name (e.g. "Blacks Beach").
            lat: Beach latitude.
            lon: Beach longitude.
            state: Two-letter state code (e.g. "CA"). Limits which
                   state-specific domains are searched. If None, all
                   states are searched.
            city: City name for search disambiguation.
        """
        domains = self._resolve_domains(state)
        if not domains:
            self._log(f"No government domains configured for state={state}")
            return []

        results: list[CrawlResult] = []
        browser_cfg = BrowserConfig(headless=True, verbose=False)

        async with AsyncWebCrawler(config=browser_cfg) as browser:
            for domain in domains:
                urls = await self._find_urls_for_domain(
                    domain, beach_name, city=city, browser=browser
                )
                if not urls:
                    continue

                for url in urls:
                    result = await self._crawl_page(
                        url, beach_name, domain, browser=browser
                    )
                    if result is not None:
                        results.append(result)
                    await asyncio.sleep(_RATE_LIMIT_SECS)

        return results

    # ------------------------------------------------------------------
    # Domain resolution
    # ------------------------------------------------------------------

    def _resolve_domains(self, state: str | None) -> list[str]:
        """Build the list of domains to search based on state."""
        domains = list(_UNIVERSAL_DOMAINS)
        if state is not None:
            state_upper = state.upper()
            domains.extend(_STATE_DOMAINS.get(state_upper, []))
        else:
            # No state filter -- include all state domains
            for state_domains in _STATE_DOMAINS.values():
                domains.extend(state_domains)
        return domains

    # ------------------------------------------------------------------
    # URL discovery via Google site-search
    # ------------------------------------------------------------------

    async def _find_urls_for_domain(
        self,
        domain: str,
        beach_name: str,
        *,
        city: str | None = None,
        browser: AsyncWebCrawler | None = None,
        max_results: int = 3,
    ) -> list[str]:
        """Use Google site-restricted search to find relevant pages.

        Crawls the Google SERP HTML and extracts result links that
        belong to the target domain.
        """
        # Strip protocol for the site: operator
        domain_host = domain.replace("https://", "").replace("http://", "")
        query = f"site:{domain_host} {beach_name} beach"
        if city:
            query += f" {city}"
        search_url = f"https://www.google.com/search?q={quote_plus(query)}&num=5"

        cache_key = f"google_search:{domain_host}:{beach_name}"
        cached = self.cache.get(cache_key)
        if cached is not None and cached.metadata.get("discovered_urls"):
            self._log(f"Cache hit for Google search: {query}")
            return cached.metadata["discovered_urls"][:max_results]

        self._log(f"Google search: {query}")

        crawl_cfg = CrawlerRunConfig(
            word_count_threshold=0,
        )

        discovered: list[str] = []
        try:
            if browser is not None:
                response = await browser.arun(url=search_url, config=crawl_cfg)
            else:
                browser_cfg = BrowserConfig(headless=True, verbose=False)
                async with AsyncWebCrawler(config=browser_cfg) as fallback_browser:
                    response = await fallback_browser.arun(
                        url=search_url, config=crawl_cfg
                    )

            if not response.success:
                self._log(f"Google search crawl failed: {response.error_message}")
                return []

            # Check for CAPTCHA / bot detection before parsing links
            text = self._extract_markdown(response)
            captcha_indicators = [
                "captcha",
                "unusual traffic",
                "not a robot",
                "verify you're human",
            ]
            if any(indicator in text.lower() for indicator in captcha_indicators):
                self._log(
                    f"Google CAPTCHA detected for {domain_host}, skipping"
                )
                return []

            # Extract links from the crawled page that belong to our domain
            discovered = self._extract_domain_links(
                response.links or {}, domain, max_results
            )

            # Cache the discovery result
            self.cache.put(
                cache_key,
                CrawlResult(
                    source="google_search",
                    url=search_url,
                    metadata={"discovered_urls": discovered, "query": query},
                ),
            )

        except Exception as exc:
            self._log(f"Google search error for '{query}': {exc}")

        await asyncio.sleep(_RATE_LIMIT_SECS)
        return discovered

    @staticmethod
    def _extract_domain_links(
        links: dict, domain: str, limit: int
    ) -> list[str]:
        """Filter crawled links to those matching the target domain.

        Crawl4AI returns links as ``{"internal": [...], "external": [...]}``
        where each item is a dict with at least ``"href"``.
        """
        domain_host = domain.replace("https://", "").replace("http://", "")
        found: list[str] = []
        seen: set[str] = set()

        all_links: list[dict] = []
        if isinstance(links, dict):
            all_links.extend(links.get("external", []))
            all_links.extend(links.get("internal", []))
        elif isinstance(links, list):
            all_links = links

        for link in all_links:
            href = link.get("href", "") if isinstance(link, dict) else str(link)
            if not href:
                continue
            # Match domain (allow subpaths)
            if domain_host in href and href not in seen:
                seen.add(href)
                found.append(href)
                if len(found) >= limit:
                    break

        return found

    # ------------------------------------------------------------------
    # Page crawl
    # ------------------------------------------------------------------

    async def _crawl_page(
        self,
        url: str,
        beach_name: str,
        domain: str,
        *,
        browser: AsyncWebCrawler | None = None,
    ) -> CrawlResult | None:
        """Crawl a single government page with Crawl4AI."""
        cached = self.cache.get(url)
        if cached is not None:
            self._log(f"Cache hit: {url}")
            return cached

        self._log(f"Crawling government page: {url}")

        crawl_cfg = CrawlerRunConfig(
            word_count_threshold=50,
            excluded_tags=["nav", "footer", "aside", "script", "style"],
            exclude_external_links=True,
        )

        try:
            if browser is not None:
                response = await browser.arun(url=url, config=crawl_cfg)
            else:
                browser_cfg = BrowserConfig(headless=True, verbose=False)
                async with AsyncWebCrawler(config=browser_cfg) as fallback_browser:
                    response = await fallback_browser.arun(url=url, config=crawl_cfg)

            if not response.success:
                error_msg = (
                    response.error_message
                    if response.error_message
                    else "unknown crawl error"
                )
                self._log(f"Crawl failed for {url}: {error_msg}")
                return CrawlResult(
                    source="government",
                    url=url,
                    error=error_msg,
                    metadata={"domain": domain, "beach_name": beach_name},
                )

            result = CrawlResult(
                source="government",
                url=url,
                title=response.metadata.get("title") if response.metadata else None,
                raw_text=self._extract_markdown(response),
                metadata={
                    "domain": domain,
                    "beach_name": beach_name,
                },
            )
            self.cache.put(url, result)
            return result

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            self._log(f"HTTP {status} for {url}")
            return CrawlResult(
                source="government",
                url=url,
                error=f"HTTP {status}",
                metadata={"domain": domain, "beach_name": beach_name},
            )

        except Exception as exc:
            self._log(f"Error crawling {url}: {exc}")
            return CrawlResult(
                source="government",
                url=url,
                error=str(exc),
                metadata={"domain": domain, "beach_name": beach_name},
            )
