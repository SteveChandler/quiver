import { compassToDegrees } from "@/lib/domains/conditions/map-forecast";
import type { PublicForecastHour } from "@/lib/services/spot-surf-report-service";

export interface HourlyChartPoint {
  at: string;
  heightFt: number | null;
  tideFt: number | null;
  windFromDeg: number | null;
  inBestWindow: boolean;
}

export interface HourlyChart {
  points: HourlyChartPoint[];
  maxHeightFt: number;
  tideRange: [number, number] | null;
  bestWindow?: { start: string; end: string } | null;
}

/** "2-3 ft" charts as 3: a bar shows how big it gets. */
function topOfRange(value: string | null | undefined): number | null {
  const numbers = (value?.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
  return numbers.length > 0 ? Math.max(...numbers) : null;
}

function direction(value: string | null | undefined): number | null {
  if (!value) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return numeric;
  return compassToDegrees(value);
}

function tide(value: string | null | undefined): number | null {
  const parsed = value == null ? NaN : parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildHourlyChart(
  hours: PublicForecastHour[],
  best: { start: string | null; end: string | null },
): HourlyChart {
  const start = best.start ? Date.parse(best.start) : NaN;
  const end = best.end ? Date.parse(best.end) : NaN;
  const points = [...hours]
    .sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at))
    .map((hour) => {
      const at = Date.parse(hour.forecast_at);
      return {
        at: hour.forecast_at,
        heightFt: topOfRange(hour.wave_height),
        tideFt: tide(hour.tide_height),
        windFromDeg: direction(hour.wind_direction),
        inBestWindow: Number.isFinite(start) && Number.isFinite(end) && at >= start && at < end,
      };
    });
  const heights = points.map((p) => p.heightFt).filter((h): h is number => h != null);
  const tides = points.map((p) => p.tideFt).filter((t): t is number => t != null);
  return {
    points,
    bestWindow: points.some((point) => point.inBestWindow) && best.start && best.end
      ? { start: best.start, end: best.end } : null,
    maxHeightFt: heights.length > 0 ? Math.max(...heights) : 0,
    tideRange: tides.length > 0 ? [Math.min(...tides), Math.max(...tides)] : null,
  };
}
