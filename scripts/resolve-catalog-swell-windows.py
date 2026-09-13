#!/usr/bin/env python3

import argparse
import importlib.util
import json
from pathlib import Path


def load_module(filename: str, name: str):
    module_path = Path(__file__).with_name(filename)
    spec = importlib.util.spec_from_file_location(name, module_path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


SURFSPOTS = load_module("fetch-catalog-surfspots-evidence.py", "surfspots_evidence")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve catalog swell-window conflicts from source and bathymetry evidence.")
    parser.add_argument("--audit", required=True, type=Path)
    parser.add_argument("--surf-forecast", required=True, type=Path)
    parser.add_argument("--surfspots", required=True, type=Path)
    parser.add_argument("--manual", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def direction_in_window(direction: float, window: dict[str, float], tolerance: float = 11.25) -> bool:
    direction %= 360
    span = window_span(window)
    if span + tolerance * 2 >= 360:
        return True
    delta = (direction - window["min_deg"]) % 360
    return delta <= span + tolerance or delta >= 360 - tolerance


def window_span(window: dict[str, float]) -> float:
    return (window["max_deg"] - window["min_deg"]) % 360


def has_identity_conflict(evidence: dict[str, object] | None) -> bool:
    return bool(evidence and "conflict" in str(evidence.get("source_scope", "")))


def source_evidence(
    beach_id: str,
    review: dict[str, object],
    surf_forecast: dict[str, object],
    surfspots: dict[str, object],
    manual: dict[str, object],
) -> dict[str, object] | None:
    manual_result = manual.get(beach_id)
    if manual_result:
        return {"provider": "manual_targeted_research", **manual_result}
    secondary = surfspots.get(beach_id, {})
    if SURFSPOTS.secondary_match_is_trusted(review, secondary):
        return {
            "provider": "SurfSpots.co",
            "directions_deg": secondary["ideal_direction_deg"],
            "source_scope": "spot_coordinate_name_match",
            "source_urls": [secondary["source_url"]],
        }
    primary = surf_forecast.get(beach_id, {})
    if SURFSPOTS.primary_match_is_trusted(review, primary):
        return {
            "provider": "Surf-Forecast",
            "directions_deg": [primary["ideal_direction_deg"]],
            "source_scope": "spot_coordinate_name_match",
            "source_urls": [primary["source_url"]],
        }
    return None


def choose_window(review: dict[str, object], evidence: dict[str, object] | None) -> tuple[str, dict[str, float], dict[str, int]]:
    v1_window = review["v1"]["window"]
    v2_window = review["v2"]["window"] if review["v2"] else None
    status = review["decision"]["status"]
    directions = evidence.get("directions_deg", []) if evidence else []
    hits = {
        "v1": sum(direction_in_window(value, v1_window) for value in directions),
        "v2": sum(direction_in_window(value, v2_window) for value in directions) if v2_window else 0,
    }
    override = evidence.get("selected_window_override") if evidence else None
    if override:
        hits["override"] = sum(direction_in_window(value, override) for value in directions)
        return "source_terrain_override", override, hits
    if not v2_window:
        return "v1", v1_window, hits
    if status == "v2_supported_v1_rejected":
        return "v2", v2_window, hits
    if status in {"v1_supported_v2_rejected", "v1_bathymetrically_plausible"}:
        return "v1", v1_window, hits
    if hits["v2"] > hits["v1"]:
        return "v2", v2_window, hits
    if hits["v1"] > hits["v2"]:
        return "v1", v1_window, hits
    if window_span(v2_window) <= window_span(v1_window):
        return "v2", v2_window, hits
    return "v1", v1_window, hits


def main() -> None:
    args = parse_args()
    audit = json.loads(args.audit.read_text())
    surf_forecast = json.loads(args.surf_forecast.read_text())["results"]
    surfspots = json.loads(args.surfspots.read_text())["results"]
    manual = json.loads(args.manual.read_text())["results"]
    resolutions = {}
    for beach_id, review in audit["reviews"].items():
        evidence = source_evidence(beach_id, review, surf_forecast, surfspots, manual)
        if review["decision"]["source_research_required"] and not evidence:
            raise ValueError(f"Missing source evidence for {review['name']} ({beach_id})")
        version, selected_window, hits = choose_window(review, evidence)
        recommended_disposition = evidence.get("recommended_disposition") if evidence else None
        if recommended_disposition:
            version = None
            selected_window = None
        selected_source_hits = sum(
            direction_in_window(value, selected_window)
            for value in (evidence.get("directions_deg", []) if evidence else [])
        ) if selected_window else None
        source_contradiction = bool(
            review["decision"]["source_research_required"]
            and evidence
            and selected_window
            and selected_source_hits == 0
        )
        identity_conflict = has_identity_conflict(evidence)
        production_action = recommended_disposition or "update_swell_window"
        is_window_update = production_action == "update_swell_window"
        resolutions[beach_id] = {
            "name": review["name"],
            "audit_reasons": review["audit_reasons"],
            "bathymetry_status": review["decision"]["status"],
            "source_evidence": evidence,
            "source_direction_hits": hits,
            "selected_source_direction_hits": selected_source_hits,
            "source_contradiction": source_contradiction,
            "selected_version": version,
            "selected_window": selected_window,
            "confidence": "medium" if is_window_update else "not_applicable",
            "identity_or_coordinate_conflict": identity_conflict,
            "production_action": production_action,
            "production_update_allowed": is_window_update and not identity_conflict and not source_contradiction,
            "disposition_allowed": bool(recommended_disposition and identity_conflict),
            "release_precondition": (
                "Apply the documented identity disposition only after fresh production reconciliation."
                if recommended_disposition
                else "Resolve the source-direction contradiction before generating SQL."
                if source_contradiction
                else "Resolve identity/coordinate conflict and rerun both terrain models."
                if identity_conflict
                else "Reconcile against a fresh read-only production extract before generating SQL."
            ),
        }
    summary = {
        "reviewed": len(resolutions),
        "source_required": sum(review["decision"]["source_research_required"] for review in audit["reviews"].values()),
        "source_resolved": sum(bool(value["source_evidence"]) for value in resolutions.values()),
        "production_update_allowed": sum(value["production_update_allowed"] for value in resolutions.values()),
        "disposition_allowed": sum(value["disposition_allowed"] for value in resolutions.values()),
        "identity_or_coordinate_conflicts": sum(value["identity_or_coordinate_conflict"] for value in resolutions.values()),
        "selected_v1": sum(value["selected_version"] == "v1" for value in resolutions.values()),
        "selected_v2": sum(value["selected_version"] == "v2" for value in resolutions.values()),
        "selected_source_terrain_override": sum(value["selected_version"] == "source_terrain_override" for value in resolutions.values()),
        "source_contradictions": sum(value["source_contradiction"] for value in resolutions.values()),
        "soft_delete_duplicate": sum(value["production_action"] == "soft_delete_duplicate" for value in resolutions.values()),
        "exclude_non_surf_identity": sum(value["production_action"] == "exclude_non_surf_identity" for value in resolutions.values()),
    }
    output = {
        "schema_version": "1.0.0",
        "dataset_id": "catalog-source-bathymetry-resolution-2026-08-28",
        "reviewed_on": "2026-08-28",
        "source_catalog": audit["source_catalog"],
        "methodology": {
            "bathymetry": "GMRT 500 m and NOAA ETOPO 2022 15 arc-second dual-grid screen.",
            "source_resolution": "Coordinate-and-name matched spot guides, followed by targeted documented research for unresolved aliases and complex spots.",
            "selection": "A bathymetrically rejected window is not selected. Where both pass, the window matching more normalized source directions wins; ties prefer the narrower window. A documented source-plus-terrain override is allowed for refracting or wrapping breaks that straight offshore rays cannot represent. Any selected window with zero source-direction hits fails closed.",
            "release_safety": "This artifact is a candidate resolution from the committed catalog snapshot, not authorization to mutate production. Fresh read-only production reconciliation remains mandatory.",
        },
        "summary": summary,
        "resolutions": resolutions,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
