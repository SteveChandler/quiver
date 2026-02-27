"""OpenStreetMap Overpass API crawler for beach amenities."""

from __future__ import annotations

import asyncio
import math

import httpx

from quiver_content.crawlers.base import (
    BaseCrawler,
    CrawlCache,
    CrawlResult,
)

# Rate limit: 2s between requests (well within Overpass 10K/day guideline)
_RATE_LIMIT_SECS = 2.0

# Cache amenity data for 30 days (amenities rarely change)
_CACHE_TTL_DAYS = 30

_OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter"

_USER_AGENT = "QuiverSurf/1.0 (content-pipeline; contact@quiversurf.app)"

# Overpass QL query template — searches 1km radius around (lat, lon)
_QUERY_TEMPLATE = """\
[out:json][timeout:25];
(
  node[amenity=parking](around:1000,{lat},{lon});
  way[amenity=parking](around:1000,{lat},{lon});
  node[amenity=toilets](around:1000,{lat},{lon});
  node[amenity=shower](around:1000,{lat},{lon});
  node[amenity=dressing_room](around:1000,{lat},{lon});
  node[emergency=lifeguard](around:1000,{lat},{lon});
  node[leisure=picnic_table](around:1000,{lat},{lon});
  node[amenity=cafe](around:1000,{lat},{lon});
  node[amenity=fast_food](around:1000,{lat},{lon});
  node[shop=sports](around:1000,{lat},{lon});
  node[shop=outdoor](around:1000,{lat},{lon});
  way[natural=beach](around:1000,{lat},{lon});
);
out body geom;
"""

# Categorize OSM tags into amenity types
_TAG_CATEGORIES: dict[str, str] = {
    "parking": "parking",
    "toilets": "restroom",
    "shower": "shower",
    "dressing_room": "changing_room",
    "lifeguard": "lifeguard",
    "picnic_table": "picnic",
    "cafe": "food",
    "fast_food": "food",
    "sports": "shop",
    "outdoor": "shop",
}


