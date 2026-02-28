"""
HRRR (High-Resolution Rapid Refresh) wind data extraction service.

Fetches 3km resolution wind data from NOAA's NOMADS GRIB Filter
and extracts values for beach coordinates.

HRRR Coverage: CONUS only (no Hawaii, Puerto Rico, or Baja south)
Resolution: 3km (vs 13km GFS used by NWS)
Horizon: 0-18 hours (vs 7+ days for GFS)
Update frequency: Hourly
"""
import tempfile
import math
import logging
from datetime import datetime, timezone, timedelta
from typing import Optional
from dataclasses import dataclass

import httpx
import numpy as np

logger = logging.getLogger(__name__)

# Check eccodes availability at import time so callers get a clear message
# instead of a confusing ImportError deep inside parse_grib().
try:
    import eccodes as _eccodes  # noqa: F401
    _ECCODES_AVAILABLE = True
except ImportError:
    _ECCODES_AVAILABLE = False
    logger.warning(
        "eccodes not installed — HRRR GRIB parsing will be unavailable. "
        "Install with: pip install eccodes"
    )

NOMADS_BASE_URL = "https://nomads.ncep.noaa.gov/cgi-bin/filter_hrrr_2d.pl"

# West Coast bounding box (with padding for coastal accuracy).
# Intentionally restricted to the US West Coast (CA, OR, WA, northern Baja).
# To expand to the full CONUS, change to approximately:
#   toplat=50, bottomlat=24, leftlon=-125, rightlon=-66
BBOX = {
    "toplat": 49,
    "bottomlat": 32,
    "leftlon": -126,
    "rightlon": -117,
}

# HRRR data availability lag (minutes after model run start)
HRRR_LAG_MINUTES = 90

# Maximum forecast hour supported by HRRR
HRRR_MAX_FORECAST_HOUR = 18

# Minimum GRIB file size to consider valid (NOMADS returns HTML error
# pages for missing data, which are typically under 1KB)
MIN_GRIB_BYTES = 1000


@dataclass
class WindExtraction:
    """Wind data extracted for a single beach."""
    beach_id: str
    wind_speed_ms: float
    wind_direction_deg: float
    wind_gust_ms: Optional[float]
    forecast_hour: int
    model_run: str  # e.g., "2026-02-28T12:00:00Z"


