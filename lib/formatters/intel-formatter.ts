/**
 * Intel Formatter Module
 * Handles formatting and rendering of surf intelligence data
 * Extracted from morning-intel-utils.ts as part of module decomposition
 */

import type {
  SurfMetrics,
  MorningIntelData,
  ForecastSlice,
} from "@/types/morning-intel";

/**
 * IntelFormatter - Responsible for formatting surf data for display
 *
 * Responsibilities:
 * - Wave height description formatting
 * - Surf range derivation from forecast data
 * - Intel markdown rendering for posts
 * - Display text generation
 */
export class IntelFormatter {
  /**
   * Convert wave height to readable description
   *
   * @param avgHeight - Average wave height in feet
   * @returns Human-readable wave height description
   */
  getWaveHeightDescription(avgHeight: number): string {
    if (avgHeight < 1) return "Knee-high";
    if (avgHeight < 2) return "Waist-high";
    if (avgHeight < 3.5) return "Chest-high";
    if (avgHeight < 5) return "Head-high";
    if (avgHeight < 7) return "Overhead";
    return "Double overhead+";
  }

  /**
   * Derive surf range from forecast data
   *
   * Calculates min, max, and dominant wave height from available forecasts
   *
   * @param forecasts - Array of forecast entries with wave height data
   * @returns Surf metrics with min/max/dominant description
   */
  deriveSurfRange(forecasts: ForecastSlice["forecasts"]): SurfMetrics {
    const waveHeights = forecasts
      .map((f) => f.wave_height || f.swell_height || null)
      .filter((h): h is number => h !== null);

    if (waveHeights.length === 0) {
      return { min: 0, max: 0, dominant: "N/A" };
    }

    const min = Math.min(...waveHeights);
    const max = Math.max(...waveHeights);
    const avg = waveHeights.reduce((a, b) => a + b, 0) / waveHeights.length;

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      dominant: this.getWaveHeightDescription(avg),
    };
  }

  /**
   * Render complete intel markdown for a post
   *
   * Generates formatted markdown text including:
   * - Spot name and time
   * - Conditions score (if available)
   * - Surf, tide, swell, and wind details
   * - Best window recommendation
   * - Hazards and skill level (if applicable)
   *
   * @param data - Complete morning intel data structure
   * @returns Formatted markdown string ready for posting
   */
  renderIntelMarkdown(data: MorningIntelData): string {
    const {
      spotName,
      time,
      surf,
      tide,
      swells,
      wind,
      bestWindow,
      confidence,
      notes,
      conditions,
      beachPreferences,
    } = data;

    const tideDirection =
      tide.direction === "rising"
        ? "rising"
        : tide.direction === "falling"
        ? "falling"
        : "slack";

    const tideNext = tide.nextEvent
      ? `next ${tide.nextEvent.type} ${tide.nextEvent.height} ft @ ${tide.nextEvent.time}`
      : "N/A";

    const primarySwell = swells.primary
      ? `${swells.primary.height} ft @ ${swells.primary.period}s from ${swells.primary.cardinal} (${swells.primary.direction}°)`
      : "N/A";

    const secondarySwell = swells.secondary
      ? `${swells.secondary.height} ft @ ${swells.secondary.period}s from ${swells.secondary.cardinal} (${swells.secondary.direction}°)`
      : "N/A";

    // Build conditions section if available
    let conditionsSection = "";
    if (conditions && beachPreferences) {
      conditionsSection = `
📊 **CONDITIONS SCORE: ${conditions.score}/10**

${conditions.swell.emoji} **Swell Direction:** ${conditions.swell.message}
${conditions.wind.emoji} **Wind:** ${conditions.wind.message}
${conditions.tide.emoji} **Tide:** ${conditions.tide.message}`;

      if (beachPreferences.skillLevel) {
        conditionsSection += `\n🏄 **Skill Level:** ${beachPreferences.skillLevel}`;
      }

      if (beachPreferences.hazards && beachPreferences.hazards.length > 0) {
        conditionsSection += `\n\n⚠️ **HAZARDS:** ${beachPreferences.hazards.join(", ")}`;
      }

      conditionsSection += "\n";
    }

    return `**${spotName} — Morning Surf Intel (${time})**
${conditionsSection}
- **Surf:** ${surf.min}–${surf.max} ft (${surf.dominant})
- **Tide @ ${time}:** ${tide.height} ft, ${tideDirection} (${tideNext})
- **Swell:**
  - Primary: ${primarySwell}
  - Secondary: ${secondarySwell}
- **Wind:** ${wind.speed} mph ${wind.cardinal} (${wind.direction}°) — ${wind.description}
- **Best Window:** ${bestWindow}
- **Confidence:** ${confidence}

**Notes:** ${notes || "Standard morning conditions"}`;
  }
}

// Export singleton instance for convenience
export const intelFormatter = new IntelFormatter();

// Export individual functions for backward compatibility
export const getWaveHeightDescription = (avgHeight: number): string =>
  intelFormatter.getWaveHeightDescription(avgHeight);

export const deriveSurfRange = (forecasts: ForecastSlice["forecasts"]): SurfMetrics =>
  intelFormatter.deriveSurfRange(forecasts);

export const renderIntelMarkdown = (data: MorningIntelData): string =>
  intelFormatter.renderIntelMarkdown(data);
