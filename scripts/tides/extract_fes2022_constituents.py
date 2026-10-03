"""Extract coastal FES2022 harmonic constants from downloaded NetCDF grids."""

import argparse
import json
import lzma
import math
import shutil
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import netCDF4
import numpy as np


def pick_variable(dataset, role):
    variables = dataset.variables
    exact = {
        "lat": {"lat", "latitude"},
        "lon": {"lon", "longitude"},
        "amplitude": {"amplitude", "amp", "ha"},
        "phase": {"phase", "pha", "phase_lag", "lag"},
    }[role]
    candidates = []
    for name, variable in variables.items():
        label = name.lower()
        standard = str(getattr(variable, "standard_name", "")).lower()
        units = str(getattr(variable, "units", "")).lower()
        if role in ("lat", "lon"):
            match = label in exact or standard == ("latitude" if role == "lat" else "longitude")
        elif role == "amplitude":
            match = label in exact or "amplitude" in label or "amplitude" in standard
        else:
            match = label in exact or "phase" in label or "phase" in standard
        if match:
            candidates.append(variable)
    if role in ("amplitude", "phase"):
        unit_set = ({"m", "meter", "meters", "metre", "metres", "cm", "centimeter", "centimeters",
                     "centimetre", "centimetres", "mm", "millimeter", "millimeters", "millimetre", "millimetres"}
                    if role == "amplitude" else {"degree", "degrees", "degrees_east", "deg", "radian", "radians", "rad"})
        by_units = [var for var in (candidates or variables.values())
                    if len(var.dimensions) == 2 and str(getattr(var, "units", "")).strip().lower() in unit_set]
        if len(by_units) == 1 or not candidates:
            candidates = by_units
    if len(candidates) != 1:
        available = ", ".join(f"{name} ({getattr(var, 'units', 'no units')})" for name, var in variables.items())
        raise ValueError(f"Cannot uniquely detect {role} variable; candidates={[v.name for v in candidates]}; available: {available}")
    return candidates[0]


def amplitude_factor(variable):
    units = str(getattr(variable, "units", "")).strip().lower()
    if units in ("m", "meter", "meters", "metre", "metres"):
        return 1.0
    if units in ("cm", "centimeter", "centimeters", "centimetre", "centimetres"):
        return 0.01
    if units in ("mm", "millimeter", "millimeters", "millimetre", "millimetres"):
        return 0.001
    raise ValueError(f"Unsupported amplitude units {units!r} for {variable.name}")


def phase_factor(variable):
    units = str(getattr(variable, "units", "")).strip().lower()
    if units in ("degree", "degrees", "degrees_east", "deg"):
        return 1.0
    if units in ("radian", "radians", "rad"):
        return 180.0 / math.pi
    raise ValueError(f"Unsupported phase units {units!r} for {variable.name}")


def distance_km(lat1, lon1, lat2, lon2):
    lat1, lat2 = math.radians(lat1), math.radians(lat2)
    dlat = lat2 - lat1
    dlon = math.radians((lon2 - lon1 + 180) % 360 - 180)
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return 6371.0 * 2 * math.asin(min(1.0, math.sqrt(a)))


def candidates(latitudes, longitudes, point):
    latitude = point["lat"]
    longitude = point["lon"] % 360
    i0 = int(np.argmin(np.abs(latitudes - latitude)))
    j0 = int(np.argmin(np.abs((longitudes - longitude + 180) % 360 - 180)))
    found = []
    for di in range(-5, 6):
        i = i0 + di
        if not 0 <= i < len(latitudes):
            continue
        for dj in range(-5, 6):
            j = (j0 + dj) % len(longitudes)
            ring = max(abs(di), abs(dj))
            distance = distance_km(latitude, point["lon"], float(latitudes[i]), float(longitudes[j]))
            found.append((ring, distance, i, j))
    return sorted(found)


def value_at(variable, lat_dimension, lon_dimension, i, j):
    if len(variable.dimensions) != 2 or set(variable.dimensions) != {lat_dimension, lon_dimension}:
        raise ValueError(f"{variable.name} must have exactly the latitude and longitude dimensions; got {variable.dimensions}")
    indexes = (i, j) if variable.dimensions[0] == lat_dimension else (j, i)
    value = variable[indexes]
    if np.ma.is_masked(value):
        return None
    number = float(value)
    return number if math.isfinite(number) else None


