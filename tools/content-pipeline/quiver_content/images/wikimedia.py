"""Wikimedia Commons geo-search for beach images."""

from __future__ import annotations

import logging
import re
from dataclasses import dataclass

import httpx

from quiver_content.config import CRAWL_USER_AGENT
from quiver_content.images.license import build_attribution_html

logger = logging.getLogger(__name__)

# Regex to strip HTML tags (used for cleaning Artist metadata)
_STRIP_HTML_RE = re.compile(r"<[^>]+>")

WIKIMEDIA_API_URL = "https://commons.wikimedia.org/w/api.php"


@dataclass
class ImageCandidate:
    """A candidate beach image with metadata."""

    source: str  # "wikimedia" or "flickr"
    source_id: str  # Unique ID within the source
    image_url: str  # Full-size URL
    thumb_url: str | None = None
    title: str | None = None
    width: int | None = None
    height: int | None = None
    creator_name: str | None = None
    creator_url: str | None = None
    license_code: str | None = None
    license_url: str | None = None
    attribution_html: str | None = None
    score: float = 0.0  # Set by scorer


def _strip_html(html: str | None) -> str | None:
    """Remove HTML tags from a string, returning None for empty results."""
    if not html:
        return None
    text = _STRIP_HTML_RE.sub("", html).strip()
    return text if text else None


def _extract_metadata(extmetadata: dict) -> dict:
    """Extract creator, license, and other metadata from Wikimedia extmetadata.

    Returns a dict with keys: creator_name, license_code, license_url.
    """
    result: dict[str, str | None] = {
        "creator_name": None,
        "license_code": None,
        "license_url": None,
    }

    artist = extmetadata.get("Artist", {}).get("value")
    if artist:
        result["creator_name"] = _strip_html(artist)

    license_short = extmetadata.get("LicenseShortName", {}).get("value")
    if license_short:
        result["license_code"] = license_short.strip()

    license_url = extmetadata.get("LicenseUrl", {}).get("value")
    if license_url:
        result["license_url"] = license_url.strip()

    return result


async def search_wikimedia(
    beach_name: str,
    lat: float,
    lon: float,
    radius_m: int = 2000,
    limit: int = 20,
) -> list[ImageCandidate]:
    """Search Wikimedia Commons for geo-tagged images near coordinates.

    Uses the MediaWiki API with generator=geosearch to find images within
    ``radius_m`` metres of the given lat/lon, then fetches imageinfo metadata
    for each result.

    Parameters
    ----------
    beach_name:
        Name of the beach (used for attribution context, not in the API query).
    lat, lon:
        Center point coordinates.
    radius_m:
        Search radius in metres (max 10000 for the API).
    limit:
        Maximum number of results to request.

    Returns
    -------
    list[ImageCandidate]
        Candidates with metadata populated. Empty list on any API failure.
    """
    params = {
        "action": "query",
        "generator": "geosearch",
        "ggscoord": f"{lat}|{lon}",
        "ggsradius": str(min(radius_m, 10000)),
        "ggsnamespace": "6",  # File namespace
        "ggslimit": str(min(limit, 50)),
        "prop": "imageinfo",
        "iiprop": "url|extmetadata|size",
        "iiurlwidth": "1920",
        "format": "json",
        "formatversion": "2",
    }

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": CRAWL_USER_AGENT},
            timeout=15.0,
        ) as client:
            resp = await client.get(WIKIMEDIA_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Wikimedia search failed for %s: %s", beach_name, exc)
        return []

    pages = data.get("query", {}).get("pages", [])
    if not pages:
        return []

    # formatversion=2 returns a list; formatversion=1 returns a dict
    if isinstance(pages, dict):
        pages = list(pages.values())

    candidates: list[ImageCandidate] = []
    for page in pages:
        imageinfo_list = page.get("imageinfo")
        if not imageinfo_list:
            continue
        info = imageinfo_list[0]

        image_url = info.get("url")
        if not image_url:
            continue

        # Clean up page title (strip "File:" prefix)
        raw_title = page.get("title", "")
        title = re.sub(r"^File:", "", raw_title).strip() or None
        # Also strip file extension from the display title
        if title:
            title = re.sub(r"\.\w{2,5}$", "", title).strip() or title

        extmetadata = info.get("extmetadata", {})
        meta = _extract_metadata(extmetadata)

        attribution = build_attribution_html(
            source="Wikimedia Commons",
            creator_name=meta["creator_name"],
            license_code=meta["license_code"],
            license_url=meta["license_url"],
            title=title,
        )

        candidates.append(
            ImageCandidate(
                source="wikimedia",
                source_id=str(page.get("pageid", "")),
                image_url=image_url,
                thumb_url=info.get("thumburl"),
                title=title,
                width=info.get("width"),
                height=info.get("height"),
                creator_name=meta["creator_name"],
                license_code=meta["license_code"],
                license_url=meta["license_url"],
                attribution_html=attribution,
            )
        )

    return candidates
