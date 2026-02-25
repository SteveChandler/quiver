"""Flickr geo-search for beach images.

Ported from ``scripts/fetch-beach-photos.ts``. Degrades gracefully when
``FLICKR_API_KEY`` is not configured (returns an empty list).
"""

from __future__ import annotations

import logging
import math

import httpx

from quiver_content.config import CRAWL_USER_AGENT, FLICKR_API_KEY
from quiver_content.images.license import build_attribution_html
from quiver_content.images.wikimedia import ImageCandidate

logger = logging.getLogger(__name__)

FLICKR_API_URL = "https://api.flickr.com/services/rest/"

# Only Creative-Commons licences that permit at least reuse with attribution.
FLICKR_LICENSE_MAP: dict[str, dict[str, str]] = {
    "4": {
        "code": "CC-BY 2.0",
        "url": "https://creativecommons.org/licenses/by/2.0/",
    },
    "5": {
        "code": "CC-BY-SA 2.0",
        "url": "https://creativecommons.org/licenses/by-sa/2.0/",
    },
    "6": {
        "code": "CC-BY-ND 2.0",
        "url": "https://creativecommons.org/licenses/by-nd/2.0/",
    },
    "9": {
        "code": "CC0 1.0",
        "url": "https://creativecommons.org/publicdomain/zero/1.0/",
    },
    "10": {
        "code": "CC-BY 4.0",
        "url": "https://creativecommons.org/licenses/by/4.0/",
    },
    "11": {
        "code": "CC-BY-SA 4.0",
        "url": "https://creativecommons.org/licenses/by-sa/4.0/",
    },
}

# Comma-separated licence IDs accepted by flickr.photos.search
_ALLOWED_LICENSES = ",".join(FLICKR_LICENSE_MAP.keys())


def bbox_from_coords(lat: float, lon: float, km: float = 2.0) -> dict[str, float]:
    """Calculate a bounding box from a centre point and radius in km.

    This is a direct port of the TypeScript ``bboxFromLatLng`` helper.

    Returns
    -------
    dict with keys ``min_lat``, ``max_lat``, ``min_lon``, ``max_lon``.
    """
    R = 6371  # Earth radius in km
    d_lat = km / R * (180 / math.pi)
    d_lon = km / (R * math.cos(math.radians(lat))) * (180 / math.pi)
    return {
        "min_lat": lat - d_lat,
        "max_lat": lat + d_lat,
        "min_lon": lon - d_lon,
        "max_lon": lon + d_lon,
    }


async def search_flickr(
    beach_name: str,
    lat: float,
    lon: float,
    radius_km: float = 2.0,
    limit: int = 50,
) -> list[ImageCandidate]:
    """Search Flickr for CC-licensed photos near the given coordinates.

    If ``FLICKR_API_KEY`` is not set the function returns an empty list
    immediately (graceful degradation).

    Parameters
    ----------
    beach_name:
        Used as the ``text`` search term to improve relevance.
    lat, lon:
        Centre point for the bounding-box search.
    radius_km:
        Half-width of the search bounding box in km.
    limit:
        Maximum photos to request (capped at 500 by the Flickr API).

    Returns
    -------
    list[ImageCandidate]
        Candidates with metadata populated. Empty list on failure or missing key.
    """
    if not FLICKR_API_KEY:
        logger.debug("FLICKR_API_KEY not set; skipping Flickr search")
        return []

    bbox = bbox_from_coords(lat, lon, radius_km)
    bbox_str = (
        f"{bbox['min_lon']},{bbox['min_lat']},{bbox['max_lon']},{bbox['max_lat']}"
    )

    params = {
        "method": "flickr.photos.search",
        "api_key": FLICKR_API_KEY,
        "text": beach_name,
        "bbox": bbox_str,
        "license": _ALLOWED_LICENSES,
        "content_type": "1",  # photos only
        "media": "photos",
        "extras": "url_l,url_o,url_m,owner_name,license,date_taken",
        "per_page": str(min(limit, 500)),
        "sort": "interestingness-desc",
        "safe_search": "1",
        "format": "json",
        "nojsoncallback": "1",
    }

    try:
        async with httpx.AsyncClient(
            headers={"User-Agent": CRAWL_USER_AGENT},
            timeout=15.0,
        ) as client:
            resp = await client.get(FLICKR_API_URL, params=params)
            resp.raise_for_status()
            data = resp.json()
    except (httpx.HTTPError, ValueError) as exc:
        logger.warning("Flickr search failed for %s: %s", beach_name, exc)
        return []

    photos = data.get("photos", {}).get("photo", [])
    if not photos:
        return []

    candidates: list[ImageCandidate] = []
    for photo in photos:
        # Prefer url_l (large 1024), fall back to url_o (original)
        image_url = photo.get("url_l") or photo.get("url_o")
        if not image_url:
            # Skip photos without a usable URL
            continue

        thumb_url = photo.get("url_m")
        photo_id = str(photo.get("id", ""))
        owner = photo.get("owner", "")
        creator_name = photo.get("ownername") or owner or None
        creator_url = f"https://www.flickr.com/photos/{owner}/" if owner else None

        license_id = str(photo.get("license", ""))
        license_info = FLICKR_LICENSE_MAP.get(license_id, {})
        license_code = license_info.get("code")
        license_url = license_info.get("url")

        title = photo.get("title") or None

        attribution = build_attribution_html(
            source="Flickr",
            creator_name=creator_name,
            creator_url=creator_url,
            license_code=license_code,
            license_url=license_url,
            title=title,
        )

        candidates.append(
            ImageCandidate(
                source="flickr",
                source_id=photo_id,
                image_url=image_url,
                thumb_url=thumb_url,
                title=title,
                width=None,  # Flickr extras don't reliably include dimensions for url_l
                height=None,
                creator_name=creator_name,
                creator_url=creator_url,
                license_code=license_code,
                license_url=license_url,
                attribution_html=attribution,
            )
        )

    return candidates
