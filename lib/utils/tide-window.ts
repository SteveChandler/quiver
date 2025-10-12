/**
 * Tide Chart Window Calculation Utility
 * 
 * Calculates optimal time windows for tide chart display with configurable
 * window duration and "now" marker positioning.
 */

export interface WindowBounds {
  /** Start of the visible window (Unix timestamp ms) */
  windowStart: number;
  /** End of the visible window (Unix timestamp ms) */
  windowEnd: number;
  /** Current time timestamp (Unix timestamp ms) */
  nowTs: number;
  /** Start with buffer applied (for data fetching) */
  bufferStart: number;
  /** End with buffer applied (for data fetching) */
  bufferEnd: number;
}

export interface WindowConfig {
  /** Total visible hours in the window (default: 18) */
  windowHours?: number;
  /** Position of "now" marker as fraction of window (0 = left, 1 = right, default: 1/3) */
  nowBias?: number;
  /** Buffer hours to add on each edge to prevent clipping (default: 1) */
  bufferHours?: number;
  /** Override current time for testing */
  now?: Date;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Calculates the time window bounds for a tide chart display.
 * 
 * The window is positioned such that "now" appears at a configurable position
 * (default 1/3 from the left), showing more future time than past time.
 * 
 * @param config - Window configuration options
 * @returns Window bounds with start/end times and buffer zones
 * 
 * @example
 * ```ts
 * // Show 18-hour window with "now" at 1/3 from left (6h past, 12h future)
 * const bounds = calculateTideWindow({ windowHours: 18, nowBias: 1/3 });
 * 
 * // Use bounds for data fetching (includes buffer)
 * const data = await fetchTides(bounds.bufferStart, bounds.bufferEnd);
 * 
 * // Use bounds for chart domain
 * const chartDomain = [bounds.windowStart, bounds.windowEnd];
 * ```
 */
export function calculateTideWindow(config: WindowConfig = {}): WindowBounds {
  const {
    windowHours = 18,
    nowBias = 1 / 3,
    bufferHours = 1,
    now = new Date(),
  } = config;

  // Validate inputs
  if (windowHours <= 0) {
    throw new Error('windowHours must be positive');
  }
  if (nowBias < 0 || nowBias > 1) {
    throw new Error('nowBias must be between 0 and 1');
  }
  if (bufferHours < 0) {
    throw new Error('bufferHours must be non-negative');
  }

  const nowTs = now.getTime();
  const windowMs = windowHours * HOUR_MS;
  const bufferMs = bufferHours * HOUR_MS;

  // Calculate hours before and after "now"
  const hoursBefore = windowHours * nowBias;
  const hoursAfter = windowHours * (1 - nowBias);

  // Calculate window bounds
  const windowStart = nowTs - (hoursBefore * HOUR_MS);
  const windowEnd = nowTs + (hoursAfter * HOUR_MS);

  // Calculate buffer bounds (for data fetching)
  const bufferStart = windowStart - bufferMs;
  const bufferEnd = windowEnd + bufferMs;

  return {
    windowStart,
    windowEnd,
    nowTs,
    bufferStart,
    bufferEnd,
  };
}

/**
 * Filters tide data to only include points within the window bounds.
 * Optionally includes buffer zone for smooth curve rendering.
 * 
 * @param data - Array of tide data points
 * @param bounds - Window bounds from calculateTideWindow
 * @param includeBuffer - Whether to include buffer zone points (default: true)
 * @returns Filtered tide data points
 */
export function filterToWindow<T extends { time: Date | string | number }>(
  data: T[],
  bounds: WindowBounds,
  includeBuffer = true
): T[] {
  const start = includeBuffer ? bounds.bufferStart : bounds.windowStart;
  const end = includeBuffer ? bounds.bufferEnd : bounds.windowEnd;

  return data.filter(point => {
    const ts = typeof point.time === 'number'
      ? point.time
      : point.time instanceof Date
      ? point.time.getTime()
      : new Date(point.time).getTime();

    return ts >= start && ts <= end;
  });
}

/**
 * Generates appropriate X-axis tick positions for the tide chart.
 * 
 * @param bounds - Window bounds
 * @param intervalHours - Hours between ticks (default: 3)
 * @returns Array of tick timestamps
 */
export function generateTicks(
  bounds: WindowBounds,
  intervalHours = 3
): number[] {
  const intervalMs = intervalHours * HOUR_MS;
  const ticks: number[] = [];

  // Start from the nearest interval boundary before windowStart
  const firstTick = Math.floor(bounds.windowStart / intervalMs) * intervalMs;

  for (let t = firstTick; t <= bounds.windowEnd; t += intervalMs) {
    if (t >= bounds.windowStart) {
      ticks.push(t);
    }
  }

  return ticks;
}

/**
 * Formats the window duration as a human-readable string.
 * 
 * @param bounds - Window bounds
 * @returns Formatted duration string (e.g., "18-Hour", "24-Hour")
 */
export function formatWindowDuration(bounds: WindowBounds): string {
  const durationMs = bounds.windowEnd - bounds.windowStart;
  const hours = Math.round(durationMs / HOUR_MS);
  return `${hours}-Hour`;
}
