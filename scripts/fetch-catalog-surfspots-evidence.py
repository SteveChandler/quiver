#!/usr/bin/env python3

import argparse
import difflib
import importlib.util
import json
import math
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path


SITEMAP_URL = "https://www.surfspots.co/sitemap.xml"
USER_AGENT = "QuiverCatalogResearch/1.0 (https://quiversurf.app)"


def load_primary_fetcher():
    module_path = Path(__file__).with_name("fetch-catalog-surf-guide-evidence.py")
    spec = importlib.util.spec_from_file_location("primary_surf_guide_fetcher", module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


PRIMARY = load_primary_fetcher()
PRIMARY_SOURCE_ALIASES = {
    "off the wall": {"offthe wall insanities"},
    "pops": {"populars"},
}
SUBBREAK_TOKENS = {
    "corner", "cove", "first", "groins", "jetty", "marina", "middle",
    "north", "park", "peak", "pier", "second", "sewer", "sloat", "south",
    "st", "street", "third",
}
SUBBREAK_TOKEN_ALIASES = {"jetties": "jetty", "groin": "groins"}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch SurfSpots.co direction evidence.")
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--primary-evidence", type=Path)
    parser.add_argument("--delay-ms", type=int, default=25)
    return parser.parse_args()


def compass_degrees(value: str) -> float | None:
    compact = re.sub(r"[^a-z]", "", value.lower())
    compact_degrees = {
        re.sub(r"[^a-z]", "", name): degrees
        for name, degrees in PRIMARY.COMPASS_DEGREES.items()
    }
    return compact_degrees.get(compact)


def parse_page(html: str) -> dict[str, object]:
    coordinate_match = re.search(
        r'"latitude":"?([-0-9.]+)"?,"longitude":"?([-0-9.]+)"?', html
    )
    directions_match = re.search(r'"swell_dir":(\[[^\]]*\])', html)
    directions = json.loads(directions_match.group(1)) if directions_match else []
    degrees = [compass_degrees(value) for value in directions]
    return {
        "coordinate": (
            {
                "latitude": float(coordinate_match.group(1)),
                "longitude": float(coordinate_match.group(2)),
            }
            if coordinate_match
            else None
        ),
        "ideal_direction_text": directions,
        "ideal_direction_deg": [value for value in degrees if value is not None],
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
    return [
        node.text
        for node in root.findall("s:url/s:loc", namespace)
        if node.text and "/spot/" in node.text
    ]


def url_name(url: str) -> str:
    slug = urllib.parse.unquote(url.rstrip("/").split("/")[-1])
    return PRIMARY.normalize_name(slug.replace("-", " ").replace("_", " "))


def explicit_subbreak_tokens(value: str) -> set[str]:
    tokens = {
        SUBBREAK_TOKEN_ALIASES.get(token, token)
        for token in re.findall(r"[a-z]+|\d+(?:st|nd|rd|th)?", value.lower())
    }
    return {
        token
        for token in tokens
        if token in SUBBREAK_TOKENS or re.fullmatch(r"\d+(?:st|nd|rd|th)", token)
    }


def source_slug(url: str) -> str:
    return urllib.parse.unquote(url.rstrip("/").split("/")[-1]).replace("-", " ").replace("_", " ")


def name_candidates(name: str, urls: list[str]) -> list[tuple[float, str]]:
    target = PRIMARY.normalize_name(name)
    scored = []
    for url in urls:
        candidate = url_name(url)
        score = difflib.SequenceMatcher(None, target, candidate).ratio()
        if target == candidate:
            score = 1.5
        elif target and (target in candidate or candidate in target):
            score += 0.25
        scored.append((score, url))
    return sorted(scored, reverse=True)[:6]


def primary_match_is_trusted(review: dict[str, object], result: dict[str, object]) -> bool:
    return source_match_is_trusted(review, result, "coordinate_and_direction_matched")


def secondary_match_is_trusted(review: dict[str, object], result: dict[str, object]) -> bool:
    return source_match_is_trusted(review, result, "coordinate_name_and_direction_matched")


def source_match_is_trusted(
    review: dict[str, object], result: dict[str, object], required_status: str
) -> bool:
    if result.get("status") != required_status:
        return False
    generic_tokens = {"beach", "point", "inlet", "jetty", "pier", "harbor", "state"}
    target_subbreaks = explicit_subbreak_tokens(str(review["name"]))
    source_subbreaks = explicit_subbreak_tokens(source_slug(str(result["source_url"])))
    normalized_target = PRIMARY.normalize_name(str(review["name"]))
    normalized_source = url_name(str(result["source_url"]))
    if target_subbreaks != source_subbreaks and not (
        normalized_source in PRIMARY_SOURCE_ALIASES.get(normalized_target, set())
    ):
        return False
    target_tokens = {
        token
        for token in normalized_target.split()
        if len(token) >= 4 and token not in generic_tokens
    }
    source_tokens = set(normalized_source.split())
    shares_name = bool(target_tokens & source_tokens) or bool(
        {token[:5] for token in target_tokens} & {token[:5] for token in source_tokens}
    )
    alias_match = normalized_source in PRIMARY_SOURCE_ALIASES.get(normalized_target, set())
    distance_km = result.get("distance_km", 999)
    name_score = result.get("name_score", 0)
    if name_score >= 0.85 and distance_km <= 2:
        return True
    if not shares_name and not alias_match:
        return False
    if alias_match:
        return distance_km <= 5
    if name_score >= 0.85:
        return distance_km <= 10
    return name_score >= 0.7 and distance_km <= 5


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


def best_match(review: dict[str, object], urls: list[str], delay_ms: int) -> dict[str, object]:
    attempts = []
    for name_score, url in name_candidates(str(review["name"]), urls):
        try:
            parsed = parse_page(fetch_text(url))
            distance_km = (
                haversine_km(review["coordinate"], parsed["coordinate"])
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
                name_score >= 0.65
                and distance_km is not None
                and distance_km <= 5
                and parsed["ideal_direction_deg"]
            ):
                return {
                    "status": "coordinate_name_and_direction_matched",
                    "source_url": url,
                    "source_coordinate": parsed["coordinate"],
                    "distance_km": round(distance_km, 2),
                    "ideal_direction_text": parsed["ideal_direction_text"],
                    "ideal_direction_deg": parsed["ideal_direction_deg"],
                    "name_score": round(name_score, 3),
                    "checked_on": "2026-08-28",
                }
        except Exception as error:
            attempts.append({"url": url, "error": f"{type(error).__name__}: {error}"})
        time.sleep(delay_ms / 1000)
    return {"status": "no_coordinate_name_direction_match", "attempts": attempts, "checked_on": "2026-08-28"}


def main() -> None:
    args = parse_args()
    audit = json.loads(args.audit.read_text())
    urls = sitemap_urls()
    primary = (
        json.loads(args.primary_evidence.read_text()).get("results", {})
        if args.primary_evidence
        else {}
    )
    targets = [
        (beach_id, review)
        for beach_id, review in audit["reviews"].items()
        if review["decision"]["source_research_required"]
        and not primary_match_is_trusted(review, primary.get(beach_id, {}))
    ]
    target_ids = {beach_id for beach_id, _ in targets}
    previous = json.loads(args.output.read_text()).get("results", {}) if args.output.exists() else {}
    results = {key: value for key, value in previous.items() if key in target_ids}
    for index, (beach_id, review) in enumerate(targets, start=1):
        existing = results.get(beach_id)
        if existing and existing.get("status") == "coordinate_name_and_direction_matched":
            continue
        results[beach_id] = best_match(review, urls, args.delay_ms)
        print(f"{index}/{len(targets)} {review['name']}: {results[beach_id]['status']}", flush=True)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(
                {
                    "schema_version": "1.0.0",
                    "dataset_id": "catalog-surfspots-direction-evidence-2026-08-28",
                    "checked_on": "2026-08-28",
                    "provider": "SurfSpots.co public spot pages",
                    "sitemap_url": SITEMAP_URL,
                    "target_count": len(targets),
                    "matched_count": sum(
                        result.get("status") == "coordinate_name_and_direction_matched"
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
