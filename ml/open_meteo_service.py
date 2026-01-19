"""
Open-Meteo Marine API service for fetching wave forecasts.

This service fetches marine forecasts from Open-Meteo to use as ensemble
features in the ML bias correction model.

API Documentation: https://open-meteo.com/en/docs/marine-weather-api
"""
import httpx
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Open-Meteo Marine API endpoint
MARINE_API_URL = "https://marine-api.open-meteo.com/v1/marine"

# Rate limiting: Open-Meteo allows 10,000 requests/day for non-commercial use
# We'll add a small delay between requests to be respectful
REQUEST_DELAY_MS = 100


class OpenMeteoError(Exception):
    """Custom exception for Open-Meteo API errors."""
    pass


class OpenMeteoService:
    """
    Service for fetching marine forecast data from Open-Meteo.

    Provides wave height, period, direction, and swell decomposition data
    to use as additional features in the ML model.
    """

    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout
        self._last_request_time: Optional[datetime] = None
        self._rate_limit_lock: Optional[asyncio.Lock] = None

    def _get_lock(self) -> asyncio.Lock:
        """Get or create the rate limit lock (must be created in async context)."""
        if self._rate_limit_lock is None:
            self._rate_limit_lock = asyncio.Lock()
        return self._rate_limit_lock

    async def _rate_limit(self):
        """Apply rate limiting between requests (thread-safe)."""
        async with self._get_lock():
            if self._last_request_time:
                elapsed = (datetime.now() - self._last_request_time).total_seconds() * 1000
                if elapsed < REQUEST_DELAY_MS:
                    await asyncio.sleep((REQUEST_DELAY_MS - elapsed) / 1000)
            self._last_request_time = datetime.now()

    async def fetch_forecast(
        self,
        lat: float,
        lon: float,
        target_time: datetime,
        include_history: bool = True
    ) -> Optional[dict]:
        """
        Fetch Open-Meteo marine forecast for a specific location and time.

        Args:
            lat: Latitude (-90 to 90)
            lon: Longitude (-180 to 180)
            target_time: The timestamp to get forecast for
            include_history: If True, fetch past_days to find historical data

        Returns:
            Dictionary with marine forecast data, or None if unavailable
        """
        await self._rate_limit()

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
                "wind_wave_period",
                "wind_wave_direction",
            ],
            "timezone": "UTC",
        }

        # Determine if we need historical or forecast data
        # Convert to naive UTC for comparison
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        target_naive = target_time.replace(tzinfo=None) if target_time.tzinfo else target_time
        days_diff = (now - target_naive).days

        if days_diff > 0 and include_history:
            # Need historical data - use past_days (max 92)
            params["past_days"] = min(days_diff + 1, 92)
            params["forecast_days"] = 1
        else:
            # Need forecast data
            params["past_days"] = 2  # Include recent for matching
            params["forecast_days"] = 7

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(MARINE_API_URL, params=params)
                response.raise_for_status()
                data = response.json()

            return self._extract_closest_forecast(data, target_time)

        except httpx.HTTPStatusError as e:
            logger.warning(f"Open-Meteo API error: {e.response.status_code} for {lat}, {lon}")
            return None
        except httpx.RequestError as e:
            logger.warning(f"Open-Meteo request failed: {e}")
            return None
        except Exception as e:
            logger.error(f"Unexpected error fetching Open-Meteo data: {e}")
            return None

    def _extract_closest_forecast(self, data: dict, target_time: datetime) -> Optional[dict]:
        """
        Extract the forecast closest to the target time from API response.

        Args:
            data: Raw API response
            target_time: Target timestamp to find

        Returns:
            Dictionary with extracted forecast values
        """
        hourly = data.get("hourly", {})
        times = hourly.get("time", [])

        if not times:
            return None

        # Parse times and find closest
        parsed_times = []
        for t in times:
            try:
                # Open-Meteo returns ISO format without timezone
                parsed_times.append(datetime.fromisoformat(t.replace("Z", "")))
            except ValueError:
                continue

        if not parsed_times:
            return None

        # Find closest time index
        target_naive = target_time.replace(tzinfo=None) if target_time.tzinfo else target_time
        time_diffs = [abs((t - target_naive).total_seconds()) for t in parsed_times]
        closest_idx = time_diffs.index(min(time_diffs))

        # Check if closest time is within 2 hours
        if time_diffs[closest_idx] > 7200:
            logger.debug(f"Closest Open-Meteo time is {time_diffs[closest_idx]/3600:.1f}h away, skipping")
            return None

        # Extract values at closest index
        def safe_get(key: str) -> Optional[float]:
            values = hourly.get(key, [])
            if closest_idx < len(values):
                val = values[closest_idx]
                return float(val) if val is not None else None
            return None

        return {
            "timestamp_om": parsed_times[closest_idx].isoformat(),
            "wave_height_om": safe_get("wave_height"),
            "wave_period_om": safe_get("wave_period"),
            "wave_direction_om": safe_get("wave_direction"),
            "swell_height_om": safe_get("swell_wave_height"),
            "swell_period_om": safe_get("swell_wave_period"),
            "swell_direction_om": safe_get("swell_wave_direction"),
            "wind_wave_height_om": safe_get("wind_wave_height"),
            "wind_wave_period_om": safe_get("wind_wave_period"),
            "wind_wave_direction_om": safe_get("wind_wave_direction"),
        }

    def fetch_forecast_sync(
        self,
        lat: float,
        lon: float,
        target_time: datetime,
        include_history: bool = True
    ) -> Optional[dict]:
        """
        Synchronous wrapper for fetch_forecast.

        Use this when calling from synchronous code (e.g., training scripts).
        """
        return asyncio.run(self.fetch_forecast(lat, lon, target_time, include_history))


def fetch_open_meteo_batch(
    locations: list[tuple[float, float, datetime]],
    max_concurrent: int = 10
) -> list[Optional[dict]]:
    """
    Fetch Open-Meteo forecasts for multiple locations concurrently.

    Args:
        locations: List of (lat, lon, timestamp) tuples
        max_concurrent: Maximum concurrent requests

    Returns:
        List of forecast dictionaries (or None for failures)
    """
    async def fetch_all():
        service = OpenMeteoService()
        semaphore = asyncio.Semaphore(max_concurrent)

        async def fetch_with_semaphore(lat, lon, ts):
            async with semaphore:
                return await service.fetch_forecast(lat, lon, ts)

        tasks = [fetch_with_semaphore(lat, lon, ts) for lat, lon, ts in locations]
        return await asyncio.gather(*tasks)

    return asyncio.run(fetch_all())


# Example usage and testing
if __name__ == "__main__":
    import sys

    logging.basicConfig(level=logging.DEBUG)

    # Test with a California beach
    service = OpenMeteoService()

    # Current forecast
    result = service.fetch_forecast_sync(
        lat=33.1581,  # Oceanside, CA
        lon=-117.3506,
        target_time=datetime.now(timezone.utc)
    )

    if result:
        print("Current forecast:")
        for key, value in result.items():
            print(f"  {key}: {value}")
    else:
        print("Failed to fetch forecast")
        sys.exit(1)

    # Historical data (yesterday)
    yesterday = datetime.now(timezone.utc) - timedelta(days=1)
    result_hist = service.fetch_forecast_sync(
        lat=33.1581,
        lon=-117.3506,
        target_time=yesterday
    )

    if result_hist:
        print(f"\nHistorical forecast ({yesterday.date()}):")
        for key, value in result_hist.items():
            print(f"  {key}: {value}")
    else:
        print("Failed to fetch historical forecast")
