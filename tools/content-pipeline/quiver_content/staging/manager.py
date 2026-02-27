"""Staging area manager for review-ready content files.

Manages reading/writing files in the ``output/staging/{beach_id}/``
directory structure.  Content flows through staging before being
published to Supabase, giving operators a chance to review and edit
the generated JSON and Markdown artifacts.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from quiver_content.config import STAGING_DIR


# --------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------- #


def _beach_dir(beach_id: str) -> Path:
    """Get or create the staging directory for a beach."""
    d = STAGING_DIR / beach_id
    d.mkdir(parents=True, exist_ok=True)
    return d


def _sanitize_markdown(text: str) -> str:
    """Escape markdown special characters in user-supplied text."""
    # Only escape characters that could break the structure
    for char in ['[', ']', '(', ')', '<', '>']:
        text = text.replace(char, f'\\{char}')
    return text


# --------------------------------------------------------------------- #
# Schema reference used in the sources.md prompt
# --------------------------------------------------------------------- #

_LAYER1_SCHEMA = """\
description: TEXT - 2-3 paragraphs about the beach
break_type: TEXT - Primary break type (beach, point, reef)
crowd_level: TEXT - e.g., "heavy", "moderate", "light"
crowd_tips: TEXT - Crowd navigation advice
wave_tips: TEXT - Tactical wave advice
best_conditions_prose: TEXT - Human-readable best conditions
access_tips: TEXT - How to get there
parking_tips: TEXT - Parking situation
best_months: INTEGER[] - Months 1-12 for best surfing
hazards: TEXT[] - Known hazards
aspect_deg: INTEGER - Shoreline aspect 0-360 degrees
skill_level: TEXT - "beginner", "intermediate", "advanced", "expert"
preferred_tide_direction: TEXT - Preferred tide direction
preferred_tide_ft_min: NUMERIC - Min preferred tide height (feet)
preferred_tide_ft_max: NUMERIC - Max preferred tide height (feet)
features: TEXT[] - Filterable tags
warnings: TEXT[] - Safety warnings
local_etiquette: TEXT - Local rules
real_takeaways: TEXT[] - Emoji-prefixed local tips"""

_LAYER2_SCHEMA = """\
beginner_notes: {
  why_beginners_love_it: string[],
  logistics: {
    parking, walk_distance, lifeguards: boolean,
    best_hours, facilities
  },
  description: string,
  what_to_expect: {
    wave_size, wave_type, bottom, hazards: string[],
    water_temp, skill_level
  },
  seasonal_guide: { summer, fall, winter, spring },
  important_note?: string
}

tide_notes: {
  best_tides: string[],
  tide_timing: { low_tide, mid_tide, high_tide },
  tide_tips: string[],
  description: string
}

safety_notes: {
  hazards: string[],
  rip_currents: {
    frequency, location, how_to_spot, what_to_do
  },
  emergency_contacts: { lifeguard, coastguard, local_police },
  local_rules: string[],
  description: string
}

advanced_notes: {
  advanced_features: string[],
  technique_tips: string[],
  equipment_recommendations: {
    board_type, board_size, wetsuit
  },
  local_secrets: string[],
  description: string
}