def extract(fes_dir, points):
    files = sorted(path for path in Path(fes_dir).iterdir() if path.name.lower().endswith((".nc", ".nc.xz")) and "mask" not in path.name.lower())
    if not files:
        raise ValueError(f"No constituent .nc or .nc.xz files in {fes_dir}")
    ids = [point["id"] for point in points]
    if len(ids) != len(set(ids)):
        raise ValueError("Point IDs must be unique")
    results = {point["id"]: {**point, "cell": None, "constituents": []} for point in points}
    choices = {}
    sampled = {point["id"]: [] for point in points}
    grid = None
    names = set()
    with tempfile.TemporaryDirectory(prefix="fes2022-") as temp:
        for source in files:
            name = source.name.removesuffix(".xz").removesuffix(".nc").split("_", 1)[0].upper()
            if not name.isalnum() or not any(character.isalpha() for character in name) or name in names:
                raise ValueError(f"Invalid or duplicate constituent name from {source.name}")
            names.add(name)
            filepath = source
            if source.suffix == ".xz":
                filepath = Path(temp) / source.stem
                with lzma.open(source, "rb") as compressed, filepath.open("wb") as output:
                    shutil.copyfileobj(compressed, output)
            with netCDF4.Dataset(filepath) as dataset:
                lat_var = pick_variable(dataset, "lat")
                lon_var = pick_variable(dataset, "lon")
                amp_var = pick_variable(dataset, "amplitude")
                phase_var = pick_variable(dataset, "phase")
                latitudes = np.asarray(lat_var[:], dtype=float)
                longitudes = np.asarray(lon_var[:], dtype=float)
                if latitudes.ndim != 1 or longitudes.ndim != 1:
                    raise ValueError(f"{source.name}: latitude and longitude must be 1D")
                if grid is None:
                    grid = (latitudes, longitudes)
                    choices = {point["id"]: candidates(latitudes, longitudes, point) for point in points}
                elif not (np.array_equal(grid[0], latitudes) and np.array_equal(grid[1], longitudes)):
                    raise ValueError(f"{source.name}: coordinate grid differs from preceding constituent")
                amp_scale = amplitude_factor(amp_var)
                phase_scale = phase_factor(phase_var)
                for point in points:
                    point_id = point["id"]
                    kept = []
                    values = {}
                    for ring, distance, i, j in choices[point_id]:
                        amplitude = value_at(amp_var, lat_var.dimensions[0], lon_var.dimensions[0], i, j)
                        phase = value_at(phase_var, lat_var.dimensions[0], lon_var.dimensions[0], i, j)
                        if amplitude is not None and phase is not None:
                            kept.append((ring, distance, i, j))
                            values[(i, j)] = {"name": name, "amplitudeM": amplitude * amp_scale, "phaseDeg": phase * phase_scale}
                    choices[point_id] = kept
                    sampled[point_id].append(values)
            if filepath != source:
                filepath.unlink()

        # Reopen each grid once; only the nearest cell valid in every constituent is retained.
        unresolved = []
        for point in points:
            point_id = point["id"]
            if not choices[point_id]:
                unresolved.append(point_id)
                results.pop(point_id)
                continue
            _, distance, i, j = choices[point_id][0]
            lat, lon = float(grid[0][i]), float(grid[1][j])
            results[point_id]["cell"] = {"lat": lat, "lon": (lon + 180) % 360 - 180, "distanceKm": round(distance, 3)}
            results[point_id]["constituents"] = [values[(i, j)] for values in sampled[point_id]]
    return {"model": "FES2022", "generatedAt": datetime.now(timezone.utc).isoformat(), "points": results, "unresolved": unresolved}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fes-dir", required=True)
    parser.add_argument("--points", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    input_points = json.loads(Path(args.points).read_text())["points"]
    output = extract(args.fes_dir, input_points)
    Path(args.out).write_text(json.dumps(output, indent=2) + "\n")
    print(f"Extracted {len(output['points'])} points; unresolved: {len(output['unresolved'])}")


if __name__ == "__main__":
    main()
