# Condition Alert Hourly Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Condition-alert pushes describe the real stretch of qualifying surf (e.g. "7–9 AM") instead of a one-hour slice cut from a 3-hourly grid. A single qualifying hour is described as "around 8 AM".

**Architecture:**
- `enhanced_forecasts` holds 3-hourly rows, but the alert pipeline treats them as hourly. Two rules make every window one hour:
  - `findMatchingWindows` splits on gaps over 90 min;
  - it ends each window one hour after its last row.
- The fix, behind a flag:
  - expand the rows to hourly before matching, taking tide from the hourly NOAA series in `tide_forecasts`;
  - route both crons (evaluate and deliver revalidation) through one shared preparation function, so they cannot disagree.
- The copy change for one-hour windows needs no flag. Today every window is one hour, so every push currently overstates its precision.

**Tech Stack:** Next.js App Router route handlers (Vercel crons), TypeScript, Supabase JS (service role, read-only queries), Jest (`yarn test:unit`), Node 22, Yarn 1.

**Spec:** this plan's Problem section. The evidence was gathered on 2026-10-01 and is summarised in memory as `condition-alert-windows-always-one-hour`.

## Problem (the spec)

On 2026-10-01 Steven received "Worth a look — Blacks Beach, 8–9 AM" (body "Blacks Beach 8 AM-9 AM — 4-5ft @ 12s, 4 mph") and called it "far too narrow to be believable".

**Verified on prod:**
- **Every window is exactly one hour.** All 1,732 `alert_queue` rows created in the last 45 days (101 users) have `window_end - window_start` of exactly 1.00 h.
- **The forecast grid is 3-hourly.** `enhanced_forecasts` has 8 rows per beach per day (02, 05, 08, 11, 14, 17, 20, 23 local in PDT).
- **The window code** is `lib/alerts/window-finder.ts`: `MAX_CONTIGUOUS_GAP_MS = 90 min` splits every 3-hour neighbour into its own window, and `buildWindow` sets `window_end = last row + 1 h`.
- **The daylight filter assumes hourly rows.** `lib/alerts/sunrise.ts` `filterToDaylight` treats each row as one hour long (comment: "ponytail: assumes hourly rows").

**The Blacks rule** ("Watch Blacks Beach Now": wave 3–6 ft, period ≥ 7 s, wind ≤ 9 kt, tide 0–4 ft rising) against Oct 1:

| Row (PDT) | Wave | Wind | Tide (row) | Tide (NOAA hourly, 9410230) | Result |
|---|---|---|---|---|---|
| 05:00 | 4.5 ft | 0 kt | 2.5 ft rising | 2.53 ft at 05:00 | passes; dropped by the daylight filter (sunrise 06:44) |
| 08:00 | 4.7 ft, 12 s | 3.5 kt | 3.9 ft rising | 3.38 ft at 08:00 | passes, so the window is [08:00, 09:00) |
| 11:00 | 4.5 ft | ~7 kt | 5.2 ft | — | fails tide ≤ 4 |

**With hourly expansion and NOAA tide:**
- 07:00 passes (tide 2.84 ft, rising).
- 08:00 passes (3.38 ft).
- 09:00 fails (4.09 ft).
- So the window is **07:00–09:00**.

That matches the hourly view the native app draws: Beach Detail interpolates 3-hourly rows to hourly through `quiver-native src/features/beach-forecast/hourly-forecast-rows.ts`.

