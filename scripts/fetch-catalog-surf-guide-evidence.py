#!/usr/bin/env python3

import argparse
import difflib
import json
import math
import re
import time
import unicodedata
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


SITEMAP_URL = "https://www.surf-forecast.com/sitemaps/surf-spots.xml"
COUNTRY_BREAK_URLS = (
    "https://www.surf-forecast.com/countries/United-States/breaks",
    "https://www.surf-forecast.com/countries/Mexico/breaks",
)
USER_AGENT = "QuiverCatalogResearch/1.0 (https://quiversurf.app)"
COMPASS_DEGREES = {
    "north": 0,
    "north northeast": 22.5,
    "northeast": 45,
    "east northeast": 67.5,
    "east": 90,
    "east southeast": 112.5,
    "southeast": 135,
    "south southeast": 157.5,
    "south": 180,
    "south southwest": 202.5,
    "southwest": 225,
    "west southwest": 247.5,
    "west": 270,
    "west northwest": 292.5,
    "northwest": 315,
    "north northwest": 337.5,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fetch spot-specific Surf-Forecast direction evidence."
    )
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--delay-ms", type=int, default=75)
    return parser.parse_args()


def normalize_name(value: str) -> str:
    value = re.sub(r"\([^)]*\)", " ", value)
    value = value.split("/")[0]
    value = value.split("—")[0]
    value = value.split("–")[0]
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("'", "").replace("’", "")
    value = re.sub(r"\b(inlet|jetty|pier|point|breakwall)\b$", " ", value, flags=re.I)
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def compass_degrees(value: str) -> float | None:
    normalized = re.sub(r"[-\s]+", " ", value.lower()).strip()
    abbreviations = {
        "n": "north",
        "nne": "north northeast",
        "ne": "northeast",
        "ene": "east northeast",
        "e": "east",
        "ese": "east southeast",
        "se": "southeast",
        "sse": "south southeast",
        "s": "south",
        "ssw": "south southwest",
        "sw": "southwest",
        "wsw": "west southwest",
        "w": "west",
        "wnw": "west northwest",
        "nw": "northwest",
        "nnw": "north northwest",
    }
    normalized = abbreviations.get(normalized, normalized)
    return COMPASS_DEGREES.get(normalized)


def parse_page(html: str) -> dict[str, object]:
    coordinate_match = re.search(
        r'"currentLocation"\s*:\s*\{[^{}]*?"lat"\s*:\s*([-0-9.]+)'
        r'\s*,\s*"lng"\s*:\s*([-0-9.]+)',
        html,
        flags=re.I,
    )
    direction_match = re.search(
        r"(?:ideal|best) swell direction is from (?:the )?([a-z -]+?)(?:\.|,|<)",
        html,
        flags=re.I,
    )
    direction_text = (
        re.sub(r"[-\s]+", " ", direction_match.group(1).lower()).strip()
        if direction_match
        else None
    )
    return {
        "coordinate": (
            {
                "latitude": float(coordinate_match.group(1)),
                "longitude": float(coordinate_match.group(2)),
            }
            if coordinate_match
            else None
        ),
        "ideal_direction_text": direction_text,
        "ideal_direction_deg": compass_degrees(direction_text) if direction_text else None,
    }


def fetch_text(url: str, attempts: int = 3) -> str:
    error = None
    for attempt in range(attempts):
        try:
            request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read().decode("utf-8", "ignore")
        except Exception as current_error:
            error = current_error
            if attempt + 1 < attempts:
                time.sleep(0.5 * (attempt + 1))
    raise error


def sitemap_urls() -> list[str]:
    root = ET.fromstring(fetch_text(SITEMAP_URL))
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.text for node in root.findall("s:url/s:loc", namespace) if node.text]
    if urls:
        return urls

    discovered = set()
    for country_url in COUNTRY_BREAK_URLS:
        html = fetch_text(country_url)
        for path in re.findall(r'href=["\'](/breaks/[^"\'/?#]+)', html):
            discovered.add(urllib.parse.urljoin(country_url, path))
    return sorted(discovered)


