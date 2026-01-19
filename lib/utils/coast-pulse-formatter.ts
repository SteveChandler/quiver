/**
 * Coast Pulse message formatting utilities
 * Transforms raw buoy data into interpretive surf commentary
 */

import {
  getSeasonalTempContext,
  detectCoastalRegion,
  type CoastalRegion,
} from "@/lib/constants/coastal-regions";

/**
 * Get size assessment label from wave height
 */
export function getHeightAssessment(heightFt: number): string {
  if (heightFt < 1.0) return "Flat";
  if (heightFt < 1.5) return "Ankle-to-knee";
  if (heightFt < 2.5) return "Knee-to-waist";
  if (heightFt < 4.0) return "Waist-to-chest";
  if (heightFt < 6.0) return "Head-high";
  if (heightFt < 8.0) return "Overhead";
  if (heightFt < 12.0) return "Double overhead";
  return "XXL";
}

/**
 * Get condition note based on height and period
 */
export function getHeightConditionNote(
  heightFt: number,
  periodS: number
): string {
  // Flat conditions
  if (heightFt < 1.0) {
    return "Minimal energy, SUP or prone conditions";
  }

  // Small waves - period matters less
  if (heightFt < 1.5) {
    return "Best for patient longboarders";
  }

  if (heightFt < 2.5) {
    return "Favorable for longboards, fun for all";
  }

  // Mid-size waves - period starts to matter
  if (heightFt < 4.0) {
    if (periodS < 9) {
      return "Choppy, but rideable for most surfers";
    }
    return "Good size for most surfers";
  }

  // Head-high - period quality important
  if (heightFt < 6.0) {
    if (periodS < 9) {
      return "Inconsistent, intermediate+";
    }
    return "Solid conditions, intermediate+";
  }

  // Overhead - getting serious
  if (heightFt < 8.0) {
    if (periodS >= 15) {
      return "Powerful surf, experienced surfers";
    }
    return "Heavy surf, experienced surfers";
  }

  // Double overhead+
  if (heightFt < 12.0) {
    return "Heavy conditions, experts only";
  }

  return "Dangerous, big wave spots only";
}

/**
 * Get swell energy label from wave period
 */
export function getPeriodLabel(periodS: number): string {
  if (periodS < 6) return "Wind chop";
  if (periodS < 9) return "Short-period wind swell";
  if (periodS < 12) return "Mid-period swell";
  if (periodS < 15) return "Groundswell";
  if (periodS < 18) return "Long-period groundswell";
  return "Deep-water groundswell";
}

/**
 * Get quality description from wave period
 */
export function getPeriodQuality(periodS: number): string {
  if (periodS < 6) return "Bumpy, disorganized";
  if (periodS < 9) return "Inconsistent, close-out prone";
  if (periodS < 12) return "Decent shape, moderate power";
  if (periodS < 15) return "Clean lines, good shape expected";
  if (periodS < 18) return "Solid energy, powerful waves";
  return "Excellent organization, maximum power";
}

/**
 * Get swell direction context based on region
 */
export function getSwellDirectionContext(
  direction: string | null | undefined,
  region: CoastalRegion
): string | null {
  if (!direction) return null;

  const dir = direction.toUpperCase().replace(/\s+/g, "");

  // Check if this direction is favorable for the region
  const isFavorable = region.coastFaces.some((face) => {
    // Direct match
    if (dir === face) return true;
    // Adjacent match (e.g., SW matches S or W facing)
    if (dir.includes(face) || face.includes(dir)) return true;
    return false;
  });

  // Generate context based on region and direction match
  if (isFavorable) {
    // Describe what the swell direction favors
    switch (region.id) {
      case "socal":
        if (dir === "SW" || dir === "S") {
          return "Filling in south-facing reefs and points";
        }
        if (dir === "W" || dir === "WNW") {
          return "Working most west-facing beaches";
        }
        if (dir === "NW") {
          return "Wrapping into protected spots";
        }
        return "Favorable for local breaks";

      case "central-ca":
      case "norcal":
        if (dir === "NW" || dir === "WNW") {
          return "A direct hit for most breaks";
        }
        if (dir === "W") {
          return "Clean lines for open beaches";
        }
        if (dir === "SW") {
          return "Favorable for south-facing coves";
        }
        return "Working the coast";

      case "pacific-nw":
        if (dir === "W" || dir === "NW") {
          return "Direct exposure, powerful surf";
        }
        if (dir === "SW") {
          return "Clean lines, less direct angle";
        }
        return "Working exposed beaches";

      case "hawaii":
        if (dir === "N" || dir === "NW") {
          return "Lighting up north shores";
        }
        if (dir === "S" || dir === "SW") {
          return "South shore season";
        }
        if (dir === "E" || dir === "NE") {
          return "Trade swell for east-facing breaks";
        }
        return "Finding favorable exposures";

      case "east-fl":
      case "east-se":
      case "east-mid":
      case "east-ne":
        if (dir === "E" || dir === "ESE") {
          return "Clean lines for east-facing beaches";
        }
        if (dir === "SE" || dir === "S") {
          return "Favorable angle for east-facing beaches";
        }
        if (dir === "NE") {
          return "Direct energy, may be choppy";
        }
        return "Working the coast";

      case "gulf":
        if (dir === "S" || dir === "SE") {
          return "Favorable for gulf beaches";
        }
        return "Finding workable angles";

      default:
        return "Favorable for local breaks";
    }
  }

  // Unfavorable direction
  return "Many spots in shadow from this direction";
}