**Required behaviour:**
1. **Hourly matching.** With the flag on for a rule's owner, matching runs on hourly rows: source rows plus interpolated hours for whole-hour gaps of 2–3 h. Tide comes from the NOAA hourly series when it brackets the hour, otherwise from linear interpolation of the row tide.
2. **One shared preparation.** Evaluate and deliver revalidation use the same preparation function, and both honour the flag the same way.
3. **Flag off means no change.** Every existing test passes unmodified with the flag off.
4. **Copy for one-hour windows.** A window of 60 minutes or less reads "around 8 AM" in the push title and body; longer windows keep "7–9 AM" / "7 AM-9 AM". The consolidated email already labels ≤ 75 min windows "Good Around" (`ConsolidatedAlertEmail.tsx:315-325`), so push and email agree.
5. **Rollout.** Release to an allowlist first (Steven's accounts), then everyone. The success measure is the share of `alert_queue` windows longer than one hour (today 0%).

## Global Constraints

- **Read-only production access.** No migrations or index changes are needed or allowed in this plan.
- **Flags** follow `lib/flags/daily-call.ts`:
  - `process.env[NAME] === "true"`, off when unset;
  - comma-separated user allowlist, where empty means everyone.
  - Names: `ALERT_HOURLY_WINDOWS_ENABLED`, `ALERT_HOURLY_WINDOWS_USER_ALLOWLIST`.
- **`tide_status` vocabulary** is exactly `Rising` / `Falling` / `Unknown`, as in `enhanced_forecasts`. `evaluateConditions` lower-cases before comparing.
- **Interpolation** is linear for magnitudes and circular for degrees. If either neighbour is null the result is null: a threshold must never pass on half the data.
- **Interpolated hours** carry the nearest source row's `forecast_id`, because `alert-adapter.ts` needs a real row id.
- **Supabase reads return at most 1,000 rows.** Query tide one beach at a time, about 30 rows each.
- **Testing:** targeted Jest files only (`yarn test:unit <path>`); don't run the whole suite while iterating. Node 22 (`nvm use 22`).
- **Commits:** conventional, atomic, staged by path (never `git add -A`). End each message with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Turning points.** A tide high or low between two source rows: the derived `tide_status` must follow the NOAA samples (rising before the peak, falling after), not the sign between the two rows. Pinned in Task 3.
2. **Gaps not on the grid.** A forecast gap that isn't 2 or 3 whole hours (a missing row leaving 6 h, or a 90-min offset): no hours may be invented across it, and the finder still splits there. Pinned in Task 3.
3. **Deploy day.** A queue row evaluated before the flag flip (08:00–09:00) and revalidated after it: deliver rewrites it to 07:00–09:00 by id, and delivery dedup (user + beach + date) prevents a second push. Pinned in Task 5 (deliver test).
4. **NOAA series missing or stale for a beach** (the tide cron runs twice a week): fall back to row-tide interpolation, never to a clamped edge value. `interpolateTideHeight` clamps outside its range, so it must not be used unguarded. Pinned in Task 3.
5. **Wave-size gate on interpolated hours.** The rideability gate reads `maxWaveByForecastAt` by `forecast_at`. Interpolated hours need their own interpolated upper bound, or the gate silently drops to the lower-bound parse. Pinned in Task 3.

---

### Task 1: Say "around 8 AM" for one-hour windows

**Files:**
- Modify: `lib/alerts/push-formatter.ts`, the `formatTitleWindow` (~166-192) and `formatTimeRange` (~194-202) helpers
- Test: `__tests__/lib/alerts/push-formatter.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: no new exports; the title and body window strings change for windows of 60 minutes or less.

- [ ] **Step 1: Write the failing tests.** Append inside the existing top-level `describe` of `push-formatter.test.ts`. Reuse the file's existing match fixture helper: read the top of the file (lines 1-28) and use the same builder that sets `window_start`/`window_end`. If it's named differently, adapt the call, not the assertions.

```ts
  it("says 'around' for a one-hour window instead of a fake range (Blacks 2026-10-01)", () => {
    const match = { ...baseMatch, window_start: "2026-10-01T15:00:00Z", window_end: "2026-10-01T16:00:00Z", best_hour: "2026-10-01T15:00:00Z" };
    const { title, body } = formatPushNotification([match]);
    expect(title).toMatch(/, around 8 AM$/);
    expect(body).toMatch(/^Blacks Beach around 8 AM — /);
  });

  it("keeps a range for windows longer than an hour", () => {
    const match = { ...baseMatch, window_start: "2026-10-01T14:00:00Z", window_end: "2026-10-01T16:00:00Z", best_hour: "2026-10-01T15:00:00Z" };
    const { title, body } = formatPushNotification([match]);
    expect(title).toMatch(/, 7–9 AM$/);
    expect(body).toMatch(/^Blacks Beach 7 AM-9 AM — /);
  });
```

`baseMatch` is the file's fixture with `beach_name: "Blacks Beach"`, `beach_timezone: "America/Los_Angeles"`. Spread over the existing fixture and override those two fields if the fixture uses another beach.

- [ ] **Step 2: Run the tests to verify they fail.**
  Run: `yarn test:unit __tests__/lib/alerts/push-formatter.test.ts -t "around|keeps a range"`
  Expected: the first test fails because the title ends `, 8–9 AM`. The second passes already.

- [ ] **Step 3: Implement.** In `push-formatter.ts`, add above `formatTitleWindow`:

```ts
/** A window this short is one forecast slot; a range would claim precision the forecast lacks. */
const SINGLE_SLOT_WINDOW_MS = 60 * 60 * 1000;

function isSingleSlotWindow(start: string, end: string): boolean {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(ms) && ms <= SINGLE_SLOT_WINDOW_MS;
}

function formatAround(start: string, timezone: string): string {
  const hour = new Date(start).toLocaleTimeString("en-US", { hour: "numeric", hour12: true, timeZone: timezone });
  return `around ${hour}`;
}
```

  Then make the first line of both `formatTitleWindow(start, end, timezone)` and `formatTimeRange(start, end, timezone)`:

```ts
  if (isSingleSlotWindow(start, end)) return formatAround(start, timezone);
```

- [ ] **Step 4: Run the formatter and voice tests.**
  Run: `yarn test:unit __tests__/lib/alerts/push-formatter.test.ts __tests__/lib/notifications/copy/voice-guard.test.ts`
  Expected: all PASS. If `voice-guard` rejects "around", read its rule. Don't weaken it; tell the reviewer.

- [ ] **Step 5: Commit.**

```bash
git add lib/alerts/push-formatter.ts __tests__/lib/alerts/push-formatter.test.ts
git commit -m "fix(alerts): say 'around 8 AM' for one-hour alert windows"
```

---

### Task 2: Flag for hourly alert windows

**Files:**
- Create: `lib/flags/alert-hourly-windows.ts`
- Test: `lib/flags/__tests__/alert-hourly-windows.test.ts`

**Interfaces:**
- Produces: `isAlertHourlyWindowsEnabledFor(userId: string): boolean`, `ALERT_HOURLY_WINDOWS_ENABLED_FLAG`, `ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG`

- [ ] **Step 1: Write the failing test.**

```ts
import {
  ALERT_HOURLY_WINDOWS_ENABLED_FLAG,
  ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG,
  isAlertHourlyWindowsEnabledFor,
} from "@/lib/flags/alert-hourly-windows";

describe("isAlertHourlyWindowsEnabledFor", () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  it("is off when the flag is unset", () => {
    delete process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG];
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(false);
  });

  it("is on for everyone when enabled with an empty allowlist", () => {
    process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] = "true";
    process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] = "";
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(true);
  });

  it("is on only for allowlisted users when an allowlist is set", () => {
    process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] = "true";
    process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] = " user-a ,user-b";
    expect(isAlertHourlyWindowsEnabledFor("user-a")).toBe(true);
    expect(isAlertHourlyWindowsEnabledFor("user-c")).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails.**
  Run: `yarn test:unit lib/flags/__tests__/alert-hourly-windows.test.ts`
  Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** `lib/flags/alert-hourly-windows.ts`:

