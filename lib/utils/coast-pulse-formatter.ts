/**
 * Coast Pulse message formatting utilities
 * Transforms raw buoy data into interpretive surf commentary
 */

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
