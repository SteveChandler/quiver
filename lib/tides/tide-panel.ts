/**
 * Web port of the native tide panel maths (quiver-native src/lib/tide-drilldown.ts
 * and src/lib/chart-paths.ts), so the web tide chart draws and labels the same
 * curve the app does. Keep the two in step.
 */

const HOUR_MS = 3_600_000;

export interface TidePanelPoint {
  timestamp: number;
  heightFt: number;
}

interface TidePanelTick {
  timestamp: number;
  label: string;
}

interface ChartPathPoint {
  x: number;
  y: number;
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(2)).toString();
}

function monotoneCurve(points: ChartPathPoint[]): { sorted: ChartPathPoint[]; tangents: number[] } {
  const sorted = points
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    .sort((left, right) => left.x - right.x)
    .reduce<ChartPathPoint[]>((result, point) => {
      const previous = result[result.length - 1];
      if (previous?.x === point.x) {
        result[result.length - 1] = point;
        return result;
      }
      result.push(point);
      return result;
    }, []);
  if (sorted.length < 2) return { sorted, tangents: sorted.map(() => 0) };

  const slopes = sorted.slice(0, -1).map((point, index) => {
    const next = sorted[index + 1];
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = sorted.map((_, index) => {
    if (index === 0) return slopes[0];
    if (index === sorted.length - 1) return slopes[slopes.length - 1];
    const before = slopes[index - 1];
    const after = slopes[index];
    if (before === 0 || after === 0 || Math.sign(before) !== Math.sign(after)) return 0;
    return (2 * before * after) / (before + after);
  });

  slopes.forEach((slope, index) => {
    if (slope === 0) {
      tangents[index] = 0;
      tangents[index + 1] = 0;
      return;
    }
    const leftRatio = tangents[index] / slope;
    const rightRatio = tangents[index + 1] / slope;
    const magnitude = Math.hypot(leftRatio, rightRatio);
    if (magnitude <= 3) return;
    const scale = 3 / magnitude;
    tangents[index] = scale * leftRatio * slope;
    tangents[index + 1] = scale * rightRatio * slope;
  });
  return { sorted, tangents };
}

/** Monotone cubic path: smoothing never invents a higher high or a lower low. */
export function buildMonotoneCurvePath(points: ChartPathPoint[]): string {
  const { sorted, tangents } = monotoneCurve(points);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return `M${formatCoordinate(sorted[0].x)},${formatCoordinate(sorted[0].y)}`;

  const commands = sorted.slice(0, -1).map((point, index) => {
    const next = sorted[index + 1];
    const deltaX = next.x - point.x;
    const c1 = { x: point.x + deltaX / 3, y: point.y + (tangents[index] * deltaX) / 3 };
    const c2 = { x: next.x - deltaX / 3, y: next.y - (tangents[index + 1] * deltaX) / 3 };
    return `C ${formatCoordinate(c1.x)},${formatCoordinate(c1.y)} ${formatCoordinate(c2.x)},${formatCoordinate(c2.y)} ${formatCoordinate(next.x)},${formatCoordinate(next.y)}`;
  });
  return [`M${formatCoordinate(sorted[0].x)},${formatCoordinate(sorted[0].y)}`, ...commands].join(" ");
}

/** Height the drawn monotone curve passes through at `timestamp`, or null outside the points. */
export function tideHeightOnCurve(points: TidePanelPoint[], timestamp: number): number | null {
  const { sorted, tangents } = monotoneCurve(points.map((p) => ({ x: p.timestamp, y: p.heightFt })));
  if (sorted.length === 0 || timestamp < sorted[0].x || timestamp > sorted[sorted.length - 1].x) return null;
  if (sorted.length === 1) return sorted[0].y;
  const index = sorted.findIndex((_, i) => i + 1 < sorted.length && timestamp <= sorted[i + 1].x);
  const from = sorted[index];
  const to = sorted[index + 1];
  const width = to.x - from.x;
  const t = (timestamp - from.x) / width;
  const t2 = t * t;
  const t3 = t2 * t;
  return (
    (2 * t3 - 3 * t2 + 1) * from.y +
    (t3 - 2 * t2 + t) * width * tangents[index] +
    (-2 * t3 + 3 * t2) * to.y +
    (t3 - t2) * width * tangents[index + 1]
  );
}

/** Native `tideYDomain`: always includes 0, pads by max(0.5 ft, 15%), rounds out to half feet. */
export function tideYDomain(points: TidePanelPoint[]): [number, number] {
  if (points.length === 0) return [-1, 1];
  const values = points.map((point) => point.heightFt);
  values.push(0);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = Math.max(0.5, (max - min) * 0.15);
  return [Math.floor((min - pad) * 2) / 2, Math.ceil((max + pad) * 2) / 2];
}

/** "2PM", like native `formatForecastHourClockInZone`. */
function formatTideHourLabel(timestamp: number, timeZone: string): string {
  return new Date(timestamp).toLocaleTimeString("en-US", { hour: "numeric", timeZone }).replace(/\s/g, "");
}

function weekdayLabel(timestamp: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone }).format(new Date(timestamp)).toUpperCase();
}

/** Native `buildTideChartXTicks`: hour labels up to 36 h, then one weekday label per day shown 6 h or more. */
export function buildTideChartXTicks(
  chartStart: number,
  chartEnd: number,
  timeZone: string,
  tickCount = 7
): TidePanelTick[] {
  const span = chartEnd - chartStart;
  if (span > 36 * HOUR_MS) {
    const segments: { label: string; start: number; end: number }[] = [];
    for (let at = chartStart; at <= chartEnd; at += HOUR_MS) {
      const label = weekdayLabel(at, timeZone);
      const last = segments[segments.length - 1];
      const end = Math.min(at + HOUR_MS, chartEnd);
      if (last?.label === label) last.end = end;
      else segments.push({ label, start: at, end });
    }
    const days = segments.filter((segment) => segment.end - segment.start >= 6 * HOUR_MS);
    const step = Math.max(1, Math.ceil(days.length / Math.max(1, tickCount)));
    return days
      .filter((_, index) => index % step === 0)
      .map((segment) => ({ timestamp: segment.start + (segment.end - segment.start) / 2, label: segment.label }));
  }
  const count = Math.max(2, tickCount);
  return Array.from({ length: count }, (_, index) => {
    const timestamp = chartStart + (span * index) / (count - 1);
    return { timestamp, label: formatTideHourLabel(timestamp, timeZone) };
  });
}

export function formatPanelTideHeight(heightFt: number): string {
  const rounded = Number(heightFt.toFixed(1));
  return `${(Object.is(rounded, -0) ? 0 : rounded).toFixed(1)} ft`;
}