def url_name(url: str) -> str:
    slug = urllib.parse.unquote(url.rstrip("/").split("/")[-1])
    return normalize_name(slug.replace("-", " ").replace("_", " "))


def name_candidates(name: str, urls: list[str]) -> list[tuple[float, str]]:
    target = normalize_name(name)
    scored = []
    for url in urls:
        candidate = url_name(url)
        score = difflib.SequenceMatcher(None, target, candidate).ratio()
        if target == candidate:
            score = 1.5
        elif target and (target in candidate or candidate in target):
            score += 0.25
        scored.append((score, url))
    return sorted(scored, reverse=True)[:12]


def haversine_km(left: dict[str, float], right: dict[str, float]) -> float:
    radius_km = 6371.0088
    lat_1 = math.radians(left["latitude"])
    lat_2 = math.radians(right["latitude"])
    delta_lat = lat_2 - lat_1
    delta_lon = math.radians(right["longitude"] - left["longitude"])
    value = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(lat_1) * math.cos(lat_2) * math.sin(delta_lon / 2) ** 2
    )
    return radius_km * 2 * math.atan2(math.sqrt(value), math.sqrt(1 - value))


def best_match(
    review: dict[str, object], urls: list[str], delay_ms: int
) -> dict[str, object]:
    target_coordinate = review["coordinate"]
    attempts = []
    for name_score, url in name_candidates(str(review["name"]), urls):
        try:
            parsed = parse_page(fetch_text(url))
            distance_km = (
                haversine_km(target_coordinate, parsed["coordinate"])
                if parsed["coordinate"]
                else None
            )
            attempts.append(
                {
                    "url": url,
                    "name_score": round(name_score, 3),
                    "distance_km": round(distance_km, 2) if distance_km is not None else None,
                    **parsed,
                }
            )
            if (
                distance_km is not None
                and distance_km <= 35
                and parsed["ideal_direction_deg"] is not None
            ):
                return {
                    "status": "coordinate_and_direction_matched",
                    "source_url": url,
                    "source_coordinate": parsed["coordinate"],
                    "distance_km": round(distance_km, 2),
                    "ideal_direction_text": parsed["ideal_direction_text"],
                    "ideal_direction_deg": parsed["ideal_direction_deg"],
                    "name_score": round(name_score, 3),
                    "checked_on": "2026-08-28",
                }
        except Exception as error:
            attempts.append(
                {
                    "url": url,
                    "name_score": round(name_score, 3),
                    "error": f"{type(error).__name__}: {error}",
                }
            )
        time.sleep(delay_ms / 1000)
    return {
        "status": "no_coordinate_direction_match",
        "checked_on": "2026-08-28",
        "attempts": attempts,
    }


def main() -> None:
    args = parse_args()
    audit = json.loads(args.audit.read_text())
    urls = sitemap_urls()
    previous = (
        json.loads(args.output.read_text()).get("results", {})
        if args.output.exists()
        else {}
    )
    results = dict(previous)
    targets = [
        (beach_id, review)
        for beach_id, review in audit["reviews"].items()
        if review["decision"]["source_research_required"]
    ]
    for index, (beach_id, review) in enumerate(targets, start=1):
        existing = results.get(beach_id)
        if existing and existing.get("status") == "coordinate_and_direction_matched":
            continue
        results[beach_id] = best_match(review, urls, args.delay_ms)
        print(f"{index}/{len(targets)} {review['name']}: {results[beach_id]['status']}")
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(
                {
                    "schema_version": "1.0.0",
                    "dataset_id": "catalog-surf-forecast-direction-evidence-2026-08-28",
                    "checked_on": "2026-08-28",
                    "provider": "Surf-Forecast public spot guide pages",
                    "sitemap_url": SITEMAP_URL,
                    "country_break_urls": COUNTRY_BREAK_URLS,
                    "target_count": len(targets),
                    "matched_count": sum(
                        result.get("status") == "coordinate_and_direction_matched"
                        for result in results.values()
                    ),
                    "results": results,
                },
                indent=2,
                ensure_ascii=False,
            )
            + "\n"
        )


if __name__ == "__main__":
    main()
