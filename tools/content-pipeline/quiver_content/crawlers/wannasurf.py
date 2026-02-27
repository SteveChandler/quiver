"""Wannasurf.com crawler for structured surf spot data."""

from __future__ import annotations

import asyncio
import re
from urllib.parse import quote_plus

import httpx
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig

from quiver_content.crawlers.base import (
    BaseCrawler,
    CrawlCache,
    CrawlResult,
)

# Conservative rate limit: 3 req/min given hostile robots.txt
_RATE_LIMIT_SECS = 20.0

_USER_AGENT = "QuiverSurf/1.0 (content-pipeline; contact@quiversurf.app)"

# Wannasurf URL base
_BASE_URL = "https://www.wannasurf.com"

# Map of US state codes to Wannasurf region path segments
_STATE_REGIONS: dict[str, str] = {
    "CA": "California",
    "OR": "Oregon",
    "WA": "Washington",
    "HI": "Hawaii",
}

# Known Wannasurf sub-regions per state (county-level path segments)
# These are the directory names used in wannasurf.com/spot/North_America/USA/{State}/{SubRegion}/
_STATE_SUBREGIONS: dict[str, list[str]] = {
    "CA": [
        "Del_Norte_County", "Humboldt_County", "Mendocino_County",
        "Sonoma_County", "Marin_County", "San_Francisco_County",
        "San_Mateo_County", "Santa_Cruz_County", "Monterey_County",
        "San_Luis_Obispo_County", "Santa_Barbara_County",
        "Ventura_County", "Los_Angeles_County", "Orange_County",
        "San_Diego_County",
    ],
    "OR": [
        "Clatsop_County", "Tillamook_County", "Lincoln_County",
        "Lane_County", "Douglas_County", "Coos_County", "Curry_County",
    ],
    "HI": [
        "Kauai", "Oahu", "Molokai", "Maui", "Big_Island",
    ],
    "WA": [
        "Pacific_County", "Grays_Harbor_County", "Jefferson_County",
        "Clallam_County",
    ],
}


def _slugify(name: str) -> str:
    """Convert a beach name to a wannasurf URL slug (lowercase, underscored)."""
    # "Blacks Beach" -> "blacks_beach", "Huntington Beach" -> "huntington_beach"
    slug = re.sub(r"['\"]", "", name)  # Remove apostrophes/quotes
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", slug)  # Non-alphanum -> underscore
    slug = slug.strip("_").lower()
    return slug


