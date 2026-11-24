/**
 * Y-axis ticks for tide charts. Same rule as quiver-native `tideYTicks` /
 * `formatTideAxisValue` (src/lib/tide-drilldown.ts), so web and native label
 * the same heights on the same lines.
 */
const TIDE_TICK_STEPS = [0.5, 1, 2, 5] as const;
const MAX_TICKS = 5;

function normaliseZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

/** Multiples of the smallest step that gives at most five ticks inside the domain. */
export function tideYTicks(domain: [number, number]): number[] {
  const [min, max] = domain;
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];
  for (const step of TIDE_TICK_STEPS) {
    const first = Math.ceil(min / step);
    const last = Math.floor(max / step);
    if (last - first + 1 > MAX_TICKS && step !== TIDE_TICK_STEPS[TIDE_TICK_STEPS.length - 1]) continue;
    const ticks: number[] = [];
    for (let i = first; i <= last; i += 1) ticks.push(normaliseZero(Number((i * step).toFixed(2))));
    return ticks;
  }
  return [];
}

/** "2", "0.5", never "-0". */
export function formatTideAxisValue(value: number): string {
  const v = normaliseZero(Number(value.toFixed(1)));
  return Number.isInteger(v) ? v.toFixed(0) : v.toFixed(1);
}
