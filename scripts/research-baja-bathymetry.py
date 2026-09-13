#!/usr/bin/env python3

import argparse
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy.io import netcdf_file


GMRT_SOURCE_URL = (
    "https://www.gmrt.org/services/GridServer?"
    "north=32.65&south=22.65&west=-117.5&east=-109.1&"
    "layer=topo&format=netcdf&mresolution=500"
)
ETOPO_SOURCE_URL = (
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/"
    "ETOPO_2022_v1_15s.nc?z%5B(22.65):1:(32.65)%5D"
    "%5B(-117.5):1:(-109.1)%5D"
)
GMRT_DOCUMENTATION_URL = "https://www.gmrt.org/services/gridserverinfo.php"
ETOPO_DOCUMENTATION_URL = (
    "https://coastwatch.pfeg.noaa.gov/erddap/griddap/"
    "ETOPO_2022_v1_15s.html"
)
GEBCO_DOCUMENTATION_URL = (
    "https://www.gebco.net/data-products/gridded-bathymetry-data"
)
VICINITY_PIN_IDS = {
    "bcn-rancho-santini",
    "bcn-san-antonio-del-mar-colonet-area",
    "bcn-puerto-san-andres",
    "bcn-playa-elefante-isla-cedros",
    "bcs-open-doors-isla-natividad",
    "bcs-rancho-san-carlos",
}
WINDOW_OVERRIDES = {
    "bcs-punta-arenas": {
        "min_deg": 157.5,
        "max_deg": 180,
        "status": "south_wrap_window_narrowed_for_bathymetric_exposure",
        "exception_type": "documented_swell_refraction",
        "note": (
            "Two independent guides identify south swell and SurfTrips also describes "
            "the required wrap into the Gulf. The original S-to-SSW half-window crossed "
            "the East Cape landmass, so it is narrowed to SSE-through-S. Bathymetry "
            "supports the open southeast approach; the south endpoint remains a "
            "published wrap direction rather than a direct unobstructed ray."
        ),
        "evidence_urls": [
            "https://www.surf-forecast.com/breaks/Punta-Arenas",
            "https://deepswell.com/surf-guide/Mexico/Southern-Baja/Punta-Arenas/1521",
            "https://surftrips.co/mexico/baja-california-sur/punta-arenas",
        ],
    }
}


