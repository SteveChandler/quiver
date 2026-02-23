/**
 * Utility functions for optimal surf time analysis
 *
 * These functions are extracted from the route handler to be testable
 * and reusable across the application.
 */

import { confidenceToDecimal, decimalToConfidence } from "@/lib/services/forecast/confidence-scorer";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";
import type { EnhancedForecastEntity } from "@/types/forecast";

/**
 * Extended forecast entity with additional computed/aliased fields
 * that session planner database views and RPC functions provide
 * beyond the base EnhancedForecastEntity columns.
 */
type SessionPlannerForecast = EnhancedForecastEntity & {
  tide_type?: string | null;
  swell_period?: string | number | null;
};

type ForecastWithHour = SessionPlannerForecast & { __hour?: number | null; __interpolated?: boolean };

export interface OptimalTimeSlot {
  // Center time of the block for backwards compatibility with previous UI
  time: string;
  // Optional start/end for block display (e.g., 2-hour window)
  startTime?: string;
  endTime?: string;
  score: number;
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
    tideHeight?: number | null;
    tideType?: string | null;
    swellPeriod?: number | null;
  };
  rating: "poor" | "fair" | "good" | "excellent";
  reasons: string[];
}

/**
 * Converts time string to hour (0-23)
 */
export function parseTimeToHour(timeStr: string): number | null {
  try {
    if (!timeStr) return null;

    // 1) ISO-like: contains 'T' → use Date parsing
    if (timeStr.includes("T")) {
      const d = new Date(timeStr);
      if (!isNaN(d.getTime())) {
        return d.getHours() + d.getMinutes() / 60;
      }
    }

    // 2) HH:MM:SS (24h)
    const hms = timeStr.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (hms) {
      const hour = parseInt(hms[1], 10);
      const minute = parseInt(hms[2], 10);
      return (hour % 24) + minute / 60;
    }

    // 3) HH:MM AM/PM
    const ampmMatch = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (ampmMatch) {
      let hour = parseInt(ampmMatch[1], 10);
      const minute = parseInt(ampmMatch[2], 10);
      const ampm = ampmMatch[3].toUpperCase();
      if (ampm === "PM" && hour !== 12) hour += 12;
      if (ampm === "AM" && hour === 12) hour = 0;
      return hour + minute / 60;
    }

    return null;
  } catch (error) {
    console.error("Error parsing time:", error);
    return null;
  }
}

/**
 * Convert hour float to HH:MM string
 */
