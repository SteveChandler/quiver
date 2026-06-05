import type { EnhancedForecastEntity, TideScheduleEntry } from "@/types/forecast";

function isValidTideScheduleEntry(value: unknown): value is TideScheduleEntry {
  if (!value || typeof value !== "object") return false;

  const entry = value as Partial<TideScheduleEntry>;
  return (
    typeof entry.time === "number" &&
    Number.isFinite(entry.time) &&
    entry.time > 0 &&
    typeof entry.height === "number" &&
    Number.isFinite(entry.height) &&
    (entry.type === "high" || entry.type === "low")
  );
}

export function extractMergedTideSchedule(
  forecasts?: EnhancedForecastEntity[]
): TideScheduleEntry[] {
  if (!Array.isArray(forecasts) || forecasts.length === 0) return [];

  const entriesByTime = new Map<number, TideScheduleEntry>();

  for (const forecast of forecasts) {
    const schedule = forecast.raw_forecast?.tide_schedule;
    if (!Array.isArray(schedule)) continue;

    for (const entry of schedule) {
      if (!isValidTideScheduleEntry(entry)) continue;
      if (entriesByTime.has(entry.time)) continue;

      entriesByTime.set(entry.time, {
        time: entry.time,
        height: entry.height,
        type: entry.type,
      });
    }
  }

  return Array.from(entriesByTime.values()).sort((a, b) => a.time - b.time);
}
