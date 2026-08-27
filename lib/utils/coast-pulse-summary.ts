/**
 * Shared summary computation for Coast Pulse.
 * Used by both the main coast-pulse API and the lightweight summary endpoint.
 */

import { TIME } from "@/lib/constants/coast-pulse";

export interface CoastPulseSummaryItem {
  source: {
    type: string;
    credibility: number;
  };
  message: string;
  timestamp: Date | string;
  trend?: "up" | "down" | "stable";
  windSpeedMph?: number | null;
  windDirection?: string | null;
  windObservedAt?: string | null;
  windSource?: string | null;
}

export interface CoastPulseSummary {
  waveHeight: string | null;
  heightType: "offshore" | "breaking" | "forecast" | null;
  windSpeed: string | null;
  tideHeight: string | null;
  waterTemp: string | null;
  trend: "improving" | "stable" | "declining" | null;
  confidence: number;
  lastUpdated: string;
}

/**
 * Calculate confidence score based on data freshness and source credibility
 */
function calculateConfidence(items: CoastPulseSummaryItem[]): number {
  if (items.length === 0) return 0;

  const now = Date.now();
  let totalScore = 0;
  let count = 0;

  for (const item of items.slice(0, 3)) {
    const ageMs = now - new Date(item.timestamp).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);

    // Freshness penalty: -10 points per hour old
    const freshnessPenalty = Math.min(50, ageHours * 10);
    const itemScore = Math.max(0, item.source.credibility - freshnessPenalty);

    totalScore += itemScore;
    count++;
  }

  return count > 0 ? Math.round(totalScore / count) : 0;
}

/**
 * Compute summary from available items
 * Priority: Recent Intel (breaking) > Forecast (estimated) > Buoy (offshore)
 */
export function computeSummary(items: CoastPulseSummaryItem[]): CoastPulseSummary {
  let waveHeight: string | null = null;
  let heightType: "offshore" | "breaking" | "forecast" | null = null;

  // Priority 1: Recent intel (user-reported breaking wave height)
  const recentIntel = items.find(
    (i) =>
      i.source.type === "intel" &&
      Date.now() - new Date(i.timestamp).getTime() < TIME.TWO_HOURS_MS
  );

  if (recentIntel) {
    const match = recentIntel.message.match(/(\d+\.?\d*(?:-\d+\.?\d*)?)(?:ft|')/i);
    if (match) {
      waveHeight = `${match[1]} ft`;
      heightType = "breaking";
    }
  }

  // Priority 2: Daily Intel or Forecast (estimated surf height)
  if (!waveHeight) {
    const dailyIntelItem = items.find((i) => i.source.type === "daily-intel");
    const forecastItem = items.find((i) => i.source.type === "forecast");
    const summaryItem = dailyIntelItem || forecastItem;

    if (summaryItem) {
      const match = summaryItem.message.match(/(\d+\.?\d*(?:-\d+\.?\d*)?)ft/);
      if (match) {
        waveHeight = `${match[1]} ft`;
        heightType = "forecast";
      }
    }
  }

  // Priority 3: Buoy data (offshore swell - CDIP > NDBC > local)
  if (!waveHeight) {
    const buoyItem =
      items.find((i) => i.source.type === "cdip") ||
      items.find((i) => i.source.type === "ndbc") ||
      items.find((i) => i.source.type === "local");
    if (buoyItem) {
      const match = buoyItem.message.match(/(\d+\.?\d*)ft/);
      if (match) {
        waveHeight = `${match[1]} ft (offshore)`;
        heightType = "offshore";
      }
    }
  }

  // The forecast item carries the latest beach-grid analysis (RTMA when
  // available). Offshore buoy wind remains a fallback only.
  const beachWind = items.find(
    (item) =>
      ["forecast", "wind"].includes(item.source.type) &&
      item.windSpeedMph != null &&
      Number.isFinite(item.windSpeedMph)
  );
  const structuredBuoyWind = items.find(
    (item) =>
      ["local", "cdip", "ndbc"].includes(item.source.type) &&
      item.windSpeedMph != null &&
      Number.isFinite(item.windSpeedMph)
  );
  const legacyBuoyWind = items.find(
    (item) => ["local", "cdip", "ndbc"].includes(item.source.type)
  );
  const legacyBuoyWindMatch = legacyBuoyWind?.message.match(/(\d+)kt\s*(\w+)?/);
  const beachWindSpeedMph = beachWind?.windSpeedMph;
  const beachWindDirection = beachWind?.windDirection;
  const buoyWindSpeedMph = structuredBuoyWind?.windSpeedMph;
  const buoyWindDirection = structuredBuoyWind?.windDirection;
  const windSpeed = beachWindSpeedMph != null
    ? `${Math.round(beachWindSpeedMph)} mph${
        beachWindDirection ? ` ${beachWindDirection}` : ""
      }`
    : buoyWindSpeedMph != null
      ? `${Math.round(buoyWindSpeedMph)} mph${
          buoyWindDirection ? ` ${buoyWindDirection}` : ""
        }`
      : legacyBuoyWindMatch
        ? `${legacyBuoyWindMatch[1]} kt${
            legacyBuoyWindMatch[2] ? ` ${legacyBuoyWindMatch[2]}` : ""
          }`
        : null;

  // Determine overall trend
  const trends = items.map((i) => i.trend).filter(Boolean);
  let overallTrend: "improving" | "stable" | "declining" | null = null;
  if (trends.includes("up")) overallTrend = "improving";
  else if (trends.includes("down")) overallTrend = "declining";
  else if (trends.length > 0) overallTrend = "stable";

  // Calculate confidence based on data freshness
  const confidence = calculateConfidence(items);

  // Extract tide height from tide item
  const tideItem = items.find((i) => i.source.type === "tide");
  let tideHeight: string | null = null;
  if (tideItem) {
    const match = tideItem.message.match(/Now:\s*(\d+\.?\d*)ft\s*(\w+)/);
    if (match) {
      tideHeight = `${match[1]}ft ${match[2]}`;
    }
  }

  // Extract water temp from NDBC item
  const ndbcItem = items.find((i) => i.source.type === "ndbc");
  let waterTemp: string | null = null;
  if (ndbcItem) {
    const match = ndbcItem.message.match(/(\d+)\u00b0F/);
    if (match) {
      waterTemp = `${match[1]}\u00b0F`;
    }
  }

  return {
    waveHeight,
    heightType,
    windSpeed,
    tideHeight,
    waterTemp,
    trend: overallTrend,
    confidence,
    lastUpdated: new Date().toISOString(),
  };
}
