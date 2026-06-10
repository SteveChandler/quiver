import type { TidePoint, TideChartProps } from "../tide-chart-recharts";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { extractMergedTideSchedule } from "@/lib/utils/tide-schedule";

// --- Internal Types --------------------------------------------------------

export type InternalPoint = TidePoint & { timestamp: number };

// --- Utility Functions -----------------------------------------------------

export const toDate = (t: TidePoint["t"]) => (t instanceof Date ? t : new Date(t));

export const defaultDayFmt = (d: Date) =>
  d.toLocaleDateString(undefined, { weekday: "short" });

const metersToFeet = (m?: number | null) =>
  typeof m === "number" && Number.isFinite(m) ? m * 3.28084 : undefined;

const parseHeight = (value?: string | null) => {
  if (!value) return undefined;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number.parseFloat(match[0]) : undefined;
};

export const parseForecastDateTime = (
  forecastDateOrAt: string,
  forecastTime?: string
): Date | undefined => {
  if (!forecastDateOrAt) return undefined;

  // New path: single forecast_at argument (ISO 8601)
  if (!forecastTime) {
    const parsed = new Date(forecastDateOrAt);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  // Legacy path: forecast_date + forecast_time
  const dateStr = forecastDateOrAt;
  const timeStr = forecastTime;
  const trimmedTime = (timeStr ?? "").trim();
  const datePart = dateStr.includes("T")
    ? dateStr.split("T")[0]?.trim() ?? dateStr.trim()
    : dateStr.trim();

  const candidates: string[] = [];

  if (trimmedTime) {
    const timeUpper = trimmedTime.toUpperCase();

    if (/^\d{1,2}:\d{2}$/.test(trimmedTime)) {
      candidates.push(`${datePart}T${trimmedTime.padStart(5, "0")}:00`);
    } else if (/^\d{1,2}:\d{2}:\d{2}$/.test(trimmedTime)) {
      candidates.push(`${datePart}T${trimmedTime}`);
    } else if (/^\d{1,2}:\d{2}\s?[AP]M$/.test(timeUpper)) {
      const [hh, mm] = timeUpper.replace(/\s+/g, "").split(/[:APM]/);
      let hours = Number.parseInt(hh ?? "0", 10) % 12;
      if (timeUpper.includes("PM")) hours += 12;
      candidates.push(
        `${datePart}T${hours.toString().padStart(2, "0")}:${mm ?? "00"}:00`
      );
    } else if (/^\d{1,2}\s?[AP]M$/.test(timeUpper)) {
      const match = /^\d{1,2}/.exec(timeUpper);
      let hours = Number.parseInt(match?.[0] ?? "0", 10) % 12;
      if (timeUpper.includes("PM")) hours += 12;
      candidates.push(`${datePart}T${hours.toString().padStart(2, "0")}:00:00`);
    }

    candidates.push(`${datePart}T${trimmedTime}`);
    candidates.push(`${datePart} ${trimmedTime}`);
  }

  candidates.push(`${dateStr}T${trimmedTime}`);
  candidates.push(`${dateStr} ${trimmedTime}`);

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  if (!/^\d{1,2}$/.test(trimmedTime)) {
    const fallback = new Date(trimmedTime);
    if (!Number.isNaN(fallback.getTime())) {
      return fallback;
    }
  }

  return undefined;
};

// --- Normalization Functions -----------------------------------------------

export const normalizeDirectData = (
  points?: TideChartProps["data"]
): InternalPoint[] => {
  if (!Array.isArray(points)) return [];
  return points
    .map((p) => {
      if (!p) return undefined;
      const dateValue = toDate((p as TidePoint).t ?? (p as any).time);
      if (Number.isNaN(dateValue.getTime())) return undefined;
      const height = (p as TidePoint).h ?? (p as any).height;
      if (!Number.isFinite(height)) return undefined;
      const legacyType = (p as any)?.type as string | undefined;
      const normalized: InternalPoint = {
        t: dateValue,
        h: Number(height),
        isHigh:
          (p as TidePoint).isHigh ??
          (typeof legacyType === "string" &&
            legacyType.toLowerCase() === "high"),
        isLow:
          (p as TidePoint).isLow ??
          (typeof legacyType === "string" &&
            legacyType.toLowerCase() === "low"),
        timestamp: dateValue.getTime(),
      };
      return normalized;
    })
    .filter(Boolean) as InternalPoint[];
};

export const normalizeHourly = (
  hourly?: TideChartProps["hourly"]
): InternalPoint[] => {
  if (!Array.isArray(hourly)) return [];
  return hourly
    .map((h) => {
      if (!h || !h.ts) return undefined;
      const ts = new Date(h.ts);
      if (Number.isNaN(ts.getTime())) return undefined;
      const heightFt = h.height_ft ?? metersToFeet(h.height_m ?? undefined);
      if (!Number.isFinite(heightFt)) return undefined;
      return {
        t: ts,
        h: Number(heightFt),
        timestamp: ts.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

export const normalizeEvents = (
  events?: TideChartProps["events"]
): InternalPoint[] => {
  if (!Array.isArray(events)) return [];
  return events
    .map((event) => {
      if (!event || !event.ts) return undefined;
      const ts = new Date(event.ts);
      if (Number.isNaN(ts.getTime())) return undefined;
      const heightFt =
        event.height_ft ?? metersToFeet(event.height_m ?? undefined);
      if (!Number.isFinite(heightFt)) return undefined;
      const isHigh = event.type === "HIGH";
      return {
        t: ts,
        h: Number(heightFt),
        isHigh,
        isLow: !isHigh,
        timestamp: ts.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

/**
 * Extract tide extrema from raw_forecast.tide_schedule
 * This is the authoritative source - same data used by "Next Tides" cards
 */
export const normalizeTideSchedule = (
  forecasts?: EnhancedForecastEntity[]
): InternalPoint[] => {
  return extractMergedTideSchedule(forecasts).map((tide) => ({
    t: new Date(tide.time * 1000),
    h: tide.height,
    isHigh: tide.type === "high",
    isLow: tide.type === "low",
    timestamp: tide.time * 1000,
  }));
};

export const normalizeForecasts = (
  forecasts?: EnhancedForecastEntity[]
): InternalPoint[] => {
  if (!Array.isArray(forecasts)) return [];
  return forecasts
    .map((forecast) => {
      // Prefer forecast_at (UTC timestamptz), fall back to legacy fields
      const date = forecast.forecast_at
        ? new Date(forecast.forecast_at)
        : forecast.forecast_date && forecast.forecast_time
          ? (parseForecastDateTime(forecast.forecast_date, forecast.forecast_time) ??
            new Date(`${forecast.forecast_date}T${forecast.forecast_time}`))
          : undefined;
      if (!date) return undefined;
      if (Number.isNaN(date.getTime())) return undefined;
      const heightFt =
        parseHeight(forecast.tide_height) ??
        parseHeight(forecast.next_tide_height);
      if (!Number.isFinite(heightFt)) return undefined;
      const type = forecast.tide_status ?? forecast.next_tide_type ?? "";
      const isHigh = typeof type === "string" && /high/i.test(type);
      const isLow = typeof type === "string" && /low/i.test(type);
      return {
        t: date,
        h: Number(heightFt),
        isHigh,
        isLow,
        timestamp: date.getTime(),
      } satisfies InternalPoint;
    })
    .filter(Boolean) as InternalPoint[];
};

export const sortAndUnique = (points: InternalPoint[]): InternalPoint[] => {
  const byTs = new Map<number, InternalPoint>();
  for (const point of points) {
    if (!point) continue;
    const existing = byTs.get(point.timestamp);
    if (!existing) {
      byTs.set(point.timestamp, point);
    } else {
      byTs.set(point.timestamp, {
        ...existing,
        ...point,
        isHigh: existing.isHigh || point.isHigh,
        isLow: existing.isLow || point.isLow,
      });
    }
  }
  return Array.from(byTs.values()).sort((a, b) => a.timestamp - b.timestamp);
};

export const isExtremaOnly = (points: InternalPoint[]): boolean => {
  if (points.length < 2) return false;
  return points.every((p) => p.isHigh === true || p.isLow === true);
};

export const synthesizeFromExtrema = (extrema: InternalPoint[]): InternalPoint[] => {
  if (extrema.length < 2) return extrema;
  const sorted = sortAndUnique(extrema);
  const result: InternalPoint[] = [];
  const step = 60 * 60 * 1000; // 1 hour granularity for smoothing

  for (let i = 0; i < sorted.length - 1; i++) {
    const current = sorted[i];
    const next = sorted[i + 1];
    const dt = next.timestamp - current.timestamp;
    if (dt <= 0) continue;
    for (let t = current.timestamp; t < next.timestamp; t += step) {
      const u = (t - current.timestamp) / dt;
      const h =
        current.h + ((next.h - current.h) * (1 - Math.cos(Math.PI * u))) / 2;
      result.push({
        t,
        h,
        timestamp: t,
        isHigh: u === 0 ? current.isHigh : undefined,
        isLow: u === 0 ? current.isLow : undefined,
      });
    }
  }
  // include final point explicitly
  result.push(sorted[sorted.length - 1]);
  return sortAndUnique(result);
};

export const annotateWithExtrema = (
  data: InternalPoint[],
  extrema: InternalPoint[]
): InternalPoint[] => {
  if (!extrema.length || !data.length) return data;

  const emphasisLookup = new Map<
    number,
    { isHigh?: boolean; isLow?: boolean }
  >();
  extrema.forEach((point) => {
    emphasisLookup.set(point.timestamp, {
      isHigh: point.isHigh,
      isLow: point.isLow,
    });
  });

  return data.map((point) => {
    const emphasis = emphasisLookup.get(point.timestamp);
    if (!emphasis) return point;
    return { ...point, ...emphasis };
  });
};