```ts
export const ALERT_HOURLY_WINDOWS_ENABLED_FLAG = "ALERT_HOURLY_WINDOWS_ENABLED";
export const ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG = "ALERT_HOURLY_WINDOWS_USER_ALLOWLIST";

/** Match condition alerts on hourly rows (3-hourly forecast expanded, NOAA hourly tide). */
export function isAlertHourlyWindowsEnabledFor(userId: string): boolean {
  if (process.env[ALERT_HOURLY_WINDOWS_ENABLED_FLAG] !== "true") return false;
  const allowlist = new Set(
    (process.env[ALERT_HOURLY_WINDOWS_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  return allowlist.size === 0 || allowlist.has(userId);
}
```

- [ ] **Step 4: Run it to verify it passes.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/flags/alert-hourly-windows.ts lib/flags/__tests__/alert-hourly-windows.test.ts
git commit -m "feat(alerts): add the ALERT_HOURLY_WINDOWS flag"
```

---

### Task 3: Expand 3-hourly forecast hours to hourly

**Files:**
- Create: `lib/alerts/hourly-forecast-hours.ts`
- Test: `__tests__/lib/alerts/hourly-forecast-hours.test.ts`

**Interfaces:**
- Consumes: `ForecastHour` from `lib/alerts/types.ts`.
- Produces:
  - `interface AlertTideSample { time: string; heightFt: number }`
  - `interface HourlyExpansion { hours: ForecastHour[]; maxWaveByForecastAt: Map<string, number> }`
  - `expandForecastHoursToHourly(input: { hours: ForecastHour[]; maxWaveByForecastAt: Map<string, number>; tideSamples?: AlertTideSample[] | null }): HourlyExpansion`

- [ ] **Step 1: Write the failing tests.**

```ts
import { expandForecastHoursToHourly, type AlertTideSample } from "@/lib/alerts/hourly-forecast-hours";
import type { ForecastHour } from "@/lib/alerts/types";

const row = (forecast_at: string, fields: Partial<ForecastHour> = {}): ForecastHour => ({
  forecast_id: `id-${forecast_at}`,
  forecast_at,
  wave_height: 4.5, wave_period: 12, wave_direction: "W",
  swell_1_height: 4, swell_1_period: 12, swell_1_direction: 270,
  wind_speed: 0, wind_direction_deg: 90,
  tide_height: 2.5, tide_status: "Rising",
  ...fields,
});

// Blacks Beach, 2026-10-01 (PDT = UTC-7): 05:00, 08:00, 11:00 local.
const r05 = row("2026-10-01T12:00:00+00:00", { wave_height: 4.5, wind_speed: 0, tide_height: 2.5 });
const r08 = row("2026-10-01T15:00:00+00:00", { wave_height: 4.7, wind_speed: 3.5, tide_height: 3.9 });
const r11 = row("2026-10-01T18:00:00+00:00", { wave_height: 4.5, wind_speed: 7, tide_height: 5.2 });
const noaa: AlertTideSample[] = [
  ["2026-10-01T12:00:00Z", 2.53], ["2026-10-01T13:00:00Z", 2.56], ["2026-10-01T14:00:00Z", 2.84],
  ["2026-10-01T15:00:00Z", 3.38], ["2026-10-01T16:00:00Z", 4.09], ["2026-10-01T17:00:00Z", 4.83],
  ["2026-10-01T18:00:00Z", 5.30],
].map(([time, heightFt]) => ({ time: time as string, heightFt: heightFt as number }));
const maxWave = new Map([[r05.forecast_at, 5], [r08.forecast_at, 5], [r11.forecast_at, 5]]);

