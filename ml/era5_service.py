"""
ERA5-Ocean reanalysis data service via Open-Meteo.

This service fetches historical marine reanalysis data from ERA5-Ocean
through the Open-Meteo Marine API. ERA5 provides consistent, validated
wave data from 1940 to present.

Key characteristics:
- Resolution: 0.5° (~50km)
- Temporal: Hourly
- Coverage: Global
- Delay: 5 days behind real-time
- Data source: ECMWF ERA5 reanalysis

API Documentation: https://open-meteo.com/en/docs/marine-weather-api
"""
import httpx
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging
import pandas as pd
from dataclasses import dataclass

logger = logging.getLogger(__name__)

# Open-Meteo Marine API (serves ERA5 for historical dates)
MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine"

# ERA5 has a 5-day delay
ERA5_DELAY_DAYS = 5

# Maximum date range per request (Open-Meteo limit)
MAX_DAYS_PER_REQUEST = 92


@dataclass
class ERA5DataPoint:
    """Single ERA5 observation data point."""
    timestamp: datetime
    wave_height_m: float
    wave_period_s: float
    wave_direction_deg: float
    swell_height_m: Optional[float] = None
    swell_period_s: Optional[float] = None
    swell_direction_deg: Optional[float] = None
    wind_wave_height_m: Optional[float] = None


