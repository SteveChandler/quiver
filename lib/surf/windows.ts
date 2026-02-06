import { boardCall, computeHourScore, HourInputs, BeachMeta, HourlyMarine, HourlyTide } from "./scoring";
import { METERS_TO_FEET } from '@/lib/utils/unit-conversions';

interface HourSample extends HourInputs {
  ts: string; // ISO timestamp (hourly)
}

interface SurfWindow {
  startTs: string;
  endTs: string;
  score: number; // 0..100
  grade: ReturnType<typeof boardCall>;
}

export function buildTwoHourWindows(hours: HourSample[]): SurfWindow[] {
  if (!hours.length) return [];
  const byTs = [...hours].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  const results: SurfWindow[] = [];
  for (let i = 0; i < byTs.length; i++) {
    const h1 = byTs[i];
    const h2 = byTs.find((h) => new Date(h.ts).getTime() === new Date(h1.ts).getTime() + 3600_000);
    if (!h2) continue;
    const s1 = computeHourScore(h1);
    const s2 = computeHourScore(h2);
    const avg = Math.round((s1.total0to100 + s2.total0to100) / 2);
    results.push({
      startTs: h1.ts,
      endTs: new Date(new Date(h1.ts).getTime() + 2 * 3600_000).toISOString(),
      score: avg,
      grade: boardCall(avg),
    });
  }
  return results.sort((a, b) => b.score - a.score || a.startTs.localeCompare(b.startTs));
}

interface TopWindowOptions {
  tz?: string; // IANA TZ, defaults to America/Los_Angeles
  startHour?: number; // inclusive, 0-23
  endHour?: number; // exclusive, 1-24
  limit?: number; // number of windows to return
  minScore?: number; // optional minimum score threshold
}

export function topMorningWindows(
  hours: HourSample[],
  options: TopWindowOptions = {}
): SurfWindow[] {
  const {
    tz = "America/Los_Angeles",
    startHour = 6,
    endHour = 12,
    limit = 3,
    minScore,
  } = options;
  const windows = buildTwoHourWindows(hours);
  const filtered = windows.filter((w) => {
    const h = localHour(w.startTs, tz);
    const inRange = h >= startHour && h < endHour;
    const passMin = minScore == null || w.score >= minScore;
    return inRange && passMin;
  });
  // Enforce non-overlapping selection (greedy by score, then earliest)
  const picks: SurfWindow[] = [];
  for (const w of filtered) {
    const overlaps = picks.some(
      (p) => !(new Date(w.endTs) <= new Date(p.startTs) || new Date(w.startTs) >= new Date(p.endTs))
    );
    if (!overlaps) {
      picks.push(w);
      if (picks.length === limit) break;
    }
  }
  return picks;
}

function localHour(ts: string, tz: string): number {
  try {
    return new Date(ts).toLocaleString("en-US", {
      hour: "2-digit",
      hour12: false,
      timeZone: tz,
    }) as unknown as number;
  } catch {
    return new Date(ts).getUTCHours();
  }
}

function formatLocalTwoHourRange(ts: string, tz: string): string {
  const start = new Date(ts);
  const end = new Date(start.getTime() + 2 * 3600_000);
  const startStr = start.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: undefined,
    hour12: true,
    timeZone: tz,
  });
  const endStr = end.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: undefined,
    hour12: true,
    timeZone: tz,
  });
  // Normalize 0 minutes output (some engines include ":00")
  return `${trimMinutes(startStr)}–${trimMinutes(endStr)}`;
}

function trimMinutes(label: string): string {
  return label.replace(":00", "").replace(/\s+/g, " ").trim();
}

function capitalize<T extends string>(s: T): Capitalize<T> {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as Capitalize<T>;
}

// Range-driven top windows picker (non-overlapping top 3 by meanScore)
export function topWindowsInRange(
  beach: BeachMeta,
  marineHours: HourlyMarine[],
  tideHours: HourlyTide[],
  startUtc: Date,
  endUtc: Date,
  windowMinutes = 120
) {
  const inRange = marineHours.filter((h) => h.ts >= startUtc && h.ts <= endUtc);
  if (!inRange.length) return [] as any[];

  const tideMap = new Map(tideHours.map((t) => [t.ts.getTime(), t.tide_ft]));
  const results: any[] = [];

  for (const first of inRange) {
    const start = first.ts;
    const end = new Date(start.getTime() + windowMinutes * 60 * 1000);
    if (end > endUtc) break;
    const hours = inRange.filter((h) => h.ts >= start && h.ts < end);
    if (!hours.length) continue;

    const scores = hours.map((h) => {
      const tide = tideMap.get(h.ts.getTime()) ?? 0;
      return computeHourScore(beach, h, tide);
    });
    const meanScore = Math.round(
      scores.reduce((a, b) => a + b, 0) / scores.length
    );
    const avgHsFt =
      hours.reduce((a, b) => a + b.hs_m * METERS_TO_FEET, 0) / Math.max(1, hours.length);

    results.push({
      beach,
      start,
      end,
      meanScore,
      avgHsFt,
      tideAtStartFt: tideMap.get(first.ts.getTime()) ?? 0,
      windAtStart: { dir: first.wind_dir_deg, spd_kts: first.wind_spd_kts },
      swellAtStart: { dir: first.swell_dir_deg, tp_s: first.tp_s },
    });
  }

  results.sort((a, b) => b.meanScore - a.meanScore);
  const picks: typeof results = [];
  for (const r of results) {
    if (picks.every((p) => r.end <= p.start || r.start >= p.end)) {
      picks.push(r);
      if (picks.length === 3) break;
    }
  }
  return picks;
}

export function windowBlurbDetailed(w: any) {
  const h = (d: Date) =>
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const board = boardCall(w.avgHsFt, w.beach.break_type);
  return {
    title: `${w.beach.name ?? ""} — ${h(w.start)}–${h(w.end)} (score ${
      w.meanScore
    })`,
    reasons: [
      `Swell ~${Math.round(w.avgHsFt)} ft avg, ${Math.round(
        w.swellAtStart.tp_s ?? 0
      )}s, ${Math.round(w.swellAtStart.dir ?? 0)}°`,
      `Wind ${Math.round(w.windAtStart.spd_kts ?? 0)} kt @ ${Math.round(
        w.windAtStart.dir ?? 0
      )}° at start`,
      `Tide ${Number(w.tideAtStartFt ?? 0).toFixed(1)} ft`,
      `Board: ${board}`,
    ],
  };
}