/**
 * Get comfort label from water temperature
 */
export function getTempComfortLabel(tempF: number): string {
  if (tempF < 50) return "cold";
  if (tempF < 55) return "chilly";
  if (tempF < 60) return "cool";
  if (tempF < 65) return "mild";
  if (tempF < 70) return "comfortable";
  if (tempF < 75) return "warm";
  return "tropical";
}

/**
 * Format water temperature with comfort and seasonal context
 */
export function formatWaterTemp(
  tempF: number,
  region: CoastalRegion,
  month: number
): string {
  const comfort = getTempComfortLabel(tempF);
  const seasonal = getSeasonalTempContext(tempF, region, month);

  if (seasonal) {
    return `Water ${Math.round(tempF)}°F, ${comfort} (${seasonal})`;
  }

  return `Water ${Math.round(tempF)}°F (${comfort})`;
}

export interface TideData {
  nextTideName: string; // "High Tide" or "Low Tide"
  nextTideHeight: number;
  hoursUntil: number;
  minsUntil: number;
  currentHeight: number;
  status: "Rising" | "Falling" | string;
}

/**
 * Format tide status with interpretive context
 */
export function formatTideMessage(data: TideData): string {
  const {
    nextTideName,
    nextTideHeight,
    hoursUntil,
    minsUntil,
    currentHeight,
    status,
  } = data;

  const isGoingHigh = nextTideName.toLowerCase().includes("high");
  const isNear = hoursUntil === 0 && minsUntil <= 30;

  // Time string
  const timeStr =
    hoursUntil > 0 ? `${hoursUntil}h ${minsUntil}m` : `${minsUntil}m`;

  // Extreme tide warnings
  if (currentHeight < 0 || nextTideHeight < 0) {
    if (currentHeight < -0.5 || nextTideHeight < -0.5) {
      return `Extremely low, ${nextTideHeight.toFixed(1)}ft low in ${timeStr}. Exposed rocks likely.`;
    }
  }

  if (currentHeight > 6 || nextTideHeight > 6) {
    return `King tide range, ${nextTideHeight.toFixed(1)}ft ${isGoingHigh ? "high" : "low"} in ${timeStr}. Reduced beach access.`;
  }

  // Near tide states (within 30 min)
  if (isNear) {
    if (isGoingHigh) {
      return `Near high, ${currentHeight.toFixed(1)}ft. Fat and slow at most spots.`;
    } else {
      return `Near low, ${currentHeight.toFixed(1)}ft. Watch for shallow sections.`;
    }
  }

  // Transitional states
  if (status === "Rising") {
    if (currentHeight < 1.5) {
      // Rising from low
      return `Filling in, rising for ${timeStr}. Sandbars coming alive.`;
    }
    // Rising toward high
    return `Pushing in, high in ${timeStr}. Beach breaks may back off.`;
  }

  if (status === "Falling") {
    if (currentHeight > 3) {
      // Falling from high
      return `Draining out, dropping for ${timeStr}. Reefs and points improving.`;
    }
    // Falling toward low
    return `Draining fast, ${nextTideHeight.toFixed(1)}ft low in ${timeStr}. Reefs and points improving.`;
  }

  // Fallback
  return `${nextTideName} in ${timeStr} @ ${nextTideHeight.toFixed(1)}ft.`;
}

export interface BuoyData {
  heightFt: number;
  periodS: number;
  direction: string | null;
  waterTempF: number | null;
  lat: number;
  lon: number;
}

/**
 * Format complete buoy message with interpretive commentary
 */
export function formatBuoyMessage(data: BuoyData): string {
  const { heightFt, periodS, direction, waterTempF, lat, lon } = data;

  const region = detectCoastalRegion(lat, lon);
  const month = new Date().getMonth();

  const parts: string[] = [];

  // 1. Period-based energy label + measurements
  const periodLabel = getPeriodLabel(periodS);
  parts.push(`${periodLabel}, ${heightFt.toFixed(1)}ft @ ${periodS}s`);

  // 2. Direction with context (if available)
  if (direction && region) {
    const dirContext = getSwellDirectionContext(direction, region);
    if (dirContext) {
      parts.push(`${direction}. ${dirContext}`);
    } else {
      parts.push(direction);
    }
  } else if (direction) {
    parts.push(direction);
  }

  // 3. Condition note based on size + period
  const conditionNote = getHeightConditionNote(heightFt, periodS);
  parts.push(conditionNote);

  // 4. Water temp with seasonal context (if available)
  if (waterTempF != null && region) {
    parts.push(formatWaterTemp(waterTempF, region, month));
  } else if (waterTempF != null) {
    parts.push(`Water ${Math.round(waterTempF)}°F`);
  }

  return parts.join(". ").replace(/\.\./g, ".").replace(/\. \./g, ".");
}