class ERA5Service:
    """
    Service for fetching ERA5-Ocean reanalysis data.

    ERA5 provides validated historical wave data that can be used as
    pseudo-observations for training data augmentation.
    """

    def __init__(self, timeout: float = 60.0):
        self.timeout = timeout

    async def fetch_historical_data(
        self,
        lat: float,
        lon: float,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """
        Fetch ERA5-Ocean historical data for a location and date range.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            start_date: Start of date range
            end_date: End of date range (max 92 days from start)

        Returns:
            DataFrame with hourly ERA5 data
        """
        # Ensure end_date respects ERA5 delay
        max_end_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=ERA5_DELAY_DAYS)
        if end_date > max_end_date:
            end_date = max_end_date
            logger.debug(f"Adjusted end_date to {end_date} due to ERA5 delay")

        # Split into chunks if range exceeds max
        all_data = []
        current_start = start_date

        while current_start < end_date:
            current_end = min(
                current_start + timedelta(days=MAX_DAYS_PER_REQUEST),
                end_date
            )

            chunk_data = await self._fetch_chunk(lat, lon, current_start, current_end)
            if chunk_data is not None:
                all_data.append(chunk_data)

            current_start = current_end + timedelta(days=1)

        if not all_data:
            return pd.DataFrame()

        return pd.concat(all_data, ignore_index=True)

    async def _fetch_chunk(
        self,
        lat: float,
        lon: float,
        start_date: datetime,
        end_date: datetime
    ) -> Optional[pd.DataFrame]:
        """Fetch a single chunk of ERA5 data (max 92 days)."""
        params = {
            "latitude": lat,
            "longitude": lon,
            "hourly": [
                "wave_height",
                "wave_period",
                "wave_direction",
                "swell_wave_height",
                "swell_wave_period",
                "swell_wave_direction",
                "wind_wave_height",
            ],
            "start_date": start_date.strftime("%Y-%m-%d"),
            "end_date": end_date.strftime("%Y-%m-%d"),
            "timezone": "UTC",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(MARINE_API_URL, params=params)
                response.raise_for_status()
                data = response.json()

            return self._parse_response(data)

        except httpx.HTTPStatusError as e:
            logger.warning(f"ERA5 API error: {e.response.status_code} for {lat}, {lon}")
            return None
        except httpx.RequestError as e:
            logger.warning(f"ERA5 request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching ERA5 data: {e}")
            return None

    def _parse_response(self, data: dict) -> pd.DataFrame:
        """Parse Open-Meteo API response into DataFrame."""
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        if not times:
            return pd.DataFrame()

        df = pd.DataFrame({
            "timestamp": pd.to_datetime(times),
            "wave_height_era5": hourly.get("wave_height", [None] * len(times)),
            "wave_period_era5": hourly.get("wave_period", [None] * len(times)),
            "wave_direction_era5": hourly.get("wave_direction", [None] * len(times)),
            "swell_height_era5": hourly.get("swell_wave_height", [None] * len(times)),
            "swell_period_era5": hourly.get("swell_wave_period", [None] * len(times)),
            "swell_direction_era5": hourly.get("swell_wave_direction", [None] * len(times)),
            "wind_wave_height_era5": hourly.get("wind_wave_height", [None] * len(times)),
        })

        # Drop rows with missing wave height (critical field)
        df = df.dropna(subset=["wave_height_era5"])

        return df

    def fetch_historical_data_sync(
        self,
        lat: float,
        lon: float,
        start_date: datetime,
        end_date: datetime
    ) -> pd.DataFrame:
        """Synchronous wrapper for fetch_historical_data."""
        return asyncio.run(self.fetch_historical_data(lat, lon, start_date, end_date))


class ERA5Validator:
    """
    Validates ERA5 accuracy against real buoy observations.

    Before using ERA5 as pseudo-ground-truth, we must verify it's accurate
    enough for the specific beaches in question.
    """

    def __init__(self, era5_service: ERA5Service):
        self.era5_service = era5_service

    async def validate_against_buoy(
        self,
        buoy_observations: pd.DataFrame,
        lat: float,
        lon: float,
        time_tolerance_hours: float = 1.0
    ) -> dict:
        """
        Compare ERA5 data against actual buoy observations.

        Args:
            buoy_observations: DataFrame with 'timestamp' and 'wave_height_m'
            lat: Beach latitude
            lon: Beach longitude
            time_tolerance_hours: Max time difference for matching

        Returns:
            Validation metrics dict
        """
        if buoy_observations.empty:
            return {"valid": False, "error": "No buoy observations provided"}

        # Get ERA5 data for the same time range
        start_date = buoy_observations['timestamp'].min()
        end_date = buoy_observations['timestamp'].max()

        era5_data = await self.era5_service.fetch_historical_data(
            lat, lon, start_date, end_date
        )

        if era5_data.empty:
            return {"valid": False, "error": "No ERA5 data available"}

        # Match observations with ERA5
        matched_pairs = []
        tolerance = timedelta(hours=time_tolerance_hours)

        for _, obs in buoy_observations.iterrows():
            obs_time = obs['timestamp']
            if pd.isna(obs_time):
                continue

            # Find closest ERA5 timestamp
            time_diffs = abs(era5_data['timestamp'] - obs_time)
            min_diff_idx = time_diffs.idxmin()
            min_diff = time_diffs[min_diff_idx]

            if min_diff <= tolerance:
                era5_row = era5_data.loc[min_diff_idx]
                matched_pairs.append({
                    'buoy_height': obs['wave_height_m'],
                    'era5_height': era5_row['wave_height_era5'],
                    'time_diff_hours': min_diff.total_seconds() / 3600
                })

        if not matched_pairs:
            return {"valid": False, "error": "No matching observations found"}

        df = pd.DataFrame(matched_pairs)

        # Calculate validation metrics
        df['error'] = df['buoy_height'] - df['era5_height']
        df['abs_error'] = df['error'].abs()

        mae = df['abs_error'].mean()
        rmse = (df['error'] ** 2).mean() ** 0.5
        bias = df['error'].mean()
        correlation = df['buoy_height'].corr(df['era5_height'])

        # Validation thresholds
        is_valid = mae < 0.4 and correlation > 0.75

        return {
            "valid": is_valid,
            "n_pairs": len(df),
            "mae_m": round(mae, 3),
            "rmse_m": round(rmse, 3),
            "bias_m": round(bias, 3),
            "correlation": round(correlation, 3),
            "recommendation": "Use ERA5" if is_valid else "ERA5 not accurate enough for this location"
        }


async def fetch_era5_for_beaches(
    beaches: list[dict],
    start_date: datetime,
    end_date: datetime,
    max_concurrent: int = 5
) -> dict[str, pd.DataFrame]:
    """
    Fetch ERA5 data for multiple beaches concurrently.

    Args:
        beaches: List of dicts with 'id', 'latitude', 'longitude'
        start_date: Start of date range
        end_date: End of date range
        max_concurrent: Maximum concurrent API requests

    Returns:
        Dictionary mapping beach_id to ERA5 DataFrame
    """
    service = ERA5Service()
    semaphore = asyncio.Semaphore(max_concurrent)
    results = {}

    async def fetch_beach(beach: dict):
        async with semaphore:
            beach_id = beach['id']
            lat = beach['latitude']
            lon = beach['longitude']

            logger.debug(f"Fetching ERA5 for beach {beach_id}")
            data = await service.fetch_historical_data(lat, lon, start_date, end_date)

            if not data.empty:
                data['beach_id'] = beach_id

            return beach_id, data

    tasks = [fetch_beach(b) for b in beaches]
    task_results = await asyncio.gather(*tasks)

    for beach_id, data in task_results:
        results[beach_id] = data

    return results


# Example usage and testing
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.DEBUG)

    # Test ERA5 data fetch
    service = ERA5Service()

    # Fetch 30 days of historical data for Oceanside, CA
    end_date = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=ERA5_DELAY_DAYS + 1)
    start_date = end_date - timedelta(days=30)

    print(f"Fetching ERA5 data from {start_date.date()} to {end_date.date()}")

    data = service.fetch_historical_data_sync(
        lat=33.1581,
        lon=-117.3506,
        start_date=start_date,
        end_date=end_date
    )

    if not data.empty:
        print(f"\nRetrieved {len(data)} hourly observations")
        print(f"Date range: {data['timestamp'].min()} to {data['timestamp'].max()}")
        print(f"\nSample data:")
        print(data.head(10).to_string(index=False))

        print(f"\nStatistics:")
        print(f"  Mean wave height: {data['wave_height_era5'].mean():.2f}m")
        print(f"  Max wave height: {data['wave_height_era5'].max():.2f}m")
        print(f"  Mean period: {data['wave_period_era5'].mean():.1f}s")
    else:
        print("Failed to fetch ERA5 data")
        sys.exit(1)
