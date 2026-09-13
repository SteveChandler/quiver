#!/usr/bin/env python3

import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BAJA_MODULE_PATH = REPO_ROOT / "scripts" / "research-baja-bathymetry.py"
COMPLEX_BREAK_TYPES = {
    "breakwater",
    "inlet",
    "jetty",
    "jetty/beach",
    "point",
    "reef",
    "reef/point",
    "river-mouth",
    "rivermouth",
}
REGIONS = {
    "baja": {"south": 22.65, "north": 32.65, "west": -117.5, "east": -109.1},
    "pacific": {"south": 31.8, "north": 48.7, "west": -125.5, "east": -116.3},
    "hawaii": {"south": 18.8, "north": 22.9, "west": -160.2, "east": -155.0},
    "puerto-rico": {"south": 17.2, "north": 19.2, "west": -68.1, "east": -64.9},
    "northeast": {"south": 39.0, "north": 44.4, "west": -75.5, "east": -69.1},
    "southeast": {"south": 27.3, "north": 36.8, "west": -82.0, "east": -74.5},
    "gulf": {"south": 26.5, "north": 30.3, "west": -98.2, "east": -93.7},
}


def load_bathymetry_module():
    spec = importlib.util.spec_from_file_location("baja_bathymetry", BAJA_MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit catalog swell-window candidates against GMRT and ETOPO."
    )
    parser.add_argument("--catalog", required=True, type=Path)
    parser.add_argument("--grid-root", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def split_sql_values(value_list: str) -> list[str]:
    values: list[str] = []
    start = 0
    depth = 0
    quoted = False
    index = 0
    while index < len(value_list):
        char = value_list[index]
        if quoted:
            if char == "'" and index + 1 < len(value_list) and value_list[index + 1] == "'":
                index += 2
                continue
            if char == "'":
                quoted = False
        else:
            if char == "'":
                quoted = True
            elif char in "([{":
                depth += 1
            elif char in ")]}":
                depth -= 1
            elif char == "," and depth == 0:
                values.append(value_list[start:index].strip())
                start = index + 1
        index += 1
    values.append(value_list[start:].strip())
    return values


def sql_scalar(value: str):
    value = value.strip()
    if value == "NULL":
        return None
    if value.startswith("'"):
        output: list[str] = []
        index = 1
        while index < len(value):
            if value[index] == "'":
                if index + 1 < len(value) and value[index + 1] == "'":
                    output.append("'")
                    index += 2
                    continue
                break
            output.append(value[index])
            index += 1
        return "".join(output)
    if value in {"true", "false"}:
        return value == "true"
    try:
        return float(value) if "." in value else int(value)
    except ValueError:
        return value


def load_catalog(path: Path) -> list[dict[str, object]]:
    rows: list[dict[str, object]] = []
    prefix = "INSERT INTO public.beaches "
    for line in path.read_text().splitlines():
        if not line.startswith(prefix):
            continue
        columns_start = line.index("(")
        columns_end = line.index(") VALUES ")
        columns = [
            column.strip().strip('"')
            for column in line[columns_start + 1 : columns_end].split(",")
        ]
        values_start = columns_end + len(") VALUES (")
        values_end = line.rfind(") ON CONFLICT")
        values = split_sql_values(line[values_start:values_end])
        if len(columns) != len(values):
            raise ValueError(
                f"Catalog row has {len(columns)} columns and {len(values)} values"
            )
        row = {column: sql_scalar(value) for column, value in zip(columns, values)}
        for json_field in ["preference_model", "editorial_sources"]:
            raw = row.get(json_field)
            if not isinstance(raw, str):
                continue
            try:
                row[json_field] = json.loads(raw)
            except json.JSONDecodeError:
                row[json_field] = None
        rows.append(row)
    return rows


def circular_distance(left: float, right: float) -> float:
    return min((left - right) % 360, (right - left) % 360)


def is_material_divergence(
    v1_min: float | None,
    v1_max: float | None,
    v2_min: float | None,
    v2_max: float | None,
) -> bool:
    if None in {v1_min, v1_max, v2_min, v2_max}:
        return False
    v1_span = (v1_max - v1_min) % 360
    v2_span = (v2_max - v2_min) % 360
    endpoint_shift = max(
        circular_distance(v1_min, v2_min), circular_distance(v1_max, v2_max)
    )
    return endpoint_shift >= 90 or abs(v1_span - v2_span) >= 120


def derive_catalog_targets(rows: list[dict[str, object]]) -> list[dict[str, object]]:
    targets: list[dict[str, object]] = []
    for source_row in rows:
        reasons: list[str] = []
        if source_row.get("swell_window_v2_method") is None:
            reasons.append("missing_v2")
        if is_material_divergence(
            source_row.get("swell_window_min_deg"),
            source_row.get("swell_window_max_deg"),
            source_row.get("swell_window_min_deg_v2"),
            source_row.get("swell_window_max_deg_v2"),
        ):
            reasons.append("material_v1_v2_divergence")
        if not reasons:
            continue
        row = dict(source_row)
        row["audit_reasons"] = reasons
        targets.append(row)
    return targets


def catalog_region(row: dict[str, object]) -> str:
    if row.get("country") == "Mexico" or row.get("state") == "Baja California":
        return "baja"
    state = row.get("state")
    if state in {"CA", "OR", "WA"}:
        return "pacific"
    if state == "HI":
        return "hawaii"
    if state == "PR":
        return "puerto-rico"
    if state == "TX":
        return "gulf"
    if state in {"FL", "GA", "NC", "SC"}:
        return "southeast"
    if state in {"MA", "ME", "NH", "NJ", "NY", "RI"}:
        return "northeast"
    raise ValueError(f"No bathymetry region for {row.get('name')} ({state})")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def request_urls(region: str) -> dict[str, str]:
    bounds = REGIONS[region]
    gmrt = (
        "https://www.gmrt.org/services/GridServer?"
        f"north={bounds['north']}&south={bounds['south']}&"
        f"west={bounds['west']}&east={bounds['east']}&"
        "layer=topo&format=netcdf&mresolution=500"
    )
    etopo = (
        "https://coastwatch.pfeg.noaa.gov/erddap/griddap/"
        "ETOPO_2022_v1_15s.nc?"
        f"z%5B({bounds['south']}):1:({bounds['north']})%5D"
        f"%5B({bounds['west']}):1:({bounds['east']})%5D"
    )
    return {"gmrt": gmrt, "etopo": etopo}


def grid_paths(grid_root: Path, region: str) -> tuple[Path, Path]:
    return (
        grid_root / f"gmrt-{region}.nc",
        grid_root / f"etopo-{region}.nc",
    )


def window_center(min_deg: float, max_deg: float) -> float:
    return (min_deg + ((max_deg - min_deg) % 360) / 2) % 360


def evaluate_window(
    bathymetry,
    gmrt,
    etopo,
    latitude: float,
    longitude: float,
    min_deg: float,
    max_deg: float,
) -> dict[str, object]:
    center = window_center(min_deg, max_deg)
    snapped = bathymetry.snap_to_ocean(gmrt, latitude, longitude, center)
    bearings = bathymetry.sample_bearings(min_deg, max_deg)
    gmrt_profiles = [
        bathymetry.directional_profile(
            gmrt, snapped["latitude"], snapped["longitude"], bearing
        )
        for bearing in bearings
    ]
    etopo_profiles = [
        bathymetry.directional_profile(
            etopo, snapped["latitude"], snapped["longitude"], bearing
        )
        for bearing in bearings
    ]
    gmrt_supported = sum(
        profile["ocean_fraction_4_to_60_km"] >= 0.85
        for profile in gmrt_profiles
    )
    etopo_supported = sum(
        profile["ocean_fraction_4_to_60_km"] >= 0.85
        for profile in etopo_profiles
    )
    mean_ocean_fraction = round(
        sum(
            profile["ocean_fraction_4_to_60_km"]
            for profile in [*gmrt_profiles, *etopo_profiles]
        )
        / 10,
        3,
    )
    return {
        "window": {"min_deg": min_deg, "max_deg": max_deg},
        "center_deg": round(center, 4),
        "analysis_ocean_cell": snapped,
        "sampled_bearings_deg": bearings,
        "gmrt_profiles": gmrt_profiles,
        "etopo_profiles": etopo_profiles,
        "model_agreement": {
            "gmrt_supported_bearings_of_5": gmrt_supported,
            "etopo_supported_bearings_of_5": etopo_supported,
            "mean_ocean_fraction": mean_ocean_fraction,
            "passes_exposure_threshold": min(gmrt_supported, etopo_supported) >= 3,
        },
    }


def decision_for(
    row: dict[str, object],
    v1: dict[str, object],
    v2: dict[str, object] | None,
) -> dict[str, object]:
    v1_passes = v1["model_agreement"]["passes_exposure_threshold"]
    v2_passes = v2 and v2["model_agreement"]["passes_exposure_threshold"]
    source_research_required = True
    if v2 is None:
        status = "v1_bathymetrically_plausible" if v1_passes else "v1_bathymetry_conflict"
        selected = v1["window"] if v1_passes else None
    elif v1_passes and not v2_passes:
        status = "v1_supported_v2_rejected"
        selected = v1["window"]
    elif v2_passes and not v1_passes:
        status = "v2_supported_v1_rejected"
        selected = v2["window"]
    elif v1_passes and v2_passes:
        status = "both_windows_bathymetrically_plausible_source_resolution_required"
        selected = None
    else:
        status = "neither_window_bathymetrically_plausible_source_resolution_required"
        selected = None
    return {
        "status": status,
        "selected_window": selected,
        "confidence": "medium" if selected else "unresolved",
        "source_research_required": source_research_required,
        "production_update_allowed": False,
    }


def source_urls(row: dict[str, object]) -> list[str]:
    sources = row.get("editorial_sources")
    if not isinstance(sources, list):
        return []
    return sorted(
        {
            source.get("url")
            for source in sources
            if isinstance(source, dict) and source.get("url")
        }
    )


def main() -> None:
    args = parse_args()
    bathymetry = load_bathymetry_module()
    catalog = load_catalog(args.catalog)
    targets = derive_catalog_targets(catalog)
    loaded_grids: dict[str, tuple[object, object]] = {}
    grid_sources: dict[str, object] = {}
    reviews: dict[str, object] = {}

    for region in sorted({catalog_region(row) for row in targets}):
        gmrt_path, etopo_path = grid_paths(args.grid_root, region)
        if not gmrt_path.exists() or not etopo_path.exists():
            raise FileNotFoundError(f"Missing grids for {region}")
        loaded_grids[region] = (
            bathymetry.GmrtGrid(gmrt_path),
            bathymetry.EtopoGrid(etopo_path),
        )
        urls = request_urls(region)
        grid_sources[region] = {
            "bounds": REGIONS[region],
            "gmrt": {
                "request_url": urls["gmrt"],
                "sha256": sha256(gmrt_path),
                "resolution_m": 500,
            },
            "etopo": {
                "request_url": urls["etopo"],
                "sha256": sha256(etopo_path),
                "resolution_arc_seconds": 15,
            },
        }

    for row in targets:
        region = catalog_region(row)
        gmrt, etopo = loaded_grids[region]
        latitude = float(row["lat"])
        longitude = float(row["lon"])
        v1 = evaluate_window(
            bathymetry,
            gmrt,
            etopo,
            latitude,
            longitude,
            float(row["swell_window_min_deg"]),
            float(row["swell_window_max_deg"]),
        )
        v2 = None
        if row.get("swell_window_v2_method") is not None:
            v2 = evaluate_window(
                bathymetry,
                gmrt,
                etopo,
                latitude,
                longitude,
                float(row["swell_window_min_deg_v2"]),
                float(row["swell_window_max_deg_v2"]),
            )
        reviews[str(row["id"])] = {
            "name": row["name"],
            "city": row.get("city"),
            "state": row.get("state"),
            "country": row.get("country"),
            "break_type": row.get("break_type"),
            "coordinate": {"latitude": latitude, "longitude": longitude},
            "region": region,
            "audit_reasons": row["audit_reasons"],
            "catalog_editorial_source_urls": source_urls(row),
            "v1": v1,
            "v2": v2,
            "decision": decision_for(row, v1, v2),
        }

    decisions = [review["decision"] for review in reviews.values()]
    output = {
        "schema_version": "1.0.0",
        "dataset_id": "catalog-source-bathymetry-screen-2026-08-28",
        "reviewed_on": "2026-08-28",
        "source_catalog": {
            "path": str(args.catalog),
            "sha256": sha256(args.catalog),
            "row_count": len(catalog),
            "provenance_limit": (
                "Repository production snapshot committed 2026-08-13; confirm target rows "
                "against a fresh read-only production extract before preparing an update migration."
            ),
        },
        "methodology": {
            "target_rule": (
                "Include rows missing swell_window_v2_method and rows whose V1/V2 endpoints "
                "shift by at least 90 degrees or whose circular span changes by at least 120 degrees."
            ),
            "bathymetry_rule": (
                "Sample five bearings per candidate window from 4 to 60 km. A window passes "
                "when at least three bearings retain at least 85% ocean coverage in both GMRT "
                "500 m and NOAA ETOPO 2022 15 arc-second grids."
            ),
            "decision_limit": (
                "Bathymetry establishes directional plausibility, not surf quality. Material "
                "V1/V2 disagreements and complex breaks require independent published source "
                "resolution before production_update_allowed may become true."
            ),
        },
        "grid_sources": grid_sources,
        "summary": {
            "catalog_rows": len(catalog),
            "target_entries": len(reviews),
            "missing_v2": sum(
                "missing_v2" in review["audit_reasons"] for review in reviews.values()
            ),
            "material_v1_v2_divergence": sum(
                "material_v1_v2_divergence" in review["audit_reasons"]
                for review in reviews.values()
            ),
            "bathymetry_selected": sum(
                decision["selected_window"] is not None for decision in decisions
            ),
            "source_research_required": sum(
                decision["source_research_required"] for decision in decisions
            ),
            "production_update_allowed": 0,
        },
        "reviews": reviews,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(reviews)} catalog reviews to {args.output}")


if __name__ == "__main__":
    main()