crowd_notes: {
  crowd_patterns: {
    weekday, weekend, peak_hours, off_hours
  },
  best_times_to_avoid_crowds: string[],
  local_etiquette: string[],
  alternative_spots: string[],
  description: string
}"""


# --------------------------------------------------------------------- #
# Editorial columns (imported at function level to avoid circular import)
# --------------------------------------------------------------------- #


def _get_editorial_columns() -> list[str]:
    """Lazy import to avoid circular dependency at module load."""
    from quiver_content.db.beaches import EDITORIAL_COLUMNS

    return EDITORIAL_COLUMNS


# --------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------- #


def save_sources(beach_id: str, beach_info: dict, crawl_results: list[dict]) -> Path:
    """Write a human-readable ``sources.md`` with all crawled content.

    This is the file that gets pasted into Claude Code for content
    generation.  It contains:

    - Beach identity (name, city, state, coordinates)
    - Existing data status (which columns are set vs null)
    - All crawled text organised by source
    - The exact schema to fill (Layer 1 columns + Layer 2 content types)

    Args:
        beach_id: The beach UUID.
        beach_info: Beach dict from ``get_beach_with_gaps()`` -- includes
            name, city, state, lat, lon, gaps info, and editorial columns.
        crawl_results: List of ``CrawlResult.to_dict()`` results.

    Returns:
        Path to the written ``sources.md`` file.
    """
    editorial_columns = _get_editorial_columns()
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    lines: list[str] = []

    # ---- Header --------------------------------------------------- #
    name = beach_info.get("name", "Unknown Beach")
    city = beach_info.get("city", "")
    state = beach_info.get("state", "")
    lat = beach_info.get("lat", "")
    lon = beach_info.get("lon", "")

    lines.append(f"# Beach: {_sanitize_markdown(name)}, {_sanitize_markdown(city)}, {state}")
    lines.append(f"Coordinates: {lat}, {lon}")
    lines.append(f"Beach ID: {beach_id}")
    lines.append(f"Generated: {ts}")
    lines.append("")

    # ---- Existing data status ------------------------------------- #
    lines.append("## Existing Data")
    lines.append("")
    for col in editorial_columns:
        value = beach_info.get(col)
        if value is None:
            status = "null"
        elif isinstance(value, (list, dict)):
            status = f"set ({len(value)} items)" if value else "set (empty)"
        elif isinstance(value, str):
            status = f"set ({len(value)} chars)" if value else "set (empty)"
        else:
            status = f"set ({value})"
        lines.append(f"- {col}: {status}")
    lines.append("")

    # Layer 2 existing content
    editorial_content = beach_info.get("editorial_content", [])
    if editorial_content:
        lines.append("### Layer 2 Editorial Content (existing)")
        for ec in editorial_content:
            ct = ec.get("content_type", "?")
            gen = ec.get("generated_at", "?")
            lines.append(f"- {ct} (generated: {gen})")
        lines.append("")
    else:
        lines.append("### Layer 2 Editorial Content (existing)")
        lines.append("- None")
        lines.append("")

    # ---- Crawled sources ------------------------------------------ #
    if crawl_results:
        for cr in crawl_results:
            source_name = cr.get("source", "unknown")
            url = cr.get("url", "")
            raw_text = cr.get("raw_text", "")
            error = cr.get("error")
            metadata = cr.get("metadata", {})

            lines.append(f"## Source: {source_name}")
            lines.append(f"URL: {url}")
            lines.append("")

            if error:
                lines.append(f"**Error:** {error}")
            elif raw_text.strip():
                lines.append(raw_text.strip())
            else:
                lines.append("*(No text extracted)*")

            # Render structured metadata for Wannasurf
            if source_name == "wannasurf" and not error:
                ws_fields = [
                    ("break_type", "Break Type"),
                    ("bottom_type", "Bottom"),
                    ("swell_directions", "Swell Directions"),
                    ("wind_directions", "Wind Directions"),
                    ("tide_position", "Tide Position"),
                    ("tide_movement", "Tide Movement"),
                    ("skill_level", "Skill Level"),
                    ("crowd_weekday", "Crowd (Weekday)"),
                    ("crowd_weekend", "Crowd (Weekend)"),
                    ("hazards", "Hazards"),
                    ("wave_quality", "Wave Quality"),
                    ("swell_range_ft", "Swell Range"),
                    ("best_months", "Best Months"),
                ]
                parsed = {k: metadata.get(k) for k, _ in ws_fields if metadata.get(k)}
                if parsed:
                    lines.append("")
                    lines.append("### Parsed Surf Data")
                    lines.append("")
                    for key, label in ws_fields:
                        val = metadata.get(key)
                        if val:
                            lines.append(f"- **{label}:** {val}")

            # Render structured metadata for OSM
            if source_name == "osm" and not error:
                lines.append("")
                lines.append(
                    "> **License:** ODbL - "
                    "Data (c) OpenStreetMap contributors. "
                    "Attribution required when publishing."
                )
                counts = [
                    ("parking_count", "Parking"),
                    ("restroom_count", "Restrooms"),
                    ("shower_count", "Showers"),
                    ("lifeguard_count", "Lifeguard Stations"),
                    ("food_count", "Food/Drink"),
                    ("shop_count", "Surf/Outdoor Shops"),
                ]
                has_counts = any(metadata.get(k, 0) > 0 for k, _ in counts)
                if has_counts:
                    lines.append("")
                    lines.append("### Amenity Counts")
                    lines.append("")
                    for key, label in counts:
                        count = metadata.get(key, 0)
                        if count > 0:
                            lines.append(f"- **{label}:** {count}")

            lines.append("")
            lines.append("---")
            lines.append("")
    else:
        lines.append("## Sources")
        lines.append("")
        lines.append("*(No crawl results available)*")
        lines.append("")
        lines.append("---")
        lines.append("")

    # ---- Schema to fill ------------------------------------------- #
    lines.append("## Schema to Fill")
    lines.append("")
    lines.append("### Layer 1: beaches table columns")
    lines.append("")
    lines.append("```")
    lines.append(_LAYER1_SCHEMA)
    lines.append("```")
    lines.append("")
    lines.append("### Layer 2: beach_editorial_content types")
    lines.append("")
    lines.append("```")
    lines.append(_LAYER2_SCHEMA)
    lines.append("```")
    lines.append("")

    # ---- Write to disk -------------------------------------------- #
    path = _beach_dir(beach_id) / "sources.md"
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


def save_content(beach_id: str, content_type: str, data: dict | list) -> Path:
    """Save generated JSON content to staging.

    Args:
        beach_id: The beach UUID.
        content_type: e.g., ``"beach_columns"``, ``"beginner_notes"``,
            ``"tide_notes"``, etc.
        data: The JSON-serialisable content.

    Returns:
        Path to the written JSON file.
    """
    path = _beach_dir(beach_id) / f"{content_type}.json"
    path.write_text(json.dumps(data, indent=2, default=str), encoding="utf-8")
    return path


def load_content(beach_id: str, content_type: str) -> dict | list | None:
    """Load staged JSON content.  Returns ``None`` if not found."""
    path = STAGING_DIR / beach_id / f"{content_type}.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def list_staged(beach_id: str) -> list[str]:
    """List all staged content types for a beach."""
    d = STAGING_DIR / beach_id
    if not d.exists():
        return []
    return sorted(f.stem for f in d.glob("*.json"))


def save_photo_candidates(beach_id: str, candidates: list[dict]) -> Path:
    """Save ranked photo candidates to staging."""
    photos_dir = _beach_dir(beach_id) / "photos"
    photos_dir.mkdir(exist_ok=True)
    path = photos_dir / "candidates.json"
    path.write_text(json.dumps(candidates, indent=2, default=str), encoding="utf-8")
    return path


def load_photo_candidates(beach_id: str) -> list[dict] | None:
    """Load staged photo candidates."""
    path = STAGING_DIR / beach_id / "photos" / "candidates.json"
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))