def validate_window_override(spot_id: str, override: dict[str, object]) -> None:
    if override.get("exception_type") != "documented_swell_refraction":
        raise ValueError(f"{spot_id} override lacks an approved refraction exception type")
    if len(override.get("evidence_urls", [])) < 2:
        raise ValueError(f"{spot_id} override requires at least two spot-specific sources")
    if not str(override.get("note", "")).strip():
        raise ValueError(f"{spot_id} override requires a documented terrain rationale")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Audit Baja swell windows against two public bathymetry grids."
    )
    parser.add_argument("--dataset", required=True, type=Path)
    parser.add_argument("--land-audit", required=True, type=Path)
    parser.add_argument("--gmrt-grid", required=True, type=Path)
    parser.add_argument("--etopo-grid", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument(
        "--scope",
        choices=["remaining-low", "all-rankable"],
        default="remaining-low",
    )
    return parser.parse_args()


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


class GmrtGrid:
    def __init__(self, path: Path) -> None:
        with netcdf_file(path, "r", mmap=False) as dataset:
            self.x_range = np.array(dataset.variables["x_range"][:], dtype=float)
            self.y_range = np.array(dataset.variables["y_range"][:], dtype=float)
            self.spacing = np.array(dataset.variables["spacing"][:], dtype=float)
            self.dimension = np.array(dataset.variables["dimension"][:], dtype=int)
            self.z = np.array(dataset.variables["z"][:], dtype=float).reshape(
                (self.dimension[1], self.dimension[0])
            )

    def sample(self, latitude: float, longitude: float) -> float:
        x_index = round((longitude - self.x_range[0]) / self.spacing[0])
        y_index = round((self.y_range[1] - latitude) / self.spacing[1])
        if not (0 <= x_index < self.dimension[0]):
            return math.nan
        if not (0 <= y_index < self.dimension[1]):
            return math.nan
        return float(self.z[y_index, x_index])


class EtopoGrid:
    def __init__(self, path: Path) -> None:
        with netcdf_file(path, "r", mmap=False) as dataset:
            self.latitudes = np.array(dataset.variables["latitude"][:], dtype=float)
            self.longitudes = np.array(dataset.variables["longitude"][:], dtype=float)
            self.z = np.array(dataset.variables["z"][:], dtype=float)

    def sample(self, latitude: float, longitude: float) -> float:
        y_index = int(np.searchsorted(self.latitudes, latitude))
        x_index = int(np.searchsorted(self.longitudes, longitude))
        y_index = min(max(y_index, 0), len(self.latitudes) - 1)
        x_index = min(max(x_index, 0), len(self.longitudes) - 1)
        return float(self.z[y_index, x_index])


def destination(
    latitude: float, longitude: float, bearing_deg: float, distance_km: float
) -> tuple[float, float]:
    radius_km = 6371.0088
    bearing = math.radians(bearing_deg)
    latitude_1 = math.radians(latitude)
    longitude_1 = math.radians(longitude)
    angular_distance = distance_km / radius_km
    latitude_2 = math.asin(
        math.sin(latitude_1) * math.cos(angular_distance)
        + math.cos(latitude_1)
        * math.sin(angular_distance)
        * math.cos(bearing)
    )
    longitude_2 = longitude_1 + math.atan2(
        math.sin(bearing) * math.sin(angular_distance) * math.cos(latitude_1),
        math.cos(angular_distance)
        - math.sin(latitude_1) * math.sin(latitude_2),
    )
    return math.degrees(latitude_2), math.degrees(longitude_2)


def circular_span(min_deg: float, max_deg: float) -> float:
    return (max_deg - min_deg) % 360


def sample_bearings(min_deg: float, max_deg: float) -> list[float]:
    span = circular_span(min_deg, max_deg)
    return [round((min_deg + span * fraction) % 360, 4) for fraction in np.linspace(0, 1, 5)]


def ocean_fraction(
    grid: GmrtGrid | EtopoGrid,
    latitude: float,
    longitude: float,
    bearing_deg: float,
    start_km: int = 4,
    end_km: int = 60,
) -> float:
    samples = [
        grid.sample(*destination(latitude, longitude, bearing_deg, distance_km))
        for distance_km in range(start_km, end_km + 1)
    ]
    finite = [value for value in samples if math.isfinite(value)]
    if not finite:
        return 0
    return sum(value < 0 for value in finite) / len(finite)


def snap_to_ocean(
    grid: GmrtGrid,
    latitude: float,
    longitude: float,
    center_bearing_deg: float,
) -> dict[str, float]:
    candidates: list[tuple[float, float, float, float, float]] = []
    for distance_km in np.arange(0, 6.01, 0.25):
        bearings = [0] if distance_km == 0 else range(0, 360, 5)
        for bearing_deg in bearings:
            candidate_lat, candidate_lon = destination(
                latitude, longitude, bearing_deg, float(distance_km)
            )
            depth_m = grid.sample(candidate_lat, candidate_lon)
            if not math.isfinite(depth_m) or depth_m >= -1:
                continue
            support = ocean_fraction(
                grid,
                candidate_lat,
                candidate_lon,
                center_bearing_deg,
                start_km=1,
                end_km=12,
            )
            candidates.append(
                (float(distance_km), -support, candidate_lat, candidate_lon, depth_m)
            )
        supported = [candidate for candidate in candidates if candidate[1] <= -0.75]
        if supported:
            distance, _, candidate_lat, candidate_lon, depth_m = min(supported)
            return {
                "latitude": round(candidate_lat, 6),
                "longitude": round(candidate_lon, 6),
                "distance_from_analysis_pin_km": round(distance, 2),
                "gmrt_depth_m": round(depth_m, 1),
            }
    if not candidates:
        raise ValueError(f"No ocean cell within 6 km of {latitude}, {longitude}")
    distance, _, candidate_lat, candidate_lon, depth_m = min(candidates)
    return {
        "latitude": round(candidate_lat, 6),
        "longitude": round(candidate_lon, 6),
        "distance_from_analysis_pin_km": round(distance, 2),
        "gmrt_depth_m": round(depth_m, 1),
    }


def directional_profile(
    grid: GmrtGrid | EtopoGrid,
    latitude: float,
    longitude: float,
    bearing_deg: float,
) -> dict[str, object]:
    depths: dict[str, float | None] = {}
    for distance_km in [5, 10, 20, 40, 60]:
        value = grid.sample(
            *destination(latitude, longitude, bearing_deg, distance_km)
        )
        depths[str(distance_km)] = round(value, 1) if math.isfinite(value) else None
    return {
        "bearing_deg": bearing_deg,
        "ocean_fraction_4_to_60_km": round(
            ocean_fraction(grid, latitude, longitude, bearing_deg), 3
        ),
        "depth_m_by_distance_km": depths,
    }


def analysis_coordinate(spot: dict[str, object]) -> tuple[dict[str, float], str]:
    spot_id = str(spot["source_spot_id"])
    browser_validation = (spot.get("surfline_reference") or {}).get(
        "browser_coordinate_validation"
    ) or {}
    surfline_coordinate = browser_validation.get("surfline_coordinate")
    if spot_id in VICINITY_PIN_IDS and surfline_coordinate:
        return (
            {
                "latitude": float(surfline_coordinate["latitude"]),
                "longitude": float(surfline_coordinate["longitude"]),
            },
            "surfline_browser_validated_vicinity_coordinate",
        )
    return (
        {"latitude": float(spot["lat"]), "longitude": float(spot["lon"])},
        "production_catalog_coordinate",
    )


def audited_ids(land_audit: dict[str, object]) -> list[str]:
    cross_reference = land_audit["low_confidence_cross_reference"]
    return [
        *cross_reference["geometry_consistent_but_still_low_confidence_ids"],
        *cross_reference["geometry_indeterminate_due_to_vicinity_pin_ids"],
    ]


def build_review(
    spot: dict[str, object], gmrt: GmrtGrid, etopo: EtopoGrid
) -> dict[str, object]:
    spot_id = str(spot["source_spot_id"])
    existing_review = spot.get("swell_bathymetry_review") or {}
    prior = existing_review.get("published_prior") or spot["swell_window_evidence"]
    prior_source_url = prior.get("source_url") or prior.get("evidence_url")
    if not prior_source_url:
        raise ValueError(f"{spot_id} lacks a published swell-direction source URL")
    override = WINDOW_OVERRIDES.get(spot_id)
    if override:
        validate_window_override(spot_id, override)
    selected_window = {
        "min_deg": override["min_deg"] if override else prior["min_deg"],
        "max_deg": override["max_deg"] if override else prior["max_deg"],
    }
    analysis_pin, coordinate_basis = analysis_coordinate(spot)
    span = circular_span(selected_window["min_deg"], selected_window["max_deg"])
    center_bearing = (selected_window["min_deg"] + span / 2) % 360
    snapped = snap_to_ocean(
        gmrt,
        analysis_pin["latitude"],
        analysis_pin["longitude"],
        center_bearing,
    )
    bearings = sample_bearings(
        selected_window["min_deg"], selected_window["max_deg"]
    )
    gmrt_profiles = [
        directional_profile(
            gmrt, snapped["latitude"], snapped["longitude"], bearing
        )
        for bearing in bearings
    ]
    etopo_profiles = [
        directional_profile(
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
    bathymetrically_supported = min(gmrt_supported, etopo_supported) >= 3
    evidence_urls = [
        prior_source_url,
        GMRT_DOCUMENTATION_URL,
        ETOPO_DOCUMENTATION_URL,
    ]
    if override:
        evidence_urls = [
            *override["evidence_urls"],
            GMRT_DOCUMENTATION_URL,
            ETOPO_DOCUMENTATION_URL,
        ]
    return {
        "status": override["status"] if override else (
            "published_prior_bathymetrically_plausible"
            if bathymetrically_supported
            else "published_prior_bathymetry_conflict_source_resolution_required"
        ),
        "window": selected_window,
        "confidence": (
            "medium"
            if bathymetrically_supported or override
            else "unresolved"
        ),
        "published_prior": {
            "min_deg": prior["min_deg"],
            "max_deg": prior["max_deg"],
            "source_url": prior_source_url,
        },
        "analysis_coordinate": analysis_pin,
        "coordinate_basis": coordinate_basis,
        "analysis_ocean_cell": snapped,
        "sampled_bearings_deg": bearings,
        "gmrt_profiles": gmrt_profiles,
        "etopo_profiles": etopo_profiles,
        "model_agreement": {
            "gmrt_supported_bearings_of_5": gmrt_supported,
            "etopo_supported_bearings_of_5": etopo_supported,
            "passes_exposure_threshold": bathymetrically_supported,
        },
        "note": override["note"] if override else (
            "The published ideal-direction prior agrees with open-water access and "
            "offshore depth continuity in both gridded terrain models. This validates "
            "a medium-confidence editorial ranking window; it does not resolve the "
            "individual reef ledge, takeoff, tide response, or live surf quality."
        ),
        "evidence_urls": evidence_urls,
    }


def main() -> None:
    args = parse_args()
    dataset = json.loads(args.dataset.read_text())
    land_audit = json.loads(args.land_audit.read_text())
    spots_by_id = {spot["source_spot_id"]: spot for spot in dataset["spots"]}
    target_ids = (
        audited_ids(land_audit)
        if args.scope == "remaining-low"
        else [
            spot["source_spot_id"]
            for spot in dataset["spots"]
            if spot.get("import_eligible")
        ]
    )
    missing = sorted(set(target_ids) - set(spots_by_id))
    if missing:
        raise ValueError(f"Missing target spots: {', '.join(missing)}")

    gmrt = GmrtGrid(args.gmrt_grid)
    etopo = EtopoGrid(args.etopo_grid)
    reviews = {
        spot_id: build_review(spots_by_id[spot_id], gmrt, etopo)
        for spot_id in target_ids
    }
    direct_grid_passes = sum(
        review["model_agreement"]["passes_exposure_threshold"]
        for review in reviews.values()
    )
    documented_wrap_exceptions = sum(
        spot_id in WINDOW_OVERRIDES
        and not review["model_agreement"]["passes_exposure_threshold"]
        for spot_id, review in reviews.items()
    )
    supported_count = direct_grid_passes + documented_wrap_exceptions
    output = {
        "schema_version": "1.0.0",
        "dataset_id": "baja-swell-window-bathymetry-audit-2026-08-28",
        "reviewed_on": "2026-08-28",
        "scope": {
            "reviewed_spot_count": len(reviews),
            "scope": args.scope,
            "reason": (
                "Apply reproducible source-plus-bathymetry review to the selected "
                "Baja production scope without relying on session calibration."
            ),
        },
        "methodology": {
            "direction_convention": (
                "Meteorological swell direction: the bearing indicates where swell "
                "travels from; rays are traced outward from the break toward that bearing."
            ),
            "grid_use": (
                "GMRT 500 m and NOAA ETOPO 2022 15 arc-second grids are sampled from "
                "4 to 60 km offshore across five bearings spanning each window."
            ),
            "decision_policy": (
                "A source-reported direction becomes medium confidence when at least "
                "three of five bearings retain at least 85% ocean coverage in both grids. "
                "A fail-closed exception requires an allowlisted refraction override, at least "
                "two spot-specific published sources, and a documented terrain rationale. High "
                "confidence still requires independent spot-specific published corroboration."
            ),
            "nearshore_limit": (
                "These global/regional grids validate exposure, land shadow, and broad "
                "shelf or canyon continuity. They cannot resolve an individual reef ledge, "
                "sandbar, takeoff, tide response, or current conditions."
            ),
            "gmrt_fill_limit": (
                "The unmasked GMRT topo layer uses a global bathymetry fill where "
                "higher-resolution contributed data are unavailable; ETOPO is therefore "
                "used as an independent terrain-model cross-check, not as a field sounding."
            ),
            "gebco_context": (
                "GEBCO_2026 is the current public-domain 15 arc-second global terrain "
                "model and provides a TID source-type grid. It is cited as the current "
                "global reference but was not substituted for the two computed grids."
            ),
        },
        "sources": [
            {
                "provider": "GMRT GridServer",
                "request_url": GMRT_SOURCE_URL,
                "documentation_url": GMRT_DOCUMENTATION_URL,
                "local_sha256": sha256(args.gmrt_grid),
                "requested_resolution_m": 500,
                "grid_dimensions": {
                    "longitude": int(gmrt.dimension[0]),
                    "latitude": int(gmrt.dimension[1]),
                },
                "longitude_range": gmrt.x_range.tolist(),
                "latitude_range": gmrt.y_range.tolist(),
                "actual_spacing_deg": gmrt.spacing.tolist(),
            },
            {
                "provider": "NOAA NCEI ETOPO 2022 via ERDDAP",
                "request_url": ETOPO_SOURCE_URL,
                "documentation_url": ETOPO_DOCUMENTATION_URL,
                "local_sha256": sha256(args.etopo_grid),
                "resolution_arc_seconds": 15,
                "grid_dimensions": {
                    "longitude": len(etopo.longitudes),
                    "latitude": len(etopo.latitudes),
                },
                "longitude_range": [
                    float(etopo.longitudes[0]),
                    float(etopo.longitudes[-1]),
                ],
                "latitude_range": [
                    float(etopo.latitudes[0]),
                    float(etopo.latitudes[-1]),
                ],
            },
            {
                "provider": "GEBCO_2026 documentation",
                "documentation_url": GEBCO_DOCUMENTATION_URL,
                "computed_in_this_audit": False,
            },
        ],
        "summary": {
            "direct_grid_passes": direct_grid_passes,
            "documented_wrap_exceptions": documented_wrap_exceptions,
            "medium_confidence": supported_count,
            "high_confidence": 0,
            "remaining_low_confidence": 0,
            "source_resolution_required": len(reviews) - supported_count,
            "windows_retained": len(reviews) - len(WINDOW_OVERRIDES),
            "windows_narrowed": len(WINDOW_OVERRIDES),
        },
        "reviews": reviews,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(reviews)} reviews to {args.output}")


if __name__ == "__main__":
    main()
