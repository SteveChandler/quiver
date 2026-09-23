import type { MatchingWindow } from "@/lib/alerts/types";
import { qualityWord } from "@/lib/alerts/push-formatter";

const MAX_SUBJECT_LENGTH = 78;

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1);
}

function timeOfDayLabel(windowStart: string, timezone: string): string {
  const date = new Date(windowStart);
  if (Number.isNaN(date.getTime())) return "today";

  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "2-digit",
      hourCycle: "h23",
    }).format(date)
  );

  if (!Number.isFinite(hour)) return "today";
  if (hour < 12) return "this morning";
  if (hour < 17) return "this afternoon";
  return "this evening";
}

function alertWeekday(alertDate: string): string {
  const firstToken = alertDate.split(",")[0]?.trim();
  const weekdays = new Set([
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ]);
  if (weekdays.has(firstToken)) return firstToken;

  const parsed = new Date(alertDate);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString("en-US", { weekday: "long" });
  }

  return firstToken || "today";
}

function truncateBeachName(beachName: string, suffix: string): string {
  const maxBeachLength = MAX_SUBJECT_LENGTH - suffix.length;
  if (beachName.length <= maxBeachLength) return beachName;
  if (maxBeachLength <= 3) {
    return beachName.slice(0, Math.max(0, maxBeachLength));
  }
  return `${beachName.slice(0, maxBeachLength - 3)}...`;
}

function withTruncatedBeach(beachName: string, suffix: string): string {
  return `${truncateBeachName(beachName, suffix)}${suffix}`;
}

export function buildConsolidatedSubject(
  matches: MatchingWindow[],
  alertDate: string
): string {
  if (matches.length === 0) {
    return `Surf report for ${alertDate}`.slice(0, MAX_SUBJECT_LENGTH);
  }

  if (matches.length > 1) {
    const sorted = [...matches].sort((a, b) => b.best_score - a.best_score);
    const top = sorted[0];
    const suffix = ` + ${sorted.length - 1} more spots firing ${alertWeekday(alertDate)}`;
    return withTruncatedBeach(top.beach_name, suffix);
  }

  const match = matches[0];
  const snap = match.conditions_snapshot ?? {};
  const waveHeight = finiteNumber(snap.wave_height);
  const period = finiteNumber(snap.swell_1_period);
  const label = timeOfDayLabel(match.window_start, match.beach_timezone);

  if (waveHeight === null || period === null) {
    return withTruncatedBeach(match.beach_name, `: surf window ${label}`);
  }

  const quality = qualityWord(match.best_score).toLowerCase();
  const suffix = ` ${quality}: ${formatNumber(waveHeight)} ft @ ${formatNumber(period)}s ${label}`;
  return withTruncatedBeach(match.beach_name, suffix);
}