function toTimeString(hourFloat: number): string {
  const h = Math.floor(hourFloat) % 24;
  const m = Math.round((hourFloat - Math.floor(hourFloat)) * 60);
  const hh = String((h + 24) % 24).padStart(2, "0");
  const mm = String(m % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Filters forecasts to within N hours of the selected time
 */
export function filterByTimeWindow(
  forecasts: SessionPlannerForecast[],
  selectedTime: string,
  windowHours: number
): SessionPlannerForecast[] {
  try {
    const selectedHour = parseTimeToHour(selectedTime);
    if (selectedHour === null) return forecasts;

    return forecasts.filter((forecast) => {
      const forecastHour = parseTimeToHour(forecast.forecast_time);
      if (forecastHour === null) return false;

      let timeDiff = Math.abs(forecastHour - selectedHour);
      if (timeDiff > 12) {
        timeDiff = 24 - timeDiff;
      }

      return timeDiff <= windowHours;
    });
  } catch (error) {
    console.error("Error filtering by time window:", error);
    return forecasts;
  }
}

/**
 * Scores a single forecast row and returns an OptimalTimeSlot-compatible object
 */
export function scoreForecast(forecast: SessionPlannerForecast, currentTimeHour?: number | null): OptimalTimeSlot {
  const waveHeight = parseFloat(forecast.wave_height ?? "") || 0;
  if (forecast.wave_height == null) trackFallback({ domain: 'session-planner', field: 'wave_height', fallbackValue: 0 });
  const windSpeed =
    parseFloat(String(forecast.wind_speed)?.replace(/[^\d.]/g, "")) || 0;
  const windDirectionLabel: string = forecast.wind_direction || "Variable";
  const windDirection = windDirectionLabel.toLowerCase();
  const tideHeight: number | null =
    forecast.tide_height != null ? Number(forecast.tide_height) : null;
  const tideType: string | null = forecast.tide_type || null;
  const swellPeriod: number | null =
    forecast.swell_period != null ? Number(forecast.swell_period) : null;
  const weatherCondition = forecast.weather_condition || "Unknown";

  // Use centralized scale conversion (confidence_score is 0-100, we need 0-1 for scoring)
  const confidence = confidenceToDecimal(forecast.confidence_score ?? 50);

  let score = 0;
  const reasons: string[] = [];

  // Wave height scoring (2-6 feet ideal) - Max 30
  if (waveHeight >= 2 && waveHeight <= 6) {
    score += 30;
    reasons.push(`Good wave height (${waveHeight}ft)`);
  } else if (waveHeight >= 1 && waveHeight < 2) {
    score += 18;
    reasons.push(`Small waves (${waveHeight}ft)`);
  } else if (waveHeight > 6 && waveHeight <= 8) {
    score += 22;
    reasons.push(`Large waves (${waveHeight}ft)`);
  } else if (waveHeight > 8) {
    score += 10;
    reasons.push(`Very large waves (${waveHeight}ft)`);
  }

  // Swell period scoring (10–16s best) - Max 15
  if (swellPeriod != null) {
    if (swellPeriod >= 10 && swellPeriod <= 16) {
      score += 15;
      reasons.push(`Good period (${swellPeriod}s)`);
    } else if (swellPeriod >= 8 && swellPeriod < 10) {
      score += 10;
      reasons.push(`Decent period (${swellPeriod}s)`);
    } else if (swellPeriod >= 6 && swellPeriod < 8) {
      score += 5;
      reasons.push(`Short period (${swellPeriod}s)`);
    }
  }

  // Wind speed scoring (lighter better) - Max 20
  if (windSpeed <= 5) {
    score += 20;
    reasons.push(`Light winds (${windSpeed}mph)`);
  } else if (windSpeed <= 10) {
    score += 12;
    reasons.push(`Moderate winds (${windSpeed}mph)`);
  } else if (windSpeed <= 15) {
    score += 5;
    reasons.push(`Breezy (${windSpeed}mph)`);
  } else {
    reasons.push(`Strong winds (${windSpeed}mph)`);
  }

  // Wind direction scoring (offshore best) - Max 15
  if (
    windDirection.includes("e") ||
    windDirection.includes("ne") ||
    windDirection.includes("se")
  ) {
    score += 15;
    reasons.push(`Offshore winds (${windDirectionLabel})`);
  } else if (windDirection.includes("n") || windDirection.includes("s")) {
    score += 7;
    reasons.push(`Cross-shore winds (${windDirectionLabel})`);
  } else {
    reasons.push(`Onshore winds (${windDirectionLabel})`);
  }

  // Tide scoring
  if (tideHeight != null) {
    if (tideHeight >= 1.5 && tideHeight <= 3.5) {
      score += 8;
      reasons.push("Mid tide in sweet spot");
    } else if (tideHeight > 4 && tideHeight <= 6) {
      score += 4;
      reasons.push(`Higher tide (${tideHeight}ft)`);
    } else if (tideHeight < 1) {
      score += 3;
      reasons.push(`Lower tide (${tideHeight}ft)`);
    }
  }
  if (tideType) {
    const tt = tideType.toLowerCase();
    if (tt.includes("rising") || tt.includes("flood")) {
      score += 4;
      reasons.push("Rising tide");
    } else if (tt.includes("falling") || tt.includes("ebb")) {
      reasons.push("Falling tide");
    }
  }

  // Confidence - Max 10
  score += Math.min(confidence * 10, 10);
  if (confidence >= 0.8) reasons.push("High forecast confidence");
  else if (confidence >= 0.6) reasons.push("Good forecast confidence");
  else reasons.push("Lower forecast confidence");

  // Determine wave quality descriptor
  let waveQuality = "Poor";
  if (waveHeight >= 3 && waveHeight <= 5 && windSpeed <= 8)
    waveQuality = "Excellent";
  else if (waveHeight >= 2 && waveHeight <= 6 && windSpeed <= 12)
    waveQuality = "Good";
  else if (waveHeight >= 1 && waveHeight <= 8 && windSpeed <= 18)
    waveQuality = "Fair";

  // Overall rating buckets
  let rating: "poor" | "fair" | "good" | "excellent" = "poor";
  if (score >= 70) rating = "excellent";
  else if (score >= 55) rating = "good";
  else if (score >= 40) rating = "fair";

  // Add contextual reasoning for same-day sessions
  if (currentTimeHour !== null && currentTimeHour !== undefined) {
    const forecastHour = parseTimeToHour(forecast.forecast_time);
    if (forecastHour !== null) {
      const timeDiff = forecastHour - currentTimeHour;
      if (timeDiff > 0 && timeDiff <= 2) {
        reasons.unshift(`Coming up soon (${Math.round(timeDiff * 60)}min away)`);
      } else if (timeDiff > 2 && timeDiff <= 4) {
        reasons.unshift(`Perfect timing for session prep`);
      } else if (timeDiff > 4) {
        reasons.unshift(`Allows time for travel and preparation`);
      }
    }
  }

  const finalScore = Math.min(Math.round(score), 100);

  return {
    time: forecast.forecast_time,
    score: finalScore,
    conditions: {
      waveHeight,
      waveQuality,
      windSpeed,
      windDirection: windDirectionLabel,
      confidence: decimalToConfidence(confidence),
      weatherCondition,
      tideHeight,
      tideType,
      swellPeriod,
    },
    rating,
    reasons,
  };
}

/**
 * Build rolling 2-hour blocks, averaging scores/conditions
 */
export function buildTwoHourBlocks(
  scored: OptimalTimeSlot[]
): OptimalTimeSlot[] {
  if (scored.length === 0) return [];

  const sorted = [...scored].sort((a, b) => {
    const ah = parseTimeToHour(a.time) ?? 0;
    const bh = parseTimeToHour(b.time) ?? 0;
    return ah - bh;
  });

  const blocks: OptimalTimeSlot[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const start = sorted[i];
    const startHour = parseTimeToHour(start.time);
    if (startHour == null) continue;

    const windowPoints: OptimalTimeSlot[] = [start];
    for (let j = i + 1; j < sorted.length; j++) {
      const h = parseTimeToHour(sorted[j].time);
      if (h == null) continue;
      let diff = Math.abs(h - startHour);
      if (diff > 12) diff = 24 - diff;
      if (diff <= 2) windowPoints.push(sorted[j]);
    }

    const avg = (arr: number[]) =>
      arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    const avgScore = Math.round(avg(windowPoints.map((p) => p.score)));
    const avgWave = Number(
      avg(windowPoints.map((p) => p.conditions.waveHeight)).toFixed(1)
    );
    const avgWind = Number(
      avg(windowPoints.map((p) => p.conditions.windSpeed)).toFixed(1)
    );
    const avgConf = Math.round(
      avg(windowPoints.map((p) => p.conditions.confidence))
    );
    const avgTide = windowPoints.some((p) => p.conditions.tideHeight != null)
      ? Number(
          avg(
            windowPoints.map((p) =>
              p.conditions.tideHeight == null ? 0 : p.conditions.tideHeight
            )
          ).toFixed(1)
        )
      : null;
    const avgPeriod = windowPoints.some((p) => p.conditions.swellPeriod != null)
      ? Number(
          avg(
            windowPoints.map((p) =>
              p.conditions.swellPeriod == null ? 0 : p.conditions.swellPeriod
            )
          ).toFixed(1)
        )
      : null;

    const windDir =
      windowPoints.find(
        (p) =>
          p.conditions.windDirection &&
          p.conditions.windDirection !== "Variable"
      )?.conditions.windDirection || start.conditions.windDirection;

    let rating: "poor" | "fair" | "good" | "excellent" = "poor";
    if (avgScore >= 70) rating = "excellent";
    else if (avgScore >= 55) rating = "good";
    else if (avgScore >= 40) rating = "fair";

    const startTime = start.time;
    const endTime = windowPoints[windowPoints.length - 1].time;

    const centerHour = (() => {
      const sh = parseTimeToHour(startTime) ?? 0;
      const eh = parseTimeToHour(endTime) ?? sh;
      let diff = eh - sh;
      if (diff < 0) diff += 24;
      const mid = sh + diff / 2;
      return toTimeString(mid);
    })();

    blocks.push({
      time: centerHour,
      startTime,
      endTime,
      score: avgScore,
      conditions: {
        waveHeight: avgWave,
        waveQuality: start.conditions.waveQuality,
        windSpeed: avgWind,
        windDirection: windDir,
        confidence: avgConf,
        weatherCondition: start.conditions.weatherCondition,
        tideHeight: avgTide,
        tideType: start.conditions.tideType ?? null,
        swellPeriod: avgPeriod,
      },
      rating,
      reasons: ["Averaged conditions across ~2h window"],
    });
  }

  const unique = new Map<string, OptimalTimeSlot>();
  for (const b of blocks) {
    const key = `${b.startTime}-${b.endTime}`;
    if (!unique.has(key) || unique.get(key)!.score < b.score)
      unique.set(key, b);
  }
  return Array.from(unique.values());
}

/**
 * Analyzes forecast data to determine optimal surf times
 */
export function analyzeOptimalTimes(
  forecasts: SessionPlannerForecast[],
  selectedTime?: string | null,
  currentTimeHour?: number | null
): OptimalTimeSlot[] {
  let filteredForecasts = forecasts;
  if (selectedTime) {
    filteredForecasts = filterByTimeWindow(forecasts, selectedTime, 2);
    if (filteredForecasts.length < 2) {
      filteredForecasts = filterByTimeWindow(forecasts, selectedTime, 4);
    }

    if (filteredForecasts.length < 2) {
      const synthetic = generateAnchoredInterpolatedPoints(
        forecasts,
        selectedTime
      );
      if (synthetic.length > 0) {
        filteredForecasts = synthetic;
      }
    }
  }

  if (currentTimeHour !== null && currentTimeHour !== undefined) {
    filteredForecasts = filteredForecasts.filter((forecast) => {
      const forecastHour = parseTimeToHour(forecast.forecast_time);
      if (forecastHour === null) return false;
      const minFutureTime = currentTimeHour + 0.25;
      return forecastHour >= minFutureTime;
    });
  }

  const scored = filteredForecasts.map((f) => scoreForecast(f, currentTimeHour));

  if (!selectedTime) {
    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((s) => ({ ...s }));
  }

  const blocks = buildTwoHourBlocks(scored);

  const center = parseTimeToHour(selectedTime);
  let clamped = blocks;
  if (center != null) {
    clamped = blocks.filter((b) => {
      const h = parseTimeToHour(b.time);
      if (h == null) return false;
      let diff = Math.abs(h - center);
      if (diff > 12) diff = 24 - diff;
      return diff <= 2.1;
    });
  }

  const candidates = clamped.length > 0 ? clamped : blocks;

  const finalBlocks = candidates
    .sort((a, b) => {
      if (currentTimeHour !== null && currentTimeHour !== undefined) {
        const aTime = parseTimeToHour(a.time) || 0;
        const bTime = parseTimeToHour(b.time) || 0;

        const aProximity = Math.max(0, 120 - Math.abs(aTime - currentTimeHour) * 20);
        const bProximity = Math.max(0, 120 - Math.abs(bTime - currentTimeHour) * 20);

        const aWeighted = a.score * 0.7 + aProximity * 0.3;
        const bWeighted = b.score * 0.7 + bProximity * 0.3;

        return bWeighted - aWeighted;
      }

      return b.score - a.score;
    })
    .slice(0, 4);
  return finalBlocks;
}

/**
 * Generate synthetic 1-hour step points in ±2h window around selectedTime,
 * by interpolating between surrounding real forecast rows.
 */
function generateAnchoredInterpolatedPoints(
  forecasts: SessionPlannerForecast[],
  selectedTime: string
): ForecastWithHour[] {
  const target = parseTimeToHour(selectedTime);
  if (target == null) return [];

  const rows = forecasts
    .map((f) => ({ ...f, __hour: parseTimeToHour(f.forecast_time) }))
    .filter((f) => f.__hour != null)
    .sort((a, b) => a.__hour! - b.__hour!);
  if (rows.length === 0) return [];

  const points: ForecastWithHour[] = [];
  const wantedHours = [target - 2, target - 1, target, target + 1, target + 2];

  for (const h of wantedHours) {
    const modH = ((h % 24) + 24) % 24;

    const exact = rows.find(
      (r) => Math.abs((r.__hour as number) - modH) < 0.25
    );
    if (exact) {
      points.push(exact);
      continue;
    }

    const before = [...rows]
      .reverse()
      .find((r) => (r.__hour as number) <= modH);
    const after = rows.find((r) => (r.__hour as number) >= modH);

    if (before && after && before !== after) {
      points.push(interpolateForecastRow(before, after, modH));
      continue;
    }

    const nearest = rows.reduce((best: ForecastWithHour | null, r) => {
      if (!best) return r;
      return Math.abs((r.__hour as number) - modH) <
        Math.abs((best.__hour as number) - modH)
        ? r
        : best;
    }, null as ForecastWithHour | null);
    if (nearest) {
      points.push({
        ...nearest,
        forecast_time: toTimeString(modH) + ":00",
        __interpolated: true,
      });
    }
  }

  return points;
}

function interpolateForecastRow(
  before: ForecastWithHour,
  after: ForecastWithHour,
  targetHour: number
): ForecastWithHour {
  const t0 = before.__hour as number;
  const t1 = after.__hour as number;
  const alpha =
    t1 === t0 ? 0 : Math.min(Math.max((targetHour - t0) / (t1 - t0), 0), 1);

  const lerp = (a: number, b: number) => a + (b - a) * alpha;
  const num = (v: string | number | null | undefined) => {
    const n = parseFloat(String(v).replace(/[^\d.\-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const waveHeight = lerp(num(before.wave_height), num(after.wave_height));
  const windSpeed = lerp(num(before.wind_speed), num(after.wind_speed));
  const confidence = lerp(
    num(before.confidence_score),
    num(after.confidence_score)
  );
  const tideHeight = lerp(num(before.tide_height), num(after.tide_height));
  const swellPeriod = lerp(num(before.swell_period), num(after.swell_period));

  const closer =
    Math.abs(targetHour - t0) <= Math.abs(t1 - targetHour) ? before : after;
  const tideType = (() => {
    if (before.tide_height != null && after.tide_height != null) {
      return num(after.tide_height) > num(before.tide_height)
        ? "rising"
        : "falling";
    }
    return closer.tide_type ?? null;
  })();

  return {
    ...closer,
    forecast_time: toTimeString(targetHour) + ":00",
    wave_height: waveHeight.toFixed(1),
    wind_speed: `${Math.round(windSpeed)} mph`,
    confidence_score: confidence,
    tide_height: Number.isFinite(tideHeight)
      ? tideHeight.toFixed(1)
      : null,
    tide_type: tideType,
    swell_period: Number.isFinite(swellPeriod)
      ? Number(swellPeriod.toFixed(1))
      : null,
    __interpolated: true,
  };
}

/**
 * Build simple synthetic 2-hour blocks around a selected time when no data is available.
 */
export function buildSyntheticBlocks(selectedTime: string, currentTimeHour?: number | null): OptimalTimeSlot[] {
  const center = parseTimeToHour(selectedTime) ?? 12;

  let adjustedCenter = center;
  let reasons = ["No live forecast available; showing time centered around your selection"];

  if (currentTimeHour !== null && currentTimeHour !== undefined) {
    const minFutureTime = currentTimeHour + 0.25;
    if (center < minFutureTime) {
      adjustedCenter = minFutureTime;
      const minutesAway = Math.round((adjustedCenter - currentTimeHour) * 60);
      reasons = [`Adjusted to next available time (${minutesAway}min from now)`, "No live forecast data available"];
    } else {
      const minutesAway = Math.round((center - currentTimeHour) * 60);
      if (minutesAway < 120) {
        reasons = [`Coming up in ${minutesAway}min`, "No live forecast data available"];
      }
    }
  }

  const start = toTimeString(adjustedCenter - 1);
  const end = toTimeString(adjustedCenter + 1);

  return [
    {
      time: toTimeString(adjustedCenter),
      startTime: start,
      endTime: end,
      score: 50,
      conditions: {
        waveHeight: 0,
        waveQuality: "Fair",
        windSpeed: 0,
        windDirection: "Variable",
        confidence: 0,
        weatherCondition: "Unknown",
        tideHeight: null,
        tideType: null,
        swellPeriod: null,
      },
      rating: "fair",
      reasons,
    },
  ];
}
