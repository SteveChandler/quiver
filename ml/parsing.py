"""Text parsing utilities for NOAA forecast data."""
import re
from typing import Optional

FEET_TO_METERS = 0.3048
MPH_TO_MS = 0.44704
KTS_TO_MS = 0.514444

def parse_wave_height(text: Optional[str]) -> Optional[float]:
    """
    Parse wave height text to meters.

    Handles various NOAA formats:
    - "3-4ft", "3 to 4 ft", "3-4 ft plus"
    - "3ft", "3 ft"
    - "Flat", "flat"

    Returns:
        Height in meters, or None if unparseable
    """
    if not text or 'flat' in text.lower():
        return 0.15

    # Clean text: remove "plus", "occasional", "to", keep only digits and separators
    clean = re.sub(r'[^\d\-\.]', ' ', text).strip()

    # Find all numbers in the string
    nums = [float(n) for n in re.findall(r'\d*\.?\d+', clean) if n]

    if len(nums) == 2:
        # Range: take midpoint
        return ((nums[0] + nums[1]) / 2) * FEET_TO_METERS
    elif len(nums) == 1:
        # Single value
        return nums[0] * FEET_TO_METERS

    # Unparseable
    return None


def parse_wind_speed(text: Optional[str]) -> Optional[float]:
    """
    Parse wind speed text to m/s.

    Handles:
    - "10 mph", "10mph"
    - "10 kts", "10kts"

    Returns:
        Speed in m/s, or None if unparseable
    """
    if not text:
        return None

    text_lower = text.lower()

    # Find the number
    match = re.search(r'(\d+\.?\d*)', text)
    if not match:
        return None

    value = float(match.group(1))

    # Determine unit
    if 'kts' in text_lower or 'knot' in text_lower:
        return value * KTS_TO_MS
    elif 'mph' in text_lower:
        return value * MPH_TO_MS
    else:
        # Assume m/s if no unit
        return value