class HRRRWindService:
    """Service for extracting HRRR wind data for beach coordinates.

    Uses NOAA NOMADS GRIB Filter to fetch subregion GRIB2 files containing
    U/V wind components and gusts at 10m above ground, then performs
    nearest-neighbor extraction for requested beach coordinates.

    The HRRR grid uses Lambert Conformal projection (~3km spacing), so
    a KD-tree on Cartesian-projected lat/lon is used for lookups.
    The tree is built once and cached for reuse across forecast hours.
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._grid_tree = None  # Cached scipy.spatial.cKDTree
        self._grid_lats = None
        self._grid_lons = None

    def _get_latest_available_run(self) -> tuple[str, int]:
        """Determine the latest available HRRR model run.

        HRRR runs hourly but data becomes available approximately
        60-90 minutes after the model run start time.

        Returns:
            Tuple of (date_str "YYYYMMDD", hour int)
        """
        now = datetime.now(timezone.utc)
        available_time = now - timedelta(minutes=HRRR_LAG_MINUTES)
        return available_time.strftime("%Y%m%d"), available_time.hour

    async def fetch_grib(
        self,
        run_date: str,
        run_hour: int,
        forecast_hour: int,
        client: Optional[httpx.AsyncClient] = None,
    ) -> Optional[bytes]:
        """Fetch a GRIB2 file from NOMADS for a specific run and forecast hour.

        Requests only U/V wind at 10m and gusts within the West Coast
        bounding box to minimize download size.

        Args:
            run_date: Model run date "YYYYMMDD"
            run_hour: Model run hour (0-23)
            forecast_hour: Forecast hour (0-18)
            client: Optional shared httpx client (creates one if not provided)

        Returns:
            Raw GRIB2 bytes, or None on failure
        """
        params = {
            "dir": f"/hrrr.{run_date}/conus",
            "file": f"hrrr.t{run_hour:02d}z.wrfsfcf{forecast_hour:02d}.grib2",
            "var_UGRD": "on",
            "var_VGRD": "on",
            "var_GUST": "on",
            "lev_10_m_above_ground": "on",
            "lev_surface": "on",  # GUST is on surface level, U/V on 10m
            "subregion": "",
            **BBOX,
        }

        try:
            async def _fetch(c: httpx.AsyncClient) -> Optional[bytes]:
                response = await c.get(NOMADS_BASE_URL, params=params)
                response.raise_for_status()

                if len(response.content) < MIN_GRIB_BYTES:
                    logger.warning(
                        "HRRR response too small (%d bytes), likely missing "
                        "data for %s t%02dz f%02d",
                        len(response.content), run_date, run_hour, forecast_hour,
                    )
                    return None

                logger.info(
                    "Fetched HRRR GRIB2: %d bytes for %s t%02dz f%02d",
                    len(response.content), run_date, run_hour, forecast_hour,
                )
                return response.content

            if client is not None:
                return await _fetch(client)
            else:
                async with httpx.AsyncClient(timeout=self.timeout) as c:
                    return await _fetch(c)

        except httpx.HTTPStatusError as e:
            logger.warning("NOMADS HTTP error: %d", e.response.status_code)
            return None
        except httpx.RequestError as e:
            logger.warning("NOMADS request failed: %s", e)
            return None

    def parse_grib(self, grib_bytes: bytes) -> dict[str, np.ndarray]:
        """Parse GRIB2 bytes and extract U/V wind components and gusts.

        Uses the eccodes library directly to avoid xarray/dask overhead.
        Writes bytes to a temporary file since eccodes needs a file handle.

        Returns:
            Dict with keys 'u10', 'v10', 'gust' (optional), 'lats', 'lons'.
            Each value is a flat numpy array over the grid points.
        """
        if not _ECCODES_AVAILABLE:
            raise RuntimeError(
                "eccodes is not installed — cannot parse GRIB data. "
                "Install with: pip install eccodes"
            )
        import eccodes

        result: dict[str, np.ndarray] = {}

        with tempfile.NamedTemporaryFile(suffix=".grib2") as tmp:
            tmp.write(grib_bytes)
            tmp.flush()

            with open(tmp.name, "rb") as f:
                while True:
                    msgid = eccodes.codes_grib_new_from_file(f)
                    if msgid is None:
                        break

                    try:
                        short_name = eccodes.codes_get(msgid, "shortName")

                        # Extract lat/lon arrays once (same grid for all messages)
                        if "lats" not in result:
                            result["lats"] = eccodes.codes_get_array(
                                msgid, "latitudes"
                            )
                            result["lons"] = eccodes.codes_get_array(
                                msgid, "longitudes"
                            )

                        values = eccodes.codes_get_values(msgid)

                        if short_name == "10u":
                            result["u10"] = values
                        elif short_name == "10v":
                            result["v10"] = values
                        elif short_name == "gust":
                            result["gust"] = values

                    finally:
                        eccodes.codes_release(msgid)

        if "u10" not in result or "v10" not in result:
            logger.warning(
                "GRIB parse incomplete: found keys %s", list(result.keys())
            )

        return result

    def _build_grid_tree(self, lats: np.ndarray, lons: np.ndarray) -> None:
        """Build a KD-tree for fast nearest-neighbor lookups on the HRRR grid.

        Converts lat/lon to Cartesian coordinates on a unit sphere so that
        Euclidean KD-tree distance approximates great-circle distance.
        """
        from scipy.spatial import cKDTree

        lat_rad = np.radians(lats)
        lon_rad = np.radians(lons)

        x = np.cos(lat_rad) * np.cos(lon_rad)
        y = np.cos(lat_rad) * np.sin(lon_rad)
        z = np.sin(lat_rad)

        coords = np.column_stack([x, y, z])
        self._grid_tree = cKDTree(coords)
        self._grid_lats = lats
        self._grid_lons = lons

    def _find_nearest_indices(
        self,
        beach_lats: list[float],
        beach_lons: list[float],
    ) -> np.ndarray:
        """Find nearest HRRR grid indices for the given beach coordinates.

        Args:
            beach_lats: List of beach latitudes
            beach_lons: List of beach longitudes

        Returns:
            Array of integer indices into the flattened grid arrays
        """
        lat_rad = np.radians(beach_lats)
        lon_rad = np.radians(beach_lons)

        x = np.cos(lat_rad) * np.cos(lon_rad)
        y = np.cos(lat_rad) * np.sin(lon_rad)
        z = np.sin(lat_rad)

        coords = np.column_stack([x, y, z])
        _, indices = self._grid_tree.query(coords)
        return indices

    def extract_wind_for_beaches(
        self,
        grib_data: dict[str, np.ndarray],
        beaches: list[dict],
        forecast_hour: int,
        model_run: str,
    ) -> list[WindExtraction]:
        """Extract wind values for a list of beaches from parsed GRIB data.

        Args:
            grib_data: Parsed GRIB data from parse_grib()
            beaches: List of dicts with 'id', 'lat', 'lon' keys
            forecast_hour: Forecast hour for metadata
            model_run: Model run ISO timestamp for metadata

        Returns:
            List of WindExtraction results
        """
        if "u10" not in grib_data or "v10" not in grib_data:
            logger.error("Missing U/V wind components in GRIB data")
            return []

        # Build KD-tree on first call, then reuse across forecast hours
        if self._grid_tree is None:
            self._build_grid_tree(grib_data["lats"], grib_data["lons"])

        beach_lats = [b["lat"] for b in beaches]
        beach_lons = [b["lon"] for b in beaches]
        indices = self._find_nearest_indices(beach_lats, beach_lons)

        results = []
        for i, beach in enumerate(beaches):
            idx = indices[i]
            u = float(grib_data["u10"][idx])
            v = float(grib_data["v10"][idx])

            # Wind speed from U/V components
            speed = math.sqrt(u**2 + v**2)

            # Meteorological wind direction (direction wind is coming FROM).
            # atan2(-u, -v) gives the "from" direction directly.
            direction_rad = math.atan2(-u, -v)
            direction_deg = (math.degrees(direction_rad) + 360) % 360

            # Gust may not be present in all GRIB messages
            gust = None
            if "gust" in grib_data:
                gust = float(grib_data["gust"][idx])

            results.append(
                WindExtraction(
                    beach_id=beach["id"],
                    wind_speed_ms=round(speed, 2),
                    wind_direction_deg=round(direction_deg, 1),
                    wind_gust_ms=round(gust, 2) if gust is not None else None,
                    forecast_hour=forecast_hour,
                    model_run=model_run,
                )
            )

        return results

    async def extract_current_wind(
        self,
        beaches: list[dict],
        forecast_hours: list[int] | None = None,
    ) -> list[dict]:
        """Extract current HRRR wind data for the given beaches.

        Determines the latest available model run, fetches GRIB data for
        each requested forecast hour, and returns wind extractions as
        JSON-serializable dicts.

        Args:
            beaches: List of dicts with 'id', 'lat', 'lon' keys
            forecast_hours: Which forecast hours to extract (default [1])

        Returns:
            List of dicts ready for JSON serialization
        """
        if forecast_hours is None:
            forecast_hours = [1]

        run_date, run_hour = self._get_latest_available_run()
        model_run = (
            f"{run_date[:4]}-{run_date[4:6]}-{run_date[6:8]}"
            f"T{run_hour:02d}:00:00Z"
        )

        all_results: list[dict] = []

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for fh in forecast_hours:
                if fh > HRRR_MAX_FORECAST_HOUR:
                    logger.warning(
                        "Skipping forecast hour %d -- HRRR max is %d",
                        fh, HRRR_MAX_FORECAST_HOUR,
                    )
                    continue

                grib_bytes = await self.fetch_grib(run_date, run_hour, fh, client=client)
                if grib_bytes is None:
                    logger.warning("No GRIB data for f%02d, skipping", fh)
                    continue

                grib_data = self.parse_grib(grib_bytes)
                extractions = self.extract_wind_for_beaches(
                    grib_data, beaches, fh, model_run
                )

                for ext in extractions:
                    # Compute the valid time for this forecast hour
                    valid_time = datetime.strptime(run_date, "%Y%m%d").replace(
                        hour=run_hour, tzinfo=timezone.utc,
                    ) + timedelta(hours=fh)

                    all_results.append({
                        "beach_id": ext.beach_id,
                        "wind_speed_ms": ext.wind_speed_ms,
                        "wind_direction_deg": ext.wind_direction_deg,
                        "wind_gust_ms": ext.wind_gust_ms,
                        "forecast_hour": ext.forecast_hour,
                        "model_run": ext.model_run,
                        "valid_time": valid_time.isoformat(),
                    })

        logger.info(
            "Extracted HRRR wind for %d beaches x %d hours = %d results",
            len(beaches), len(forecast_hours), len(all_results),
        )
        return all_results