class WannasurfCrawler(BaseCrawler):
    """Crawl Wannasurf for structured surf spot data.

    Discovery strategy: construct candidate URLs from the beach name and
    state, then probe with HEAD requests. Wannasurf URLs follow the
    pattern ``/spot/North_America/USA/{State}/{SubRegion}/{spot_slug}/``.
    Since the site is not indexed by Google, we try all known sub-regions
    for the state.
    """

    def __init__(self, cache: CrawlCache | None = None, verbose: bool = False):
        super().__init__(cache=cache, verbose=verbose)

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
        """Search Wannasurf for a surf spot page and extract structured data."""
        urls = await self._discover_urls(beach_name, state=state)
        if not urls:
            self._log(f"No Wannasurf pages found for {beach_name}")
            return []

        results: list[CrawlResult] = []
        browser_cfg = BrowserConfig(headless=True, verbose=False)

        async with AsyncWebCrawler(config=browser_cfg) as browser:
            for url in urls:
                result = await self._crawl_spot_page(url, beach_name, browser=browser)
                if result is not None:
                    results.append(result)
                await asyncio.sleep(_RATE_LIMIT_SECS)

        return results

    # ------------------------------------------------------------------
    # URL discovery via direct probing
    # ------------------------------------------------------------------

    async def _discover_urls(
        self,
        beach_name: str,
        *,
        state: str | None = None,
    ) -> list[str]:
        """Construct candidate Wannasurf URLs and probe with HEAD requests."""
        cache_key = f"wannasurf_search:{beach_name}"
        cached = self.cache.get(cache_key)
        if cached is not None and cached.metadata.get("discovered_urls"):
            self._log(f"Cache hit for Wannasurf search: {beach_name}")
            return cached.metadata["discovered_urls"]

        slug = _slugify(beach_name)
        state_upper = (state or "").upper()
        region = _STATE_REGIONS.get(state_upper)

        if not region:
            self._log(f"No Wannasurf region for state={state}")
            # Cache the miss to avoid re-probing
            self.cache.put(
                cache_key,
                CrawlResult(
                    source="wannasurf_search",
                    url=f"wannasurf_probe:{beach_name}",
                    metadata={"discovered_urls": [], "slug": slug},
                ),
            )
            return []

        # Build candidate URLs for all known sub-regions
        subregions = _STATE_SUBREGIONS.get(state_upper, [])
        candidates = [
            f"{_BASE_URL}/spot/North_America/USA/{region}/{sub}/{slug}/"
            for sub in subregions
        ]

        self._log(
            f"Probing {len(candidates)} candidate URLs for {beach_name} ({slug})"
        )

        found: list[str] = []
        async with httpx.AsyncClient(
            timeout=10.0,
            follow_redirects=True,
            headers={"User-Agent": _USER_AGENT},
        ) as client:
            for url in candidates:
                try:
                    resp = await client.head(url)
                    if resp.status_code == 200:
                        self._log(f"Found: {url}")
                        found.append(url)
                        break  # One match is enough
                except httpx.HTTPError:
                    pass
                # Brief pause between probes (lighter than full rate limit)
                await asyncio.sleep(1.0)

        # Cache discovery result
        self.cache.put(
            cache_key,
            CrawlResult(
                source="wannasurf_search",
                url=f"wannasurf_probe:{beach_name}",
                metadata={"discovered_urls": found, "slug": slug},
            ),
        )

        return found

    # ------------------------------------------------------------------
    # Spot page crawl + extraction
    # ------------------------------------------------------------------

    async def _crawl_spot_page(
        self,
        url: str,
        beach_name: str,
        *,
        browser: AsyncWebCrawler,
    ) -> CrawlResult | None:
        """Crawl a single Wannasurf spot page and extract structured data."""
        cached = self.cache.get(url)
        if cached is not None:
            self._log(f"Cache hit: {url}")
            return cached

        self._log(f"Crawling Wannasurf page: {url}")

        crawl_cfg = CrawlerRunConfig(
            word_count_threshold=0,
            excluded_tags=["nav", "footer", "script", "style"],
        )

        try:
            response = await browser.arun(url=url, config=crawl_cfg)

            if not response.success:
                error_msg = response.error_message or "unknown crawl error"
                self._log(f"Crawl failed for {url}: {error_msg}")
                return CrawlResult(
                    source="wannasurf",
                    url=url,
                    error=error_msg,
                    metadata={"beach_name": beach_name},
                )

            raw_text = self._extract_markdown(response)
            metadata = self._parse_spot_data(raw_text)
            metadata["beach_name"] = beach_name

            result = CrawlResult(
                source="wannasurf",
                url=url,
                title=response.metadata.get("title") if response.metadata else None,
                raw_text=raw_text,
                metadata=metadata,
            )
            self.cache.put(url, result)
            return result

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            if status in (429, 503):
                self._log(f"Rate limited ({status}) for {url}, backing off")
                await asyncio.sleep(_RATE_LIMIT_SECS * 3)
            return CrawlResult(
                source="wannasurf",
                url=url,
                error=f"HTTP {status}",
                metadata={"beach_name": beach_name},
            )

        except Exception as exc:
            self._log(f"Error crawling {url}: {exc}")
            return CrawlResult(
                source="wannasurf",
                url=url,
                error=str(exc),
                metadata={"beach_name": beach_name},
            )

    # ------------------------------------------------------------------
    # Structured data parsing
    # ------------------------------------------------------------------

    @staticmethod
    def _parse_spot_data(markdown: str) -> dict:
        """Extract structured surf data from Wannasurf page markdown.

        Wannasurf renders label-value pairs as concatenated text without
        separators, e.g. ``Wave qualityWorld Class`` or ``BottomSandy``.
        We match ``LabelValue\\n`` where Label is known and Value runs
        to the next newline.
        """
        data: dict = {}

        # Known labels that can appear as the next field (used to stop greedy matches)
        _KNOWN_LABELS = (
            "Wave quality", "Experience", "Frequency", "Type", "Direction",
            "Bottom", "Power", "Normal length", "Good day length",
            "Good swell", "Good wind", "Swell size", "Best tide",
            "Week crowd", "Week-end crowd", "Webcam",
        )
        _LABEL_BOUNDARY = "|".join(re.escape(lb) for lb in _KNOWN_LABELS)

        def find_field(label: str) -> str | None:
            """Match 'LabelValue' where value runs to newline or next known label."""
            # Wannasurf format: "LabelValue\n" (no separator)
            match = re.search(
                rf"{label}\s*(.+?)(?:\n|$)", markdown, re.IGNORECASE
            )
            if match:
                val = match.group(1).strip()
                # Trim if value runs into the next known label
                for lb in _KNOWN_LABELS:
                    idx = val.find(lb)
                    if idx == 0:
                        # Value is empty — starts with the next label
                        val = ""
                        break
                    if idx > 0:
                        val = val[:idx].strip()
                        break
                # Skip if value looks like another label or is empty
                if val and not val.startswith("#"):
                    return val
            return None

        # Wave quality & experience (from "Surf Spot Quality" section)
        val = find_field("Wave quality")
        if val:
            data["wave_quality"] = val

        val = find_field("Experience")
        if val:
            data["skill_level"] = val

        val = find_field("Frequency")
        if val:
            data["frequency"] = val

        # Wave section
        val = find_field(r"(?:^|\n)\s*Type")
        if val:
            data["break_type"] = val

        val = find_field("Direction")
        if val:
            data["direction"] = val

        val = find_field("Bottom")
        if val:
            data["bottom_type"] = val

        val = find_field("Power")
        if val:
            data["power"] = val

        # Tide, Swell and Wind section
        val = find_field("Good swell direction")
        if val:
            data["swell_directions"] = val

        val = find_field("Good wind direction")
        if val:
            data["wind_directions"] = val

        val = find_field("Swell size")
        if val:
            data["swell_range_ft"] = val

        val = find_field("Best tide position")
        if val:
            data["tide_position"] = val

        val = find_field("Best tide movement")
        if val:
            data["tide_movement"] = val

        # More details section
        val = find_field("Week crowd")
        if val:
            data["crowd_weekday"] = val

        val = find_field("Week-end crowd")
        if val:
            data["crowd_weekend"] = val

        # Hazards — rendered as "#### Dangers\n- item\n- item"
        dangers_match = re.search(
            r"#{2,5}\s*Dangers?\s*\n((?:\s*-\s*.+\n?)+)", markdown, re.IGNORECASE
        )
        if dangers_match:
            items = re.findall(r"-\s*(.+)", dangers_match.group(1))
            data["hazards"] = ", ".join(i.strip() for i in items if i.strip())

        # Best season / months
        val = find_field("Best season")
        if val:
            data["best_months"] = val
        val = find_field("Best month")
        if val and "best_months" not in data:
            data["best_months"] = val

        return data