def _haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine distance in meters between two GPS points."""
    R = 6_371_000  # Earth radius in meters
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class OverpassCrawler(BaseCrawler):
    """Query OpenStreetMap Overpass API for beach amenities.

    Searches for parking, restrooms, showers, lifeguard stations, food,
    and surf shops within 1km of the beach coordinates. Results are
    licensed under ODbL (Open Database License).
    """

    def __init__(self, cache: CrawlCache | None = None, verbose: bool = False):
        super().__init__(
            cache=cache or CrawlCache(ttl_days=_CACHE_TTL_DAYS),
            verbose=verbose,
        )

    async def crawl(
        self,
        beach_name: str,
        lat: float,
        lon: float,
        **kwargs,
    ) -> list[CrawlResult]:
        """Query Overpass API for amenities near the beach."""
        cache_key = f"overpass:{lat:.5f},{lon:.5f}"
        cached = self.cache.get(cache_key)
        if cached is not None:
            self._log(f"Cache hit for Overpass query at ({lat}, {lon})")
            return [cached]

        self._log(f"Querying Overpass API for amenities near {beach_name}")

        query = _QUERY_TEMPLATE.format(lat=lat, lon=lon)

        try:
            async with httpx.AsyncClient(
                timeout=30.0,
                headers={"User-Agent": _USER_AGENT},
            ) as client:
                response = await client.post(
                    _OVERPASS_ENDPOINT,
                    data={"data": query},
                )
                response.raise_for_status()
                data = response.json()

            elements = data.get("elements", [])
            self._log(f"Overpass returned {len(elements)} elements")

            # Parse and categorize results
            amenities = self._categorize_elements(elements, lat, lon)
            raw_text = self._build_summary_text(amenities, beach_name)
            metadata = self._build_metadata(amenities)

            result = CrawlResult(
                source="osm",
                url=f"overpass:{lat:.5f},{lon:.5f}",
                title=f"Nearby Amenities - {beach_name}",
                raw_text=raw_text,
                metadata=metadata,
            )
            self.cache.put(cache_key, result)

            await asyncio.sleep(_RATE_LIMIT_SECS)
            return [result]

        except httpx.HTTPStatusError as exc:
            status = exc.response.status_code
            self._log(f"Overpass HTTP {status}")
            if status in (429, 504):
                self._log("Rate limited or timeout, backing off")
                await asyncio.sleep(_RATE_LIMIT_SECS * 5)
            return [
                CrawlResult(
                    source="osm",
                    url=f"overpass:{lat:.5f},{lon:.5f}",
                    error=f"HTTP {status}",
                    metadata={"beach_name": beach_name},
                )
            ]

        except Exception as exc:
            self._log(f"Overpass error: {exc}")
            return [
                CrawlResult(
                    source="osm",
                    url=f"overpass:{lat:.5f},{lon:.5f}",
                    error=str(exc),
                    metadata={"beach_name": beach_name},
                )
            ]

    # ------------------------------------------------------------------
    # Element categorization
    # ------------------------------------------------------------------

    def _categorize_elements(
        self,
        elements: list[dict],
        center_lat: float,
        center_lon: float,
    ) -> dict[str, list[dict]]:
        """Group OSM elements by amenity category with distance from beach."""
        categories: dict[str, list[dict]] = {
            "parking": [],
            "restroom": [],
            "shower": [],
            "changing_room": [],
            "lifeguard": [],
            "picnic": [],
            "food": [],
            "shop": [],
            "beach": [],
        }

        for el in elements:
            tags = el.get("tags", {})
            el_type = el.get("type", "")

            # Compute distance from beach center
            if el_type == "node":
                el_lat = el.get("lat", center_lat)
                el_lon = el.get("lon", center_lon)
            elif el_type == "way" and "geometry" in el:
                # Use centroid of way geometry
                geom = el["geometry"]
                if geom:
                    el_lat = sum(p.get("lat", 0) for p in geom) / len(geom)
                    el_lon = sum(p.get("lon", 0) for p in geom) / len(geom)
                else:
                    el_lat, el_lon = center_lat, center_lon
            else:
                el_lat, el_lon = center_lat, center_lon

            distance_m = _haversine_m(center_lat, center_lon, el_lat, el_lon)

            # Determine category
            category = None

            # Check natural=beach
            if tags.get("natural") == "beach":
                category = "beach"
            # Check emergency=lifeguard
            elif tags.get("emergency") == "lifeguard":
                category = "lifeguard"
            # Check amenity tag
            elif "amenity" in tags:
                category = _TAG_CATEGORIES.get(tags["amenity"])
            # Check leisure tag
            elif "leisure" in tags:
                category = _TAG_CATEGORIES.get(tags["leisure"])
            # Check shop tag
            elif "shop" in tags:
                category = _TAG_CATEGORIES.get(tags["shop"])

            if category and category in categories:
                name = tags.get("name", "")
                detail = {
                    "name": name,
                    "type": category,
                    "distance_m": round(distance_m),
                    "tags": {
                        k: v
                        for k, v in tags.items()
                        if k in ("fee", "access", "supervised", "surface", "capacity")
                    },
                }
                categories[category].append(detail)

        # Sort each category by distance
        for cat_list in categories.values():
            cat_list.sort(key=lambda x: x["distance_m"])

        return categories

    # ------------------------------------------------------------------
    # Text summary
    # ------------------------------------------------------------------

    @staticmethod
    def _build_summary_text(
        amenities: dict[str, list[dict]], beach_name: str
    ) -> str:
        """Build a human-readable amenity summary for sources.md."""
        lines: list[str] = []
        lines.append(f"## Nearby Amenities for {beach_name} (within 1km)")
        lines.append("")
        lines.append(
            "*Data from OpenStreetMap (ODbL license). "
            "Attribution: (c) OpenStreetMap contributors.*"
        )
        lines.append("")

        def _format_count(items: list[dict], label: str) -> str:
            if not items:
                return f"**{label}:** None found"
            count = len(items)
            named = [i for i in items if i.get("name")]
            closest = items[0]
            dist_str = f"{closest['distance_m']}m from beach"

            if named:
                names = ", ".join(i["name"] for i in named[:3])
                extra = f" (+{count - 3} more)" if count > 3 else ""
                return f"**{label}:** {count} found ({dist_str}) - {names}{extra}"
            return f"**{label}:** {count} found ({dist_str})"

        lines.append(_format_count(amenities["parking"], "Parking"))

        # Combine restrooms, showers, changing rooms
        facilities = (
            amenities["restroom"] + amenities["shower"] + amenities["changing_room"]
        )
        if facilities:
            parts = []
            if amenities["restroom"]:
                parts.append(f"{len(amenities['restroom'])} restroom(s)")
            if amenities["shower"]:
                parts.append(f"{len(amenities['shower'])} shower(s)")
            if amenities["changing_room"]:
                parts.append(f"{len(amenities['changing_room'])} changing room(s)")
            lines.append(f"**Facilities:** {', '.join(parts)}")
        else:
            lines.append("**Facilities:** None found")

        lines.append(_format_count(amenities["lifeguard"], "Lifeguard Stations"))
        lines.append(_format_count(amenities["food"], "Food/Drink"))
        lines.append(_format_count(amenities["shop"], "Surf/Outdoor Shops"))

        if amenities["picnic"]:
            lines.append(
                f"**Picnic Areas:** {len(amenities['picnic'])} table(s) found"
            )

        # Beach polygon info
        if amenities["beach"]:
            beach_info = amenities["beach"][0]
            supervised = beach_info.get("tags", {}).get("supervised")
            if supervised == "yes":
                lines.append("**Beach:** Supervised/lifeguarded beach area")
            else:
                lines.append("**Beach:** Beach area mapped in OSM")

        lines.append("")
        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Structured metadata
    # ------------------------------------------------------------------

    @staticmethod
    def _build_metadata(amenities: dict[str, list[dict]]) -> dict:
        """Build structured metadata dict for CrawlResult.metadata."""
        return {
            "parking_count": len(amenities["parking"]),
            "restroom_count": len(amenities["restroom"]),
            "shower_count": len(amenities["shower"]),
            "changing_room_count": len(amenities["changing_room"]),
            "lifeguard_count": len(amenities["lifeguard"]),
            "food_count": len(amenities["food"]),
            "shop_count": len(amenities["shop"]),
            "picnic_count": len(amenities["picnic"]),
            "amenity_details": {
                cat: items for cat, items in amenities.items() if items
            },
            "license": "ODbL",
            "attribution": "(c) OpenStreetMap contributors",
        }