describe("expandForecastHoursToHourly", () => {
  it("fills whole hours between 3-hourly rows with linear values and the nearest row's id", () => {
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: maxWave });
    expect(hours.map((h) => h.forecast_at)).toEqual([
      r05.forecast_at, "2026-10-01T13:00:00.000Z", "2026-10-01T14:00:00.000Z", r08.forecast_at,
    ]);
    expect(hours[1].wave_height).toBeCloseTo(4.567, 2);
    expect(hours[2].wind_speed).toBeCloseTo(2.333, 2);
    expect(hours[1].forecast_id).toBe(r05.forecast_id);
    expect(hours[2].forecast_id).toBe(r08.forecast_id);
  });

  it("blends directions the short way round", () => {
    const a = row("2026-10-01T12:00:00+00:00", { wind_direction_deg: 350 });
    const b = row("2026-10-01T15:00:00+00:00", { wind_direction_deg: 20 });
    const { hours } = expandForecastHoursToHourly({ hours: [a, b], maxWaveByForecastAt: new Map() });
    expect(hours[1].wind_direction_deg).toBeCloseTo(0, 0);
  });

  it("never passes a threshold on half the data: one null neighbour gives null", () => {
    const a = row("2026-10-01T12:00:00+00:00", { wind_speed: null });
    const { hours } = expandForecastHoursToHourly({ hours: [a, r08], maxWaveByForecastAt: new Map() });
    expect(hours[1].wind_speed).toBeNull();
  });

  it("does not invent hours across a gap that is not 2 or 3 whole hours", () => {
    const late = row("2026-10-01T21:00:00+00:00");
    const offset = row("2026-10-01T22:30:00+00:00");
    const { hours } = expandForecastHoursToHourly({ hours: [r08, late, offset], maxWaveByForecastAt: new Map() });
    expect(hours.map((h) => h.forecast_at)).toEqual([r08.forecast_at, late.forecast_at, offset.forecast_at]);
  });

  it("takes tide from bracketing NOAA hourly samples and derives the status from them", () => {
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08, r11], maxWaveByForecastAt: maxWave, tideSamples: noaa });
    const at = (iso: string) => hours.find((h) => new Date(h.forecast_at).toISOString() === iso)!;
    expect(at("2026-10-01T15:00:00.000Z").tide_height).toBeCloseTo(3.38, 2); // source row's 3.9 replaced
    expect(at("2026-10-01T16:00:00.000Z").tide_height).toBeCloseTo(4.09, 2);
    expect(at("2026-10-01T14:00:00.000Z").tide_status).toBe("Rising");
  });

  it("follows the NOAA samples through a turning point between two rows", () => {
    const peak: AlertTideSample[] = [
      { time: "2026-10-01T12:00:00Z", heightFt: 4.0 }, { time: "2026-10-01T13:00:00Z", heightFt: 4.6 },
      { time: "2026-10-01T14:00:00Z", heightFt: 4.4 }, { time: "2026-10-01T15:00:00Z", heightFt: 3.6 },
    ];
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: new Map(), tideSamples: peak });
    expect(hours[1].tide_status).toBe("Rising");  // 13:00: 12:00 (4.0) → 14:00 (4.4) is still up
    expect(hours[2].tide_status).toBe("Falling"); // 14:00
  });

  it("falls back to row-tide interpolation when NOAA does not bracket the hour, never to a clamped edge", () => {
    const stale: AlertTideSample[] = [{ time: "2026-09-28T12:00:00Z", heightFt: 1.0 }];
    const { hours } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: maxWave, tideSamples: stale });
    expect(hours[1].tide_height).toBeCloseTo(2.967, 2); // linear 2.5 → 3.9
    expect(hours[1].tide_status).toBe("Rising");
  });

  it("interpolates the wave upper bound for the rideability gate", () => {
    const wide = new Map([[r05.forecast_at, 4], [r08.forecast_at, 7]]);
    const { maxWaveByForecastAt } = expandForecastHoursToHourly({ hours: [r05, r08], maxWaveByForecastAt: wide });
    expect(maxWaveByForecastAt.get("2026-10-01T13:00:00.000Z")).toBeCloseTo(5, 5);
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**
  Run: `yarn test:unit __tests__/lib/alerts/hourly-forecast-hours.test.ts`
  Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** `lib/alerts/hourly-forecast-hours.ts`:

```ts
import type { ForecastHour } from "./types";

const HOUR_MS = 60 * 60 * 1000;
/** The forecast grid is 3-hourly; only its own gaps are filled, never a missing row. */
const MIN_EXPANDED_GAP_HOURS = 2;
const MAX_EXPANDED_GAP_HOURS = 3;
/** A NOAA sample counts for an hour only when the series brackets it this tightly. */
const MAX_TIDE_SAMPLE_GAP_MS = 2 * HOUR_MS;

export interface AlertTideSample {
  time: string;
  heightFt: number;
}

export interface HourlyExpansion {
  hours: ForecastHour[];
  maxWaveByForecastAt: Map<string, number>;
}

function lerp(a: number | null, b: number | null, t: number): number | null {
  if (a == null || b == null) return null;
  return a + (b - a) * t;
}

function lerpDegrees(a: number | null, b: number | null, t: number): number | null {
  if (a == null || b == null) return null;
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

function tideStatusFromSlope(slope: number, fallback: string | null): string | null {
  if (slope > 0) return "Rising";
  if (slope < 0) return "Falling";
  return fallback;
}

/** Height at `ms` from samples that bracket it within MAX_TIDE_SAMPLE_GAP_MS, else null. */
function sampledTide(samples: { ms: number; heightFt: number }[], ms: number): number | null {
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.ms === ms) return s.heightFt;
    const next = samples[i + 1];
    if (next && s.ms < ms && ms < next.ms) {
      if (next.ms - s.ms > MAX_TIDE_SAMPLE_GAP_MS) return null;
      return s.heightFt + (next.heightFt - s.heightFt) * ((ms - s.ms) / (next.ms - s.ms));
    }
  }
  return null;
}

function applyTideSamples(hours: ForecastHour[], tideSamples: AlertTideSample[] | null | undefined): ForecastHour[] {
  if (!tideSamples || tideSamples.length === 0) return hours;
  const samples = tideSamples
    .map((s) => ({ ms: Date.parse(s.time), heightFt: s.heightFt }))
    .filter((s) => Number.isFinite(s.ms) && Number.isFinite(s.heightFt))
    .sort((a, b) => a.ms - b.ms);
  return hours.map((hour) => {
    const ms = Date.parse(hour.forecast_at);
    const height = sampledTide(samples, ms);
    if (height == null) return hour;
    const before = sampledTide(samples, ms - HOUR_MS);
    const after = sampledTide(samples, ms + HOUR_MS);
    const slope = before != null && after != null ? after - before : after != null ? after - height : before != null ? height - before : 0;
    return { ...hour, tide_height: height, tide_status: tideStatusFromSlope(slope, hour.tide_status) };
  });
}

/**
 * Expands 3-hourly forecast rows to hourly so alert windows describe the real stretch of
 * qualifying surf. Mirrors the native app's hourly rows (quiver-native hourly-forecast-rows.ts):
 * linear magnitudes, circular directions, nearest-row text, and only whole-hour gaps of 2–3 h.
 */
export function expandForecastHoursToHourly(input: {
  hours: ForecastHour[];
  maxWaveByForecastAt: Map<string, number>;
  tideSamples?: AlertTideSample[] | null;
}): HourlyExpansion {
  const sorted = [...input.hours].sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at));
  const maxWave = new Map(input.maxWaveByForecastAt);
  const out: ForecastHour[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i];
    out.push(from);
    const to = sorted[i + 1];
    if (!to) continue;
    const gapHours = (Date.parse(to.forecast_at) - Date.parse(from.forecast_at)) / HOUR_MS;
    if (!Number.isInteger(gapHours) || gapHours < MIN_EXPANDED_GAP_HOURS || gapHours > MAX_EXPANDED_GAP_HOURS) continue;
    const fromMax = maxWave.get(from.forecast_at) ?? from.wave_height;
    const toMax = maxWave.get(to.forecast_at) ?? to.wave_height;
    for (let k = 1; k < gapHours; k++) {
      const t = k / gapHours;
      const nearest = t < 0.5 ? from : to;
      const forecastAt = new Date(Date.parse(from.forecast_at) + k * HOUR_MS).toISOString();
      const tide = lerp(from.tide_height, to.tide_height, t);
      const tideSlope = from.tide_height != null && to.tide_height != null ? to.tide_height - from.tide_height : 0;
      out.push({
        forecast_id: nearest.forecast_id,
        forecast_at: forecastAt,
        wave_height: lerp(from.wave_height, to.wave_height, t),
        wave_period: lerp(from.wave_period, to.wave_period, t),
        wave_direction: nearest.wave_direction,
        swell_1_height: lerp(from.swell_1_height, to.swell_1_height, t),
        swell_1_period: lerp(from.swell_1_period, to.swell_1_period, t),
        swell_1_direction: lerpDegrees(from.swell_1_direction, to.swell_1_direction, t),
        wind_speed: lerp(from.wind_speed, to.wind_speed, t),
        wind_direction_deg: lerpDegrees(from.wind_direction_deg, to.wind_direction_deg, t),
        tide_height: tide,
        tide_status: tideStatusFromSlope(tideSlope, nearest.tide_status),
      });
      const interpolatedMax = lerp(fromMax, toMax, t);
      if (interpolatedMax != null) maxWave.set(forecastAt, interpolatedMax);
    }
  }
  return { hours: applyTideSamples(out, input.tideSamples), maxWaveByForecastAt: maxWave };
}
```

- [ ] **Step 4: Run the tests to verify they pass.** Same command. Expected: PASS. If the turning-point case fails on the 13:00 hour, check the slope: it uses the samples one hour either side (4.0 → 4.4, so +0.4, Rising). Don't change the fixture to fit the code.

- [ ] **Step 5: Commit.**

```bash
git add lib/alerts/hourly-forecast-hours.ts __tests__/lib/alerts/hourly-forecast-hours.test.ts
git commit -m "feat(alerts): expand 3-hourly forecast rows to hourly for alert matching"
```

---

### Task 4: Load a beach's NOAA hourly tide for the alert day

**Files:**
- Create: `lib/alerts/alert-tide-samples.ts`
- Test: `__tests__/lib/alerts/alert-tide-samples.test.ts`

**Interfaces:**
- Consumes: `AlertTideSample` (Task 3).
- Produces:
  - `loadAlertTideSamples(supabase: AlertTideClient, beachId: string, startIso: string, endIso: string): Promise<AlertTideSample[] | null>`, where null means unavailable and the caller falls back to row tide;
  - `createAlertTideCache(supabase): (beachId: string, startIso: string, endIso: string) => Promise<AlertTideSample[] | null>`, which memoises per beach and day within one cron run.

`tide_forecasts` columns used: `beach_id`, `ts_utc` (timestamptz), `tide_ft` (real). Rows are hourly NOAA predictions, written per beach with the nearest station (e.g. Blacks → 9410230).

- [ ] **Step 1: Write the failing tests.**

```ts
import { createAlertTideCache, loadAlertTideSamples } from "@/lib/alerts/alert-tide-samples";

function clientReturning(result: { data: unknown; error: unknown }) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "gte", "lt", "order"]) {
    builder[method] = (...args: unknown[]) => { calls.push([method, ...args]); return builder; };
  }
  (builder as { then: unknown }).then = (resolve: (v: unknown) => unknown) => resolve(result);
  return { client: { from: (table: string) => { calls.push(["from", table]); return builder; } }, calls };
}

describe("loadAlertTideSamples", () => {
  it("reads one beach's hourly NOAA heights for the day", async () => {
    const { client, calls } = clientReturning({ data: [{ ts_utc: "2026-10-01T15:00:00+00:00", tide_ft: 3.38255 }], error: null });
    const samples = await loadAlertTideSamples(client as never, "blacks", "2026-10-01T07:00:00Z", "2026-10-02T07:00:00Z");
    expect(samples).toEqual([{ time: "2026-10-01T15:00:00+00:00", heightFt: 3.38255 }]);
    expect(calls).toContainEqual(["from", "tide_forecasts"]);
    expect(calls).toContainEqual(["eq", "beach_id", "blacks"]);
  });

  it("returns null on an error or an empty series so callers keep the row tide", async () => {
    expect(await loadAlertTideSamples(clientReturning({ data: null, error: { message: "boom" } }).client as never, "b", "s", "e")).toBeNull();
    expect(await loadAlertTideSamples(clientReturning({ data: [], error: null }).client as never, "b", "s", "e")).toBeNull();
  });

  it("queries each beach and day once per run", async () => {
    const { client, calls } = clientReturning({ data: [{ ts_utc: "2026-10-01T15:00:00Z", tide_ft: 3.4 }], error: null });
    const tideFor = createAlertTideCache(client as never);
    await tideFor("blacks", "s", "e");
    await tideFor("blacks", "s", "e");
    expect(calls.filter((c) => c[0] === "from")).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail.**
  Run: `yarn test:unit __tests__/lib/alerts/alert-tide-samples.test.ts`
  Expected: FAIL, cannot find module.

- [ ] **Step 3: Implement** `lib/alerts/alert-tide-samples.ts`:

```ts
import type { AlertTideSample } from "./hourly-forecast-hours";

/** The subset of the Supabase client this module uses, so tests can stub it. */
export interface AlertTideClient {
  from(table: "tide_forecasts"): {
    select(columns: string): {
      eq(column: "beach_id", value: string): {
        gte(column: "ts_utc", value: string): {
          lt(column: "ts_utc", value: string): {
            order(column: "ts_utc", options: { ascending: boolean }): PromiseLike<{ data: { ts_utc: string; tide_ft: number | null }[] | null; error: unknown }>;
          };
        };
      };
    };
  };
}

/** One beach's hourly NOAA tide heights for [startIso, endIso). Null means use the row tide. */
export async function loadAlertTideSamples(
  supabase: AlertTideClient,
  beachId: string,
  startIso: string,
  endIso: string,
): Promise<AlertTideSample[] | null> {
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts_utc, tide_ft")
    .eq("beach_id", beachId)
    .gte("ts_utc", startIso)
    .lt("ts_utc", endIso)
    .order("ts_utc", { ascending: true });
  if (error || !data || data.length === 0) return null;
  const samples = data
    .filter((row) => typeof row.tide_ft === "number" && Number.isFinite(row.tide_ft))
    .map((row) => ({ time: row.ts_utc, heightFt: row.tide_ft as number }));
  return samples.length > 0 ? samples : null;
}

export function createAlertTideCache(supabase: AlertTideClient) {
  const cache = new Map<string, Promise<AlertTideSample[] | null>>();
  return (beachId: string, startIso: string, endIso: string): Promise<AlertTideSample[] | null> => {
    const key = `${beachId}|${startIso}|${endIso}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = loadAlertTideSamples(supabase, beachId, startIso, endIso);
      cache.set(key, pending);
    }
    return pending;
  };
}
```

  If TypeScript rejects the real service-role client against `AlertTideClient` at the call sites in Task 5, cast at the call site (`supabase as unknown as AlertTideClient`), as other `lib/alerts` helpers do. Don't loosen the interface to `any`.

- [ ] **Step 4: Run the tests to verify they pass.** Same command. Expected: PASS.

- [ ] **Step 5: Commit.**

```bash
git add lib/alerts/alert-tide-samples.ts __tests__/lib/alerts/alert-tide-samples.test.ts
git commit -m "feat(alerts): load a beach's hourly NOAA tide for alert matching"
```

---

### Task 5: One preparation for evaluate and deliver, behind the flag

**Files:**
- Modify: `lib/alerts/revalidate-alert-window.ts`: add `prepareAlertForecastHours`, use it in `selectFreshAlertWindow` (lines 35-58), and accept `hourly` and `tideSamples`
- Modify: `app/api/cron/condition-alert-evaluate/route.ts`: replace the inline parse, daylight and max-wave block (~438-476) with `prepareAlertForecastHours`
- Modify: `app/api/cron/condition-alert-deliver/route.ts`: `refreshQueueItemFromLatestForecasts` (~472-520) passes `hourly` and `tideSamples` to `selectFreshAlertWindow`
- Test: `__tests__/lib/alerts/revalidate-alert-window.test.ts`, `__tests__/api/cron/condition-alert-deliver.test.ts`

**Interfaces:**
- Consumes:
  - `expandForecastHoursToHourly` and `AlertTideSample` (Task 3);
  - `createAlertTideCache` and `AlertTideClient` (Task 4);
  - `isAlertHourlyWindowsEnabledFor` (Task 2).
- Produces:
  - `prepareAlertForecastHours(forecastRows: EnhancedForecastAlertRow[], beach: { lat: number; lon: number }, options: { hourly: boolean; tideSamples?: AlertTideSample[] | null }): { daylight: ForecastHour[]; maxWaveByForecastAt: Map<string, number> }`;
  - `SelectFreshAlertWindowInput` gains `hourly?: boolean` (default false) and `tideSamples?: AlertTideSample[] | null`.

- [ ] **Step 1: Write the failing tests** in `revalidate-alert-window.test.ts`. Add a Blacks fixture next to `missionBeach` and these cases:

```ts
const blacksBeach: AlertRevalidationBeachMeta = {
  ...missionBeach, id: "blacks-id", name: "Blacks Beach", slug: "blacks-beach", lat: 32.8894, lon: -117.2538,
};
const watchBlacks: AlertConditions = {
  swell_height_min: 3, swell_height_max: 6, swell_period_min: 7, wind_speed_max_kt: 9,
  tide_height_min_ft: 0, tide_height_max_ft: 4, tide_direction: "rising",
};
// enhanced_forecasts rows in their stored string format (checked on prod 2026-10-01; bare/mph
// wind is read as mph by parseWindSpeedToKt). Blacks 2026-10-01 05:00 / 08:00 / 11:00 PDT.
const blacksRows = [
  { id: "r05", forecast_at: "2026-10-01T12:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "0 mph", tide_height: "2.5 ft", tide_status: "Rising" },
  { id: "r08", forecast_at: "2026-10-01T15:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "4 mph", tide_height: "3.9 ft", tide_status: "Rising" },
  { id: "r11", forecast_at: "2026-10-01T18:00:00+00:00", wave_height: "4-5 ft", wave_period: "12s", swell_1_period: "12s", wind_speed: "8 mph", tide_height: "5.2 ft", tide_status: "Rising" },
];
const blacksNoaa = [
  ["2026-10-01T12:00:00Z", 2.53], ["2026-10-01T13:00:00Z", 2.56], ["2026-10-01T14:00:00Z", 2.84],
  ["2026-10-01T15:00:00Z", 3.38], ["2026-10-01T16:00:00Z", 4.09], ["2026-10-01T17:00:00Z", 4.83], ["2026-10-01T18:00:00Z", 5.3],
].map(([time, heightFt]) => ({ time: time as string, heightFt: heightFt as number }));
const before = new Date("2026-10-01T12:30:00Z"); // 05:30 PDT, when the push would go out

describe("hourly alert windows (Blacks 2026-10-01)", () => {
  it("keeps today's one-hour window with the flag off", () => {
    const w = selectFreshAlertWindow({ conditions: watchBlacks, forecastRows: blacksRows, beach: blacksBeach, now: before });
    expect([w?.window_start, w?.window_end]).toEqual(["2026-10-01T15:00:00+00:00", "2026-10-01T16:00:00.000Z"]);
  });

  it("finds the real 7–9 AM stretch on hourly rows with NOAA tide", () => {
    const w = selectFreshAlertWindow({
      conditions: watchBlacks, forecastRows: blacksRows, beach: blacksBeach, now: before,
      hourly: true, tideSamples: blacksNoaa,
    });
    expect(new Date(w!.window_start).toISOString()).toBe("2026-10-01T14:00:00.000Z");
    expect(new Date(w!.window_end).toISOString()).toBe("2026-10-01T16:00:00.000Z");
    expect(w!.forecast_id).toMatch(/^r0[58]$/);
  });
});
```

  **Why 7–9 AM:**
  - Sunrise is 06:44 PDT, so the daylight filter drops 05:00 and 06:00.
  - 07:00 (14Z) passes: wave 4 ft lower bound, wind 2.3 kt, NOAA tide 2.84 ft rising.
  - 08:00 (15Z) passes: NOAA tide 3.38 ft.
  - 09:00 (16Z) fails: NOAA tide 4.09 ft > 4.
  - Flag off, the same rows give 08:00–09:00, because 15Z is the only daylight row under 4 ft of row tide.

- [ ] **Step 2: Run them to verify they fail.**
  Run: `yarn test:unit __tests__/lib/alerts/revalidate-alert-window.test.ts -t "hourly alert windows"`
  Expected: the flag-off case PASSES (it documents today's behaviour); the hourly case FAILS (it still finds 15:00–16:00).

- [ ] **Step 3: Implement** `prepareAlertForecastHours` in `revalidate-alert-window.ts` and use it in `selectFreshAlertWindow`:

```ts
import { expandForecastHoursToHourly, type AlertTideSample } from "@/lib/alerts/hourly-forecast-hours";

interface SelectFreshAlertWindowInput {
  conditions: AlertConditions;
  forecastRows: EnhancedForecastAlertRow[];
  beach: AlertRevalidationBeachMeta;
  now?: Date;
  /** Match on hourly rows (ALERT_HOURLY_WINDOWS); the caller resolves the flag for the rule's owner. */
  hourly?: boolean;
  tideSamples?: AlertTideSample[] | null;
}

/** The one preparation both alert crons use: parse, optionally expand to hourly, keep daylight. */
export function prepareAlertForecastHours(
  forecastRows: EnhancedForecastAlertRow[],
  beach: { lat: number; lon: number },
  options: { hourly: boolean; tideSamples?: AlertTideSample[] | null },
): { daylight: ForecastHour[]; maxWaveByForecastAt: Map<string, number> } {
  const parsed = forecastRows.map(parseEnhancedForecastHour);
  const rowMaxWave = buildMaxWaveByForecastAt(forecastRows);
  const { hours, maxWaveByForecastAt } = options.hourly
    ? expandForecastHoursToHourly({ hours: parsed, maxWaveByForecastAt: rowMaxWave, tideSamples: options.tideSamples })
    : { hours: parsed, maxWaveByForecastAt: rowMaxWave };
  return { daylight: filterToDaylight(hours, beach.lat, beach.lon), maxWaveByForecastAt };
}
```

  In `selectFreshAlertWindow`, destructure `hourly = false, tideSamples = null`, and replace:

```ts
  const parsed = forecastRows.map(parseEnhancedForecastHour);
  const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
```

  with:

```ts
  const { daylight, maxWaveByForecastAt } = prepareAlertForecastHours(forecastRows, beach, { hourly, tideSamples });
```

  Then delete the later `const maxWaveByForecastAt = buildMaxWaveByForecastAt(forecastRows);` line, so the gate reads the expanded map.

- [ ] **Step 4: Run them to verify they pass.**
  Run: `yarn test:unit __tests__/lib/alerts/revalidate-alert-window.test.ts`
  Expected: all PASS, including every pre-existing case (flag off is unchanged).

- [ ] **Step 5: Wire the evaluate route.** In `app/api/cron/condition-alert-evaluate/route.ts`:
  - create one tide cache per run next to the service client (line ~120):

```ts
  const tideFor = createAlertTideCache(supabase as unknown as AlertTideClient);
```

  - replace the block from `const parsed: ForecastHour[] = forecasts.map(...)` through the `maxWaveByForecastAt` loop (~438-476) with:

```ts
              const hourly = isAlertHourlyWindowsEnabledFor(rule.user_id);
              const tideSamples = hourly ? await tideFor(rule.beach_id, todayStart, todayEnd) : null;
              const { daylight, maxWaveByForecastAt } = prepareAlertForecastHours(
                forecasts as EnhancedForecastAlertRow[],
                beach,
                { hourly, tideSamples },
              );
              if (daylight.length === 0) continue;
```

  Keep the comment block that explains the max-wave gate, moved above the new call. Confirm the loop variable is `rule` and the owner field is `user_id` by reading lines 380-440. If the evaluate route's own parse differed from `parseEnhancedForecastHour` (compare the two field by field), stop and report the difference instead of silently changing it.

- [ ] **Step 6: Wire the deliver route.** In `refreshQueueItemFromLatestForecasts` (~472-520) of `app/api/cron/condition-alert-deliver/route.ts`, before `selectFreshAlertWindow`:

```ts
    const hourly = isAlertHourlyWindowsEnabledFor(item.user_id);
    const tideSamples = hourly
      ? await loadAlertTideSamples(supabase as unknown as AlertTideClient, item.beach_id, dayStart, dayEnd)
      : null;
```

  `dayStart`/`dayEnd` are the same UTC day bounds the function already computes for the forecast query (read lines 472-490 for their names). Then pass `hourly, tideSamples` into `selectFreshAlertWindow({ ... })`.

- [ ] **Step 7: Deploy-day test** in `__tests__/api/cron/condition-alert-deliver.test.ts`.
  - **Copy the test** that seeds `store.forecastRows` with the 15Z and 20Z Mission Beach rows (~1340-1460) into a new `it("rewrites a one-hour queue row to the hourly window on the same row, with one send (ALERT_HOURLY_WINDOWS)")`.
  - **Changes in the copy:**
    - set `process.env.ALERT_HOURLY_WINDOWS_ENABLED = "true"` and `process.env.ALERT_HOURLY_WINDOWS_USER_ALLOWLIST = ""` at the start, and restore both in `finally` or `afterEach`;
    - change the second row's `forecast_at` from `"2026-04-26T20:00:00Z"` to `"2026-04-26T18:00:00Z"`, so the rows are 3 h apart and the hours between them are filled;
    - replace the window assertions with:

```ts
      expect(store.queueRefreshUpdates).toHaveLength(1);
      expect(store.queueRefreshUpdates[0]).toMatchObject({
        id: QUEUE_1,
        values: { window_start: "2026-04-26T15:00:00Z", window_end: "2026-04-26T19:00:00.000Z" },
      });
      expect(store.queueUpdates).toEqual([{ ids: [QUEUE_1], sent: true }]);
```

  - **Why 15:00–19:00:** both rows carry the values the original test already accepts. The interpolated 16Z and 17Z hours are identical to them, and 19Z = the 18Z row + 1 h. 08:00–12:00 PDT is daylight.
  - **If the store mock has no `tide_forecasts` table** (its `from()` throws or returns undefined), extend the mock so `from("tide_forecasts")` resolves `{ data: [], error: null }`. An empty series makes the code fall back to row tide, which is what this test needs.

- [ ] **Step 8: Run the affected suites.**
  Run: `yarn test:unit __tests__/lib/alerts __tests__/api/cron/condition-alert-evaluate.test.ts __tests__/api/cron/condition-alert-deliver.test.ts lib/flags/__tests__/alert-hourly-windows.test.ts`
  Expected: all PASS. Then `yarn typecheck`. Expected: clean.

- [ ] **Step 9: Commit.**

```bash
git add lib/alerts/revalidate-alert-window.ts app/api/cron/condition-alert-evaluate/route.ts app/api/cron/condition-alert-deliver/route.ts __tests__/lib/alerts/revalidate-alert-window.test.ts __tests__/api/cron/condition-alert-deliver.test.ts
git commit -m "feat(alerts): match condition alerts on hourly rows behind ALERT_HOURLY_WINDOWS"
```

---

### Task 6: Release and measure (operator steps, no code)

Production changes need Steven's approval at each step: the env flag, the prod promotion, and widening the allowlist.

- [ ] **Step 1: Ship the code.** Open the PR to `main`, then promote to `prod` with a slice or release PR per the `quiver-prod-slice-promotion` skill. Both crons run only on the Production deployment. Task 1 (the "around" copy) takes effect on release with no flag.
- [ ] **Step 2: Allowlist Steven.** Set `ALERT_HOURLY_WINDOWS_ENABLED=true` and `ALERT_HOURLY_WINDOWS_USER_ALLOWLIST=<Steven's user ids>` in Vercel Production, then redeploy so env reaches the functions. Both accounts are in the 2026-10-01 investigation: `73040cff…` owns "Watch Blacks Beach Now"; `610a5745…` is stcha0004@gmail.com. Read the full ids from `profiles`; don't paste them into commits.
- [ ] **Step 3: Verify the next morning.** Evaluate runs at 09:00 UTC. Read-only SQL:

```sql
select r.name, q.window_start, q.window_end,
       round(extract(epoch from (q.window_end - q.window_start)) / 3600.0, 2) as hours
from alert_queue q join alert_rules r on r.id = q.rule_id
where q.created_at > now() - interval '1 day' and q.user_id in ('<id-1>', '<id-2>')
order by q.window_start;
```

  - **Expected:** multi-hour windows that start and end on whole hours.
  - **Then compare against the app:** open Beach Detail for the same beach and hour, and check the hourly bars agree with the window, within the native app's row-tide interpolation (Review Focus 1).
- [ ] **Step 4: Widen.** Clear the allowlist (empty means everyone) and redeploy. After 7 days, measure the share of `alert_queue` windows longer than 1 h. It was 0% on 2026-10-01; expect most windows to exceed 1 h. Also check that sends per week don't spike: delivery dedup is per user, beach and day, so they shouldn't.

## Follow-ups (separate plans, not in scope)

- **Sharper window edges.**
  - Snap each window's edges to sunrise and threshold crossings using `lib/alerts/window-refiner.ts`, extended with an optional rule-limit input. It reads beach limits today, and its wind is in mph while rules are in kt.
  - Add the limiting clause to the copy, e.g. "until the tide passes 4 ft around 8:15". The daily-call push already does this.
- **Tide agreement with the app.** Native Beach Detail interpolates each row's `tide_height`, which can sit about 0.5 ft off NOAA (Blacks 08:00: 3.9 vs 3.38). Once quiver#903 (hourly NOAA tide into forecast rows) ships, rows and alerts agree.
- **Remove the dead path.** Once the flag is on for everyone, delete the flag and the 3-hourly-as-hourly branch, and fix the false "rows are hourly" comment in `sunrise.ts`.
