# Swell Outlook Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the backend half of Swell Outlook Phase 1: a flag-gated, allowlisted `GET /api/swell/outlook` that lists every swell heading to a user's beaches (pulse rule, fit for their skill and boards, sticky tracking), plus the first-sighting push and its back-off, with synthetic forecast rows removed from detection.
**Architecture:** A second, more inclusive "pulse" rule (`lib/alerts/swell-events/outlook.ts`) runs beside the notable-swell detector inside the nightly snapshot cron and persists into `swell_event_forecast_snapshots` under its own `detector_version` and a `:p` key marker, so history never mixes with `swell-events.v1`. A pure builder (`lib/services/discovery/swell-outlook.ts`) reads those snapshots for the user's pool, reuses Week Scout's grouping, tier and change logic (extracted to a shared module), adds fit, source, storm name and sticky tracking, and the endpoint and the swell-alert cron both call it. Per-user list and back-off state live in one new service-role table.
**Tech Stack:** Next.js App Router route handlers, TypeScript, Supabase JS (service role), Postgres migrations (written, not applied), Jest, Vercel crons, NHC `CurrentStorms.json`.
**Spec:** docs/superpowers/specs/2026-10-04-swell-outlook-design.md

## Global Constraints

- Work in a new worktree cut from `origin/main`, never the primary checkout: `git worktree add .worktrees/swell-outlook-backend -b feat/swell-outlook-backend origin/main` (from `/Users/stevenchandler/Desktop/dev/quiver`). The spec and this plan live on the docs branch; do not copy them into the implementation PR.
- Pulse thresholds (own object, never mutate `SWELL_EVENT_THRESHOLDS`): face >= 1.5 ft, model period >= 9 s, prominence >= 25% of peak energy, skip pulses peaking today or already past, >= 3 beaches agreeing at region level. Notable-swell thresholds stay 3 ft / 11 s / `maxHorizonDays` 9.
- Horizon is 9 days (`horizonDays: 9`). Sticky: shrinking needs face >= 2 ft within 45 deg and 36 h of the last predicted peak; sticky entries never push and never raise tier.
- Fit uses the IDEAL band for `in_range` and the ACCEPTABLE band for `rideable`/`below_range`/`above_range`; `above_range` is never hidden; no skill level means `unknown`.
- Flags: `SWELL_OUTLOOK_ENABLED` is on only for exact `"true"`; `SWELL_OUTLOOK_USER_ALLOWLIST` empty means NOBODY (like `lib/flags/swell-followup.ts`, unlike `swell-alert.ts`). Sends also stay behind `SWELL_ALERT_ENABLED`; follow-ups behind `SWELL_FOLLOWUP_ENABLED`.
- Pushes: first-sighting only when a swell is listed with `fit.status === 'in_range'`; one per user per swell; at most one first-sighting push per user per 72 h; free users home beach only. Back-off: answered = authenticated `GET /api/swell/outlook` or `GET /api/swell/[eventKey]` within 48 h after a send; pause after 3 consecutive unanswered; resume on next app open with counter reset and no late sends; one rarity exception after 14 days; skipped status `skipped_unengaged`.
- Migrations are WRITTEN, never applied. The database is shared prod/dev. No prod pushes or promotion, no flag or allowlist changes, no deploys, no OTA. Postgres harness runs only against a disposable local cluster.
- Never claim AI or machine-learning forecasting in any copy. Never use the phrase "the call" in copy or comments. Push copy states no rarity claim it cannot back (do not reuse `surf-titles.v1.json` rarity titles for first sightings).
- Mobile-consumed API contracts are additive; return real HTTP statuses (never an error inside a 200). New routes use `withAuth` from `lib/middleware/api-wrappers`.
- TypeScript: explicit types on function signatures, early returns, minimal comments (why, not what). Beach rows use `lat`/`lon`; forecast queries use `forecast_at`; user rows use `user_id`.
- Jest needs dummy env. Every Jest command below is written in full, prefixed `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x`.
- Run `npx tsc --noEmit` before every commit; scoped `npx eslint --max-warnings=0 <files>` on changed files.
- Conventional commits, one logical change per commit, stage by path (never `git add -A`). End each commit message with the attribution line your own session specifies; the commit commands below show the message subject only.
- Open a PR against `main`. Do NOT merge it.

## Review Focus

Most likely to bite a user first. Each has a named test.

1. **No home beach, or an empty pool.** A signed-in user with `home_beach_id` null, no favourites and no location gets a 200 with `swells: []` and `homeBeach: null`; a user with a pool but no home beach is sized at the pool beach with the largest face height. Tested in Task 10 (`builds an empty outlook for an empty pool`, `sizes at the largest beach without a home beach`) and Task 12 (`returns an empty list for a user with no pool`).
2. **No boards recorded, or no skill level.** No boards: the skill level's default band decides fit. No skill level: `fit.status === 'unknown'` and the swell is still listed. A board whose type does not normalise is dropped, not turned into a foamie. Tested in Task 6 and Task 12 (`ignores boards that do not map to a class`).
3. **NHC feed down, slow or malformed.** Any fetch error, timeout, non-200, bad JSON or odd shape yields `stormName: null` and a normal 200; the failure is cached briefly so a bad feed is not hammered. Tested in Task 7 and Task 12 (`responds 200 with stormName null when the storm feed throws`).
4. **Two overlapping swell trains stay two entries.** Same beach, different period (12 s from 270 deg and 16 s from 285 deg), surf never flat between them: two pulses, two groups, two list rows sorted by peak. Tested in Task 3 and Task 10.
5. **A swell listed yesterday and gone today.** Shrinking (face >= 2 ft still in the rows), faded (shown once, then removed), peak already past (shown as arrived for 12 h, then removed). Tested in Task 9.
6. **Synthetic rows.** `data_source = 'FALLBACK'` rows never create or place an event; rows with a null `data_source` are kept (a plain `neq` filter would drop them in SQL). Tested in Task 1.
7. **A pulse that the notable detector never sees must not enter follow-ups.** Pinning a 2 ft, 9 s pulse into `swell_event_user_state` would make `detectSwellFollowupKind` send a false "dropped" push. Only `notable` swells are pinned. Tested in Task 13.
8. **A late open does not count.** An open 60 h after a send leaves the counter alone; an open while paused resets it and queues nothing late. Tested in Task 11.

## File Structure

Create:
- `lib/alerts/swell-events/outlook.ts`: pulse rule, thresholds, regional agreement, detector version.
- `lib/services/discovery/swell-tracking.ts`: grouping, tier and change logic extracted from Week Scout.
- `lib/services/discovery/swell-outlook-types.ts`: `OutlookSwell`, `SwellOutlookResponse`, `StoredOutlookList` and the fit and source unions.
- `lib/services/discovery/swell-outlook-fit.ts`: `swellFitFor` using IDEAL and ACCEPTABLE bands.
- `lib/services/discovery/nhc-storms.ts`: cached, failure-tolerant NHC active-storms client.
- `lib/services/discovery/swell-outlook-source.ts`: source label, storm bearing match, size ranges, orientation sizes.
- `lib/services/discovery/swell-outlook-sticky.ts`: shrinking / faded / arrived carry-over.
- `lib/services/discovery/swell-outlook.ts`: response types and the pure `buildSwellOutlook`.
- `lib/services/discovery/swell-outlook-loader.ts`: I/O for one user (profile, pool, boards, snapshots, rows, storms, state).
- `lib/flags/swell-outlook.ts`: flag and allowlist (default nobody).
- `lib/alerts/swell-outlook/engagement.ts`: pure back-off state machine.
- `lib/alerts/swell-outlook/state.ts`: `swell_outlook_user_state` reads and writes, list advance, open recording.
- `lib/alerts/swell-outlook/first-sighting.ts`: candidate selection and push payload.
- `app/api/swell/outlook/route.ts`: `GET /api/swell/outlook`.
- `supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql`: F4 columns and outcome resolver (written, not applied).
- `supabase/migrations/20261004210000_create_swell_outlook_user_state.sql`: per-user list and back-off state (written, not applied).
- `supabase/tests/swell_snapshot_outcomes.sql` and `scripts/test-swell-snapshot-outcomes-postgres.sh`: disposable-cluster harness.
- `__tests__/helpers/outlook-swell.ts`: shared `OutlookSwell` fixture.
- Tests under `__tests__/` named in each task.

Modify:
- `lib/alerts/swell-events/exposure.ts`, `forecast-rows.ts`, `detector.ts`, `snapshots.ts`, `index.ts`: synthetic-row exclusion, exports, snapshot version and lead.
- `lib/cron/swell-event-snapshot-runner.ts`: write pulse snapshots, resolve outcomes.
- `lib/cron/swell-alert-runner.ts`: synthetic-row filter, outlook-user branch, history helper extraction.
- `lib/alerts/throttle.ts`: `skipped_unengaged` status.
- `lib/services/discovery/week-scout-swells.ts`: import the extracted logic.
- `lib/share/swell-share.ts`, `app/api/swell/[eventKey]/route.ts`: accept `:p` keys, record answered opens.

---

### Task 1: F1, no synthetic rows in swell detection

**Files:**
- Modify: `lib/alerts/swell-events/exposure.ts` (add constant after line 3), `lib/alerts/swell-events/forecast-rows.ts` (columns 7-16, query 27-39), `lib/alerts/swell-events/detector.ts` (type 36-45, loop 208-231), `lib/cron/swell-alert-runner.ts` (`loadForecasts` query at 330-338)
- Test: `__tests__/lib/alerts/swell-events/forecast-rows.test.ts` (new)

**Interfaces:**
- Consumes: `dayRows`, `FLAT`, `NOW`, `TIMEZONE`, `swellBeach` from `@/__tests__/helpers/swell-events`; `detectBeachSwellEvents`, `loadSwellForecastRows` from `@/lib/alerts/swell-events`.
- Produces: `SYNTHETIC_FORECAST_DATA_SOURCE = "FALLBACK"` and `EXCLUDE_SYNTHETIC_ROWS_FILTER` (exported from `forecast-rows.ts`); `SwellEventForecastRow` gains optional `data_source?: string | null`; `exposedSwellRows` skips FALLBACK rows (covers `detectBeachSwellEvents`, `detectSwellCrossing` and the later pulse rule).

- [ ] **Step 0: Check whether another task already landed this, and cut the worktree**

```bash
cd /Users/stevenchandler/Desktop/dev/quiver
git fetch origin
git grep -n "FALLBACK" origin/main -- lib/alerts/swell-events lib/cron/swell-alert-runner.ts lib/cron/swell-event-snapshot-runner.ts
git worktree add .worktrees/swell-outlook-backend -b feat/swell-outlook-backend origin/main
```

Expected at plan time: the only hit is `isStaleByDefault` in `swell-event-snapshot-runner.ts` (staleness, not row filtering). If a hit shows a `data_source` filter in `forecast-rows.ts` or a guard in `detector.ts`, this task becomes "verify and skip": run the test below, and if it passes, skip Steps 3-5 (keep the test file as its own commit).

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/alerts/swell-events/forecast-rows.test.ts
import {
  detectBeachSwellEvents,
  loadSwellForecastRows,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import {
  FLAT,
  NOW,
  TIMEZONE,
  dayRows,
  swellBeach,
  type PartitionSpec,
} from "@/__tests__/helpers/swell-events";

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };

function week(source: string | null | undefined): SwellEventForecastRow[] {
  return Array.from({ length: 7 }, (_, day) =>
    dayRows(day, day === 3 ? PEAK : FLAT, { noonBumpFt: day === 3 ? 0.2 : 0 }).map((row) => (
      day >= 2 && source !== undefined ? { ...row, data_source: source } : row
    )),
  ).flat();
}

function detect(forecasts: SwellEventForecastRow[]) {
  return detectBeachSwellEvents({ beach: swellBeach(), forecasts, now: NOW, timezone: TIMEZONE });
}

function fakeClient(rows: unknown[]) {
  const calls: unknown[][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "in", "gte", "lt", "order", "or"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.range = (from: number) => Promise.resolve({ data: from === 0 ? rows : [], error: null });
  return { calls, client: { from: () => builder } as never };
}

describe("synthetic forecast rows in swell detection", () => {
  it("detects the swell on real rows (fixture control)", () => {
    expect(detect(week("NOAA_NWS"))).toHaveLength(1);
  });

  it("cannot create an event from FALLBACK rows", () => {
    expect(detect(week("FALLBACK"))).toEqual([]);
  });

  it("keeps rows whose data_source is null", () => {
    expect(detect(week(null))).toHaveLength(1);
  });

  it("filters FALLBACK in the loader without dropping null data_source rows", async () => {
    const { calls, client } = fakeClient([]);
    await loadSwellForecastRows(client, ["b1"], new Date("2026-09-25T00:00:00Z"), new Date("2026-10-05T00:00:00Z"));
    expect(calls).toContainEqual(["or", "data_source.is.null,data_source.neq.FALLBACK"]);
    const select = calls.find(([method]) => method === "select") as [string, string];
    expect(select[1]).toContain("data_source");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events/forecast-rows.test.ts`
Expected: FAIL. `cannot create an event from FALLBACK rows` receives one event; the loader test finds no `or` call.

- [ ] **Step 3: Write the minimal implementation**

`lib/alerts/swell-events/exposure.ts`, after line 3:

```ts
/** Seasonal-curve placeholder rows (fallback-generator); never a forecast of the sea. */
export const SYNTHETIC_FORECAST_DATA_SOURCE = "FALLBACK";
```

`lib/alerts/swell-events/forecast-rows.ts` (imports, columns, query):

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

import { SYNTHETIC_FORECAST_DATA_SOURCE } from "./exposure";
import type { SwellEventForecastRow } from "./detector";
import { readAllPages } from "./paging";

const SWELL_FORECAST_COLUMNS = [
  "beach_id",
  "forecast_at",
  "data_source",
  "swell_1_height",
  "swell_1_period",
  "swell_1_direction",
  "swell_2_height",
  "swell_2_period",
  "swell_2_direction",
].join(",");

/** PostgREST `neq` drops NULL rows, so null data_source is kept explicitly. */
export const EXCLUDE_SYNTHETIC_ROWS_FILTER =
  `data_source.is.null,data_source.neq.${SYNTHETIC_FORECAST_DATA_SOURCE}`;
```

and in the query chain add `.or(EXCLUDE_SYNTHETIC_ROWS_FILTER)` directly after `.in("beach_id", beachIds)`.

`lib/alerts/swell-events/detector.ts`: import `SYNTHETIC_FORECAST_DATA_SOURCE` from `./exposure` (extend the existing import block at 21-26); change the row type and add the guard:

```ts
export type SwellEventForecastRow = Pick<
  EnhancedForecastEntity,
  | "forecast_at"
  | "swell_1_height"
  | "swell_1_period"
  | "swell_1_direction"
  | "swell_2_height"
  | "swell_2_period"
  | "swell_2_direction"
> & { data_source?: string | null };
```

```ts
  for (const forecast of forecasts) {
    // Defence in depth: loaders that select("*") still hand synthetic rows here.
    if (forecast.data_source === SYNTHETIC_FORECAST_DATA_SOURCE) continue;
    try {
```

`lib/cron/swell-alert-runner.ts`: add `import { EXCLUDE_SYNTHETIC_ROWS_FILTER } from "@/lib/alerts/swell-events/forecast-rows";` and in `loadForecasts` insert `.or(EXCLUDE_SYNTHETIC_ROWS_FILTER)` after `.in("beach_id", beachIds)`. (The runner loader is private and not unit-testable without a refactor; the detector guard is the tested control and covers it.)

`lib/alerts/swell-events/index.ts`: add `export { EXCLUDE_SYNTHETIC_ROWS_FILTER } from "./forecast-rows";` next to the existing `loadSwellForecastRows` export.

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events __tests__/lib/cron/swell-alert-runner.test.ts __tests__/lib/cron/swell-event-snapshot-runner.test.ts`
Expected: PASS (all existing swell-events and runner tests unchanged).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/alerts/swell-events/exposure.ts lib/alerts/swell-events/forecast-rows.ts lib/alerts/swell-events/detector.ts lib/alerts/swell-events/index.ts lib/cron/swell-alert-runner.ts __tests__/lib/alerts/swell-events/forecast-rows.test.ts
git commit -m "fix(swell-events): exclude FALLBACK rows from swell detection"
```

---

### Task 2: Extract Week Scout's grouping, tier and change logic

**Files:**
- Create: `lib/services/discovery/swell-tracking.ts`
- Modify: `lib/services/discovery/week-scout-swells.ts` (delete 74-80, 124-127, 133-134, 137-143, 180-232, 287-302, 492-563 at HEAD `6ddedadf9`; edit lines 29 and 51; add imports)
- Test: `__tests__/lib/services/discovery/swell-tracking.test.ts` (new); the existing `week-scout-swells.test.ts`, `week-scout-swells-service.test.ts` and `__tests__/app/api/surf-week-scout-swells-route.test.ts` must pass unmodified.

**Interfaces:**
- Consumes: `SWELL_EVENT_THRESHOLDS`, `BeachSwellEvent`, `SwellEventSnapshot` from `@/lib/alerts/swell-events`; `angleDifference`; `getLocalDateStr`, `getLocalHour`.
- Produces (all exported from `swell-tracking.ts`): `SWELL_TRACKING_RULES`; `type SwellConfidence = 'on_the_radar' | 'likely' | 'locked'`; `type SwellChangeKind`; `interface SwellChange`; `interface SwellGroup { lead: BeachSwellEvent; members: BeachSwellEvent[] }`; `groupEvents(events: readonly BeachSwellEvent[]): SwellGroup[]`; `isPreviousRun(snapshot: SwellEventSnapshot, now: Date): boolean`; `confidenceFor(lead: BeachSwellEvent, previousRuns: readonly SwellEventSnapshot[], now: Date): SwellConfidence`; `changeFor(lead, previousRuns, allSnapshots, now, timezone): SwellChange | null`; helpers `round`, `formatNumber`, `whenPhrase`. Week Scout re-exports `WeekScoutSwellChange` as an alias of `SwellChange`.

Spec note: the spec says to extract "if importing would create a cycle"; importing from `week-scout-swells.ts` would not cycle, but the grouping must not depend on Week Scout's `maxSwells: 3` slice (line 775), and the outlook should not import a 776-line Week Scout builder, so the logic moves verbatim.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/discovery/swell-tracking.test.ts
import {
  changeFor,
  confidenceFor,
  groupEvents,
} from "@/lib/services/discovery/swell-tracking";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";
import type { SwellEventSnapshot } from "@/lib/alerts/swell-events";

const NOW = new Date("2026-09-25T15:00:00.000Z");
const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "aaaaaaaa-0000-4000-8000-000000000002";

function at(days: number): string {
  return new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

function snap(peakAt: string, heightFt: number, detectedAt: string): SwellEventSnapshot {
  return {
    beachId: A, eventKey: `${A}:W:2026-09-28`, detectorVersion: "v", runDate: detectedAt.slice(0, 10), detectedAt,
    directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: heightFt, peakFaceHeightFt: heightFt,
    exposure: 1, energyRatio: 5, arrivalAt: peakAt, peakAt, fadeAt: null,
    crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
  };
}

describe("groupEvents", () => {
  it("has no cap: five swells peaking two days apart are five groups", () => {
    const events = [0, 2, 4, 6, 8].map((days) =>
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:${days}`, peakAt: at(days), directionDeg: 270, periodS: 14 }));
    expect(groupEvents(events)).toHaveLength(5);
  });

  it("merges one swell seen at two beaches", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 14, peakEnergy: 100 }),
      beachSwellEvent({ beachId: B, eventKey: `${B}:W:1`, peakAt: at(3.5), directionDeg: 280, periodS: 15, peakEnergy: 80 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(2);
  });

  it("keeps two trains at one beach apart even when direction and timing agree", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 14, peakEnergy: 100 }),
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:2`, peakAt: at(3.2), directionDeg: 275, periodS: 15, peakEnergy: 90 }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps trains more than 3 s apart in period apart (12 s vs 16 s)", () => {
    const groups = groupEvents([
      beachSwellEvent({ beachId: A, eventKey: `${A}:W:1`, peakAt: at(3), directionDeg: 270, periodS: 12, peakEnergy: 100 }),
      beachSwellEvent({ beachId: B, eventKey: `${B}:W:1`, peakAt: at(3.5), directionDeg: 285, periodS: 16, peakEnergy: 90 }),
    ]);
    expect(groups).toHaveLength(2);
  });
});

describe("confidenceFor", () => {
  it("is locked inside 36 h with a stable earlier run, likely without one", () => {
    const lead = beachSwellEvent({ peakAt: at(1), peakOffshoreHeightFt: 4 });
    const stable = snap(at(1.2), 4.2, at(-3));
    expect(confidenceFor(lead, [stable], NOW)).toBe("locked");
    expect(confidenceFor(lead, [], NOW)).toBe("likely");
  });

  it("is on the radar beyond 120 h", () => {
    expect(confidenceFor(beachSwellEvent({ peakAt: at(7) }), [snap(at(7), 4, at(-3))], NOW)).toBe("on_the_radar");
  });
});

describe("changeFor", () => {
  it("is null when no earlier run exists to prove newness", () => {
    expect(changeFor(beachSwellEvent({ peakAt: at(3) }), [], [], NOW, "America/Los_Angeles")).toBeNull();
  });

  it("reads a 25% rise as upgraded", () => {
    const lead = beachSwellEvent({ peakAt: at(3), peakOffshoreHeightFt: 5 });
    const change = changeFor(lead, [snap(at(3), 4, at(-3))], [], NOW, "America/Los_Angeles");
    expect(change?.kind).toBe("upgraded");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-tracking.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/swell-tracking'`.

- [ ] **Step 3: Write the minimal implementation**

Create `lib/services/discovery/swell-tracking.ts`. The function bodies are the existing ones, moved verbatim from `week-scout-swells.ts` (round 180-183, hoursBetween 185-187, weekdayName 189-197, partOfDay 199-210, whenPhrase 212-228, formatNumber 230-232, groupEvents 287-302, isPreviousRun 492-494, confidenceFor 496-510, sincePhrase 512-515, changeFor 517-563):

```ts
import {
  SWELL_EVENT_THRESHOLDS,
  type BeachSwellEvent,
  type SwellEventSnapshot,
} from '@/lib/alerts/swell-events';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import { getLocalDateStr, getLocalHour } from '@/lib/services/discovery/window-selector/time-slot-utils';

const HOUR_MS = 60 * 60 * 1000;

export const SWELL_TRACKING_RULES = {
  groupPeakHours: 36,
  groupPeriodS: 3,
  previousRunMinAgeHours: 18,
  stablePeakHours: 12,
  stableHeightRatio: 0.3,
  changeHeightRatio: 0.15,
  changePeakHours: 6,
  lockedLeadHours: 36,
  likelyLeadHours: 120,
} as const;

export type SwellConfidence = 'on_the_radar' | 'likely' | 'locked';
export type SwellChangeKind = 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';

export interface SwellChange {
  kind: SwellChangeKind;
  comparedToIssuedAt: string;
  previousPeakOffshoreHeightFt: number | null;
  previousPeakAt: string | null;
  summary: string;
}

export interface SwellGroup {
  lead: BeachSwellEvent;
  members: BeachSwellEvent[];
}

export function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function hoursBetween(left: string, right: string): number {
  return Math.abs(Date.parse(left) - Date.parse(right)) / HOUR_MS;
}

const weekdayFormatters = new Map<string, Intl.DateTimeFormat>();
function weekdayName(date: Date, timezone: string): string {
  let formatter = weekdayFormatters.get(timezone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: timezone });
    weekdayFormatters.set(timezone, formatter);
  }
  return formatter.format(date);
}

type PartOfDay = 'early' | 'morning' | 'midday' | 'afternoon' | 'evening' | 'night';

// Same boundaries and wording as native's formatSwellPeakWhen, so the card
// title and this text never name different parts of the day for one peak.
function partOfDay(hour: number): PartOfDay {
  if (hour < 5) return 'early';
  if (hour < 11) return 'morning';
  if (hour < 14) return 'midday';
  if (hour < 18) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

export function whenPhrase(iso: string, timezone: string, now: Date): string {
  const date = new Date(iso);
  const part = partOfDay((getLocalHour(date, timezone) ?? 12) % 24);
  const days = Math.round(
    (Date.parse(`${getLocalDateStr(date, timezone)}T12:00:00Z`)
      - Date.parse(`${getLocalDateStr(now, timezone)}T12:00:00Z`)) / (24 * HOUR_MS),
  );
  if (days === 0) {
    if (part === 'early') return 'early this morning';
    if (part === 'night') return 'tonight';
    return part === 'midday' ? 'midday today' : `this ${part}`;
  }
  const day = days === 1 ? 'tomorrow' : days === -1 ? 'yesterday' : weekdayName(date, timezone);
  if (part === 'early') return `early ${day} morning`;
  if (part === 'night' && days === -1) return 'last night';
  return `${day} ${part}`;
}

export function formatNumber(value: number): string {
  return String(round(value, 1));
}

export function groupEvents(events: readonly BeachSwellEvent[]): SwellGroup[] {
  const groups: SwellGroup[] = [];
  // Highest energy first, so each group's first member is its lead.
  for (const event of [...events].sort((left, right) => right.peakEnergy - left.peakEnergy)) {
    // Angle, not band: one swell at 200° and 205° must not split into S and SW cards.
    const group = groups.find((candidate) => (
      angleDifference(candidate.lead.directionDeg, event.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
      && hoursBetween(candidate.lead.peakAt, event.peakAt) <= SWELL_TRACKING_RULES.groupPeakHours
      && Math.abs(candidate.lead.periodS - event.periodS) <= SWELL_TRACKING_RULES.groupPeriodS
      && !candidate.members.some((member) => member.beachId === event.beachId)
    ));
    if (group) group.members.push(event);
    else groups.push({ lead: event, members: [event] });
  }
  return groups;
}

export function isPreviousRun(snapshot: SwellEventSnapshot, now: Date): boolean {
  return now.getTime() - Date.parse(snapshot.detectedAt) >= SWELL_TRACKING_RULES.previousRunMinAgeHours * HOUR_MS;
}

export function confidenceFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  now: Date,
): SwellConfidence {
  const leadHours = (Date.parse(lead.peakAt) - now.getTime()) / HOUR_MS;
  const stable = previousRuns.some((snapshot) => (
    hoursBetween(snapshot.peakAt, lead.peakAt) <= SWELL_TRACKING_RULES.stablePeakHours
    && Math.abs(lead.peakOffshoreHeightFt - snapshot.peakOffshoreHeightFt)
      <= SWELL_TRACKING_RULES.stableHeightRatio * snapshot.peakOffshoreHeightFt
  ));
  if (leadHours <= SWELL_TRACKING_RULES.lockedLeadHours) return stable ? 'locked' : 'likely';
  if (leadHours <= SWELL_TRACKING_RULES.likelyLeadHours) return stable ? 'likely' : 'on_the_radar';
  return 'on_the_radar';
}

function sincePhrase(issuedAt: string, now: Date, timezone: string): string {
  const ageHours = (now.getTime() - Date.parse(issuedAt)) / HOUR_MS;
  return ageHours < 42 ? 'yesterday' : weekdayName(new Date(issuedAt), timezone);
}

export function changeFor(
  lead: BeachSwellEvent,
  previousRuns: readonly SwellEventSnapshot[],
  allSnapshots: readonly SwellEventSnapshot[],
  now: Date,
  timezone: string,
): SwellChange | null {
  const previous = [...previousRuns].sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
  if (!previous) {
    // "New" needs proof an earlier run looked and did not see it.
    const earlierRun = allSnapshots
      .filter((snapshot) => isPreviousRun(snapshot, now))
      .sort((left, right) => Date.parse(right.detectedAt) - Date.parse(left.detectedAt))[0];
    if (!earlierRun) return null;
    const since = sincePhrase(earlierRun.detectedAt, now, timezone);
    return {
      kind: 'new',
      comparedToIssuedAt: earlierRun.detectedAt,
      previousPeakOffshoreHeightFt: null,
      previousPeakAt: null,
      summary: `Not in ${since}'s forecast`,
    };
  }

  const since = sincePhrase(previous.detectedAt, now, timezone);
  const heightChange = (lead.peakOffshoreHeightFt - previous.peakOffshoreHeightFt) / previous.peakOffshoreHeightFt;
  const peakShiftHours = (Date.parse(lead.peakAt) - Date.parse(previous.peakAt)) / HOUR_MS;
  const base = {
    comparedToIssuedAt: previous.detectedAt,
    previousPeakOffshoreHeightFt: round(previous.peakOffshoreHeightFt, 1),
    previousPeakAt: previous.peakAt,
  };
  if (heightChange >= SWELL_TRACKING_RULES.changeHeightRatio) {
    return { ...base, kind: 'upgraded', summary: `Up from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (heightChange <= -SWELL_TRACKING_RULES.changeHeightRatio) {
    return { ...base, kind: 'downgraded', summary: `Down from ${formatNumber(previous.peakOffshoreHeightFt)} ft since ${since}` };
  }
  if (Math.abs(peakShiftHours) >= SWELL_TRACKING_RULES.changePeakHours) {
    return {
      ...base,
      kind: peakShiftHours < 0 ? 'earlier' : 'later',
      summary: `Peak moved to ${whenPhrase(lead.peakAt, timezone, now)}`,
    };
  }
  return { ...base, kind: 'steady', summary: `Holding steady since ${since}` };
}
```

This is the verbatim body of the Week Scout code being removed (`round`, `hoursBetween`, `weekdayName`, `partOfDay`, `whenPhrase`, `formatNumber`, `groupEvents`, `isPreviousRun`, `confidenceFor`, `sincePhrase`, `changeFor`), with `RULES.*` renamed to `SWELL_TRACKING_RULES.*`.

Then shrink `week-scout-swells.ts` by deleting ranges in DESCENDING order so line numbers stay valid:

```bash
python3 - <<'PY'
p = 'lib/services/discovery/week-scout-swells.ts'
lines = open(p).read().split('\n')
for start, end in [(492, 563), (287, 302), (180, 232), (137, 143), (133, 134), (124, 127), (74, 80)]:
    del lines[start - 1:end]
open(p, 'w').write('\n'.join(lines))
PY
```

After the deletions, edit `week-scout-swells.ts`:

```ts
// import line 29: getLocalHour is no longer used here
import { getLocalDateStr } from '@/lib/services/discovery/window-selector/time-slot-utils';
import {
  changeFor,
  confidenceFor,
  formatNumber,
  groupEvents,
  isPreviousRun,
  round,
  whenPhrase,
  type SwellChange,
  type SwellConfidence,
  type SwellGroup,
} from '@/lib/services/discovery/swell-tracking';
```

```ts
// where interface WeekScoutSwellChange was
export type WeekScoutSwellChange = SwellChange;
```

and `confidence: 'on_the_radar' | 'likely' | 'locked';` (old line 51) becomes `confidence: SwellConfidence;`. The remaining `RULES` object keeps `maxBeaches`, `maxSwells`, `nearestRowMaxHours`, `openEndedSpanHours`, `rarityMinHistoryDays`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-tracking.test.ts __tests__/lib/services/discovery/week-scout-swells.test.ts __tests__/lib/services/discovery/week-scout-swells-service.test.ts __tests__/app/api/surf-week-scout-swells-route.test.ts`
Expected: PASS. Then `npx tsc --noEmit` and `npx eslint --max-warnings=0 lib/services/discovery/swell-tracking.ts lib/services/discovery/week-scout-swells.ts` (remove any import the tool reports unused).

- [ ] **Step 5: Commit**

```bash
git add lib/services/discovery/swell-tracking.ts lib/services/discovery/week-scout-swells.ts __tests__/lib/services/discovery/swell-tracking.test.ts
git commit -m "refactor(week-scout): extract swell grouping, tier and change logic"
```

---

### Task 3: Pulse listing rule

**Files:**
- Modify: `lib/alerts/swell-events/detector.ts` (export `ExposedSwellRow` at 79, `DayPeak` at 87, `TrackPoint` at 95, `buildTracks` at 244, `componentDays` at 274), `lib/alerts/swell-events/index.ts`
- Create: `lib/alerts/swell-events/outlook.ts`
- Test: `__tests__/lib/alerts/swell-events/outlook.test.ts` (new)

**Interfaces:**
- Consumes: `exposedSwellRows`, `swellPartitionFaceHeightFt`, `componentEnergy`, `tracksSwellComponent`, `SWELL_EVENT_BASELINE_LOOKBACK_HOURS`, `BeachSwellEvent`, `SwellEventBeach`, `SwellEventForecastRow` from `detector.ts`; `swellWindowForBeach` from `exposure.ts`.
- Produces: `SWELL_OUTLOOK_PULSE_DETECTOR_VERSION = "swell-outlook-pulse.v1"`; `SWELL_OUTLOOK_PULSE_THRESHOLDS`; `prominenceRatio(energies: readonly number[], index: number): number`; `detectBeachSwellPulses(input: { beach: SwellEventBeach; forecasts: readonly SwellEventForecastRow[]; now: Date; timezone: string }): BeachSwellEvent[]`. A pulse is a `BeachSwellEvent` whose `eventKey` is `<beachId>:<band>:<peakLocalDate>:p`.

Spec note: the spec lists `exposedSwellRows` and `swellPartitionFaceHeightFt` as reused; both are already exported. `buildTracks` and `componentDays` are private today and are exported here.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/alerts/swell-events/outlook.test.ts
import {
  SWELL_EVENT_THRESHOLDS,
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_THRESHOLDS,
  detectBeachSwellEvents,
  detectBeachSwellPulses,
  prominenceRatio,
  type SwellEventForecastRow,
} from "@/lib/alerts/swell-events";
import { NOW, TIMEZONE, dayRows, localDate, swellBeach, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const beach = swellBeach();

/** One primary partition per local day; offsets start two days back so a baseline exists. */
function series(heights: number[], periodS = 12, direction = 270): SwellEventForecastRow[] {
  return heights.flatMap((heightFt, index) => dayRows(index - 2, { heightFt, periodS, direction }, { noonBumpFt: 0.2 }));
}

function pulses(forecasts: SwellEventForecastRow[]) {
  return detectBeachSwellPulses({ beach, forecasts, now: NOW, timezone: TIMEZONE });
}

describe("detectBeachSwellPulses", () => {
  it("lists a modest 2 ft, 10 s swell the notable detector misses", () => {
    const forecasts = series([1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1], 10);
    expect(detectBeachSwellEvents({ beach, forecasts, now: NOW, timezone: TIMEZONE })).toEqual([]);
    const [pulse] = pulses(forecasts);
    expect(pulse.eventKey).toBe(`${beach.id}:W:${localDate(2)}:p`);
    expect(pulse.peakFaceHeightFt).toBeGreaterThanOrEqual(1.5);
    expect(pulse.periodS).toBe(10);
  });

  it("keeps two overlapping trains as two pulses when the surf never goes flat", () => {
    const primary = [1, 1, 1, 1, 3, 2.2, 2, 1.2, 1, 1, 1];
    const secondary = [0, 0, 0, 0, 0, 1, 4, 1.2, 0.5, 0.5, 0.5];
    const forecasts = primary.flatMap((heightFt, index) => dayRows(
      index - 2,
      { heightFt, periodS: 12, direction: 270 },
      { noonBumpFt: 0.2, secondary: secondary[index] > 0 ? { heightFt: secondary[index], periodS: 16, direction: 285 } : null },
    ));
    const found = pulses(forecasts);
    expect(found.map((pulse) => pulse.periodS)).toEqual([12, 16]);
    expect(found[0].peakAt < found[1].peakAt).toBe(true);
  });

  it("skips swells below the 1.5 ft face floor and under 9 s", () => {
    expect(pulses(series([0.6, 0.6, 0.6, 0.6, 0.8, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6]))).toEqual([]);
    expect(pulses(series([1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1], 8))).toEqual([]);
  });

  it("ignores a shoulder under 25% prominence", () => {
    const found = pulses(series([2, 2, 2, 2, 3, 2.8, 2.9, 2, 2, 2, 2]));
    expect(found).toHaveLength(1);
    expect(found[0].peakLocalDate).toBe(localDate(2));
  });

  it("skips a pulse peaking today and lists one peaking tomorrow", () => {
    expect(pulses(series([1, 1, 3, 1, 1, 1, 1, 1, 1, 1, 1]))).toEqual([]);
    expect(pulses(series([1, 1, 1, 3, 1, 1, 1, 1, 1, 1, 1])).map((pulse) => pulse.peakLocalDate)).toEqual([localDate(1)]);
  });

  it("never mutates the notable-swell thresholds", () => {
    const before = JSON.stringify(SWELL_EVENT_THRESHOLDS);
    pulses(series([1, 1, 1, 1, 3, 1, 1, 1, 1, 1, 1]));
    expect(JSON.stringify(SWELL_EVENT_THRESHOLDS)).toBe(before);
    expect(SWELL_OUTLOOK_PULSE_THRESHOLDS).toMatchObject({ minFaceHeightFt: 1.5, minPeriodS: 9, minProminenceRatio: 0.25, minRegionBeaches: 3 });
    expect(SWELL_OUTLOOK_PULSE_DETECTOR_VERSION).not.toBe("swell-events.v1");
  });

  it("returns nothing for a beach without a swell window", () => {
    const open: PartitionSpec = { heightFt: 3, periodS: 12, direction: 270 };
    expect(detectBeachSwellPulses({
      beach: swellBeach({ swell_window_center_deg: null, swell_window_halfwidth_deg: null }),
      forecasts: dayRows(1, open), now: NOW, timezone: TIMEZONE,
    })).toEqual([]);
  });
});

describe("prominenceRatio", () => {
  it("measures against the higher of the two bases", () => {
    expect(prominenceRatio([10, 100, 20, 60, 10], 1)).toBeCloseTo(0.9);
    expect(prominenceRatio([10, 100, 20, 60, 10], 3)).toBeCloseTo((60 - 20) / 60);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events/outlook.test.ts`
Expected: FAIL, `detectBeachSwellPulses is not a function` (undefined export).

- [ ] **Step 3: Write the minimal implementation**

`detector.ts`: prefix `export` on `interface ExposedSwellRow` (79), `interface DayPeak` (87), `interface TrackPoint` (95), `function buildTracks` (244) and `function componentDays` (274). No other change.

`lib/alerts/swell-events/outlook.ts`:

```ts
import { degreeToCardinal, degreesToCardinal } from "@/lib/utils/geo-utils";
import { getLocalDateStr } from "@/lib/services/discovery/window-selector/time-slot-utils";

import {
  SWELL_EVENT_BASELINE_LOOKBACK_HOURS,
  buildTracks,
  componentDays,
  componentEnergy,
  exposedSwellRows,
  tracksSwellComponent,
  type BeachSwellEvent,
  type DayPeak,
  type ExposedSwellRow,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from "./detector";
import { swellWindowForBeach } from "./exposure";

export const SWELL_OUTLOOK_PULSE_DETECTOR_VERSION = "swell-outlook-pulse.v1";

export const SWELL_OUTLOOK_PULSE_THRESHOLDS = {
  minFaceHeightFt: 1.5,
  minPeriodS: 9,
  minProminenceRatio: 0.25,
  minRegionBeaches: 3,
  regionRadiusMiles: 40,
  horizonDays: 9,
} as const;

const HOUR_MS = 60 * 60 * 1000;
// Same window as the cross-run key reuse: closer than this is one swell.
const DUPLICATE_PEAK_MS = 36 * HOUR_MS;

function addLocalDays(localDate: string, days: number): string {
  const date = new Date(`${localDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Topographic prominence of energies[index] as a share of its own height. */
export function prominenceRatio(energies: readonly number[], index: number): number {
  const peak = energies[index];
  if (!(peak > 0)) return 0;
  let leftBase = peak;
  for (let at = index - 1; at >= 0 && energies[at] <= peak; at -= 1) leftBase = Math.min(leftBase, energies[at]);
  let rightBase = peak;
  for (let at = index + 1; at < energies.length && energies[at] <= peak; at += 1) rightBase = Math.min(rightBase, energies[at]);
  return (peak - Math.max(leftBase, rightBase)) / peak;
}

function pulseFrom(args: {
  beach: SwellEventBeach;
  rows: readonly ExposedSwellRow[];
  day: DayPeak;
  baselineEnergy: number;
}): BeachSwellEvent | null {
  const peak = args.day.partition;
  if (!peak) return null;
  const onset = args.baselineEnergy + 0.5 * (args.day.energy - args.baselineEnergy);
  let arrivalIndex = args.day.rowIndex;
  while (arrivalIndex - 1 >= 0 && componentEnergy(args.rows[arrivalIndex - 1], peak) >= onset) arrivalIndex -= 1;
  let fadeAt: string | null = null;
  for (let index = args.day.rowIndex + 1; index < args.rows.length; index += 1) {
    if (componentEnergy(args.rows[index], peak) < onset) {
      fadeAt = args.rows[index].iso;
      break;
    }
  }
  const directionBand = degreesToCardinal(peak.directionDeg);
  return {
    beachId: args.beach.id,
    // The ":p" marker keeps pulse keys apart from notable keys in the shared snapshot table.
    eventKey: `${args.beach.id}:${directionBand}:${args.day.localDate}:p`,
    directionDeg: peak.directionDeg,
    directionBand,
    directionLabel: degreeToCardinal(peak.directionDeg),
    periodS: peak.periodS,
    peakOffshoreHeightFt: peak.heightFt,
    peakFaceHeightFt: args.day.faceHeightFt,
    baselineFaceHeightFt: 0,
    peakEnergy: args.day.energy,
    baselineEnergy: args.baselineEnergy,
    energyRatio: args.baselineEnergy > 0 ? Math.min(99, args.day.energy / args.baselineEnergy) : 99,
    exposure: peak.exposure,
    arrivalAt: args.rows[arrivalIndex].iso,
    peakAt: args.rows[args.day.rowIndex].iso,
    fadeAt,
    peakLocalDate: args.day.localDate,
  };
}

/**
 * Local maxima of each tracked component's daily energy with at least
 * minProminenceRatio prominence, above the face and period floors. A swell
 * still rising on the last horizon day has no right-hand neighbour and is
 * picked up by the next run.
 */
export function detectBeachSwellPulses(input: {
  beach: SwellEventBeach;
  forecasts: readonly SwellEventForecastRow[];
  now: Date;
  timezone: string;
}): BeachSwellEvent[] {
  const window = swellWindowForBeach(input.beach);
  if (!window) return [];
  const thresholds = SWELL_OUTLOOK_PULSE_THRESHOLDS;
  const today = getLocalDateStr(input.now, input.timezone);
  const lookbackStart = new Date(input.now.getTime() - SWELL_EVENT_BASELINE_LOOKBACK_HOURS * HOUR_MS);
  const rows = exposedSwellRows(input.forecasts, window, input.timezone, {
    firstDate: getLocalDateStr(lookbackStart, input.timezone),
    lastDate: addLocalDays(today, thresholds.horizonDays - 1),
  });

  const found: BeachSwellEvent[] = [];
  for (const track of buildTracks(rows)) {
    const days = componentDays(rows, track, input.beach);
    const energies = days.map((day) => day.energy);
    for (let index = 1; index < days.length - 1; index += 1) {
      const day = days[index];
      if (!day.partition || day.energy <= 0) continue;
      if (!(energies[index] >= energies[index - 1] && energies[index] > energies[index + 1])) continue;
      if (day.localDate <= today) continue;
      if (day.faceHeightFt < thresholds.minFaceHeightFt || day.partition.periodS < thresholds.minPeriodS) continue;
      if (prominenceRatio(energies, index) < thresholds.minProminenceRatio) continue;
      const pulse = pulseFrom({
        beach: input.beach,
        rows,
        day,
        baselineEnergy: Math.min(...energies.slice(0, index + 1)),
      });
      if (pulse) found.push(pulse);
    }
  }

  // Two tracks can split one swell (a period jump between rows); keep the stronger.
  const kept: BeachSwellEvent[] = [];
  for (const pulse of found.sort((left, right) => right.peakEnergy - left.peakEnergy)) {
    const duplicate = kept.some((other) => (
      tracksSwellComponent(other, pulse)
      && Math.abs(Date.parse(other.peakAt) - Date.parse(pulse.peakAt)) <= DUPLICATE_PEAK_MS
    ));
    if (!duplicate) kept.push(pulse);
  }
  return kept.sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
}
```

`index.ts`: add

```ts
export {
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_THRESHOLDS,
  detectBeachSwellPulses,
  prominenceRatio,
} from "./outlook";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events`
Expected: PASS (new file plus the unchanged detector, crossing, paging and snapshot suites).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/alerts/swell-events/detector.ts lib/alerts/swell-events/outlook.ts lib/alerts/swell-events/index.ts __tests__/lib/alerts/swell-events/outlook.test.ts
git commit -m "feat(swell-outlook): pulse listing rule with its own thresholds"
```

---

### Task 4: Pulse snapshots, keys and regional agreement

**Decision from the code:** the existing `swell_event_forecast_snapshots` table CAN hold pulses without schema change. Every NOT NULL column is filled by a pulse (`BeachSwellEvent`), and `loadRecentSwellSnapshots` already filters `detector_version`. The one trap is the unique key `(beach_id, event_key, run_date)`: a pulse and a notable event at the same beach, band and peak date would share a natural key, and `loadSwellShareEvent` reads by key without a version filter. The `:p` marker (Task 3) makes pulse keys distinct, and the share key pattern must accept it. F4's lead and outcome columns need a migration (Task 5).

**Files:**
- Modify: `lib/alerts/swell-events/snapshots.ts` (`loadRecentSwellSnapshots` 133-164, `toSwellEventSnapshotRow` 231-256), `lib/alerts/swell-events/outlook.ts` (append), `lib/alerts/swell-events/index.ts`, `lib/share/swell-share.ts` (`EVENT_KEY_PATTERN` at 83-84), `lib/cron/swell-event-snapshot-runner.ts` (columns 34-45, `SnapshotBeach` 48-60, deps 62-75, `defaultDependencies` 91-125, `processChunk` 177-230, summary 77-89 and 143-155)
- Test: `__tests__/lib/alerts/swell-events/snapshots.test.ts` (append), `__tests__/lib/alerts/swell-events/outlook.test.ts` (append), `__tests__/lib/share/swell-share.test.ts` (append), `__tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts` (new)

**Interfaces:**
- Consumes: Task 3 exports; `resolveEventKeys`; `calculateDistanceInMiles` from `@/lib/utils/distance-utils`.
- Produces: `loadRecentSwellSnapshots(supabase, beachIds, since, detectorVersion?: string)`; `toSwellEventSnapshotRow(event, detectedAt, crossing?, detectorVersion?: string)`; `interface PulseRegionCandidate { beachId: string; lat: number | null; lon: number | null; pulses: BeachSwellEvent[] }`; `filterPulsesByRegionAgreement(candidates: readonly PulseRegionCandidate[]): Map<string, BeachSwellEvent[]>`; `SnapshotBeach` gains optional `lat`/`lon`; `SwellEventSnapshotRunDependencies.loadPulseSnapshots?: (beachIds: string[], since: Date) => Promise<SwellEventSnapshot[]>`; run summary gains `pulsesDetected`, `pulseSnapshotsWritten`.

Spec note: "region" has no field the code can rely on (`beaches.region_id` is nullable and unseeded in types). The plan defines region as beaches within `regionRadiusMiles` (40) of the pulse's beach; see Human judgment.

- [ ] **Step 1: Write the failing tests**

Append to `__tests__/lib/alerts/swell-events/snapshots.test.ts` (add `SWELL_OUTLOOK_PULSE_DETECTOR_VERSION` to the file's existing `@/lib/alerts/swell-events` import block, then add the new `describe`):

```ts

describe("pulse snapshot versioning", () => {
  it("writes the pulse detector version and keeps the notable default", () => {
    const at = new Date("2026-09-25T14:30:00.000Z");
    expect(toSwellEventSnapshotRow(event(), at).detector_version).toBe(SWELL_EVENT_DETECTOR_VERSION);
    expect(toSwellEventSnapshotRow(event(), at, null, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION).detector_version)
      .toBe(SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
  });

  it("reads only the requested detector version", async () => {
    const eq = jest.fn();
    const builder: Record<string, unknown> = {};
    for (const method of ["select", "in", "gte", "order"]) builder[method] = () => builder;
    builder.eq = (...args: unknown[]) => { eq(...args); return builder; };
    builder.range = () => Promise.resolve({ data: [], error: null });
    const client = { from: () => builder } as unknown as SupabaseClient<Database>;
    await loadRecentSwellSnapshots(client, [BEACH], new Date(), SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    expect(eq).toHaveBeenCalledWith("detector_version", SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    eq.mockClear();
    await loadRecentSwellSnapshots(client, [BEACH], new Date());
    expect(eq).toHaveBeenCalledWith("detector_version", SWELL_EVENT_DETECTOR_VERSION);
  });
});
```

Append to `__tests__/lib/share/swell-share.test.ts`:

```ts
describe("pulse event keys", () => {
  const BEACH_ID = "402ec6ad-4e80-47d2-882f-5053eb9aa433";
  it("accepts the :p pulse marker and its collision suffix", () => {
    expect(parseSwellEventKey(`${BEACH_ID}:S:2026-10-08:p`)).toEqual({ eventKey: `${BEACH_ID}:S:2026-10-08:p`, beachId: BEACH_ID });
    expect(parseSwellEventKey(`${BEACH_ID}:S:2026-10-08:p:2`)?.eventKey).toBe(`${BEACH_ID}:S:2026-10-08:p:2`);
    expect(parseSwellEventKey(`${BEACH_ID}:S:2026-10-08:q`)).toBeNull();
  });
});
```

(If `parseSwellEventKey` is not already imported at the top of that test file, add it to the existing import from `@/lib/share/swell-share`.)

Append to `__tests__/lib/alerts/swell-events/outlook.test.ts` (add `filterPulsesByRegionAgreement` to its existing `@/lib/alerts/swell-events` import and `beachSwellEvent` to its existing helpers import, then add the new `describe`):

```ts

describe("filterPulsesByRegionAgreement", () => {
  const ids = ["aaaaaaaa-0000-4000-8000-000000000001", "aaaaaaaa-0000-4000-8000-000000000002", "aaaaaaaa-0000-4000-8000-000000000003", "aaaaaaaa-0000-4000-8000-000000000004"];
  const near = (index: number) => ({ lat: 32.7 + index * 0.05, lon: -117.25 - index * 0.01 });
  const pulse = (beachId: string, overrides = {}) => beachSwellEvent({ beachId, eventKey: `${beachId}:W:2026-09-28:p`, directionDeg: 270, periodS: 12, peakAt: "2026-09-28T19:00:00.000Z", ...overrides });

  it("keeps a pulse seen by three beaches inside the region", () => {
    const kept = filterPulsesByRegionAgreement(ids.slice(0, 3).map((id, index) => ({ beachId: id, ...near(index), pulses: [pulse(id)] })));
    expect([...kept.keys()].sort()).toEqual(ids.slice(0, 3));
  });

  it("drops a pulse only two beaches agree on", () => {
    expect(filterPulsesByRegionAgreement(ids.slice(0, 2).map((id, index) => ({ beachId: id, ...near(index), pulses: [pulse(id)] }))).size).toBe(0);
  });

  it("does not count a far beach or a different swell", () => {
    const candidates = [
      { beachId: ids[0], ...near(0), pulses: [pulse(ids[0])] },
      { beachId: ids[1], ...near(1), pulses: [pulse(ids[1])] },
      { beachId: ids[2], lat: 34.0, lon: -118.5, pulses: [pulse(ids[2])] },
      { beachId: ids[3], ...near(2), pulses: [pulse(ids[3], { directionDeg: 180, periodS: 17 })] },
    ];
    expect(filterPulsesByRegionAgreement(candidates).size).toBe(0);
  });

  it("never counts a beach without coordinates", () => {
    expect(filterPulsesByRegionAgreement(ids.slice(0, 3).map((id) => ({ beachId: id, lat: null, lon: null, pulses: [pulse(id)] }))).size).toBe(0);
  });
});
```

New `__tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts`:

```ts
/**
 * @jest-environment node
 */
import {
  runSwellEventSnapshotCron,
  type SnapshotBeach,
  type SwellEventSnapshotRunDependencies,
} from "@/lib/cron/swell-event-snapshot-runner";
import {
  SWELL_EVENT_DETECTOR_VERSION,
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
  type SwellEventSnapshotRow,
} from "@/lib/alerts/swell-events";
import { FLAT, NOW, dayRows, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const PEAK: PartitionSpec = { heightFt: 4, periodS: 16, direction: 270 };
const IDS = [1, 2, 3].map((n) => `bbbbbbbb-0000-4000-8000-00000000000${n}`);

function beach(id: string, index: number): SnapshotBeach {
  return {
    id, name: `Beach ${index}`, slug: `beach-${index}`, timezone: "America/Los_Angeles",
    swell_window_center_deg: 270, swell_window_halfwidth_deg: 30, swell_access_factors: null,
    terrain_enabled: false, shoaling_factors: null, deepwater_decay_factor: null,
    lat: 32.7 + index * 0.05, lon: -117.25,
  };
}

function toSnapshot(row: SwellEventSnapshotRow): SwellEventSnapshot {
  return {
    beachId: row.beach_id, eventKey: row.event_key, detectorVersion: row.detector_version, runDate: row.run_date,
    detectedAt: row.detected_at, directionDeg: row.direction_deg, directionBand: row.direction_band, periodS: row.period_s,
    peakOffshoreHeightFt: row.peak_offshore_height_ft, peakFaceHeightFt: row.peak_face_height_ft, exposure: row.exposure,
    energyRatio: row.energy_ratio, arrivalAt: row.arrival_at, peakAt: row.peak_at, fadeAt: row.fade_at,
    crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
  };
}

function swellWeek(): SwellEventForecastRow[] {
  return Array.from({ length: 8 }, (_, day) => dayRows(day, day === 3 ? PEAK : FLAT, { noonBumpFt: day === 3 ? 0.2 : 0 })).flat();
}

function harness(beaches: SnapshotBeach[]) {
  const store: SwellEventSnapshotRow[] = [];
  const deps: SwellEventSnapshotRunDependencies = {
    loadBeaches: async () => beaches,
    loadLatestForecastUpdates: async (ids) => new Map(ids.map((id) => [id, { updatedAt: "2026-09-25T12:00:00.000Z", dataSource: "NOAA_NWS" }])),
    loadForecasts: async (ids) => new Map(ids.map((id) => [id, swellWeek()])),
    loadSnapshots: async () => store.filter((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION).map(toSnapshot),
    loadPulseSnapshots: async () => store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION).map(toSnapshot),
    writeSnapshots: async (rows) => { store.push(...rows); return rows.length; },
    isStale: () => false,
  };
  return { deps, store };
}

describe("runSwellEventSnapshotCron pulse snapshots", () => {
  it("writes pulse rows under their own version and key marker when three beaches agree", async () => {
    const { deps, store } = harness(IDS.map(beach));
    const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    const pulseRows = store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION);
    expect(pulseRows).toHaveLength(3);
    expect(pulseRows.every((row) => row.event_key.endsWith(":p"))).toBe(true);
    expect(store.filter((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toHaveLength(3);
    expect(summary).toMatchObject({ pulsesDetected: 3, pulseSnapshotsWritten: 3 });
  });

  it("writes no pulse rows when only two beaches agree", async () => {
    const { deps, store } = harness(IDS.slice(0, 2).map(beach));
    await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(store.filter((row) => row.detector_version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)).toEqual([]);
  });

  it("writes nothing for pulses when the pulse snapshot loader is absent", async () => {
    const { deps, store } = harness(IDS.map(beach));
    delete deps.loadPulseSnapshots;
    await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
    expect(store.every((row) => row.detector_version === SWELL_EVENT_DETECTOR_VERSION)).toBe(true);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events/snapshots.test.ts __tests__/lib/alerts/swell-events/outlook.test.ts __tests__/lib/share/swell-share.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts`
Expected: FAIL (`filterPulsesByRegionAgreement is not a function`; the `:p` key returns null; the version argument is ignored; no pulse rows).

- [ ] **Step 3: Write the minimal implementation**

`snapshots.ts`: change the signatures and the two uses of the constant:

```ts
export async function loadRecentSwellSnapshots(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  since: Date,
  detectorVersion: string = SWELL_EVENT_DETECTOR_VERSION,
): Promise<SwellEventSnapshot[]> {
```
(`.eq("detector_version", detectorVersion)` replaces the constant at line 149.)

```ts
export function toSwellEventSnapshotRow(
  event: BeachSwellEvent,
  detectedAt: Date,
  crossing: SwellCrossing | null = null,
  detectorVersion: string = SWELL_EVENT_DETECTOR_VERSION,
): SwellEventSnapshotRow {
```
(`detector_version: detectorVersion,` replaces the constant at line 239.)

`lib/share/swell-share.ts` line 83-84:

```ts
const EVENT_KEY_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):[NESW]{1,3}:\d{4}-\d{2}-\d{2}(?::p)?(?::\d{1,2})?$/i;
```
and extend the comment above it: `plus the ":p" marker of outlook pulse keys`.

Append to `outlook.ts` (add `import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";` at the top):

```ts
export interface PulseRegionCandidate {
  beachId: string;
  lat: number | null;
  lon: number | null;
  pulses: BeachSwellEvent[];
}

function sameSwell(left: BeachSwellEvent, right: BeachSwellEvent): boolean {
  return tracksSwellComponent(left, right)
    && Math.abs(Date.parse(left.peakAt) - Date.parse(right.peakAt)) <= DUPLICATE_PEAK_MS;
}

function withinRegion(left: PulseRegionCandidate, right: PulseRegionCandidate): boolean {
  if (left.lat === null || left.lon === null || right.lat === null || right.lon === null) return false;
  return calculateDistanceInMiles(
    { lat: left.lat, lon: left.lon },
    { lat: right.lat, lon: right.lon },
  ) <= SWELL_OUTLOOK_PULSE_THRESHOLDS.regionRadiusMiles;
}

/** Keeps a pulse only when enough beaches within the region detect the same swell. */
export function filterPulsesByRegionAgreement(
  candidates: readonly PulseRegionCandidate[],
): Map<string, BeachSwellEvent[]> {
  const kept = new Map<string, BeachSwellEvent[]>();
  for (const candidate of candidates) {
    const agreeing = candidate.pulses.filter((pulse) => {
      const beaches = new Set<string>([candidate.beachId]);
      for (const other of candidates) {
        if (beaches.has(other.beachId) || !withinRegion(candidate, other)) continue;
        if (other.pulses.some((otherPulse) => sameSwell(pulse, otherPulse))) beaches.add(other.beachId);
      }
      return beaches.size >= SWELL_OUTLOOK_PULSE_THRESHOLDS.minRegionBeaches;
    });
    if (agreeing.length > 0) kept.set(candidate.beachId, agreeing);
  }
  return kept;
}
```

`index.ts`: add `filterPulsesByRegionAgreement` and `type PulseRegionCandidate` to the `./outlook` export.

`swell-event-snapshot-runner.ts`:

Imports: the file already imports `loadRecentSwellSnapshots`, `resolveEventKeys` and `toSwellEventSnapshotRow`; add

```ts
import {
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  detectBeachSwellPulses,
  filterPulsesByRegionAgreement,
  type BeachSwellEvent,
  type PulseRegionCandidate,
} from "@/lib/alerts/swell-events";
```

`BEACH_COLUMNS` (line 34-45): add `"lat",` and `"lon",` after `"timezone",`.

```ts
export type SnapshotBeach = Pick<Beach, /* existing union */> & {
  lat?: number | null;
  lon?: number | null;
};
```

Dependencies interface: add `loadPulseSnapshots?: (beachIds: string[], since: Date) => Promise<SwellEventSnapshot[]>;` and in `defaultDependencies`:

```ts
    loadPulseSnapshots: (beachIds, since) => (
      loadRecentSwellSnapshots(client, beachIds, since, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION)
    ),
```

Summary: add `pulsesDetected: number; pulseSnapshotsWritten: number;` to `SwellEventSnapshotRunSummary` and `pulsesDetected: 0, pulseSnapshotsWritten: 0,` to its initialiser.

In `runSwellEventSnapshotCron` before `processChunk`:

```ts
  const pulseCandidates: PulseRegionCandidate[] = [];
  const PULSE_WRITE_CHUNK = 500;
```

In `processChunk`, load pulse snapshots next to the others:

```ts
      const [forecasts, snapshots, pulseSnapshots] = await Promise.all([
        deps.loadForecasts(ids, from, to),
        deps.loadSnapshots(ids, since),
        deps.loadPulseSnapshots ? deps.loadPulseSnapshots(ids, since) : Promise.resolve([]),
      ]);
```

and inside the per-beach `try`, after the notable `rows.push(...)`:

```ts
          if (deps.loadPulseSnapshots) {
            const pulses = resolveEventKeys(
              detectBeachSwellPulses({ beach: swellBeach, forecasts: beachForecasts, now: args.now, timezone }),
              pulseSnapshots.filter((snapshot) => snapshot.beachId === beach.id),
            );
            summary.pulsesDetected += pulses.length;
            pulseCandidates.push({ beachId: beach.id, lat: beach.lat ?? null, lon: beach.lon ?? null, pulses });
          }
```

After the `Promise.all` over chunks and before `summary.durationMs`:

```ts
  if (deps.loadPulseSnapshots) {
    try {
      const pulseRows = [...filterPulsesByRegionAgreement(pulseCandidates).values()]
        .flat()
        .map((pulse: BeachSwellEvent) => toSwellEventSnapshotRow(pulse, args.now, null, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION));
      for (let offset = 0; offset < pulseRows.length; offset += PULSE_WRITE_CHUNK) {
        summary.pulseSnapshotsWritten += await deps.writeSnapshots(pulseRows.slice(offset, offset + PULSE_WRITE_CHUNK));
      }
    } catch (error) {
      summary.chunksFailed += 1;
      console.warn("[swell-event-snapshots] pulse write failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
```


- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-events __tests__/lib/share __tests__/lib/cron/swell-event-snapshot-runner.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts __tests__/app/api/swell-event-route.test.ts __tests__/app/app-swell-share-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/alerts/swell-events lib/share/swell-share.ts lib/cron/swell-event-snapshot-runner.ts __tests__/lib/alerts/swell-events __tests__/lib/share/swell-share.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts
git commit -m "feat(swell-outlook): persist pulse snapshots under their own version"
```

---

### Task 5: F4, lead and outcome on snapshots

**Files:**
- Create: `supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql` (written, NOT applied), `supabase/tests/swell_snapshot_outcomes.sql`, `scripts/test-swell-snapshot-outcomes-postgres.sh`
- Modify: `lib/alerts/swell-events/snapshots.ts` (`SwellEventSnapshotRow` 64-83, `toSwellEventSnapshotRow`), `lib/cron/swell-event-snapshot-runner.ts` (deps, summary, end of run)
- Test: `__tests__/migrations/swell-snapshot-lead-and-outcome.test.ts` (new), `__tests__/lib/alerts/swell-events/snapshots.test.ts` (append), `__tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts` (append)

**Interfaces:**
- Consumes: Task 4 runner and `toSwellEventSnapshotRow`.
- Produces: `SwellEventSnapshotRow.lead_days?: number | null` (days from run to peak, 2 decimals); `SwellEventSnapshotRunDependencies.resolveOutcomes?: (now: Date) => Promise<number>`; summary `outcomesResolved`; SQL function `public.resolve_swell_event_outcomes(p_now timestamptz) returns integer` (service role only); columns `lead_days numeric`, `outcome text CHECK ('held','vanished')`, `outcome_resolved_at timestamptz`.

Outcome definition: for an event whose peak is more than 12 h past, `held` when its latest snapshot was written on the last run before the peak (or no earlier run exists), else `vanished`. Every row of the event gets the same outcome, so a vanish rate by first-seen lead is a query over `swell_event_forecast_snapshots` that takes `lead_days` from each event's earliest `run_date` row and `outcome` from any of its rows. Caveat recorded in the migration: a beach skipped as stale on that last run reads as `vanished`.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/migrations/swell-snapshot-lead-and-outcome.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql"),
  "utf8",
);

describe("swell snapshot lead and outcome migration", () => {
  it("runs in one transaction", () => {
    expect(sql.trim().split("\n").filter((line) => !line.startsWith("--"))[0]).toBe("BEGIN;");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
  });

  it("adds nullable columns only, with a closed outcome vocabulary", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS lead_days numeric NULL/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS outcome text NULL/);
    expect(sql).toMatch(/CHECK \(outcome IN \('held', 'vanished'\)\)/);
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS outcome_resolved_at timestamptz NULL/);
    expect(sql).not.toMatch(/DROP (TABLE|COLUMN)|DELETE FROM|TRUNCATE/);
  });

  it("keeps the resolver service role only", () => {
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.resolve_swell_event_outcomes\(timestamptz\) FROM PUBLIC, anon, authenticated/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.resolve_swell_event_outcomes\(timestamptz\) TO service_role/);
  });
});
```

Append to `snapshots.test.ts`:

```ts
it("records the lead in days from the run to the peak", () => {
  const row = toSwellEventSnapshotRow(event(), new Date("2026-09-25T19:00:00.000Z"));
  expect(row.lead_days).toBe(3);
});
```
(`event()` peaks 2026-09-28T19:00Z, exactly 3 days after the run time.)

Append to `swell-event-snapshot-runner-pulses.test.ts`:

```ts
it("resolves outcomes after writing and reports the count", async () => {
  const { deps } = harness(IDS.map(beach));
  const resolveOutcomes = jest.fn(async () => 4);
  deps.resolveOutcomes = resolveOutcomes;
  const summary = await runSwellEventSnapshotCron({ now: NOW, dependencies: deps });
  expect(resolveOutcomes).toHaveBeenCalledWith(NOW);
  expect(summary.outcomesResolved).toBe(4);
});

it("never fails the run when outcome resolution throws", async () => {
  const { deps } = harness(IDS.map(beach));
  deps.resolveOutcomes = async () => { throw new Error("rpc down"); };
  jest.spyOn(console, "warn").mockImplementation(() => {});
  await expect(runSwellEventSnapshotCron({ now: NOW, dependencies: deps })).resolves.toMatchObject({ outcomesResolved: 0 });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/migrations/swell-snapshot-lead-and-outcome.test.ts __tests__/lib/alerts/swell-events/snapshots.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts`
Expected: FAIL (ENOENT on the migration; `lead_days` undefined; `resolveOutcomes` never called).

- [ ] **Step 3: Write the minimal implementation**

`supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql`:

```sql
-- F4 (swell outlook spec): record each snapshot's lead and, once the peak has
-- passed, whether the event was still present on the last run before it.
-- Written by /api/cron/swell-event-snapshots with the service role only.
-- Caveat: a beach skipped as stale on that last run has no row and reads as
-- 'vanished'.
BEGIN;

ALTER TABLE public.swell_event_forecast_snapshots
  ADD COLUMN IF NOT EXISTS lead_days numeric NULL,
  ADD COLUMN IF NOT EXISTS outcome text NULL CHECK (outcome IN ('held', 'vanished')),
  ADD COLUMN IF NOT EXISTS outcome_resolved_at timestamptz NULL;

COMMENT ON COLUMN public.swell_event_forecast_snapshots.lead_days IS
  'Days from this run (detected_at) to the predicted peak.';
COMMENT ON COLUMN public.swell_event_forecast_snapshots.outcome IS
  'held: the event was on the last run before its peak. vanished: it was not.';

CREATE OR REPLACE FUNCTION public.resolve_swell_event_outcomes(p_now timestamptz)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  resolved integer;
BEGIN
  WITH latest AS (
    SELECT DISTINCT ON (beach_id, event_key, detector_version)
      beach_id, event_key, detector_version, peak_at, detected_at
    FROM public.swell_event_forecast_snapshots
    WHERE outcome IS NULL
    ORDER BY beach_id, event_key, detector_version, detected_at DESC
  ),
  due AS (
    SELECT l.*,
      (SELECT max(s.detected_at) FROM public.swell_event_forecast_snapshots s WHERE s.detected_at < l.peak_at) AS last_run
    FROM latest l
    WHERE l.peak_at < p_now - interval '12 hours'
  )
  UPDATE public.swell_event_forecast_snapshots s
  SET outcome = CASE WHEN d.last_run IS NULL OR d.detected_at >= d.last_run THEN 'held' ELSE 'vanished' END,
      outcome_resolved_at = p_now
  FROM due d
  WHERE s.beach_id = d.beach_id
    AND s.event_key = d.event_key
    AND s.detector_version = d.detector_version
    AND s.outcome IS NULL;
  GET DIAGNOSTICS resolved = ROW_COUNT;
  RETURN resolved;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_swell_event_outcomes(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_swell_event_outcomes(timestamptz) TO service_role;

COMMIT;
```

`snapshots.ts`: add `lead_days?: number | null;` to `SwellEventSnapshotRow` and in `toSwellEventSnapshotRow`'s returned object:

```ts
    lead_days: Math.round(((Date.parse(event.peakAt) - detectedAt.getTime()) / 86_400_000) * 100) / 100,
```

`swell-event-snapshot-runner.ts`: dependencies `resolveOutcomes?: (now: Date) => Promise<number>;`; default dependency:

```ts
    resolveOutcomes: async (now) => {
      const { data, error } = await (client as unknown as SupabaseClient).rpc("resolve_swell_event_outcomes", { p_now: now.toISOString() });
      if (error) throw new Error(`Failed to resolve swell event outcomes: ${error.message}`);
      return typeof data === "number" ? data : 0;
    },
```
(`resolve_swell_event_outcomes` is not in the generated types; the cast mirrors `loadSwellCrossingHistory`.) Summary: `outcomesResolved: number` (initial `0`). After the pulse-write block:

```ts
  if (deps.resolveOutcomes) {
    try {
      summary.outcomesResolved = await deps.resolveOutcomes(args.now);
    } catch (error) {
      console.warn("[swell-event-snapshots] outcome resolution failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
```

`supabase/tests/swell_snapshot_outcomes.sql`:

```sql
\set ON_ERROR_STOP on
-- Disposable local cluster only; run scripts/test-swell-snapshot-outcomes-postgres.sh.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE TABLE public.beaches (id uuid PRIMARY KEY, timezone text);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
\ir ../migrations/20260925150500_create_swell_event_forecast_snapshots.sql
\ir ../migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql
\ir ../migrations/20261004210000_create_swell_outlook_user_state.sql

INSERT INTO public.beaches VALUES
  ('00000000-0000-4000-8000-000000000001', 'America/Los_Angeles'),
  ('00000000-0000-4000-8000-000000000002', 'America/Los_Angeles');

CREATE FUNCTION fixture_snapshot(p_beach uuid, p_key text, p_run date, p_detected timestamptz, p_peak timestamptz)
RETURNS void LANGUAGE sql AS $$
  INSERT INTO public.swell_event_forecast_snapshots
    (beach_id, event_key, detector_version, run_date, detected_at, direction_deg, direction_band, period_s,
     peak_offshore_height_ft, peak_face_height_ft, exposure, energy_ratio, arrival_at, peak_at)
  VALUES (p_beach, p_key, 'swell-events.v1', p_run, p_detected, 270, 'W', 14, 4, 5, 1, 5, p_peak, p_peak);
$$;

-- Runs on 10-01, 10-02, 10-03 (canary event on beach 2 is on all three).
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000002', 'canary', d::date, d + time '14:30', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-03', interval '1 day') d;
-- vanished: seen 10-01 and 10-02, absent on the last run before its 10-04 peak.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'gone', d::date, d + time '14:30', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-02', interval '1 day') d;
-- held: present on all three runs.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'stayed', d::date, d + time '14:30', timestamptz '2026-10-04 20:00+00')
FROM generate_series(timestamptz '2026-10-01', timestamptz '2026-10-03', interval '1 day') d;
-- not due: peaks in the future.
SELECT fixture_snapshot('00000000-0000-4000-8000-000000000001', 'later', '2026-10-03', timestamptz '2026-10-03 14:30+00', timestamptz '2026-10-20 20:00+00');

SELECT public.resolve_swell_event_outcomes(timestamptz '2026-10-05 12:00+00') AS resolved \gset

DO $$
BEGIN
  ASSERT (SELECT bool_and(outcome = 'vanished') FROM public.swell_event_forecast_snapshots WHERE event_key = 'gone'), 'gone should be vanished';
  ASSERT (SELECT count(*) FROM public.swell_event_forecast_snapshots WHERE event_key = 'gone') = 2, 'gone keeps both rows';
  ASSERT (SELECT bool_and(outcome = 'held') FROM public.swell_event_forecast_snapshots WHERE event_key IN ('stayed', 'canary')), 'stayed and canary should be held';
  ASSERT (SELECT outcome IS NULL FROM public.swell_event_forecast_snapshots WHERE event_key = 'later'), 'future peak stays unresolved';
END $$;

-- Idempotent: a second call resolves nothing.
SELECT public.resolve_swell_event_outcomes(timestamptz '2026-10-05 12:00+00') AS second \gset
DO $$ BEGIN ASSERT :second = 0, 'second call resolves nothing'; END $$;
SELECT 'swell snapshot outcomes OK: ' || :resolved || ' rows resolved';
```

`scripts/test-swell-snapshot-outcomes-postgres.sh` (disposable local cluster, modelled on `scripts/test-week-scout-match-postgres.sh`):

```bash
#!/usr/bin/env bash
# Disposable local cluster only. No env files, URLs, or existing databases.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
pg_bin="${SCOUT_PG_BIN:-/opt/homebrew/opt/postgresql@15/bin}"
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 TMPDIR=/tmp
tmp="$(mktemp -d /tmp/quiver-swell-outcomes-test.XXXXXX)"
cleanup() {
  "$pg_bin/pg_ctl" -D "$tmp/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$tmp"
}
trap cleanup EXIT
"$pg_bin/initdb" -D "$tmp/data" -A trust --no-locale >/dev/null
"$pg_bin/pg_ctl" -D "$tmp/data" -l "$tmp/postgres.log" -o "-k $tmp -c listen_addresses=''" -w start >/dev/null
"$pg_bin/psql" -X -h "$tmp" -p 5432 -U "$(id -un)" -d postgres -v ON_ERROR_STOP=1 -f "$root/supabase/tests/swell_snapshot_outcomes.sql"
```

Run `chmod +x scripts/test-swell-snapshot-outcomes-postgres.sh`. The harness also applies the Task 11 migration, so it is run for real in Task 11 Step 4 and again in Task 14; at this step run only the Jest tests.

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/migrations/swell-snapshot-lead-and-outcome.test.ts __tests__/lib/alerts/swell-events __tests__/lib/cron/swell-event-snapshot-runner.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20261004200000_add_swell_snapshot_lead_and_outcome.sql supabase/tests/swell_snapshot_outcomes.sql scripts/test-swell-snapshot-outcomes-postgres.sh lib/alerts/swell-events/snapshots.ts lib/cron/swell-event-snapshot-runner.ts __tests__/migrations/swell-snapshot-lead-and-outcome.test.ts __tests__/lib/alerts/swell-events/snapshots.test.ts __tests__/lib/cron/swell-event-snapshot-runner-pulses.test.ts
git commit -m "feat(swell-events): record snapshot lead and outcome (migration written, not applied)"
```

---

### Task 6: Outlook types and fit for the user

**Files:**
- Create: `lib/services/discovery/swell-outlook-types.ts`, `lib/services/discovery/swell-outlook-fit.ts`
- Test: `__tests__/lib/services/discovery/swell-outlook-fit.test.ts` (new)

**Interfaces:**
- Consumes: `getRideabilityBand(skill: SkillLevel, board: BoardClass | null): RideabilityBand` and `BoardClass` from `@/lib/domains/rideability`; `SkillLevel` from `@/lib/domains/user-preferences`; `SwellChangeKind`, `SwellConfidence` from Task 2.
- Produces: all response types (`OutlookTier`, `OutlookStatus`, `OutlookChange`, `SwellFitStatus`, `SwellFit`, `SwellSource`, `FaceHeightRangeFt`, `OutlookSwell`, `SwellOutlookResponse`, `StoredOutlookList`) from `swell-outlook-types.ts`; `swellFitFor(args: { faceHeightFt: number | null; skillLevel: SkillLevel | null; boardClasses: readonly BoardClass[] }): SwellFit` from `swell-outlook-fit.ts`.

Spec note: Week Scout's `weekScoutRideableBands`/`sizeFitFor` use the ACCEPTABLE band for `in_range`. The spec says that is too loose here, so the outlook reads `getRideabilityBand(...).ideal` and `.acceptable` itself and does not call those helpers. Boards map through `normalizeBoardClass` (Task 12), not `mapBoardTypeToBoardClass`, which turns an unknown type into a foamie.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/discovery/swell-outlook-fit.test.ts
import { swellFitFor } from "@/lib/services/discovery/swell-outlook-fit";

describe("swellFitFor", () => {
  it("advanced, shortboard only: 2.5 ft is rideable, not in range (spec worked example)", () => {
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "advanced", boardClasses: ["shortboard"] }))
      .toEqual({ status: "rideable", boards: [] });
  });

  it("advanced with a longboard too: 2.5 ft is in range on the longboard", () => {
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "advanced", boardClasses: ["shortboard", "longboard"] }))
      .toEqual({ status: "in_range", boards: ["longboard"] });
  });

  it("Steven's quiver: 1.2 ft is longboard-only, 2.5 ft fits all three", () => {
    const boardClasses = ["shortboard", "fish", "longboard"] as const;
    expect(swellFitFor({ faceHeightFt: 1.2, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "in_range", boards: ["longboard"] });
    expect(swellFitFor({ faceHeightFt: 2.5, skillLevel: "intermediate", boardClasses }))
      .toEqual({ status: "in_range", boards: ["shortboard", "fish", "longboard"] });
  });

  it("is below range under every acceptable band and above range over every one", () => {
    expect(swellFitFor({ faceHeightFt: 1, skillLevel: "advanced", boardClasses: ["shortboard"] }).status).toBe("below_range");
    expect(swellFitFor({ faceHeightFt: 14, skillLevel: "advanced", boardClasses: ["shortboard"] }).status).toBe("above_range");
  });

  it("uses the skill level's default band when no boards are recorded", () => {
    expect(swellFitFor({ faceHeightFt: 1, skillLevel: "beginner", boardClasses: [] })).toEqual({ status: "in_range", boards: [] });
    expect(swellFitFor({ faceHeightFt: 0.4, skillLevel: "beginner", boardClasses: [] }).status).toBe("below_range");
  });

  it("is unknown without a skill level or a size, but never throws", () => {
    expect(swellFitFor({ faceHeightFt: 3, skillLevel: null, boardClasses: ["shortboard"] })).toEqual({ status: "unknown", boards: [] });
    expect(swellFitFor({ faceHeightFt: null, skillLevel: "advanced", boardClasses: [] })).toEqual({ status: "unknown", boards: [] });
    expect(swellFitFor({ faceHeightFt: Number.NaN, skillLevel: "advanced", boardClasses: [] }).status).toBe("unknown");
  });

  it("calls a size in the gap between two boards' bands by the nearest edge, above on a tie", () => {
    // beginner: longboard acceptable 0.3-2.8, shortboard acceptable 0.6-4.2; 4.5 ft is above both.
    expect(swellFitFor({ faceHeightFt: 4.5, skillLevel: "beginner", boardClasses: ["longboard", "shortboard"] }).status).toBe("above_range");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-fit.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/swell-outlook-fit'`.

- [ ] **Step 3: Write the minimal implementation**

`lib/services/discovery/swell-outlook-types.ts` (matches the spec's interfaces field for field):

```ts
import type { BoardClass } from '@/lib/domains/rideability';

import type { SwellChangeKind, SwellConfidence } from './swell-tracking';

export type OutlookTier = SwellConfidence | 'early_signal';
export type OutlookStatus = 'forecast' | 'shrinking' | 'arrived' | 'faded';
export type OutlookChange = SwellChangeKind;
export type SwellFitStatus = 'in_range' | 'rideable' | 'below_range' | 'above_range' | 'unknown';
export type SwellSource = 'southern_hemisphere' | 'tropical' | 'north_pacific' | 'local' | 'unknown';

export interface SwellFit {
  status: SwellFitStatus;
  /** The user's board classes whose IDEAL band contains this size; empty unless in_range. */
  boards: BoardClass[];
}

export interface FaceHeightRangeFt {
  min: number;
  max: number;
}

export interface OutlookSwell {
  id: string;
  eventKey: string;
  tier: OutlookTier;
  status: OutlookStatus;
  change: OutlookChange;
  arrivalAt: string | null;
  peakAt: string;
  peakWindow: { from: string; to: string } | null;
  faceHeightFt: FaceHeightRangeFt;
  periodS: number | null;
  directionDeg: number;
  directionLabel: string;
  beach: { id: string; name: string };
  beachCount: number;
  notable: boolean;
  fit: SwellFit;
  source: SwellSource;
  stormName: string | null;
  sizeByOrientation: {
    southFacing: FaceHeightRangeFt | null;
    westFacing: FaceHeightRangeFt | null;
  };
  history: Array<{ runDate: string; peakAt: string; faceHeightFt: number; periodS: number | null }>;
}

export interface SwellOutlookResponse {
  generatedAt: string;
  runDate: string;
  horizonDays: number;
  homeBeach: { id: string; name: string } | null;
  swells: OutlookSwell[];
}

/** The list as it was returned for one snapshot run; sticky tracking compares against the previous one. */
export interface StoredOutlookList {
  runDate: string;
  swells: OutlookSwell[];
}
```

`lib/services/discovery/swell-outlook-fit.ts`:

```ts
import { getRideabilityBand, type BoardClass } from '@/lib/domains/rideability';
import type { SkillLevel } from '@/lib/domains/user-preferences';

import type { SwellFit } from './swell-outlook-types';

interface Range {
  readonly min: number;
  readonly max: number;
}

function contains(range: Range, value: number): boolean {
  return value >= range.min && value <= range.max;
}

export function swellFitFor(args: {
  faceHeightFt: number | null;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
}): SwellFit {
  const { faceHeightFt, skillLevel } = args;
  if (faceHeightFt === null || !Number.isFinite(faceHeightFt) || skillLevel === null) {
    return { status: 'unknown', boards: [] };
  }
  const boards = [...new Set(args.boardClasses)];
  const bands = boards.length === 0
    ? [{ board: null, band: getRideabilityBand(skillLevel, null) }]
    : boards.map((board) => ({ board, band: getRideabilityBand(skillLevel, board) }));

  const ideal = bands.filter(({ band }) => contains(band.ideal, faceHeightFt));
  if (ideal.length > 0) {
    return { status: 'in_range', boards: ideal.flatMap(({ board }) => (board ? [board] : [])) };
  }
  if (bands.some(({ band }) => contains(band.acceptable, faceHeightFt))) {
    return { status: 'rideable', boards: [] };
  }

  // Outside every acceptable band: the nearest edge decides, above wins a tie (it is the safety-relevant call).
  let nearest = { distance: Number.POSITIVE_INFINITY, status: 'above_range' as 'above_range' | 'below_range' };
  for (const { band } of bands) {
    const candidate = faceHeightFt > band.acceptable.max
      ? { distance: faceHeightFt - band.acceptable.max, status: 'above_range' as const }
      : { distance: band.acceptable.min - faceHeightFt, status: 'below_range' as const };
    if (candidate.distance < nearest.distance
      || (candidate.distance === nearest.distance && candidate.status === 'above_range')) {
      nearest = candidate;
    }
  }
  return { status: nearest.status, boards: [] };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-fit.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/services/discovery/swell-outlook-types.ts lib/services/discovery/swell-outlook-fit.ts __tests__/lib/services/discovery/swell-outlook-fit.test.ts
git commit -m "feat(swell-outlook): response types and fit from ideal and acceptable bands"
```

---

### Task 7: NHC active-storms client

**Files:**
- Create: `lib/services/discovery/nhc-storms.ts`
- Test: `__tests__/lib/services/discovery/nhc-storms.test.ts` (new)

**Interfaces:**
- Consumes: global `fetch`, `AbortSignal.timeout`.
- Produces: `interface ActiveStorm { id: string; name: string; basin: 'ep' | 'cp' | 'other'; lat: number; lon: number }`; `parseActiveStorms(payload: unknown): ActiveStorm[]`; `createNhcStormClient(deps?: { fetchImpl?: typeof fetch; now?: () => number }): { getActiveStorms(): Promise<ActiveStorm[]> }`; `getActiveStorms(): Promise<ActiveStorm[]>` (process-wide client). Never throws.

The feed shape was checked against `https://www.nhc.noaa.gov/CurrentStorms.json` on 2026-10-04: `activeStorms[]` with `id` ("ep182026"), `name`, `classification`, `latitudeNumeric`, `longitudeNumeric`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * @jest-environment node
 */
// __tests__/lib/services/discovery/nhc-storms.test.ts
import { createNhcStormClient, parseActiveStorms } from "@/lib/services/discovery/nhc-storms";

const FEED = {
  activeStorms: [
    { id: "ep182026", name: "Rachel", classification: "HU", latitudeNumeric: 20.1, longitudeNumeric: -114.3 },
    { id: "al092026", name: "Nigel", classification: "TS", latitudeNumeric: 25.2, longitudeNumeric: -60.1 },
  ],
};

function ok(body: unknown): Response {
  return { ok: true, status: 200, json: async () => body } as unknown as Response;
}

describe("parseActiveStorms", () => {
  it("reads id, name, basin and position", () => {
    expect(parseActiveStorms(FEED)).toEqual([
      { id: "ep182026", name: "Rachel", basin: "ep", lat: 20.1, lon: -114.3 },
      { id: "al092026", name: "Nigel", basin: "other", lat: 25.2, lon: -60.1 },
    ]);
  });

  it("drops malformed entries and tolerates any other shape", () => {
    expect(parseActiveStorms({ activeStorms: [null, 3, { id: "ep1", name: "", latitudeNumeric: 1, longitudeNumeric: 2 }, { id: "ep2", name: "X", latitudeNumeric: "20N", longitudeNumeric: 2 }] })).toEqual([]);
    expect(parseActiveStorms(null)).toEqual([]);
    expect(parseActiveStorms({ activeStorms: "none" })).toEqual([]);
    expect(parseActiveStorms([])).toEqual([]);
  });
});

describe("createNhcStormClient", () => {
  beforeEach(() => jest.spyOn(console, "warn").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("caches a good answer for fifteen minutes", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async () => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    expect(await client.getActiveStorms()).toHaveLength(2);
    clock += 14 * 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock += 2 * 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it.each([
    ["a network error", async () => { throw new Error("ECONNRESET"); }],
    ["a timeout", async () => { throw new DOMException("timed out", "TimeoutError"); }],
    ["a non-200", async () => ({ ok: false, status: 503, json: async () => ({}) }) as unknown as Response],
    ["invalid JSON", async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError("bad"); } }) as unknown as Response],
    ["an unexpected shape", async () => ok({ storms: [] })],
  ])("returns no storms, never throws, on %s", async (_label, impl) => {
    const client = createNhcStormClient({ fetchImpl: jest.fn(impl) as unknown as typeof fetch });
    await expect(client.getActiveStorms()).resolves.toEqual([]);
  });

  it("remembers a failure for two minutes so a bad feed is not hammered", async () => {
    let clock = 0;
    const fetchImpl = jest.fn(async () => { throw new Error("down"); });
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch, now: () => clock });
    await client.getActiveStorms();
    clock += 60_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    clock += 61_000;
    await client.getActiveStorms();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent callers", async () => {
    const fetchImpl = jest.fn(async () => ok(FEED));
    const client = createNhcStormClient({ fetchImpl: fetchImpl as unknown as typeof fetch });
    await Promise.all([client.getActiveStorms(), client.getActiveStorms(), client.getActiveStorms()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/nhc-storms.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/nhc-storms'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/services/discovery/nhc-storms.ts
const FEED_URL = 'https://www.nhc.noaa.gov/CurrentStorms.json';
const OK_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;
const TIMEOUT_MS = 4000;

export interface ActiveStorm {
  id: string;
  name: string;
  basin: 'ep' | 'cp' | 'other';
  lat: number;
  lon: number;
}

function basinOf(id: string): ActiveStorm['basin'] {
  const prefix = id.slice(0, 2).toLowerCase();
  return prefix === 'ep' || prefix === 'cp' ? prefix : 'other';
}

export function parseActiveStorms(payload: unknown): ActiveStorm[] {
  if (!payload || typeof payload !== 'object') return [];
  const list = (payload as { activeStorms?: unknown }).activeStorms;
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry): ActiveStorm[] => {
    if (!entry || typeof entry !== 'object') return [];
    const { id, name, latitudeNumeric, longitudeNumeric } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof name !== 'string' || name.trim().length === 0) return [];
    if (
      typeof latitudeNumeric !== 'number' || !Number.isFinite(latitudeNumeric)
      || typeof longitudeNumeric !== 'number' || !Number.isFinite(longitudeNumeric)
    ) {
      return [];
    }
    return [{ id, name: name.trim(), basin: basinOf(id), lat: latitudeNumeric, lon: longitudeNumeric }];
  });
}

/** A storm name is garnish: any feed failure yields no storms, never an error. */
export function createNhcStormClient(
  deps: { fetchImpl?: typeof fetch; now?: () => number } = {},
): { getActiveStorms(): Promise<ActiveStorm[]> } {
  const now = deps.now ?? Date.now;
  const fetchImpl: typeof fetch = deps.fetchImpl ?? ((...args) => fetch(...args));
  let cached: { storms: ActiveStorm[]; expiresAt: number } | null = null;
  let inflight: Promise<ActiveStorm[]> | null = null;

  async function load(): Promise<ActiveStorm[]> {
    try {
      const response = await fetchImpl(FEED_URL, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`NHC feed returned ${response.status}`);
      const storms = parseActiveStorms(await response.json());
      cached = { storms, expiresAt: now() + OK_TTL_MS };
      return storms;
    } catch (error) {
      console.warn('[nhc-storms] feed unavailable; storm names omitted', error instanceof Error ? error.message : String(error));
      cached = { storms: [], expiresAt: now() + FAILURE_TTL_MS };
      return [];
    }
  }

  return {
    async getActiveStorms(): Promise<ActiveStorm[]> {
      if (cached && cached.expiresAt > now()) return cached.storms;
      inflight ??= load().finally(() => { inflight = null; });
      return inflight;
    },
  };
}

const defaultClient = createNhcStormClient();

export function getActiveStorms(): Promise<ActiveStorm[]> {
  return defaultClient.getActiveStorms();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/nhc-storms.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/services/discovery/nhc-storms.ts __tests__/lib/services/discovery/nhc-storms.test.ts
git commit -m "feat(swell-outlook): failure-tolerant NHC active-storms client"
```

---

### Task 8: Source label, storm match, size ranges and size by orientation

**Files:**
- Create: `lib/services/discovery/swell-outlook-source.ts`
- Test: `__tests__/lib/services/discovery/swell-outlook-source.test.ts` (new)

**Interfaces:**
- Consumes: `SwellSource`, `FaceHeightRangeFt` (Task 6); `ActiveStorm` (Task 7); `angleDifference`.
- Produces: `isEastPacificHurricaneSeason(at: Date): boolean`; `swellSourceFor(args: { directionDeg: number; periodS: number | null; peakAt: string; activeStorms: readonly ActiveStorm[] }): SwellSource`; `matchStormOnBearing(args: { storms: readonly ActiveStorm[]; beach: { lat: number; lon: number }; directionDeg: number }): string | null`; `faceHeightRange(faceFt: number): FaceHeightRangeFt`; `faceHeightSpan(values: readonly number[]): FaceHeightRangeFt | null`; `sizeByOrientation(members: ReadonlyArray<{ windowCenterDeg: number | null; faceHeightFt: number }>): { southFacing: FaceHeightRangeFt | null; westFacing: FaceHeightRangeFt | null }`.

Spec notes: (1) the spec's rule order is ambiguous where `tropical` (150-190 deg) overlaps `southern_hemisphere` (180-230 deg at >= 14 s); the plan checks `tropical` first because it also needs an active East Pacific system. (2) `stormName` is looked up only for `tropical` swells so a South Pacific swell is never credited to a hurricane. (3) The spec gives no size-range formula; the plan uses +/-15% rounded to 0.5 ft with a 1 ft minimum width (human judgment list). (4) "Size by orientation" uses the pool beaches that recorded the pulse, because pulse snapshots are the list's only per-beach size source.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/discovery/swell-outlook-source.test.ts
import {
  faceHeightRange,
  faceHeightSpan,
  isEastPacificHurricaneSeason,
  matchStormOnBearing,
  sizeByOrientation,
  swellSourceFor,
} from "@/lib/services/discovery/swell-outlook-source";
import type { ActiveStorm } from "@/lib/services/discovery/nhc-storms";

const RACHEL: ActiveStorm = { id: "ep182026", name: "Rachel", basin: "ep", lat: 20.1, lon: -114.3 };
const NIGEL: ActiveStorm = { id: "al092026", name: "Nigel", basin: "other", lat: 25.2, lon: -60.1 };
const OCT = "2026-10-08T19:00:00.000Z";

describe("swellSourceFor", () => {
  it("labels long-period south as southern hemisphere", () => {
    expect(swellSourceFor({ directionDeg: 205, periodS: 15, peakAt: OCT, activeStorms: [] })).toBe("southern_hemisphere");
  });

  it("labels 150-190 deg in season with an active East Pacific system as tropical, first", () => {
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [RACHEL] })).toBe("tropical");
    expect(swellSourceFor({ directionDeg: 185, periodS: 15, peakAt: OCT, activeStorms: [RACHEL] })).toBe("tropical");
  });

  it("does not call it tropical without a system, off season or with only an Atlantic storm", () => {
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: "2026-02-08T19:00:00.000Z", activeStorms: [RACHEL] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 170, periodS: 12, peakAt: OCT, activeStorms: [NIGEL] })).toBe("unknown");
  });

  it("labels long-period northwest as north pacific, short period as local, the rest unknown", () => {
    expect(swellSourceFor({ directionDeg: 300, periodS: 14, peakAt: OCT, activeStorms: [] })).toBe("north_pacific");
    expect(swellSourceFor({ directionDeg: 300, periodS: 9, peakAt: OCT, activeStorms: [] })).toBe("local");
    expect(swellSourceFor({ directionDeg: 60, periodS: 12, peakAt: OCT, activeStorms: [] })).toBe("unknown");
    expect(swellSourceFor({ directionDeg: 205, periodS: null, peakAt: OCT, activeStorms: [] })).toBe("unknown");
  });
});

describe("isEastPacificHurricaneSeason", () => {
  it("runs May 15 through Nov 30", () => {
    expect(isEastPacificHurricaneSeason(new Date("2026-05-14T12:00:00Z"))).toBe(false);
    expect(isEastPacificHurricaneSeason(new Date("2026-05-15T12:00:00Z"))).toBe(true);
    expect(isEastPacificHurricaneSeason(new Date("2026-11-30T12:00:00Z"))).toBe(true);
    expect(isEastPacificHurricaneSeason(new Date("2026-12-01T12:00:00Z"))).toBe(false);
  });
});

describe("matchStormOnBearing", () => {
  const sanDiego = { lat: 32.7, lon: -117.25 };

  it("names a Pacific system that lies on the swell's bearing", () => {
    expect(matchStormOnBearing({ storms: [RACHEL, NIGEL], beach: sanDiego, directionDeg: 168 })).toBe("Rachel");
  });

  it("returns null when no system lies within 20 deg of the bearing or the list is empty", () => {
    expect(matchStormOnBearing({ storms: [RACHEL], beach: sanDiego, directionDeg: 250 })).toBeNull();
    expect(matchStormOnBearing({ storms: [], beach: sanDiego, directionDeg: 168 })).toBeNull();
    expect(matchStormOnBearing({ storms: [NIGEL], beach: sanDiego, directionDeg: 100 })).toBeNull();
  });
});

describe("size ranges", () => {
  it("widens a single value to at least one foot and rounds to half feet", () => {
    expect(faceHeightRange(2.5)).toEqual({ min: 2, max: 3 });
    expect(faceHeightRange(6)).toEqual({ min: 5, max: 7 });
    expect(faceHeightRange(1.5)).toEqual({ min: 1, max: 2 });
  });

  it("spans several beaches and is null for none", () => {
    expect(faceHeightSpan([])).toBeNull();
    expect(faceHeightSpan([3, 5.2])).toEqual({ min: 3, max: 5.5 });
    expect(faceHeightSpan([4])).toEqual(faceHeightRange(4));
  });
});

describe("sizeByOrientation", () => {
  it("splits beaches into south-facing and west-facing by their swell window", () => {
    expect(sizeByOrientation([
      { windowCenterDeg: 190, faceHeightFt: 4 },
      { windowCenterDeg: 270, faceHeightFt: 2.5 },
      { windowCenterDeg: 265, faceHeightFt: 3 },
    ])).toEqual({ southFacing: faceHeightRange(4), westFacing: { min: 2.5, max: 3.5 } });
  });

  it("is null for an orientation no beach faces, and ignores beaches without a window", () => {
    expect(sizeByOrientation([{ windowCenterDeg: null, faceHeightFt: 4 }])).toEqual({ southFacing: null, westFacing: null });
    expect(sizeByOrientation([{ windowCenterDeg: 270, faceHeightFt: 2 }]).southFacing).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-source.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/swell-outlook-source'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/services/discovery/swell-outlook-source.ts
import { angleDifference } from '@/lib/domains/shared/angle-utils';

import type { ActiveStorm } from './nhc-storms';
import type { FaceHeightRangeFt, SwellSource } from './swell-outlook-types';

const STORM_BEARING_TOLERANCE_DEG = 20;

/** May 15 through Nov 30, by the peak's UTC date. */
export function isEastPacificHurricaneSeason(at: Date): boolean {
  const month = at.getUTCMonth() + 1;
  if (month < 5 || month > 11) return false;
  return month !== 5 || at.getUTCDate() >= 15;
}

function between(value: number, from: number, to: number): boolean {
  return value >= from && value <= to;
}

export function swellSourceFor(args: {
  directionDeg: number;
  periodS: number | null;
  peakAt: string;
  activeStorms: readonly ActiveStorm[];
}): SwellSource {
  const { directionDeg, periodS } = args;
  if (periodS === null) return 'unknown';
  const pacificSystem = args.activeStorms.some((storm) => storm.basin === 'ep' || storm.basin === 'cp');
  if (between(directionDeg, 150, 190) && pacificSystem && isEastPacificHurricaneSeason(new Date(args.peakAt))) {
    return 'tropical';
  }
  if (between(directionDeg, 180, 230) && periodS >= 14) return 'southern_hemisphere';
  if (between(directionDeg, 280, 320) && periodS >= 13) return 'north_pacific';
  if (periodS < 11) return 'local';
  return 'unknown';
}

function bearingDeg(from: { lat: number; lon: number }, to: { lat: number; lon: number }): number {
  const rad = (degrees: number): number => (degrees * Math.PI) / 180;
  const phi1 = rad(from.lat);
  const phi2 = rad(to.lat);
  const lambda = rad(to.lon - from.lon);
  const y = Math.sin(lambda) * Math.cos(phi2);
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** A Pacific system whose bearing from the beach is within 20 deg of where the swell comes from. */
export function matchStormOnBearing(args: {
  storms: readonly ActiveStorm[];
  beach: { lat: number; lon: number };
  directionDeg: number;
}): string | null {
  let best: { name: string; offset: number } | null = null;
  for (const storm of args.storms) {
    if (storm.basin === 'other') continue;
    const offset = angleDifference(bearingDeg(args.beach, storm), args.directionDeg);
    if (offset <= STORM_BEARING_TOLERANCE_DEG && (!best || offset < best.offset)) best = { name: storm.name, offset };
  }
  return best?.name ?? null;
}

const roundHalf = (value: number): number => Math.round(value * 2) / 2;

/** +/-15% rounded to half feet, never narrower than one foot. */
export function faceHeightRange(faceFt: number): FaceHeightRangeFt {
  const min = roundHalf(faceFt * 0.85);
  const max = roundHalf(faceFt * 1.15);
  if (max - min >= 1) return { min, max };
  const floor = Math.max(0, roundHalf(faceFt - 0.5));
  return { min: floor, max: floor + 1 };
}

export function faceHeightSpan(values: readonly number[]): FaceHeightRangeFt | null {
  if (values.length === 0) return null;
  if (values.length === 1) return faceHeightRange(values[0]);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = { min: Math.floor(min * 2) / 2, max: Math.ceil(max * 2) / 2 };
  return span.max - span.min >= 1 ? span : { min: span.min, max: span.min + 1 };
}

export function sizeByOrientation(
  members: ReadonlyArray<{ windowCenterDeg: number | null; faceHeightFt: number }>,
): { southFacing: FaceHeightRangeFt | null; westFacing: FaceHeightRangeFt | null } {
  const south: number[] = [];
  const west: number[] = [];
  for (const member of members) {
    if (member.windowCenterDeg === null) continue;
    if (angleDifference(member.windowCenterDeg, 180) <= 45) south.push(member.faceHeightFt);
    else if (angleDifference(member.windowCenterDeg, 270) <= 45) west.push(member.faceHeightFt);
  }
  return { southFacing: faceHeightSpan(south), westFacing: faceHeightSpan(west) };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/services/discovery/swell-outlook-source.ts __tests__/lib/services/discovery/swell-outlook-source.test.ts
git commit -m "feat(swell-outlook): source label, storm bearing match and size by orientation"
```

---

### Task 9: Sticky tracking

**Files:**
- Create: `lib/services/discovery/swell-outlook-sticky.ts`
- Test: `__tests__/lib/services/discovery/swell-outlook-sticky.test.ts` (new)

**Interfaces:**
- Consumes: `OutlookSwell`, `StoredOutlookList` (Task 6); `swellFitFor` (Task 6); `faceHeightRange` (Task 8); `parseSwellPartitions`, `swellPartitionFaceHeightFt`, `SWELL_EVENT_THRESHOLDS`, `SwellEventBeach`, `SwellEventForecastRow` from `@/lib/alerts/swell-events`.
- Produces: `STICKY_MIN_FACE_FT = 2`; `interface CarryOverInput { previous: StoredOutlookList | null; current: readonly OutlookSwell[]; forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>; beachesById: ReadonlyMap<string, SwellEventBeach>; skillLevel: SkillLevel | null; boardClasses: readonly BoardClass[]; now: Date }`; `carryOverSwells(input: CarryOverInput): OutlookSwell[]`.

Rules implemented (spec "Sticky tracking", plus the peak-passed case the spec leaves open):
- A previous entry already `faded` is dropped (it was listed once).
- A previous entry matching a current one (same `id`, or direction within 45 deg and peak within 36 h) is not carried.
- Peak already past: carried as `arrived` for 12 h, then dropped.
- Peak still ahead: look in today's rows at the entry's beach within 45 deg and 36 h of the last predicted peak. Face >= 2 ft: `shrinking`, `change: 'downgraded'`, current size, fit recomputed, tier unchanged. Otherwise (including a missing beach or no rows): `faded`.

Spec note: the spec does not say what happens to a swell whose peak day has begun and so is skipped by the pulse rule (peaking today). Without the `arrived` carry it would read as shrinking or faded on its own peak day.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/discovery/swell-outlook-sticky.test.ts
import { carryOverSwells } from "@/lib/services/discovery/swell-outlook-sticky";
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";
import { BEACH_ID, NOW, dayRows, localIso, swellBeach, type PartitionSpec } from "@/__tests__/helpers/swell-events";

const PEAK_AT = localIso(3, 12);

function entry(overrides: Partial<OutlookSwell> = {}): OutlookSwell {
  return {
    id: `${BEACH_ID}:W:2026-09-28:p`, eventKey: `${BEACH_ID}:W:2026-09-28:p`, tier: "likely", status: "forecast", change: "steady",
    arrivalAt: localIso(2, 12), peakAt: PEAK_AT, peakWindow: null, faceHeightFt: { min: 4, max: 6 }, periodS: 14,
    directionDeg: 270, directionLabel: "W", beach: { id: BEACH_ID, name: "Test Beach" }, beachCount: 3, notable: false,
    fit: { status: "in_range", boards: [] }, source: "unknown", stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: { min: 4, max: 6 } }, history: [],
    ...overrides,
  };
}

function rowsAround(spec: PartitionSpec) {
  return [2, 3, 4].flatMap((day) => dayRows(day, spec));
}

function carry(args: { previous: OutlookSwell[] | null; current?: OutlookSwell[]; rows?: ReturnType<typeof rowsAround>; now?: Date; skill?: "advanced" | null }) {
  return carryOverSwells({
    previous: args.previous ? { runDate: "2026-09-24", swells: args.previous } : null,
    current: args.current ?? [],
    forecastsByBeach: new Map([[BEACH_ID, args.rows ?? []]]),
    beachesById: new Map([[BEACH_ID, swellBeach()]]),
    skillLevel: args.skill === undefined ? "advanced" : args.skill,
    boardClasses: ["shortboard"],
    now: args.now ?? NOW,
  });
}

describe("carryOverSwells", () => {
  it("keeps a swell that dropped under the bar as shrinking, at its current size, tier unchanged", () => {
    const [kept] = carry({ previous: [entry()], rows: rowsAround({ heightFt: 2.5, periodS: 14, direction: 270 }) });
    expect(kept).toMatchObject({ status: "shrinking", change: "downgraded", tier: "likely", id: entry().id, peakAt: PEAK_AT });
    expect(kept.faceHeightFt.max).toBeLessThan(5);
    // 2.5 ft at 14 s reads about 3.4 ft: under an advanced shortboard's ideal 3.5, still acceptable.
    expect(kept.fit.status).toBe("rideable");
  });

  it("lists a swell with no partition in the rows once as faded", () => {
    const [kept] = carry({ previous: [entry()], rows: rowsAround({ heightFt: 3, periodS: 14, direction: 90 }) });
    expect(kept).toMatchObject({ status: "faded", change: "downgraded" });
  });

  it("fades a swell whose remaining partition is under 2 ft", () => {
    expect(carry({ previous: [entry()], rows: rowsAround({ heightFt: 0.8, periodS: 14, direction: 270 }) })[0].status).toBe("faded");
  });

  it("removes a faded entry the next day", () => {
    expect(carry({ previous: [entry({ status: "faded" })], rows: rowsAround({ heightFt: 0.8, periodS: 14, direction: 270 }) })).toEqual([]);
  });

  it("does not carry an entry that today's list still has", () => {
    expect(carry({ previous: [entry()], current: [entry({ id: "other-id", peakAt: localIso(3, 15) })] })).toEqual([]);
    expect(carry({ previous: [entry()], current: [entry()] })).toEqual([]);
  });

  it("treats a missing beach or no rows as faded without throwing", () => {
    const result = carryOverSwells({
      previous: { runDate: "2026-09-24", swells: [entry()] }, current: [], forecastsByBeach: new Map(), beachesById: new Map(),
      skillLevel: null, boardClasses: [], now: NOW,
    });
    expect(result[0].status).toBe("faded");
  });

  it("shows an arrived swell for 12 h after its peak and then drops it", () => {
    const peak = new Date(PEAK_AT).getTime();
    expect(carry({ previous: [entry()], now: new Date(peak + 6 * 3_600_000) })[0].status).toBe("arrived");
    expect(carry({ previous: [entry()], now: new Date(peak + 13 * 3_600_000) })).toEqual([]);
  });

  it("returns nothing without a previous list", () => {
    expect(carry({ previous: null })).toEqual([]);
  });

  it("leaves the previous entry untouched (no mutation)", () => {
    const previous = entry();
    const snapshot = JSON.stringify(previous);
    carry({ previous: [previous], rows: rowsAround({ heightFt: 2.5, periodS: 14, direction: 270 }) });
    expect(JSON.stringify(previous)).toBe(snapshot);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-sticky.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/swell-outlook-sticky'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/services/discovery/swell-outlook-sticky.ts
import {
  SWELL_EVENT_THRESHOLDS,
  parseSwellPartitions,
  swellPartitionFaceHeightFt,
  type SwellEventBeach,
  type SwellEventForecastRow,
} from '@/lib/alerts/swell-events';
import type { BoardClass } from '@/lib/domains/rideability';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import type { SkillLevel } from '@/lib/domains/user-preferences';

import { swellFitFor } from './swell-outlook-fit';
import { faceHeightRange } from './swell-outlook-source';
import type { OutlookSwell, StoredOutlookList } from './swell-outlook-types';

const HOUR_MS = 60 * 60 * 1000;
const MATCH_PEAK_MS = 36 * HOUR_MS;
const ARRIVED_CARRY_MS = 12 * HOUR_MS;
export const STICKY_MIN_FACE_FT = 2;

export interface CarryOverInput {
  previous: StoredOutlookList | null;
  current: readonly OutlookSwell[];
  forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  beachesById: ReadonlyMap<string, SwellEventBeach>;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  now: Date;
}

function isSameSwell(left: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>, right: Pick<OutlookSwell, 'directionDeg' | 'peakAt'>): boolean {
  return angleDifference(left.directionDeg, right.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(Date.parse(left.peakAt) - Date.parse(right.peakAt)) <= MATCH_PEAK_MS;
}

/** Largest face height of a matching partition within 36 h of the last predicted peak. */
function livePeakFaceFt(previous: OutlookSwell, input: CarryOverInput): number | null {
  const beach = input.beachesById.get(previous.beach.id);
  if (!beach) return null;
  const peakMs = Date.parse(previous.peakAt);
  let best: number | null = null;
  for (const row of input.forecastsByBeach.get(previous.beach.id) ?? []) {
    if (Math.abs(Date.parse(row.forecast_at) - peakMs) > MATCH_PEAK_MS) continue;
    const partitions = parseSwellPartitions(row).filter((partition) => (
      angleDifference(partition.directionDeg, previous.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    ));
    if (partitions.length === 0) continue;
    const face = swellPartitionFaceHeightFt(partitions, beach);
    if (face !== null && (best === null || face > best)) best = face;
  }
  return best;
}

/** Swells listed on the previous run that today's list no longer has; never a push trigger and never a tier raise. */
export function carryOverSwells(input: CarryOverInput): OutlookSwell[] {
  const nowMs = input.now.getTime();
  const carried: OutlookSwell[] = [];
  for (const previous of input.previous?.swells ?? []) {
    if (previous.status === 'faded') continue;
    if (input.current.some((entry) => entry.id === previous.id || isSameSwell(entry, previous))) continue;

    const peakMs = Date.parse(previous.peakAt);
    if (peakMs <= nowMs) {
      if (nowMs - peakMs <= ARRIVED_CARRY_MS) carried.push({ ...previous, status: 'arrived', change: 'steady' });
      continue;
    }

    const face = livePeakFaceFt(previous, input);
    if (face === null || face < STICKY_MIN_FACE_FT) {
      carried.push({ ...previous, status: 'faded', change: 'downgraded' });
      continue;
    }
    carried.push({
      ...previous,
      status: 'shrinking',
      change: 'downgraded',
      faceHeightFt: faceHeightRange(face),
      fit: swellFitFor({ faceHeightFt: face, skillLevel: input.skillLevel, boardClasses: input.boardClasses }),
    });
  }
  return carried;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook-sticky.test.ts`
Expected: PASS. If the shrinking test's fit assertion differs because the transformer reads 2.5 ft / 14 s as something other than 3.4 ft, print the value once with `swellPartitionFaceHeightFt` and change only the expected fit status to match the band table (advanced shortboard ideal 3.5-8.4, acceptable 2.3-12.6).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/services/discovery/swell-outlook-sticky.ts __tests__/lib/services/discovery/swell-outlook-sticky.test.ts
git commit -m "feat(swell-outlook): sticky tracking for swells that drop under the bar"
```

---

### Task 10: Outlook builder

**Files:**
- Create: `lib/services/discovery/swell-outlook.ts`
- Test: `__tests__/lib/services/discovery/swell-outlook.test.ts` (new)

**Interfaces:**
- Consumes: `groupEvents`, `confidenceFor`, `changeFor`, `isPreviousRun` (Task 2); `swellFitFor` (Task 6); `swellSourceFor`, `matchStormOnBearing`, `faceHeightRange`, `sizeByOrientation` (Task 8); `carryOverSwells` (Task 9); `ActiveStorm` (Task 7); `PoolBeach` from `@/lib/alerts/user-pool`; `isSwellEventCurrent`, `swellWindowForBeach`, `toSwellEventBeach` from `@/lib/alerts/swell-events`.
- Produces: `SWELL_OUTLOOK_HORIZON_DAYS = 9`; `resolveOutlookRunDate(snapshots: readonly SwellEventSnapshot[], now: Date): string`; `interface BuildSwellOutlookInput { pool: ReadonlyArray<Pick<PoolBeach, 'beach' | 'relation'>>; homeBeachId: string | null; pulseSnapshots: readonly SwellEventSnapshot[]; notableSnapshots: readonly SwellEventSnapshot[]; forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>; previous: StoredOutlookList | null; skillLevel: SkillLevel | null; boardClasses: readonly BoardClass[]; storms: readonly ActiveStorm[]; now: Date }`; `interface BuiltSwellOutlook { response: SwellOutlookResponse; list: StoredOutlookList }`; `buildSwellOutlook(input: BuildSwellOutlookInput): BuiltSwellOutlook`; re-exports the types from `swell-outlook-types.ts`.

Design: the list is built from the latest pulse snapshot run for the pool beaches (`runDate`), not from live rows. Sizes are `peak_face_height_ft` at the representative beach: the home beach when it sees the swell, otherwise the pool beach with the largest face height. `id` is the earliest member's event key (earliest peak, then key order), carried over from the previous list when the same swell is matched there so it stays stable when the member set changes. A swell with no earlier run to compare reads `change: 'new'` (the spec's enum has no null).

Spec notes: (1) the spec says "reuse `confidenceFor` and the change derivation unchanged"; they are reused, and `changeFor`'s null (no earlier run to prove newness) is mapped to `'new'` because the swell is first sighted in this run. (2) `peakWindow` is peak +/- 12 h when the peak is more than 120 h out (spec: "beyond 5 days the peak is shown as a window"; width is not specified). (3) `stormName` is looked up only when `source === 'tropical'`.

- [ ] **Step 1: Write the failing test**

```ts
// __tests__/lib/services/discovery/swell-outlook.test.ts
import {
  buildSwellOutlook,
  resolveOutlookRunDate,
  type BuildSwellOutlookInput,
} from "@/lib/services/discovery/swell-outlook";
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";
import type { SwellEventSnapshot } from "@/lib/alerts/swell-events";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { NOW, TIMEZONE, dayRows, localIso } from "@/__tests__/helpers/swell-events";
import type { Beach } from "@/types/database";

const HOME = "cccccccc-0000-4000-8000-000000000001";
const SECOND = "cccccccc-0000-4000-8000-000000000002";
const THIRD = "cccccccc-0000-4000-8000-000000000003";
const NO_WINDOW = "cccccccc-0000-4000-8000-000000000004";

function beach(id: string, name: string, center: number | null = 270): Beach {
  return createMockBeach({
    id, name, slug: name.toLowerCase(), timezone: TIMEZONE,
    swell_window_center_deg: center, swell_window_halfwidth_deg: center === null ? null : 30,
  });
}

function pulse(beachId: string, overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId, eventKey: `${beachId}:W:2026-09-28:p`, detectorVersion: "swell-outlook-pulse.v1", runDate: "2026-09-25",
    detectedAt: "2026-09-25T14:30:00.000Z", directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: 3,
    peakFaceHeightFt: 4, exposure: 1, energyRatio: 5, arrivalAt: "2026-09-28T07:00:00.000Z", peakAt: "2026-09-28T19:00:00.000Z",
    fadeAt: "2026-09-29T07:00:00.000Z", crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

function input(overrides: Partial<BuildSwellOutlookInput> = {}): BuildSwellOutlookInput {
  return {
    pool: [
      { beach: beach(HOME, "Home Beach"), relation: "home" },
      { beach: beach(SECOND, "Second"), relation: "nearby" },
      { beach: beach(THIRD, "Third"), relation: "nearby" },
    ],
    homeBeachId: HOME,
    pulseSnapshots: [pulse(HOME), pulse(SECOND, { peakFaceHeightFt: 3 }), pulse(THIRD, { peakFaceHeightFt: 5 })],
    notableSnapshots: [],
    forecastsByBeach: new Map(),
    previous: null,
    skillLevel: "advanced",
    boardClasses: ["shortboard"],
    storms: [],
    now: NOW,
    ...overrides,
  };
}

describe("buildSwellOutlook", () => {
  it("builds an empty outlook for an empty pool", () => {
    const { response, list } = buildSwellOutlook(input({ pool: [], homeBeachId: null, pulseSnapshots: [] }));
    expect(response).toMatchObject({ runDate: "2026-09-25", horizonDays: 9, homeBeach: null, swells: [] });
    expect(response.generatedAt).toBe(NOW.toISOString());
    expect(list).toEqual({ runDate: "2026-09-25", swells: [] });
  });

  it("returns an empty list when no pulse was recorded for the pool", () => {
    expect(buildSwellOutlook(input({ pulseSnapshots: [] })).response.swells).toEqual([]);
  });

  it("merges one swell seen at three beaches into one entry sized at the home beach", () => {
    const [swell, ...rest] = buildSwellOutlook(input()).response.swells;
    expect(rest).toEqual([]);
    expect(swell).toMatchObject({
      eventKey: `${HOME}:W:2026-09-28:p`, beach: { id: HOME, name: "Home Beach" }, beachCount: 3, status: "forecast",
      tier: "on_the_radar", change: "new", periodS: 14, directionDeg: 270, directionLabel: "W", notable: false,
      peakWindow: null, faceHeightFt: { min: 3.5, max: 4.5 }, source: "unknown", stormName: null,
      fit: { status: "in_range", boards: ["shortboard"] },
    });
    expect(swell.id).toBe(`${HOME}:W:2026-09-28:p`);
  });

  it("sizes at the largest beach without a home beach, and reports no home beach", () => {
    const { response } = buildSwellOutlook(input({
      pool: input().pool.map(({ beach: item }) => ({ beach: item, relation: "nearby" as const })),
      homeBeachId: null,
    }));
    expect(response.homeBeach).toBeNull();
    expect(response.swells[0].beach.id).toBe(THIRD);
  });

  it("keeps two overlapping trains as two entries sorted by peak", () => {
    const later = pulse(HOME, { eventKey: `${HOME}:WNW:2026-09-30:p`, directionDeg: 285, periodS: 16, peakAt: "2026-09-30T19:00:00.000Z", arrivalAt: "2026-09-30T07:00:00.000Z" });
    const { response } = buildSwellOutlook(input({
      pool: [{ beach: beach(HOME, "Home Beach"), relation: "home" }],
      pulseSnapshots: [later, pulse(HOME, { periodS: 12 })],
    }));
    expect(response.swells.map((swell) => swell.periodS)).toEqual([12, 16]);
  });

  it("shows a peak more than five days out as a window", () => {
    const far = pulse(HOME, { peakAt: "2026-10-02T19:00:00.000Z", arrivalAt: "2026-10-02T07:00:00.000Z", eventKey: `${HOME}:W:2026-10-02:p` });
    const [swell] = buildSwellOutlook(input({ pulseSnapshots: [far] })).response.swells;
    expect(swell.peakWindow).toEqual({ from: "2026-10-02T07:00:00.000Z", to: "2026-10-03T07:00:00.000Z" });
    expect(swell.tier).toBe("on_the_radar");
  });

  it("links a notable event within 45 deg and 36 h, and only then", () => {
    const notable = pulse(HOME, { eventKey: `${HOME}:W:2026-09-28`, detectorVersion: "swell-events.v1", peakAt: "2026-09-28T23:00:00.000Z" });
    const [linked] = buildSwellOutlook(input({ notableSnapshots: [notable] })).response.swells;
    expect(linked).toMatchObject({ notable: true, eventKey: `${HOME}:W:2026-09-28` });
    const [apart] = buildSwellOutlook(input({ notableSnapshots: [{ ...notable, directionDeg: 180, peakAt: "2026-09-28T19:00:00.000Z" }] })).response.swells;
    expect(apart).toMatchObject({ notable: false, eventKey: `${HOME}:W:2026-09-28:p` });
    const [late] = buildSwellOutlook(input({ notableSnapshots: [{ ...notable, peakAt: "2026-09-30T19:00:00.000Z" }] })).response.swells;
    expect(late.notable).toBe(false);
  });

  it("lists swells without a skill level as unknown fit, and with no boards uses the skill default", () => {
    expect(buildSwellOutlook(input({ skillLevel: null })).response.swells[0].fit).toEqual({ status: "unknown", boards: [] });
    // beginner default band: ideal 1-3, acceptable 0.5-4; a 4 ft face is rideable
    expect(buildSwellOutlook(input({ skillLevel: "beginner", boardClasses: [] })).response.swells[0].fit).toEqual({ status: "rideable", boards: [] });
  });

  it("names the storm only for a tropical swell and only when one lies on the bearing", () => {
    const tropical = pulse(HOME, { directionDeg: 170, directionBand: "S", periodS: 12, eventKey: `${HOME}:S:2026-10-08:p`, peakAt: "2026-10-08T19:00:00.000Z", arrivalAt: "2026-10-08T07:00:00.000Z" });
    const storm = { id: "ep182026", name: "Rachel", basin: "ep" as const, lat: 20.1, lon: -114.3 };
    const named = buildSwellOutlook(input({ pulseSnapshots: [tropical], storms: [storm] })).response.swells[0];
    expect(named).toMatchObject({ source: "tropical", stormName: "Rachel" });
    const unnamed = buildSwellOutlook(input({ pulseSnapshots: [tropical], storms: [] })).response.swells[0];
    expect(unnamed).toMatchObject({ source: "unknown", stormName: null });
  });

  it("splits sizes by orientation and ignores beaches without a swell window", () => {
    const pool = [
      { beach: beach(HOME, "Home Beach", 270), relation: "home" as const },
      { beach: beach(SECOND, "South Beach", 190), relation: "nearby" as const },
      { beach: beach(NO_WINDOW, "Unmeasured", null), relation: "nearby" as const },
    ];
    const [swell] = buildSwellOutlook(input({
      pool, pulseSnapshots: [pulse(HOME, { peakFaceHeightFt: 3 }), pulse(SECOND, { peakFaceHeightFt: 4 }), pulse(NO_WINDOW, { peakFaceHeightFt: 2 })],
    })).response.swells;
    expect(swell.sizeByOrientation.westFacing).not.toBeNull();
    expect(swell.sizeByOrientation.southFacing).not.toBeNull();
    expect(swell.beachCount).toBe(3);
  });

  it("builds history from every run of the representative key", () => {
    const [swell] = buildSwellOutlook(input({
      pulseSnapshots: [
        pulse(HOME), pulse(HOME, { runDate: "2026-09-23", detectedAt: "2026-09-23T14:30:00.000Z", peakOffshoreHeightFt: 2.4, peakFaceHeightFt: 3.04, periodS: 13.6 }),
        pulse(SECOND), pulse(THIRD),
      ],
    })).response.swells;
    expect(swell.history).toEqual([
      { runDate: "2026-09-23", peakAt: "2026-09-28T19:00:00.000Z", faceHeightFt: 3, periodS: 14 },
      { runDate: "2026-09-25", peakAt: "2026-09-28T19:00:00.000Z", faceHeightFt: 4, periodS: 14 },
    ]);
    expect(swell.change).toBe("upgraded");
  });

  it("carries the previous id when the same swell is matched", () => {
    const previous = { runDate: "2026-09-24", swells: [{ id: "older-id", directionDeg: 268, peakAt: "2026-09-28T07:00:00.000Z", status: "forecast" }] as unknown as OutlookSwell[] };
    expect(buildSwellOutlook(input({ previous })).response.swells[0].id).toBe("older-id");
  });

  it("drops a pulse whose swell is already over", () => {
    const over = pulse(HOME, { peakAt: "2026-09-23T19:00:00.000Z", arrivalAt: "2026-09-23T07:00:00.000Z", fadeAt: "2026-09-24T07:00:00.000Z" });
    expect(buildSwellOutlook(input({ pulseSnapshots: [over] })).response.swells).toEqual([]);
  });

  it("keeps a swell that dropped under the bar as shrinking, in time order", () => {
    const previous: OutlookSwell = {
      id: "old", eventKey: `${HOME}:W:2026-09-27:p`, tier: "likely", status: "forecast", change: "steady", arrivalAt: null,
      peakAt: localIso(2, 12), peakWindow: null, faceHeightFt: { min: 4, max: 6 }, periodS: 14, directionDeg: 270, directionLabel: "W",
      beach: { id: HOME, name: "Home Beach" }, beachCount: 3, notable: false, fit: { status: "in_range", boards: [] }, source: "unknown",
      stormName: null, sizeByOrientation: { southFacing: null, westFacing: null }, history: [],
    };
    const rows = [1, 2, 3].flatMap((day) => dayRows(day, { heightFt: 2.5, periodS: 14, direction: 270 }));
    const { response, list } = buildSwellOutlook(input({
      previous: { runDate: "2026-09-24", swells: [previous] },
      pulseSnapshots: [pulse(HOME, { peakAt: "2026-09-30T19:00:00.000Z", arrivalAt: "2026-09-30T07:00:00.000Z", eventKey: `${HOME}:W:2026-09-30:p` })],
      forecastsByBeach: new Map([[HOME, rows]]),
    }));
    expect(response.swells.map((swell) => [swell.id, swell.status])).toEqual([["old", "shrinking"], [`${HOME}:W:2026-09-30:p`, "forecast"]]);
    expect(list.swells).toEqual(response.swells);
  });
});

describe("resolveOutlookRunDate", () => {
  it("is the newest snapshot run, else today's UTC date", () => {
    expect(resolveOutlookRunDate([pulse(HOME, { runDate: "2026-09-23" }), pulse(HOME, { runDate: "2026-09-24" })], NOW)).toBe("2026-09-24");
    expect(resolveOutlookRunDate([], NOW)).toBe("2026-09-25");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook.test.ts`
Expected: FAIL, `Cannot find module '@/lib/services/discovery/swell-outlook'`.

- [ ] **Step 3: Write the minimal implementation**

```ts
// lib/services/discovery/swell-outlook.ts
import {
  SWELL_EVENT_THRESHOLDS,
  isSwellEventCurrent,
  swellWindowForBeach,
  toSwellEventBeach,
  type BeachSwellEvent,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
} from '@/lib/alerts/swell-events';
import type { PoolBeach } from '@/lib/alerts/user-pool';
import type { BoardClass } from '@/lib/domains/rideability';
import { angleDifference } from '@/lib/domains/shared/angle-utils';
import type { SkillLevel } from '@/lib/domains/user-preferences';
import { getLocalDateStr } from '@/lib/services/discovery/window-selector/time-slot-utils';
import { degreeToCardinal } from '@/lib/utils/geo-utils';
import { resolveBeachTimezone } from '@/lib/utils/timezone-utils';
import type { Beach } from '@/types/database';

import type { ActiveStorm } from './nhc-storms';
import { swellFitFor } from './swell-outlook-fit';
import { carryOverSwells } from './swell-outlook-sticky';
import { faceHeightRange, matchStormOnBearing, sizeByOrientation, swellSourceFor } from './swell-outlook-source';
import type { OutlookSwell, StoredOutlookList, SwellOutlookResponse } from './swell-outlook-types';
import { changeFor, confidenceFor, groupEvents, isPreviousRun, round, type SwellGroup } from './swell-tracking';

export type * from './swell-outlook-types';

export const SWELL_OUTLOOK_HORIZON_DAYS = 9;

const HOUR_MS = 60 * 60 * 1000;
const WINDOW_LEAD_HOURS = 120;
const WINDOW_HALF_HOURS = 12;
const NOTABLE_MATCH_PEAK_MS = 36 * HOUR_MS;

export interface BuildSwellOutlookInput {
  pool: ReadonlyArray<Pick<PoolBeach, 'beach' | 'relation'>>;
  homeBeachId: string | null;
  pulseSnapshots: readonly SwellEventSnapshot[];
  notableSnapshots: readonly SwellEventSnapshot[];
  forecastsByBeach: ReadonlyMap<string, readonly SwellEventForecastRow[]>;
  previous: StoredOutlookList | null;
  skillLevel: SkillLevel | null;
  boardClasses: readonly BoardClass[];
  storms: readonly ActiveStorm[];
  now: Date;
}

export interface BuiltSwellOutlook {
  response: SwellOutlookResponse;
  list: StoredOutlookList;
}

export function resolveOutlookRunDate(snapshots: readonly SwellEventSnapshot[], now: Date): string {
  return snapshots.reduce((latest, snapshot) => (snapshot.runDate > latest ? snapshot.runDate : latest), '')
    || now.toISOString().slice(0, 10);
}

function eventFromSnapshot(snapshot: SwellEventSnapshot, timezone: string): BeachSwellEvent {
  return {
    beachId: snapshot.beachId,
    eventKey: snapshot.eventKey,
    directionDeg: snapshot.directionDeg,
    directionBand: snapshot.directionBand,
    directionLabel: degreeToCardinal(snapshot.directionDeg),
    periodS: snapshot.periodS,
    peakOffshoreHeightFt: snapshot.peakOffshoreHeightFt,
    peakFaceHeightFt: snapshot.peakFaceHeightFt,
    baselineFaceHeightFt: 0,
    peakEnergy: snapshot.exposure * snapshot.peakOffshoreHeightFt ** 2 * snapshot.periodS,
    baselineEnergy: 0,
    energyRatio: snapshot.energyRatio,
    exposure: snapshot.exposure,
    arrivalAt: snapshot.arrivalAt,
    peakAt: snapshot.peakAt,
    fadeAt: snapshot.fadeAt,
    peakLocalDate: getLocalDateStr(new Date(snapshot.peakAt), timezone),
  };
}

function latestPerKey(snapshots: readonly SwellEventSnapshot[]): SwellEventSnapshot[] {
  const latest = new Map<string, SwellEventSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.beachId}|${snapshot.eventKey}`;
    const current = latest.get(key);
    if (!current || Date.parse(snapshot.detectedAt) > Date.parse(current.detectedAt)) latest.set(key, snapshot);
  }
  return [...latest.values()];
}

function historyFor(
  snapshots: readonly SwellEventSnapshot[],
  beachId: string,
  eventKey: string,
): OutlookSwell['history'] {
  const byRun = new Map<string, SwellEventSnapshot>();
  for (const snapshot of snapshots) {
    if (snapshot.beachId !== beachId || snapshot.eventKey !== eventKey) continue;
    const current = byRun.get(snapshot.runDate);
    if (!current || Date.parse(snapshot.detectedAt) > Date.parse(current.detectedAt)) byRun.set(snapshot.runDate, snapshot);
  }
  return [...byRun.values()]
    .sort((left, right) => left.runDate.localeCompare(right.runDate))
    .map((snapshot) => ({
      runDate: snapshot.runDate,
      peakAt: snapshot.peakAt,
      faceHeightFt: round(snapshot.peakFaceHeightFt, 1),
      periodS: Math.round(snapshot.periodS),
    }));
}

function representative(group: SwellGroup, homeBeachId: string | null): BeachSwellEvent {
  const home = group.members.find((member) => member.beachId === homeBeachId);
  if (home) return home;
  return [...group.members].sort((left, right) => (
    right.peakFaceHeightFt - left.peakFaceHeightFt || left.beachId.localeCompare(right.beachId)
  ))[0];
}

function matchNotable(rep: BeachSwellEvent, notable: readonly SwellEventSnapshot[]): SwellEventSnapshot | null {
  let best: { snapshot: SwellEventSnapshot; diff: number } | null = null;
  for (const snapshot of notable) {
    if (snapshot.beachId !== rep.beachId) continue;
    if (angleDifference(snapshot.directionDeg, rep.directionDeg) > SWELL_EVENT_THRESHOLDS.trackDirectionDeg) continue;
    const diff = Math.abs(Date.parse(snapshot.peakAt) - Date.parse(rep.peakAt));
    if (diff <= NOTABLE_MATCH_PEAK_MS && (!best || diff < best.diff)) best = { snapshot, diff };
  }
  return best?.snapshot ?? null;
}

function stableId(group: SwellGroup, rep: BeachSwellEvent, previous: StoredOutlookList | null): string {
  const carried = previous?.swells.find((entry) => (
    entry.status !== 'faded'
    && angleDifference(entry.directionDeg, rep.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
    && Math.abs(Date.parse(entry.peakAt) - Date.parse(rep.peakAt)) <= NOTABLE_MATCH_PEAK_MS
  ));
  if (carried) return carried.id;
  return [...group.members].sort((left, right) => (
    Date.parse(left.peakAt) - Date.parse(right.peakAt) || left.eventKey.localeCompare(right.eventKey)
  ))[0].eventKey;
}

function toOutlookSwell(
  group: SwellGroup,
  input: BuildSwellOutlookInput,
  beachesById: ReadonlyMap<string, Beach>,
  notableLatest: readonly SwellEventSnapshot[],
): OutlookSwell | null {
  const rep = representative(group, input.homeBeachId);
  const beach = beachesById.get(rep.beachId);
  if (!beach) return null;
  const timezone = resolveBeachTimezone(beach.timezone);

  const previousRuns = input.pulseSnapshots.filter((snapshot) => (
    snapshot.beachId === rep.beachId && snapshot.eventKey === rep.eventKey && isPreviousRun(snapshot, input.now)
  ));
  const notable = matchNotable(rep, notableLatest);
  const eventKey = notable?.eventKey ?? rep.eventKey;
  const source = swellSourceFor({
    directionDeg: rep.directionDeg,
    periodS: Math.round(rep.periodS),
    peakAt: rep.peakAt,
    activeStorms: input.storms,
  });
  const leadHours = (Date.parse(rep.peakAt) - input.now.getTime()) / HOUR_MS;
  const peakMs = Date.parse(rep.peakAt);

  return {
    id: stableId(group, rep, input.previous),
    eventKey,
    tier: confidenceFor(rep, previousRuns, input.now),
    status: Date.parse(rep.arrivalAt) <= input.now.getTime() ? 'arrived' : 'forecast',
    change: changeFor(rep, previousRuns, input.pulseSnapshots, input.now, timezone)?.kind ?? 'new',
    arrivalAt: rep.arrivalAt,
    peakAt: rep.peakAt,
    peakWindow: leadHours > WINDOW_LEAD_HOURS
      ? {
        from: new Date(peakMs - WINDOW_HALF_HOURS * HOUR_MS).toISOString(),
        to: new Date(peakMs + WINDOW_HALF_HOURS * HOUR_MS).toISOString(),
      }
      : null,
    faceHeightFt: faceHeightRange(rep.peakFaceHeightFt),
    periodS: Math.round(rep.periodS),
    directionDeg: Math.round(rep.directionDeg) % 360,
    directionLabel: degreeToCardinal(rep.directionDeg),
    beach: { id: beach.id, name: beach.name },
    beachCount: group.members.length,
    notable: notable !== null,
    fit: swellFitFor({ faceHeightFt: rep.peakFaceHeightFt, skillLevel: input.skillLevel, boardClasses: input.boardClasses }),
    source,
    stormName: source === 'tropical'
      ? matchStormOnBearing({ storms: input.storms, beach: { lat: beach.lat, lon: beach.lon }, directionDeg: rep.directionDeg })
      : null,
    sizeByOrientation: sizeByOrientation(group.members.map((member) => ({
      windowCenterDeg: swellWindowForBeach(beachesById.get(member.beachId) ?? {})?.centerDeg ?? null,
      faceHeightFt: member.peakFaceHeightFt,
    }))),
    history: historyFor(notable ? input.notableSnapshots : input.pulseSnapshots, rep.beachId, eventKey),
  };
}

export function buildSwellOutlook(input: BuildSwellOutlookInput): BuiltSwellOutlook {
  const runDate = resolveOutlookRunDate(input.pulseSnapshots, input.now);
  const beachesById = new Map(input.pool.map(({ beach }) => [beach.id, beach]));
  const homeBeach = input.pool.find(({ beach, relation }) => relation === 'home' || beach.id === input.homeBeachId)?.beach ?? null;

  const events = input.pulseSnapshots
    .filter((snapshot) => snapshot.runDate === runDate && beachesById.has(snapshot.beachId))
    .map((snapshot) => eventFromSnapshot(snapshot, resolveBeachTimezone(beachesById.get(snapshot.beachId)?.timezone)))
    .filter((event) => isSwellEventCurrent(event, input.now));

  const notableLatest = latestPerKey(input.notableSnapshots);
  const current = groupEvents(events).flatMap((group) => {
    const swell = toOutlookSwell(group, input, beachesById, notableLatest);
    return swell ? [swell] : [];
  });

  const carried = carryOverSwells({
    previous: input.previous,
    current,
    forecastsByBeach: input.forecastsByBeach,
    beachesById: new Map(input.pool.map(({ beach }) => [beach.id, toSwellEventBeach(beach)])),
    skillLevel: input.skillLevel,
    boardClasses: input.boardClasses,
    now: input.now,
  });

  const swells = [...current, ...carried].sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
  return {
    response: {
      generatedAt: input.now.toISOString(),
      runDate,
      horizonDays: SWELL_OUTLOOK_HORIZON_DAYS,
      homeBeach: homeBeach ? { id: homeBeach.id, name: homeBeach.name } : null,
      swells,
    },
    list: { runDate, swells },
  };
}
```

Notes for the executor: `swellWindowForBeach` accepts `{ swell_window_center_deg?, swell_window_halfwidth_deg? }`, so passing `beachesById.get(...) ?? {}` is type-correct. If `export type * from` is rejected by the repo's TypeScript version, replace it with an explicit `export type { FaceHeightRangeFt, OutlookChange, OutlookStatus, OutlookSwell, OutlookTier, StoredOutlookList, SwellFit, SwellFitStatus, SwellOutlookResponse, SwellSource } from './swell-outlook-types';`. The test imports the types from `swell-outlook-types.ts` directly.

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/services/discovery/swell-outlook.test.ts`
Expected: PASS. If a size or tier expectation differs by the transformer or lead-hours arithmetic, fix the expected value only after confirming the reading against the band tables and `confidenceFor` (76 h to peak, no previous run: `on_the_radar`).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/services/discovery/swell-outlook.ts __tests__/lib/services/discovery/swell-outlook.test.ts
git commit -m "feat(swell-outlook): outlook builder over pulse snapshots"
```

---

### Task 11: Per-user state and back-off logic

**Files:**
- Create: `supabase/migrations/20261004210000_create_swell_outlook_user_state.sql` (written, NOT applied), `lib/alerts/swell-outlook/engagement.ts`, `lib/alerts/swell-outlook/state.ts`
- Modify: `lib/alerts/throttle.ts` (union at lines 1-14)
- Test: `__tests__/migrations/swell-outlook-user-state.test.ts`, `__tests__/lib/alerts/swell-outlook/engagement.test.ts`, `__tests__/lib/alerts/swell-outlook/state.test.ts` (all new); `__tests__/lib/alerts/throttle.test.ts` (append)

**Interfaces:**
- Consumes: `StoredOutlookList` (Task 6).
- Produces (`engagement.ts`): `SWELL_ENGAGEMENT = { answerWindowHours: 48, pauseAfterUnanswered: 3, exceptionAfterDays: 14, firstSightingMinHours: 72 }`; `interface SwellEngagementState { consecutiveUnanswered: number; lastSentAt: string | null; pausedSince: string | null; lastAnsweredAt: string | null; lastExceptionAt: string | null; lastFirstSightingAt: string | null }`; `EMPTY_SWELL_ENGAGEMENT`; `type SwellSendKind = 'first_sighting' | 'followup'`; `type SwellSendDecision = { ok: true; exception: boolean } | { ok: false; reason: 'skipped_unengaged' | 'first_sighting_spacing'; exceptionEligible: boolean }`; `applyOpen<T extends SwellEngagementState>(state: T, now: Date): T`; `settle<T extends SwellEngagementState>(state: T, now: Date): T`; `decideSend(state, now, kind, rare): SwellSendDecision`; `recordSend<T extends SwellEngagementState>(state: T, now: Date, kind: SwellSendKind, exception: boolean): T`.
- Produces (`state.ts`): `interface SwellOutlookUserState extends SwellEngagementState { outlookList: StoredOutlookList | null; outlookPrevList: StoredOutlookList | null }`; `EMPTY_SWELL_OUTLOOK_USER_STATE`; `loadSwellOutlookUserState(supabase, userId): Promise<SwellOutlookUserState | null>`; `saveSwellOutlookUserState(supabase, userId, state): Promise<void>`; `previousListFor(state: SwellOutlookUserState, runDate: string): StoredOutlookList | null`; `advanceLists(state: SwellOutlookUserState, list: StoredOutlookList): SwellOutlookUserState`; `recordSwellOpen(supabase, userId, now): Promise<void>`.
- Produces (`throttle.ts`): `AttemptStatus` gains `'skipped_unengaged'`.

Semantics: a send increments `consecutiveUnanswered` immediately (it is pending). An open within 48 h after `lastSentAt` is the answer and resets it. An open later than 48 h does not reset (the push was unanswered by the spec's definition). Three unanswered pushes whose window has lapsed pause the user (`pausedSince = lastSentAt + 48 h`); while three are still inside their window the next push is held, not sent. Any open while paused clears the pause and the counter; nothing skipped is stored, so nothing is sent late. While paused, a first-sighting push for a swell passing the existing rarity rule is allowed once every 14 days; follow-ups get no exception.

Spec note: `skipped_unengaged` joins `AttemptStatus` as a type member only. The swell runner has no `alert_delivery_attempts` writer, so its skips are counted in the run summary's `skippedCounts`; the `alert_delivery_attempts_status_check` constraint is left alone (nothing writes the new value there).

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/migrations/swell-outlook-user-state.test.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20261004210000_create_swell_outlook_user_state.sql"),
  "utf8",
);

describe("swell outlook user state migration", () => {
  it("runs in one transaction and creates one row per user", () => {
    expect(sql.trim().split("\n").filter((line) => !line.startsWith("--"))[0]).toBe("BEGIN;");
    expect(sql.trim().endsWith("COMMIT;")).toBe(true);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.swell_outlook_user_state/);
    expect(sql).toMatch(/user_id uuid PRIMARY KEY REFERENCES public\.profiles\(id\) ON DELETE CASCADE/);
  });

  it("stores the back-off fields and both lists", () => {
    for (const column of ["last_sent_at", "paused_since", "last_answered_at", "last_exception_at", "last_first_sighting_at"]) {
      expect(sql).toMatch(new RegExp(`${column} timestamptz NULL`));
    }
    expect(sql).toMatch(/consecutive_unanswered integer NOT NULL DEFAULT 0 CHECK \(consecutive_unanswered >= 0\)/);
    expect(sql).toMatch(/outlook_list jsonb NULL/);
    expect(sql).toMatch(/outlook_prev_list jsonb NULL/);
  });

  it("is service role only", () => {
    expect(sql).toMatch(/ALTER TABLE public\.swell_outlook_user_state ENABLE ROW LEVEL SECURITY/);
    expect(sql).not.toMatch(/CREATE POLICY/);
    expect(sql).not.toMatch(/DROP |DELETE FROM|TRUNCATE/);
  });
});
```

```ts
// __tests__/lib/alerts/swell-outlook/engagement.test.ts
import {
  EMPTY_SWELL_ENGAGEMENT,
  applyOpen,
  decideSend,
  recordSend,
  settle,
  type SwellEngagementState,
} from "@/lib/alerts/swell-outlook/engagement";

const T0 = new Date("2026-10-04T16:00:00.000Z");
const hours = (base: Date, h: number): Date => new Date(base.getTime() + h * 3_600_000);

function sentThrice(): SwellEngagementState {
  let state = EMPTY_SWELL_ENGAGEMENT;
  state = recordSend(state, T0, "first_sighting", false);
  state = recordSend(state, hours(T0, 73), "first_sighting", false);
  return recordSend(state, hours(T0, 146), "followup", false);
}

describe("answered", () => {
  it("an open within 48 h of a send resets the counter", () => {
    const sent = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    expect(applyOpen(sent, hours(T0, 47))).toMatchObject({ consecutiveUnanswered: 0, lastAnsweredAt: hours(T0, 47).toISOString() });
  });

  it("an open 60 h after a send is late and leaves the counter alone", () => {
    const sent = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    expect(applyOpen(sent, hours(T0, 60)).consecutiveUnanswered).toBe(1);
  });

  it("an open with nothing pending changes nothing", () => {
    expect(applyOpen(EMPTY_SWELL_ENGAGEMENT, T0)).toEqual(EMPTY_SWELL_ENGAGEMENT);
  });
});

describe("pause after three unanswered", () => {
  it("holds the next push while the third is still inside its answer window", () => {
    expect(decideSend(sentThrice(), hours(T0, 146 + 10), "followup", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
  });

  it("pauses once the third window lapses, and counts first sightings and follow-ups alike", () => {
    const later = hours(T0, 146 + 49);
    expect(settle(sentThrice(), later).pausedSince).toBe(hours(T0, 146 + 48).toISOString());
    expect(decideSend(sentThrice(), later, "first_sighting", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
    expect(decideSend(sentThrice(), later, "followup", false)).toMatchObject({ ok: false, reason: "skipped_unengaged" });
  });

  it("two unanswered pushes never pause", () => {
    let state = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    state = recordSend(state, hours(T0, 73), "first_sighting", false);
    expect(decideSend(state, hours(T0, 300), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });

  it("an open while paused resumes with the counter reset, even long after", () => {
    const paused = settle(sentThrice(), hours(T0, 400));
    const resumed = applyOpen(paused, hours(T0, 410));
    expect(resumed).toMatchObject({ pausedSince: null, consecutiveUnanswered: 0 });
    expect(decideSend(resumed, hours(T0, 411), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });

  it("an open after the window lapsed but before the pause was recorded still resumes", () => {
    const resumed = applyOpen(sentThrice(), hours(T0, 146 + 60));
    expect(resumed).toMatchObject({ pausedSince: null, consecutiveUnanswered: 0 });
  });
});

describe("the 14-day rarity exception", () => {
  const paused = (): SwellEngagementState => settle(sentThrice(), hours(T0, 400));
  const pausedAt = (): Date => new Date(paused().pausedSince as string);

  it("is not offered before 14 days", () => {
    expect(decideSend(paused(), hours(pausedAt(), 13 * 24), "first_sighting", true)).toEqual({ ok: false, reason: "skipped_unengaged", exceptionEligible: false });
  });

  it("is offered after 14 days, and sends only for a rare swell", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    expect(decideSend(paused(), day14, "first_sighting", false)).toEqual({ ok: false, reason: "skipped_unengaged", exceptionEligible: true });
    expect(decideSend(paused(), day14, "first_sighting", true)).toEqual({ ok: true, exception: true });
  });

  it("is never offered to a follow-up", () => {
    expect(decideSend(paused(), hours(pausedAt(), 20 * 24), "followup", true)).toMatchObject({ ok: false, exceptionEligible: false });
  });

  it("allows one, then waits another 14 days with the pause intact", () => {
    const day14 = hours(pausedAt(), 14 * 24);
    const after = recordSend(paused(), day14, "first_sighting", true);
    expect(after).toMatchObject({ pausedSince: paused().pausedSince, lastExceptionAt: day14.toISOString() });
    expect(decideSend(after, hours(day14, 13 * 24), "first_sighting", true)).toMatchObject({ ok: false, exceptionEligible: false });
    expect(decideSend(after, hours(day14, 14 * 24), "first_sighting", true)).toEqual({ ok: true, exception: true });
  });
});

describe("first-sighting spacing", () => {
  it("allows at most one first sighting per 72 h, without limiting follow-ups", () => {
    const state = recordSend(EMPTY_SWELL_ENGAGEMENT, T0, "first_sighting", false);
    const answered = applyOpen(state, hours(T0, 2));
    expect(decideSend(answered, hours(T0, 71), "first_sighting", false)).toMatchObject({ ok: false, reason: "first_sighting_spacing" });
    expect(decideSend(answered, hours(T0, 71), "followup", false)).toEqual({ ok: true, exception: false });
    expect(decideSend(answered, hours(T0, 73), "first_sighting", false)).toEqual({ ok: true, exception: false });
  });
});
```

```ts
// __tests__/lib/alerts/swell-outlook/state.test.ts
import {
  advanceLists,
  loadSwellOutlookUserState,
  previousListFor,
  recordSwellOpen,
  saveSwellOutlookUserState,
  EMPTY_SWELL_OUTLOOK_USER_STATE,
} from "@/lib/alerts/swell-outlook/state";
import type { StoredOutlookList } from "@/lib/services/discovery/swell-outlook-types";

const USER = "dddddddd-1111-4111-8111-000000000001";
const list = (runDate: string): StoredOutlookList => ({ runDate, swells: [] });

function fakeClient(row: Record<string, unknown> | null, error: { message: string } | null = null) {
  const upserts: Array<{ row: Record<string, unknown>; options: unknown }> = [];
  const builder: Record<string, unknown> = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: () => Promise.resolve({ data: row, error }),
    upsert: (value: Record<string, unknown>, options: unknown) => {
      upserts.push({ row: value, options });
      return Promise.resolve({ error: null });
    },
  };
  return { upserts, client: { from: () => builder } as never };
}

describe("list advance", () => {
  it("compares against the previous run's list, not the same run's", () => {
    const state = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list("2026-10-03"), outlookPrevList: list("2026-10-02") };
    expect(previousListFor(state, "2026-10-04")?.runDate).toBe("2026-10-03");
    expect(previousListFor(state, "2026-10-03")?.runDate).toBe("2026-10-02");
    expect(previousListFor(EMPTY_SWELL_OUTLOOK_USER_STATE, "2026-10-04")).toBeNull();
  });

  it("rolls the list forward once per run and is idempotent within a run", () => {
    const state = { ...EMPTY_SWELL_OUTLOOK_USER_STATE, outlookList: list("2026-10-03"), outlookPrevList: list("2026-10-02") };
    const next = advanceLists(state, list("2026-10-04"));
    expect([next.outlookList?.runDate, next.outlookPrevList?.runDate]).toEqual(["2026-10-04", "2026-10-03"]);
    const again = advanceLists(next, list("2026-10-04"));
    expect([again.outlookList?.runDate, again.outlookPrevList?.runDate]).toEqual(["2026-10-04", "2026-10-03"]);
  });
});

describe("persistence", () => {
  it("reads a row into camelCase state and tolerates a malformed list", async () => {
    const { client } = fakeClient({
      user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-10-01T10:00:00.000Z", paused_since: null,
      last_answered_at: null, last_exception_at: null, last_first_sighting_at: "2026-10-01T10:00:00.000Z",
      outlook_list: { runDate: "2026-10-03", swells: [] }, outlook_prev_list: "garbage",
    });
    expect(await loadSwellOutlookUserState(client, USER)).toMatchObject({
      consecutiveUnanswered: 2, lastFirstSightingAt: "2026-10-01T10:00:00.000Z", outlookList: { runDate: "2026-10-03" }, outlookPrevList: null,
    });
  });

  it("returns null without a row and throws on a read error", async () => {
    expect(await loadSwellOutlookUserState(fakeClient(null).client, USER)).toBeNull();
    await expect(loadSwellOutlookUserState(fakeClient(null, { message: "boom" }).client, USER)).rejects.toThrow("boom");
  });

  it("upserts one row per user in snake_case", async () => {
    const { client, upserts } = fakeClient(null);
    await saveSwellOutlookUserState(client, USER, { ...EMPTY_SWELL_OUTLOOK_USER_STATE, consecutiveUnanswered: 1, outlookList: list("2026-10-04") });
    expect(upserts[0].options).toEqual({ onConflict: "user_id" });
    expect(upserts[0].row).toMatchObject({ user_id: USER, consecutive_unanswered: 1, outlook_list: { runDate: "2026-10-04" }, paused_since: null });
  });
});

describe("recordSwellOpen", () => {
  const now = new Date("2026-10-04T18:00:00.000Z");

  it("resets the counter for an open inside 48 h of a send", async () => {
    const { client, upserts } = fakeClient({ user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-10-03T10:00:00.000Z" });
    await recordSwellOpen(client, USER, now);
    expect(upserts[0].row).toMatchObject({ consecutive_unanswered: 0, last_answered_at: now.toISOString() });
  });

  it("writes nothing for a user with no state row or nothing to change", async () => {
    const none = fakeClient(null);
    await recordSwellOpen(none.client, USER, now);
    expect(none.upserts).toEqual([]);
    const idle = fakeClient({ user_id: USER, consecutive_unanswered: 0 });
    await recordSwellOpen(idle.client, USER, now);
    expect(idle.upserts).toEqual([]);
  });
});
```

Append to `__tests__/lib/alerts/throttle.test.ts`:

```ts
import type { AttemptStatus } from "@/lib/alerts/throttle";

it("knows the unengaged-user skip status", () => {
  const status: AttemptStatus = "skipped_unengaged";
  expect(status).toBe("skipped_unengaged");
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/migrations/swell-outlook-user-state.test.ts __tests__/lib/alerts/swell-outlook __tests__/lib/alerts/throttle.test.ts`
Expected: FAIL (ENOENT on the migration, modules not found; the throttle test fails type-check or is a no-op until the union changes).

- [ ] **Step 3: Write the minimal implementation**

`lib/alerts/throttle.ts`: add `| "skipped_unengaged"` after `"skipped_stale_forecast"` in the `AttemptStatus` union.

`supabase/migrations/20261004210000_create_swell_outlook_user_state.sql`:

```sql
-- Per-user Swell Outlook state, next to swell_event_user_state: the back-off
-- counters for swell pushes and the last two lists the outlook returned (sticky
-- tracking compares today's list with the previous run's).
-- Written by /api/swell/outlook and /api/cron/swell-alert with the service role only.
BEGIN;

CREATE TABLE IF NOT EXISTS public.swell_outlook_user_state (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  consecutive_unanswered integer NOT NULL DEFAULT 0 CHECK (consecutive_unanswered >= 0),
  last_sent_at timestamptz NULL,
  paused_since timestamptz NULL,
  last_answered_at timestamptz NULL,
  last_exception_at timestamptz NULL,
  last_first_sighting_at timestamptz NULL,
  outlook_list jsonb NULL,
  outlook_prev_list jsonb NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Service role only: RLS on with no policies, as on swell_event_user_state.
ALTER TABLE public.swell_outlook_user_state ENABLE ROW LEVEL SECURITY;

COMMIT;
```

`lib/alerts/swell-outlook/engagement.ts`:

```ts
export const SWELL_ENGAGEMENT = {
  answerWindowHours: 48,
  pauseAfterUnanswered: 3,
  exceptionAfterDays: 14,
  firstSightingMinHours: 72,
} as const;

export interface SwellEngagementState {
  consecutiveUnanswered: number;
  lastSentAt: string | null;
  pausedSince: string | null;
  lastAnsweredAt: string | null;
  lastExceptionAt: string | null;
  lastFirstSightingAt: string | null;
}

export const EMPTY_SWELL_ENGAGEMENT: SwellEngagementState = {
  consecutiveUnanswered: 0,
  lastSentAt: null,
  pausedSince: null,
  lastAnsweredAt: null,
  lastExceptionAt: null,
  lastFirstSightingAt: null,
};

export type SwellSendKind = 'first_sighting' | 'followup';
export type SwellSendDecision =
  | { ok: true; exception: boolean }
  | { ok: false; reason: 'skipped_unengaged' | 'first_sighting_spacing'; exceptionEligible: boolean };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Three pushes sent, none answered, and the last answer window has lapsed: paused as of that lapse. */
export function settle<T extends SwellEngagementState>(state: T, now: Date): T {
  if (state.pausedSince !== null || state.lastSentAt === null) return state;
  if (state.consecutiveUnanswered < SWELL_ENGAGEMENT.pauseAfterUnanswered) return state;
  const lapse = Date.parse(state.lastSentAt) + SWELL_ENGAGEMENT.answerWindowHours * HOUR_MS;
  return now.getTime() > lapse ? { ...state, pausedSince: new Date(lapse).toISOString() } : state;
}

/** An authenticated outlook or swell-detail read: answers a recent push, and ends any pause. */
export function applyOpen<T extends SwellEngagementState>(state: T, now: Date): T {
  const current = settle(state, now);
  if (current.pausedSince !== null) {
    return { ...current, pausedSince: null, consecutiveUnanswered: 0, lastAnsweredAt: now.toISOString() };
  }
  if (current.lastSentAt === null || current.consecutiveUnanswered === 0) return current;
  const age = now.getTime() - Date.parse(current.lastSentAt);
  if (age < 0 || age > SWELL_ENGAGEMENT.answerWindowHours * HOUR_MS) return current;
  return { ...current, consecutiveUnanswered: 0, lastAnsweredAt: now.toISOString() };
}

export function decideSend(
  state: SwellEngagementState,
  now: Date,
  kind: SwellSendKind,
  rare: boolean,
): SwellSendDecision {
  const current = settle(state, now);
  if (current.pausedSince !== null) {
    const reference = Math.max(
      Date.parse(current.pausedSince),
      current.lastExceptionAt ? Date.parse(current.lastExceptionAt) : 0,
    );
    const open = kind === 'first_sighting'
      && now.getTime() - reference >= SWELL_ENGAGEMENT.exceptionAfterDays * DAY_MS;
    if (open && rare) return { ok: true, exception: true };
    return { ok: false, reason: 'skipped_unengaged', exceptionEligible: open };
  }
  if (current.consecutiveUnanswered >= SWELL_ENGAGEMENT.pauseAfterUnanswered) {
    return { ok: false, reason: 'skipped_unengaged', exceptionEligible: false };
  }
  if (
    kind === 'first_sighting'
    && current.lastFirstSightingAt !== null
    && now.getTime() - Date.parse(current.lastFirstSightingAt) < SWELL_ENGAGEMENT.firstSightingMinHours * HOUR_MS
  ) {
    return { ok: false, reason: 'first_sighting_spacing', exceptionEligible: false };
  }
  return { ok: true, exception: false };
}

export function recordSend<T extends SwellEngagementState>(
  state: T,
  now: Date,
  kind: SwellSendKind,
  exception: boolean,
): T {
  const at = now.toISOString();
  return {
    ...state,
    consecutiveUnanswered: state.consecutiveUnanswered + 1,
    lastSentAt: at,
    lastFirstSightingAt: kind === 'first_sighting' ? at : state.lastFirstSightingAt,
    lastExceptionAt: exception ? at : state.lastExceptionAt,
  };
}
```

`lib/alerts/swell-outlook/state.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import type { StoredOutlookList } from '@/lib/services/discovery/swell-outlook-types';
import type { Database } from '@/types/database.generated';

import { EMPTY_SWELL_ENGAGEMENT, applyOpen, type SwellEngagementState } from './engagement';

const TABLE = 'swell_outlook_user_state';
const COLUMNS = [
  'user_id', 'consecutive_unanswered', 'last_sent_at', 'paused_since', 'last_answered_at',
  'last_exception_at', 'last_first_sighting_at', 'outlook_list', 'outlook_prev_list',
].join(',');

export interface SwellOutlookUserState extends SwellEngagementState {
  outlookList: StoredOutlookList | null;
  outlookPrevList: StoredOutlookList | null;
}

export const EMPTY_SWELL_OUTLOOK_USER_STATE: SwellOutlookUserState = {
  ...EMPTY_SWELL_ENGAGEMENT,
  outlookList: null,
  outlookPrevList: null,
};

// The table is not in the generated types; rows are validated field by field.
function untyped(supabase: SupabaseClient<Database>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function parseList(value: unknown): StoredOutlookList | null {
  if (!value || typeof value !== 'object') return null;
  const { runDate, swells } = value as { runDate?: unknown; swells?: unknown };
  return typeof runDate === 'string' && Array.isArray(swells)
    ? { runDate, swells: swells as StoredOutlookList['swells'] }
    : null;
}

export async function loadSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<SwellOutlookUserState | null> {
  const { data, error } = await untyped(supabase).from(TABLE).select(COLUMNS).eq('user_id', userId).maybeSingle();
  if (error) throw new Error(`Failed to load swell outlook state: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as Record<string, unknown>;
  const count = typeof row.consecutive_unanswered === 'number' ? row.consecutive_unanswered : 0;
  return {
    consecutiveUnanswered: count,
    lastSentAt: text(row.last_sent_at),
    pausedSince: text(row.paused_since),
    lastAnsweredAt: text(row.last_answered_at),
    lastExceptionAt: text(row.last_exception_at),
    lastFirstSightingAt: text(row.last_first_sighting_at),
    outlookList: parseList(row.outlook_list),
    outlookPrevList: parseList(row.outlook_prev_list),
  };
}

export async function saveSwellOutlookUserState(
  supabase: SupabaseClient<Database>,
  userId: string,
  state: SwellOutlookUserState,
): Promise<void> {
  const { error } = await untyped(supabase).from(TABLE).upsert({
    user_id: userId,
    consecutive_unanswered: state.consecutiveUnanswered,
    last_sent_at: state.lastSentAt,
    paused_since: state.pausedSince,
    last_answered_at: state.lastAnsweredAt,
    last_exception_at: state.lastExceptionAt,
    last_first_sighting_at: state.lastFirstSightingAt,
    outlook_list: state.outlookList,
    outlook_prev_list: state.outlookPrevList,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw new Error(`Failed to save swell outlook state: ${error.message}`);
}

/** The list sticky tracking compares against: the one from an earlier run than `runDate`. */
export function previousListFor(state: SwellOutlookUserState, runDate: string): StoredOutlookList | null {
  if (state.outlookList && state.outlookList.runDate < runDate) return state.outlookList;
  return state.outlookPrevList;
}

export function advanceLists(state: SwellOutlookUserState, list: StoredOutlookList): SwellOutlookUserState {
  if (state.outlookList?.runDate === list.runDate) return { ...state, outlookList: list };
  return { ...state, outlookPrevList: state.outlookList, outlookList: list };
}

/** Records an authenticated read as an answer. A user with no state row was never pushed, so nothing to record. */
export async function recordSwellOpen(
  supabase: SupabaseClient<Database>,
  userId: string,
  now: Date,
): Promise<void> {
  const state = await loadSwellOutlookUserState(supabase, userId);
  if (!state) return;
  const next = applyOpen(state, now);
  if (JSON.stringify(next) === JSON.stringify(state)) return;
  await saveSwellOutlookUserState(supabase, userId, next);
}
```

- [ ] **Step 4: Run tests to verify they pass; then run the Postgres harness against the disposable cluster**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/migrations/swell-outlook-user-state.test.ts __tests__/lib/alerts/swell-outlook __tests__/lib/alerts/throttle.test.ts`
Expected: PASS.

Run: `bash scripts/test-swell-snapshot-outcomes-postgres.sh`
Expected: the last line reads `swell snapshot outcomes OK: <n> rows resolved` and the script exits 0. This applies the snapshot table, the F4 migration and this migration to a throwaway local cluster only; if `/opt/homebrew/opt/postgresql@15/bin` is absent set `SCOUT_PG_BIN` to any local PostgreSQL 15 bin directory. Never point it at the shared database.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add supabase/migrations/20261004210000_create_swell_outlook_user_state.sql lib/alerts/throttle.ts lib/alerts/swell-outlook/engagement.ts lib/alerts/swell-outlook/state.ts __tests__/migrations/swell-outlook-user-state.test.ts __tests__/lib/alerts/swell-outlook __tests__/lib/alerts/throttle.test.ts
git commit -m "feat(swell-outlook): per-user state and push back-off (migration written, not applied)"
```

---

### Task 12: Flag, loader and `GET /api/swell/outlook`

**Files:**
- Create: `lib/flags/swell-outlook.ts`, `lib/services/discovery/swell-outlook-loader.ts`, `app/api/swell/outlook/route.ts`
- Modify: `app/api/swell/[eventKey]/route.ts` (record answered opens; options at 66-68)
- Test: `lib/flags/__tests__/swell-outlook.test.ts`, `__tests__/lib/services/discovery/swell-outlook-loader.test.ts`, `__tests__/app/api/swell-outlook-route.test.ts` (new); `__tests__/app/api/swell-event-route.test.ts` (modify the options assertion, append tests)

**Interfaces:**
- Consumes: `buildSwellOutlook`, `resolveOutlookRunDate` (Task 10); state functions and `applyOpen` (Task 11); `loadUserPool`, `PoolBeach` from `@/lib/alerts/user-pool`; `loadRecentSwellSnapshots`, `loadSwellForecastRows`, `SWELL_OUTLOOK_PULSE_DETECTOR_VERSION` from `@/lib/alerts/swell-events`; `getActiveStorms` (Task 7); `normalizeBoardClass` from `@/lib/domains/rideability`; `parseSkillLevel` from `@/lib/domains/user-preferences`; `withAuth`, `withRateLimit`, `withNoStore`, `withProtection` from `@/lib/middleware/api-wrappers`.
- Produces: `SWELL_OUTLOOK_ENABLED_FLAG`, `SWELL_OUTLOOK_USER_ALLOWLIST_FLAG`, `isSwellOutlookEnabled(): boolean`, `getSwellOutlookAllowlist(): Set<string>`, `isSwellOutlookUserAllowed(userId: string): boolean`; `loadSwellOutlookForUser(args: { client: SupabaseClient<Database>; userId: string; now: Date; recordOpen: boolean; deps?: Partial<SwellOutlookLoaderDeps> }): Promise<SwellOutlookResponse>`; `SwellOutlookLoaderDeps`; the route handler.

Spec notes: (1) `createSuccessResponse` wraps bodies in `{ success, data, timestamp }`; the spec gives `SwellOutlookResponse` as the response type and the sibling `/api/swell/[eventKey]` returns an unwrapped body, so the outlook route returns the bare object. (2) `GET /api/swell/[eventKey]` is public and CDN cached (`s-maxage=300`); an authenticated read served from the CDN never reaches the handler and is not counted as an answer. The outlook GET (Home loads it, never cached) is the reliable signal. (3) A flag-off or non-allowlisted user gets a real `404 { error: "not_found" }`, never a 200.

- [ ] **Step 1: Write the failing tests**

```ts
// lib/flags/__tests__/swell-outlook.test.ts
import {
  SWELL_OUTLOOK_ENABLED_FLAG,
  SWELL_OUTLOOK_USER_ALLOWLIST_FLAG,
  getSwellOutlookAllowlist,
  isSwellOutlookEnabled,
  isSwellOutlookUserAllowed,
} from "@/lib/flags/swell-outlook";

const originalEnv = { ...process.env };
afterEach(() => {
  process.env = { ...originalEnv };
});

describe("swell outlook flags", () => {
  it("uses the contract env names", () => {
    expect(SWELL_OUTLOOK_ENABLED_FLAG).toBe("SWELL_OUTLOOK_ENABLED");
    expect(SWELL_OUTLOOK_USER_ALLOWLIST_FLAG).toBe("SWELL_OUTLOOK_USER_ALLOWLIST");
  });

  it("defaults off and enables only for exact true", () => {
    delete process.env[SWELL_OUTLOOK_ENABLED_FLAG];
    expect(isSwellOutlookEnabled()).toBe(false);
    process.env[SWELL_OUTLOOK_ENABLED_FLAG] = "TRUE";
    expect(isSwellOutlookEnabled()).toBe(false);
    process.env[SWELL_OUTLOOK_ENABLED_FLAG] = "true";
    expect(isSwellOutlookEnabled()).toBe(true);
  });

  it("allows nobody when the allowlist is empty or unset", () => {
    delete process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG];
    expect(isSwellOutlookUserAllowed("any-user")).toBe(false);
    process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] = " , ";
    expect(isSwellOutlookUserAllowed("any-user")).toBe(false);
  });

  it("trims the allowlist and allows only listed users", () => {
    process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] = "a, b ,,c";
    expect(getSwellOutlookAllowlist()).toEqual(new Set(["a", "b", "c"]));
    expect(isSwellOutlookUserAllowed("b")).toBe(true);
    expect(isSwellOutlookUserAllowed("d")).toBe(false);
  });
});
```

```ts
/**
 * @jest-environment node
 */
// __tests__/lib/services/discovery/swell-outlook-loader.test.ts
import { loadSwellOutlookForUser, type SwellOutlookLoaderDeps } from "@/lib/services/discovery/swell-outlook-loader";
import { SWELL_OUTLOOK_PULSE_DETECTOR_VERSION, type SwellEventSnapshot } from "@/lib/alerts/swell-events";
import { createMockBeach } from "@/__tests__/setup/typed-mocks";
import { NOW, TIMEZONE, dayRows } from "@/__tests__/helpers/swell-events";

const USER = "eeeeeeee-0000-4000-8000-000000000001";
const HOME = "eeeeeeee-0000-4000-8000-0000000000a1";

const homeBeach = createMockBeach({
  id: HOME, name: "Home Beach", slug: "home-beach", timezone: TIMEZONE, swell_window_center_deg: 270, swell_window_halfwidth_deg: 30,
});

function pulse(overrides: Partial<SwellEventSnapshot> = {}): SwellEventSnapshot {
  return {
    beachId: HOME, eventKey: `${HOME}:W:2026-09-28:p`, detectorVersion: SWELL_OUTLOOK_PULSE_DETECTOR_VERSION, runDate: "2026-09-25",
    detectedAt: "2026-09-25T14:30:00.000Z", directionDeg: 270, directionBand: "W", periodS: 14, peakOffshoreHeightFt: 3,
    peakFaceHeightFt: 4, exposure: 1, energyRatio: 5, arrivalAt: "2026-09-28T07:00:00.000Z", peakAt: "2026-09-28T19:00:00.000Z",
    fadeAt: "2026-09-29T07:00:00.000Z", crossingDirectionDeg: null, crossingPeriodS: null, crossingOffshoreHeightFt: null,
    ...overrides,
  };
}

function fakeClient(tables: { profile?: Record<string, unknown> | null; boards?: Array<{ board_type: string }>; state?: Record<string, unknown> | null; upsertError?: string }) {
  const upserts: Array<Record<string, unknown>> = [];
  const client = {
    upserts,
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: () => Promise.resolve({ data: table === "profiles" ? tables.profile ?? null : tables.state ?? null, error: null }),
        upsert: (row: Record<string, unknown>) => {
          upserts.push(row);
          return Promise.resolve({ error: tables.upsertError ? { message: tables.upsertError } : null });
        },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: tables.boards ?? [], error: null }),
      };
      return builder;
    },
  };
  return client as typeof client & never;
}

const PROFILE = { home_beach_id: HOME, max_drive_minutes: 30, experience_level: "advanced", user_location_snapshots: null };

function deps(overrides: Partial<SwellOutlookLoaderDeps> = {}): SwellOutlookLoaderDeps {
  return {
    loadPool: jest.fn(async () => [{ beach: homeBeach, relation: "home" as const, distanceMiles: null }]),
    loadSnapshots: jest.fn(async (_client, _ids, _since, version) => (version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION ? [pulse()] : [])),
    loadForecasts: jest.fn(async () => new Map()),
    getStorms: jest.fn(async () => []),
    ...overrides,
  } as SwellOutlookLoaderDeps;
}

describe("loadSwellOutlookForUser", () => {
  it("returns an empty list for a user with no pool and reads no snapshots", async () => {
    const client = fakeClient({ profile: { ...PROFILE, home_beach_id: null } });
    const loaders = deps({ loadPool: jest.fn(async () => []) });
    const response = await loadSwellOutlookForUser({ client, userId: USER, now: NOW, recordOpen: true, deps: loaders });
    expect(response).toMatchObject({ homeBeach: null, swells: [], horizonDays: 9 });
    expect(loaders.loadSnapshots).not.toHaveBeenCalled();
    expect(client.upserts).toEqual([]);
  });

  it("returns an empty list for a user without a profile row", async () => {
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: null }), userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(response.swells).toEqual([]);
  });

  it("ignores boards that do not map to a class instead of treating them as foamies", async () => {
    const unknown = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, boards: [{ board_type: "gizmo" }] }), userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(unknown.swells[0].fit).toEqual({ status: "in_range", boards: [] });
    const mixed = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, boards: [{ board_type: "Fish" }, { board_type: "shortboard" }, { board_type: "gizmo" }] }), userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(mixed.swells[0].fit).toEqual({ status: "in_range", boards: ["fish", "shortboard"] });
  });

  it("lists a swell without a skill level and marks fit unknown", async () => {
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: { ...PROFILE, experience_level: null } }), userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(response.swells[0].fit.status).toBe("unknown");
  });

  it("responds normally when the storm feed rejects", async () => {
    const tropical = pulse({ directionDeg: 170, directionBand: "S", periodS: 12, eventKey: `${HOME}:S:2026-10-08:p`, peakAt: "2026-10-08T19:00:00.000Z", arrivalAt: "2026-10-08T07:00:00.000Z" });
    const response = await loadSwellOutlookForUser({
      client: fakeClient({ profile: PROFILE }), userId: USER, now: NOW, recordOpen: false,
      deps: deps({
        loadSnapshots: jest.fn(async (_c, _i, _s, version) => (version === SWELL_OUTLOOK_PULSE_DETECTOR_VERSION ? [tropical] : [])) as never,
        getStorms: jest.fn(async () => { throw new Error("feed down"); }),
      }),
    });
    expect(response.swells[0].stormName).toBeNull();
  });

  it("stores the list, and records the open only when asked", async () => {
    const pending = { user_id: USER, consecutive_unanswered: 2, last_sent_at: "2026-09-24T10:00:00.000Z" };
    const quiet = fakeClient({ profile: PROFILE, state: pending });
    await loadSwellOutlookForUser({ client: quiet, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    expect(quiet.upserts[0]).toMatchObject({ consecutive_unanswered: 2, outlook_list: { runDate: "2026-09-25" } });
    const opened = fakeClient({ profile: PROFILE, state: pending });
    await loadSwellOutlookForUser({ client: opened, userId: USER, now: NOW, recordOpen: true, deps: deps() });
    expect(opened.upserts[0]).toMatchObject({ consecutive_unanswered: 0, last_answered_at: NOW.toISOString() });
  });

  it("still answers when the state write fails", async () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const response = await loadSwellOutlookForUser({ client: fakeClient({ profile: PROFILE, upsertError: "db down" }), userId: USER, now: NOW, recordOpen: true, deps: deps() });
    expect(response.swells).toHaveLength(1);
  });

  it("keeps yesterday's swell as shrinking when today's run lost it but the rows still show 2 ft or more", async () => {
    const first = fakeClient({ profile: PROFILE });
    await loadSwellOutlookForUser({ client: first, userId: USER, now: NOW, recordOpen: false, deps: deps() });
    const stored = first.upserts[0];

    const tomorrow = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const rows = [2, 3, 4].flatMap((day) => dayRows(day, { heightFt: 2.5, periodS: 14, direction: 270 }));
    const second = await loadSwellOutlookForUser({
      client: fakeClient({ profile: PROFILE, state: stored }), userId: USER, now: tomorrow, recordOpen: false,
      deps: deps({ loadSnapshots: jest.fn(async () => []) as never, loadForecasts: jest.fn(async () => new Map([[HOME, rows]])) as never }),
    });
    expect(second.runDate).toBe("2026-09-26");
    expect(second.swells[0]).toMatchObject({ status: "shrinking", change: "downgraded" });
  });
});
```

```ts
/** @jest-environment node */
// __tests__/app/api/swell-outlook-route.test.ts
jest.mock("server-only", () => ({}));
jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withAuth: (handler: unknown) => handler,
  withRateLimit: (handler: unknown) => handler,
}));
const mockLoad = jest.fn();
jest.mock("@/lib/services/discovery/swell-outlook-loader", () => ({
  loadSwellOutlookForUser: (...args: unknown[]) => mockLoad(...args),
}));
jest.mock("@/lib/supabase/server", () => ({ createSupabaseServiceRoleClient: jest.fn(() => ({ marker: "service" })) }));

import { NextRequest } from "next/server";
import { GET } from "@/app/api/swell/outlook/route";

const OUTLOOK = { generatedAt: "2026-10-04T18:00:00.000Z", runDate: "2026-10-04", horizonDays: 9, homeBeach: null, swells: [] };

function call(userId = "user-1"): Promise<Response> {
  return GET(new NextRequest("http://localhost/api/swell/outlook"), { user: { id: userId }, supabase: {}, params: {} } as never);
}

describe("GET /api/swell/outlook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoad.mockResolvedValue(OUTLOOK);
    process.env.SWELL_OUTLOOK_ENABLED = "true";
    process.env.SWELL_OUTLOOK_USER_ALLOWLIST = "user-1";
  });

  it("is a real 404 when the flag is off, without touching the loader", async () => {
    process.env.SWELL_OUTLOOK_ENABLED = "false";
    const response = await call();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "not_found" });
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("is a 404 for a user who is not on the allowlist, and for everyone when the allowlist is empty", async () => {
    expect((await call("someone-else")).status).toBe(404);
    process.env.SWELL_OUTLOOK_USER_ALLOWLIST = "";
    expect((await call()).status).toBe(404);
    expect(mockLoad).not.toHaveBeenCalled();
  });

  it("returns the bare SwellOutlookResponse, uncached, and records the open", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(OUTLOOK);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(mockLoad).toHaveBeenCalledWith(expect.objectContaining({ userId: "user-1", recordOpen: true }));
  });

  it("treats an empty list as a valid response", async () => {
    expect((await (await call()).json()).swells).toEqual([]);
  });
});
```

Modify `__tests__/app/api/swell-event-route.test.ts`: add near the top (before the `import { GET }` line)

```ts
const mockRecordOpen = jest.fn(async () => undefined);
jest.mock("@/lib/alerts/swell-outlook/state", () => ({
  recordSwellOpen: (...args: unknown[]) => mockRecordOpen(...args),
}));
```

change `call` to take an optional user and pass it in the context:

```ts
function call(eventKey: string, query = "", user?: { id: string }): Promise<Response> {
  return GET(
    new NextRequest(`https://www.quiversurf.app/api/swell/${encodeURIComponent(eventKey)}${query}`),
    { params: Promise.resolve({ eventKey: encodeURIComponent(eventKey) }), ...(user ? { user } : {}) } as never,
  );
}
```

replace the options assertion with

```ts
  it("is public with optional auth and rate limited", () => {
    expect(jest.requireMock("@/lib/middleware/api-wrappers").protectionOptions[0]).toEqual({
      auth: { required: false },
      rateLimit: { key: "public-default" },
    });
  });
```

and append

```ts
  it("records a signed-in read as an answer, and an anonymous one not at all", async () => {
    expect((await call(SWELL_EVENT_KEY, "", { id: "user-9" })).status).toBe(200);
    expect(mockRecordOpen).toHaveBeenCalledWith(expect.anything(), "user-9", expect.any(Date));
    mockRecordOpen.mockClear();
    await call(SWELL_EVENT_KEY);
    expect(mockRecordOpen).not.toHaveBeenCalled();
  });

  it("never fails the response when recording the open fails", async () => {
    mockRecordOpen.mockRejectedValueOnce(new Error("db down"));
    jest.spyOn(console, "warn").mockImplementation(() => {});
    expect((await call(SWELL_EVENT_KEY, "", { id: "user-9" })).status).toBe(200);
  });

  it("does not record an open for a malformed key", async () => {
    mockRecordOpen.mockClear();
    expect((await call("1 OR 1=1", "", { id: "user-9" })).status).toBe(400);
    expect(mockRecordOpen).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run them to verify they fail**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit lib/flags/__tests__/swell-outlook.test.ts __tests__/lib/services/discovery/swell-outlook-loader.test.ts __tests__/app/api/swell-outlook-route.test.ts __tests__/app/api/swell-event-route.test.ts`
Expected: FAIL (modules not found; the event-route options assertion fails because the route still declares only `rateLimit`).

- [ ] **Step 3: Write the minimal implementation**

`lib/flags/swell-outlook.ts`:

```ts
export const SWELL_OUTLOOK_ENABLED_FLAG = "SWELL_OUTLOOK_ENABLED";
export const SWELL_OUTLOOK_USER_ALLOWLIST_FLAG = "SWELL_OUTLOOK_USER_ALLOWLIST";

export function isSwellOutlookEnabled(): boolean {
  return process.env[SWELL_OUTLOOK_ENABLED_FLAG] === "true";
}

export function getSwellOutlookAllowlist(): Set<string> {
  return new Set(
    (process.env[SWELL_OUTLOOK_USER_ALLOWLIST_FLAG] ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

/** An empty list means nobody: the outlook rolls out by name (like swell follow-ups). */
export function isSwellOutlookUserAllowed(userId: string): boolean {
  return getSwellOutlookAllowlist().has(userId);
}
```

`lib/services/discovery/swell-outlook-loader.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  SWELL_OUTLOOK_PULSE_DETECTOR_VERSION,
  loadRecentSwellSnapshots,
  loadSwellForecastRows,
} from '@/lib/alerts/swell-events';
import { applyOpen } from '@/lib/alerts/swell-outlook/engagement';
import {
  EMPTY_SWELL_OUTLOOK_USER_STATE,
  advanceLists,
  loadSwellOutlookUserState,
  previousListFor,
  saveSwellOutlookUserState,
  type SwellOutlookUserState,
} from '@/lib/alerts/swell-outlook/state';
import { loadUserPool } from '@/lib/alerts/user-pool';
import { normalizeBoardClass, type BoardClass } from '@/lib/domains/rideability';
import { parseSkillLevel } from '@/lib/domains/user-preferences';
import type { Database } from '@/types/database';

import { getActiveStorms, type ActiveStorm } from './nhc-storms';
import { buildSwellOutlook, resolveOutlookRunDate, type SwellOutlookResponse } from './swell-outlook';

const DAY_MS = 24 * 60 * 60 * 1000;
const SNAPSHOT_HISTORY_DAYS = 10;
const STICKY_ROWS_BACK_MS = 6 * 60 * 60 * 1000;
const STICKY_ROWS_AHEAD_MS = 10 * DAY_MS;

type Client = SupabaseClient<Database>;

export interface SwellOutlookLoaderDeps {
  loadPool: typeof loadUserPool;
  loadSnapshots: typeof loadRecentSwellSnapshots;
  loadForecasts: typeof loadSwellForecastRows;
  getStorms: () => Promise<ActiveStorm[]>;
}

const DEFAULT_DEPS: SwellOutlookLoaderDeps = {
  loadPool: loadUserPool,
  loadSnapshots: loadRecentSwellSnapshots,
  loadForecasts: loadSwellForecastRows,
  getStorms: getActiveStorms,
};

interface OutlookProfile {
  homeBeachId: string | null;
  location: { lat: number; lon: number } | null;
  maxDriveMinutes: number | null;
  experienceLevel: string | null;
}

async function loadOutlookProfile(client: Client, userId: string): Promise<OutlookProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select('home_beach_id, max_drive_minutes, experience_level, user_location_snapshots(lat, lon)')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load swell outlook profile: ${error.message}`);
  if (!data) return null;
  const row = data as unknown as {
    home_beach_id: string | null;
    max_drive_minutes: number | null;
    experience_level: string | null;
    user_location_snapshots: { lat: number; lon: number } | Array<{ lat: number; lon: number }> | null;
  };
  const joined = Array.isArray(row.user_location_snapshots) ? row.user_location_snapshots[0] : row.user_location_snapshots;
  return {
    homeBeachId: row.home_beach_id,
    location: joined ? { lat: joined.lat, lon: joined.lon } : null,
    maxDriveMinutes: row.max_drive_minutes,
    experienceLevel: row.experience_level,
  };
}

/** A board type that does not normalise is dropped: guessing a class would move the fit band. */
async function loadBoardClasses(client: Client, userId: string): Promise<BoardClass[]> {
  const { data, error } = await client.from('boards').select('board_type').eq('user_id', userId);
  if (error || !Array.isArray(data)) return [];
  const classes = data
    .map((row) => normalizeBoardClass(row.board_type))
    .filter((boardClass): boardClass is BoardClass => boardClass !== null);
  return [...new Set(classes)];
}

async function safeState(client: Client, userId: string): Promise<SwellOutlookUserState | null> {
  try {
    return await loadSwellOutlookUserState(client, userId);
  } catch (error) {
    console.warn('[swell-outlook] state read failed; sticky tracking skipped', error instanceof Error ? error.message : String(error));
    return null;
  }
}

function emptyResponse(now: Date): SwellOutlookResponse {
  return { generatedAt: now.toISOString(), runDate: now.toISOString().slice(0, 10), horizonDays: 9, homeBeach: null, swells: [] };
}

export async function loadSwellOutlookForUser(args: {
  client: Client;
  userId: string;
  now: Date;
  recordOpen: boolean;
  deps?: Partial<SwellOutlookLoaderDeps>;
}): Promise<SwellOutlookResponse> {
  const { client, userId, now } = args;
  const deps = { ...DEFAULT_DEPS, ...args.deps };

  const profile = await loadOutlookProfile(client, userId);
  if (!profile) return emptyResponse(now);

  const state = await safeState(client, userId);
  const pool = await deps.loadPool({
    supabase: client,
    userId,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  if (pool.length === 0 && !state) return emptyResponse(now);

  const poolIds = pool.map(({ beach }) => beach.id);
  const since = new Date(now.getTime() - SNAPSHOT_HISTORY_DAYS * DAY_MS);
  const [pulseSnapshots, notableSnapshots, boardClasses, storms] = await Promise.all([
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since, SWELL_OUTLOOK_PULSE_DETECTOR_VERSION) : [],
    poolIds.length > 0 ? deps.loadSnapshots(client, poolIds, since) : [],
    loadBoardClasses(client, userId),
    deps.getStorms().catch((): ActiveStorm[] => []),
  ]);

  const runDate = resolveOutlookRunDate(pulseSnapshots, now);
  const base = state ?? EMPTY_SWELL_OUTLOOK_USER_STATE;
  const previous = previousListFor(base, runDate);
  const stickyIds = [...new Set((previous?.swells ?? []).map(({ beach }) => beach.id))].filter((id) => poolIds.includes(id));
  const forecastsByBeach = stickyIds.length > 0
    ? await deps.loadForecasts(client, stickyIds, new Date(now.getTime() - STICKY_ROWS_BACK_MS), new Date(now.getTime() + STICKY_ROWS_AHEAD_MS))
    : new Map();

  const { response, list } = buildSwellOutlook({
    pool,
    homeBeachId: profile.homeBeachId,
    pulseSnapshots,
    notableSnapshots,
    forecastsByBeach,
    previous,
    skillLevel: parseSkillLevel(profile.experienceLevel),
    boardClasses,
    storms,
    now,
  });

  const advanced = advanceLists(base, list);
  const next = args.recordOpen ? applyOpen(advanced, now) : advanced;
  if (state === null || JSON.stringify(next) !== JSON.stringify(state)) {
    try {
      await saveSwellOutlookUserState(client, userId, next);
    } catch (error) {
      console.warn('[swell-outlook] state write failed', error instanceof Error ? error.message : String(error));
    }
  }
  return response;
}
```

`app/api/swell/outlook/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';

import {
  withAuth,
  withNoStore,
  withRateLimit,
  type AuthenticatedContext,
} from '@/lib/middleware/api-wrappers';
import { isSwellOutlookEnabled, isSwellOutlookUserAllowed } from '@/lib/flags/swell-outlook';
import { loadSwellOutlookForUser } from '@/lib/services/discovery/swell-outlook-loader';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * GET /api/swell/outlook
 *
 * Every swell heading to the signed-in user's beaches, built from the latest
 * snapshot run. An authenticated read is also the "answered" signal the push
 * back-off counts. Returns the bare SwellOutlookResponse, like /api/swell/[eventKey].
 */
async function outlookHandler(_request: NextRequest, { user }: AuthenticatedContext): Promise<NextResponse> {
  if (!isSwellOutlookEnabled() || !isSwellOutlookUserAllowed(user.id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const outlook = await loadSwellOutlookForUser({
    client: createSupabaseServiceRoleClient(),
    userId: user.id,
    now: new Date(),
    recordOpen: true,
  });
  return NextResponse.json(outlook);
}

export const GET = withNoStore(
  withRateLimit(withAuth(outlookHandler, { errorMessage: 'Error loading swell outlook' }), 'surf-discovery'),
);
```

`app/api/swell/[eventKey]/route.ts`: add imports and the optional-auth wiring:

```ts
import { recordSwellOpen } from "@/lib/alerts/swell-outlook/state";
```

```ts
type OptionalUserContext = RouteContext & { user?: { id: string } | null };

/** A signed-in read answers a recent swell push. Bookkeeping: a failure never fails the response. */
async function recordOpen(userId: string | null): Promise<void> {
  if (!userId) return;
  try {
    await recordSwellOpen(createSupabaseServiceRoleClient(), userId, new Date());
  } catch (error) {
    console.warn("[api/swell] Failed to record swell open:", error);
  }
}
```

Change the handler signature to `context?: OptionalUserContext`, and after the `invalid_event_key` early return add `await recordOpen(context?.user?.id ?? null);`. Update the doc comment line "so there is no auth" to "optional auth only records an answered push". Replace the export with:

```ts
export const GET = withProtection(swellEventHandler, {
  auth: { required: false },
  rateLimit: { key: "public-default" },
});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit lib/flags/__tests__/swell-outlook.test.ts __tests__/lib/services/discovery/swell-outlook-loader.test.ts __tests__/app/api/swell-outlook-route.test.ts __tests__/app/api/swell-event-route.test.ts __tests__/app/api/og/swell-route.test.tsx __tests__/app/app-swell-share-page.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/flags/swell-outlook.ts lib/flags/__tests__/swell-outlook.test.ts lib/services/discovery/swell-outlook-loader.ts app/api/swell/outlook/route.ts "app/api/swell/[eventKey]/route.ts" __tests__/lib/services/discovery/swell-outlook-loader.test.ts __tests__/app/api/swell-outlook-route.test.ts __tests__/app/api/swell-event-route.test.ts
git commit -m "feat(swell-outlook): GET /api/swell/outlook behind a nobody-by-default allowlist"
```

---

### Task 13: First-sighting push and back-off in the swell-alert cron

**Files:**
- Create: `lib/alerts/swell-outlook/first-sighting.ts`, `__tests__/helpers/outlook-swell.ts`
- Modify: `lib/cron/swell-alert-runner.ts` (imports after 36; `evaluatePool` history block at 420-450; `RunnerDeps` at 178; `sendFollowups` 718-881; loop at 913-925; `defaultDependencies` before 688)
- Test: `__tests__/lib/alerts/swell-outlook/first-sighting.test.ts`, `__tests__/lib/cron/swell-alert-runner-outlook.test.ts` (new); existing runner suites must pass unmodified.

**Interfaces:**
- Consumes: `OutlookSwell` (Task 6); `decideSend`, `recordSend`, `settle`, `EMPTY_SWELL_ENGAGEMENT`, `SwellEngagementState` (Task 11); `loadSwellOutlookUserState`, `saveSwellOutlookUserState`, `EMPTY_SWELL_OUTLOOK_USER_STATE` (Task 11); `loadSwellOutlookForUser` (Task 12); flags (Task 12); `getUserEntitlement`, `Tier` from `@/lib/alerts/entitlements`; `SWELL_FOLLOWUP_THRESHOLDS` from `@/lib/alerts/swell-followup/change-detection`; `getSwellCardHeadline`, `buildSwellShareUrl` from `@/lib/notifications/copy/swell-card-headline`; `parseMajorSwellNotificationPayload` from `@/lib/notifications/types/major-swell`; `assessRarity`.
- Produces: `selectFirstSightingCandidates(args: { swells: readonly OutlookSwell[]; homeBeachId: string | null; tier: Tier }): OutlookSwell[]`; `firstSightingFaceHeightFt(swell: OutlookSwell): number`; `buildFirstSightingPayload(args: { swell: OutlookSwell; timezone: string }): MajorSwellNotificationPayload`; runner exports `interface SwellOutlookDeps` and keeps `buildScoreHistory` and `makeVerdictFor` module-private; run summary keys in `skippedCounts`: `skipped_unengaged`, `first_sighting_spacing`, `first_sighting_window_closed`, `first_sighting_none`.

Behaviour: for a user who is `SWELL_ALERT_*` enabled, notification-pref on, AND on the outlook allowlist (flag on), the runner skips the evening-before path entirely and instead (1) runs follow-ups under the back-off gate, (2) inside the follow-up local hours (6-21) loads the outlook, picks the earliest `forecast` swell that is `in_range` and not yet pushed (free users: home beach only), applies the 72 h spacing and back-off, and sends one "coming" push that opens the swell detail. A non-allowlisted user takes the existing path unchanged, line for line. Only `notable` swells are pinned for follow-ups; a pulse the notable detector never sees would otherwise be reported as "dropped".

Spec notes: (1) "within the existing local send hours": the evening-before alert fires only at 17:00; the plan uses the follow-up window (6-21 local) so a first sighting goes out soon after the 14:30 UTC snapshot. (2) The swell runner has no entitlement check today, so "free users home beach only, as today" is new behaviour here; the plan reads `getUserEntitlement` for outlook users only. (3) The rarity exception reuses `assessRarity` on the swell's peak row, which needs the same score history `evaluatePool` builds; that history code is extracted (`buildScoreHistory`, `makeVerdictFor`) rather than copied.

- [ ] **Step 1: Write the failing tests**

```ts
// __tests__/helpers/outlook-swell.ts  (shared fixture; the helpers directory is not a Jest suite)
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";

export const OUTLOOK_HOME_BEACH_ID = "ffffffff-0000-4000-8000-000000000001";
const HOME = OUTLOOK_HOME_BEACH_ID;

export function outlookSwell(overrides: Partial<OutlookSwell> = {}): OutlookSwell {
  return {
    id: `${HOME}:NW:2026-09-21:p`, eventKey: `${HOME}:NW:2026-09-21:p`, tier: "likely", status: "forecast", change: "new",
    arrivalAt: "2026-09-21T07:00:00.000Z", peakAt: "2026-09-21T15:00:00.000Z", peakWindow: null, faceHeightFt: { min: 3.5, max: 4.5 },
    periodS: 14, directionDeg: 300, directionLabel: "WNW", beach: { id: HOME, name: "Blacks Beach" }, beachCount: 3, notable: false,
    fit: { status: "in_range", boards: [] }, source: "north_pacific", stormName: null,
    sizeByOrientation: { southFacing: null, westFacing: { min: 3.5, max: 4.5 } }, history: [],
    ...overrides,
  };
}
```

```ts
// __tests__/lib/alerts/swell-outlook/first-sighting.test.ts
import {
  buildFirstSightingPayload,
  firstSightingFaceHeightFt,
  selectFirstSightingCandidates,
} from "@/lib/alerts/swell-outlook/first-sighting";
import { OUTLOOK_HOME_BEACH_ID as HOME, outlookSwell } from "@/__tests__/helpers/outlook-swell";

const OTHER = "ffffffff-0000-4000-8000-000000000002";

describe("selectFirstSightingCandidates", () => {
  it("keeps only forecast swells that are in range, earliest peak first", () => {
    const swells = [
      outlookSwell({ id: "late", peakAt: "2026-09-24T15:00:00.000Z" }),
      outlookSwell({ id: "early", peakAt: "2026-09-21T15:00:00.000Z" }),
      outlookSwell({ id: "shrinking", status: "shrinking" }),
      outlookSwell({ id: "faded", status: "faded" }),
      outlookSwell({ id: "arrived", status: "arrived" }),
      outlookSwell({ id: "rideable", fit: { status: "rideable", boards: [] } }),
      outlookSwell({ id: "small", fit: { status: "below_range", boards: [] } }),
      outlookSwell({ id: "big", fit: { status: "above_range", boards: [] } }),
      outlookSwell({ id: "unknown", fit: { status: "unknown", boards: [] } }),
      outlookSwell({ id: "noperiod", periodS: null }),
    ];
    expect(selectFirstSightingCandidates({ swells, homeBeachId: HOME, tier: "premium" }).map((swell) => swell.id)).toEqual(["early", "late"]);
  });

  it("limits free users to swells sized at the home beach", () => {
    const swells = [outlookSwell({ id: "home" }), outlookSwell({ id: "other", beach: { id: OTHER, name: "Elsewhere" } })];
    expect(selectFirstSightingCandidates({ swells, homeBeachId: HOME, tier: "free" }).map((swell) => swell.id)).toEqual(["home"]);
    expect(selectFirstSightingCandidates({ swells, homeBeachId: null, tier: "free" })).toEqual([]);
  });
});

describe("buildFirstSightingPayload", () => {
  const payload = buildFirstSightingPayload({ swell: outlookSwell({ fit: { status: "in_range", boards: ["longboard"] } }), timezone: "America/Los_Angeles" });

  it("opens the swell detail by the swell's own key", () => {
    expect(payload).toMatchObject({ event_key: `${HOME}:NW:2026-09-21:p`, kind: "coming", beach_id: HOME, peak_date: "2026-09-21" });
    expect(payload.share_url).toContain(encodeURIComponent(`${HOME}:NW:2026-09-21:p`));
  });

  it("states size, period, direction and day, and makes no rarity claim", () => {
    expect(payload.body).toBe("WNW swell, 4ft @ 14s, peaks Monday morning. Good size for your longboard.");
    expect(`${payload.title} ${payload.body}`).not.toMatch(/biggest|first swell|flat|in weeks|rare|the call/i);
  });

  it("never names a board when several fit or none do", () => {
    const several = buildFirstSightingPayload({ swell: outlookSwell({ fit: { status: "in_range", boards: ["fish", "longboard"] } }), timezone: "America/Los_Angeles" });
    expect(several.body).not.toMatch(/your/);
  });

  it("marks 8 ft and up as major", () => {
    const big = buildFirstSightingPayload({ swell: outlookSwell({ faceHeightFt: { min: 7.5, max: 9.5 } }), timezone: "America/Los_Angeles" });
    expect(big.awareness_severity).toBe("major");
    expect(firstSightingFaceHeightFt(outlookSwell({ faceHeightFt: { min: 3.5, max: 4.5 } }))).toBe(4);
  });
});
```

```ts
/**
 * @jest-environment node
 */
// __tests__/lib/cron/swell-alert-runner-outlook.test.ts
import { runSwellAlertCron, type SwellAlertProfile, type SwellOutlookDeps } from "@/lib/cron/swell-alert-runner";
import { EMPTY_SWELL_ENGAGEMENT, type SwellEngagementState } from "@/lib/alerts/swell-outlook/engagement";
import type { SwellFollowupState } from "@/lib/alerts/swell-followup/state";
import { beachSwellEvent } from "@/__tests__/helpers/swell-events";
import { OUTLOOK_HOME_BEACH_ID as HOME, outlookSwell } from "@/__tests__/helpers/outlook-swell";

const USER = "73040cff-afe9-4fa0-a874-2016203fc015";
/** Friday 2026-09-18, 10:00 PDT: inside the 6-21 window, not the 17:00 evening-before hour. */
const MORNING = new Date("2026-09-18T17:00:00.000Z");
/** Thursday 2026-09-17, 17:00 PDT: the evening-before hour. */
const EVENING = new Date("2026-09-18T00:00:00.000Z");
const hoursAgo = (hours: number): string => new Date(MORNING.getTime() - hours * 3_600_000).toISOString();

function profile(overrides: Partial<SwellAlertProfile> = {}): SwellAlertProfile {
  return {
    id: USER, timezone: "America/Los_Angeles", homeBeachId: HOME, location: { lat: 32.75, lon: -117.25 }, maxDriveMinutes: 45,
    experienceLevel: "advanced", notifPushEnabled: true, notifSwellAlerts: true, ...overrides,
  };
}

function engagement(overrides: Partial<SwellEngagementState> = {}): SwellEngagementState {
  return { ...EMPTY_SWELL_ENGAGEMENT, ...overrides };
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    isEnabled: jest.fn(() => true),
    isUserAllowed: jest.fn(() => true),
    loadProfiles: jest.fn(async () => [profile()]),
    evaluatePool: jest.fn(async () => ({ history: [], candidates: [] })),
    loadAlertState: jest.fn(async () => ({ eventExists: false, lastAlertAt: null, recentTitleIds: [], recentFilmCount: 0 })),
    insertAlert: jest.fn(async () => ({ id: "alert-1" })),
    enqueue: jest.fn(async () => ({ enqueued: true as const, eventId: "event-1" })),
    markAlertEnqueued: jest.fn(async () => undefined),
    recordForecast: jest.fn(async () => ({ inserted: true })),
    isFollowupEnabled: jest.fn(() => true),
    isFollowupUserAllowed: jest.fn(() => true),
    loadFollowupStates: jest.fn(async () => [] as SwellFollowupState[]),
    evaluatePinned: jest.fn(),
    saveFirstTold: jest.fn(async () => undefined),
    claimFollowup: jest.fn(async () => true),
    closeFollowupState: jest.fn(async () => undefined),
    isOutlookEnabled: jest.fn(() => true),
    isOutlookUserAllowed: jest.fn(() => true),
    loadOutlook: jest.fn(async () => [outlookSwell()]),
    loadEngagement: jest.fn(async () => null),
    saveEngagement: jest.fn(async () => undefined),
    hasFirstSightingAlert: jest.fn(async () => false),
    assessSwellRarity: jest.fn(async () => false),
    getTier: jest.fn(async () => "premium" as const),
    ...overrides,
  } as never as SwellOutlookDeps & Record<string, jest.Mock>;
}

describe("swell alert cron: outlook users", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  it("leaves a user who is not on the outlook allowlist on the evening-before path", async () => {
    const deps = makeDeps({ isOutlookUserAllowed: jest.fn(() => false) });
    await runSwellAlertCron({ now: EVENING, deps: deps as never });
    expect(deps.evaluatePool).toHaveBeenCalledTimes(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
    expect(deps.loadEngagement).not.toHaveBeenCalled();
  });

  it("leaves everyone on the evening-before path while the outlook flag is off", async () => {
    const deps = makeDeps({ isOutlookEnabled: jest.fn(() => false) });
    await runSwellAlertCron({ now: EVENING, deps: deps as never });
    expect(deps.evaluatePool).toHaveBeenCalledTimes(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
  });

  it("replaces the evening-before alert for an outlook user and sends one first-sighting push", async () => {
    const deps = makeDeps();
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.evaluatePool).not.toHaveBeenCalled();
    expect(summary.sentByKind.coming).toBe(1);
    const swell = outlookSwell();
    expect(deps.insertAlert).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, eventKey: swell.id, leadBeachId: HOME }));
    const sent = deps.enqueue.mock.calls[0][0];
    expect(sent).toMatchObject({ type: "swell_watch", recipientUserId: USER, dedupeKey: `swell_watch:${USER}:${swell.id}` });
    expect(sent.payload).toMatchObject({ event_key: swell.eventKey, kind: "coming" });
    expect(deps.saveEngagement).toHaveBeenCalledWith(USER, expect.objectContaining({ consecutiveUnanswered: 1, lastFirstSightingAt: MORNING.toISOString() }));
  });

  it("does not push a swell that is not in range, or is only shrinking", async () => {
    const deps = makeDeps({ loadOutlook: jest.fn(async () => [
      outlookSwell({ id: "a", fit: { status: "rideable", boards: [] } }),
      outlookSwell({ id: "b", status: "shrinking" }),
    ]) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("sends at most one first-sighting push per swell", async () => {
    const deps = makeDeps({ hasFirstSightingAlert: jest.fn(async () => true) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("allows one first sighting per 72 h", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => engagement({ lastFirstSightingAt: hoursAgo(10), lastSentAt: hoursAgo(10), consecutiveUnanswered: 0 })) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.first_sighting_spacing).toBe(1);
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("stays inside the local send hours", async () => {
    const deps = makeDeps();
    const summary = await runSwellAlertCron({ now: new Date("2026-09-18T10:00:00.000Z"), deps: deps as never });
    expect(summary.skippedCounts.first_sighting_window_closed).toBe(1);
    expect(deps.loadOutlook).not.toHaveBeenCalled();
  });

  it("limits a free user to swells sized at the home beach", async () => {
    const other = outlookSwell({ id: "other", beach: { id: "ffffffff-0000-4000-8000-000000000002", name: "Elsewhere" } });
    const deps = makeDeps({ getTier: jest.fn(async () => "free"), loadOutlook: jest.fn(async () => [other]) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("pins only notable swells for follow-ups", async () => {
    const plain = makeDeps();
    await runSwellAlertCron({ now: MORNING, deps: plain as never });
    expect(plain.saveFirstTold).not.toHaveBeenCalled();
    const notable = makeDeps({ loadOutlook: jest.fn(async () => [outlookSwell({ notable: true, eventKey: `${HOME}:NW:2026-09-21` })]) });
    await runSwellAlertCron({ now: MORNING, deps: notable as never });
    expect(notable.saveFirstTold).toHaveBeenCalledWith(expect.objectContaining({ userId: USER, eventKey: `${HOME}:NW:2026-09-21`, beachId: HOME }));
  });

  it("records nothing and sends nothing when the enqueue is refused", async () => {
    const deps = makeDeps({ enqueue: jest.fn(async () => ({ enqueued: false as const, reason: "duplicate" as const })) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.duplicates).toBe(1);
    expect(deps.saveEngagement).not.toHaveBeenCalled();
  });
});

describe("swell alert cron: back-off", () => {
  beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
  afterEach(() => jest.restoreAllMocks());

  const pausedFor = (days: number): SwellEngagementState => engagement({
    consecutiveUnanswered: 3, lastSentAt: hoursAgo(days * 24 + 48), pausedSince: hoursAgo(days * 24), lastFirstSightingAt: hoursAgo(days * 24 + 48),
  });

  it("skips a first sighting for a paused user and records the skip status", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(3)) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(deps.insertAlert).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("allows one rarity-rule push after 14 days of pause, then keeps the pause", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(15)), assessSwellRarity: jest.fn(async () => true) });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.sentByKind.coming).toBe(1);
    expect(deps.assessSwellRarity).toHaveBeenCalledTimes(1);
    expect(deps.saveEngagement).toHaveBeenCalledWith(USER, expect.objectContaining({ lastExceptionAt: MORNING.toISOString(), pausedSince: pausedFor(15).pausedSince }));
  });

  it("does not send after 14 days when the swell fails the rarity rule", async () => {
    const deps = makeDeps({ loadEngagement: jest.fn(async () => pausedFor(15)), assessSwellRarity: jest.fn(async () => false) });
    await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(deps.enqueue).not.toHaveBeenCalled();
  });

  it("holds follow-ups for a paused outlook user too", async () => {
    const pinned: SwellFollowupState = {
      userId: USER, eventKey: `${HOME}:NW:2026-09-20`, beachId: HOME, lastArrivalAt: "2026-09-19T15:00:00.000Z", lastPeakAt: "2026-09-20T15:00:00.000Z",
      lastFaceHeightFt: 5, lastPeriodS: 16, lastDirectionDeg: 300, serious: false, lastKind: "coming", toldKinds: ["coming"],
      lastToldAt: "2026-09-16T00:00:00.000Z", lastFollowupAt: null, status: "active",
    };
    const deps = makeDeps({
      loadEngagement: jest.fn(async () => pausedFor(3)),
      loadFollowupStates: jest.fn(async () => [pinned]),
      loadOutlook: jest.fn(async () => []),
      evaluatePinned: jest.fn(async () => ({
        beach: { id: HOME, name: "Blacks Beach", shortName: "Blacks", slug: "blacks", state: "CA" }, forecastAvailable: true,
        event: beachSwellEvent({ beachId: HOME, eventKey: pinned.eventKey, peakFaceHeightFt: 8, periodS: 16, directionDeg: 300, peakAt: pinned.lastPeakAt }),
      })),
    });
    const summary = await runSwellAlertCron({ now: MORNING, deps: deps as never });
    expect(summary.skippedCounts.skipped_unengaged).toBe(1);
    expect(deps.claimFollowup).not.toHaveBeenCalled();
    expect(deps.enqueue).not.toHaveBeenCalled();
  });
});
```

Both test files import the shared fixture from `__tests__/helpers/outlook-swell.ts` (created in the first code block of this step).

- [ ] **Step 2: Run them to verify they fail**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-outlook/first-sighting.test.ts __tests__/lib/cron/swell-alert-runner-outlook.test.ts`
Expected: FAIL (`Cannot find module '@/lib/alerts/swell-outlook/first-sighting'`; the runner never calls the outlook deps).

- [ ] **Step 3: Write the minimal implementation**

`lib/alerts/swell-outlook/first-sighting.ts`:

```ts
import type { Tier } from '@/lib/alerts/entitlements';
import { buildSwellShareUrl, getSwellCardHeadline } from '@/lib/notifications/copy/swell-card-headline';
import {
  MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
  parseMajorSwellNotificationPayload,
  type MajorSwellNotificationPayload,
} from '@/lib/notifications/types/major-swell';
import type { OutlookSwell } from '@/lib/services/discovery/swell-outlook-types';
import { getLocalDateString, getLocalHour } from '@/lib/utils/timezone-utils';

const SERIOUS_FACE_HEIGHT_FT = 8;

/** Listed for the first time and in range for this user; sticky and arrived entries never push. */
export function selectFirstSightingCandidates(args: {
  swells: readonly OutlookSwell[];
  homeBeachId: string | null;
  tier: Tier;
}): OutlookSwell[] {
  return args.swells
    .filter((swell) => swell.status === 'forecast' && swell.fit.status === 'in_range' && swell.periodS !== null)
    .filter((swell) => args.tier !== 'free' || (args.homeBeachId !== null && swell.beach.id === args.homeBeachId))
    .sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
}

export function firstSightingFaceHeightFt(swell: OutlookSwell): number {
  return Math.round(((swell.faceHeightFt.min + swell.faceHeightFt.max) / 2) * 10) / 10;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function weekday(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'UTC' }).format(new Date(`${dateKey}T12:00:00.000Z`));
}

function dayPart(iso: string, timezone: string): string {
  const hour = getLocalHour(new Date(iso), timezone);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Plain facts only: a modest swell must not borrow the rarity titles written for the evening-before alert. */
export function buildFirstSightingPayload(args: { swell: OutlookSwell; timezone: string }): MajorSwellNotificationPayload {
  const { swell, timezone } = args;
  const faceHeightFt = firstSightingFaceHeightFt(swell);
  const serious = faceHeightFt >= SERIOUS_FACE_HEIGHT_FT;
  const peakDate = getLocalDateString(new Date(swell.peakAt), timezone);
  const peakDayLabel = weekday(peakDate);
  const headline = getSwellCardHeadline({
    kind: 'coming',
    eventKey: swell.eventKey,
    beachName: swell.beach.name,
    peakDayLabel,
    serious,
  });
  const board = swell.fit.boards.length === 1 ? ` Good size for your ${swell.fit.boards[0]}.` : '';
  const body = `${swell.directionLabel} swell, ${formatNumber(faceHeightFt)}ft @ ${formatNumber(swell.periodS ?? 0)}s, `
    + `peaks ${peakDayLabel} ${dayPart(swell.peakAt, timezone)}.${board}`;
  return parseMajorSwellNotificationPayload({
    schema_version: MAJOR_SWELL_NOTIFICATION_SCHEMA_VERSION,
    beach_id: swell.beach.id,
    beach_name: swell.beach.name,
    event_start_date: getLocalDateString(new Date(swell.arrivalAt ?? swell.peakAt), timezone),
    peak_date: peakDate,
    peak_height_ft: faceHeightFt,
    peak_period_s: swell.periodS ?? 1,
    forecast_at: swell.peakAt,
    awareness_mode: 'shadow',
    automation_enabled: false,
    awareness_signal: 'forecast_trend',
    awareness_severity: serious ? 'major' : 'significant',
    official_evidence_refs: [],
    would_suppress_cohorts: ['beginner', 'intermediate', 'unknown'],
    enforcement: null,
    title: headline.headline,
    body,
    beaches: [{ beach_id: swell.beach.id, beach_name: swell.beach.name, rank: 1 }],
    event_key: swell.eventKey,
    title_id: headline.titleId,
    kind: 'coming',
    share_url: buildSwellShareUrl(swell.eventKey, 'coming', headline.titleId),
  });
}
```

`lib/cron/swell-alert-runner.ts` edits (anchors are the current text):

1. After the `isSwellFollowupEnabled` import (line 36) add:

```ts
import { getUserEntitlement, type Tier } from "@/lib/alerts/entitlements";
import { SWELL_FOLLOWUP_THRESHOLDS } from "@/lib/alerts/swell-followup/change-detection";
import {
  decideSend,
  recordSend,
  settle,
  EMPTY_SWELL_ENGAGEMENT,
  type SwellEngagementState,
} from "@/lib/alerts/swell-outlook/engagement";
import {
  buildFirstSightingPayload,
  firstSightingFaceHeightFt,
  selectFirstSightingCandidates,
} from "@/lib/alerts/swell-outlook/first-sighting";
import {
  EMPTY_SWELL_OUTLOOK_USER_STATE,
  loadSwellOutlookUserState,
  saveSwellOutlookUserState,
} from "@/lib/alerts/swell-outlook/state";
import { isSwellOutlookEnabled, isSwellOutlookUserAllowed } from "@/lib/flags/swell-outlook";
import { loadSwellOutlookForUser } from "@/lib/services/discovery/swell-outlook-loader";
import type { OutlookSwell } from "@/lib/services/discovery/swell-outlook-types";
```

2. Replace `type RunnerDeps = SwellAlertDeps & SwellFollowupDeps;` (line 178) with:

```ts
export interface SwellOutlookDeps {
  isOutlookEnabled: () => boolean;
  isOutlookUserAllowed: (userId: string) => boolean;
  loadOutlook: (profile: SwellAlertProfile, now: Date) => Promise<OutlookSwell[]>;
  loadEngagement: (userId: string) => Promise<SwellEngagementState | null>;
  saveEngagement: (userId: string, state: SwellEngagementState) => Promise<void>;
  hasFirstSightingAlert: (userId: string, eventKeys: string[]) => Promise<boolean>;
  assessSwellRarity: (profile: SwellAlertProfile, swell: OutlookSwell, now: Date) => Promise<boolean>;
  getTier: (userId: string) => Promise<Tier>;
}

type RunnerDeps = SwellAlertDeps & SwellFollowupDeps & Partial<SwellOutlookDeps>;
type OutlookRunnerDeps = SwellAlertDeps & SwellFollowupDeps & SwellOutlookDeps;

interface EngagementGate {
  state: SwellEngagementState;
  dirty: boolean;
}
```

3. Extract the score-history code from `evaluatePool`. Add above `evaluatePool`:

```ts
function makeVerdictFor(
  profile: SwellAlertProfile,
  now: Date,
): (forecast: EnhancedForecastEntity, beach: Beach) => ForecastVerdict {
  return (forecast, beach) => evaluateForecastVerdict({
    forecast,
    beach,
    experienceLevel: profile.experienceLevel,
    timezone: profile.timezone,
    now,
    candidateIdPrefix: "swell-alert",
  });
}

function buildScoreHistory(args: {
  pool: ReadonlyArray<{ beach: Beach }>;
  forecastsByBeach: ReadonlyMap<string, readonly EnhancedForecastEntity[]>;
  verdictFor: (forecast: EnhancedForecastEntity, beach: Beach) => ForecastVerdict;
  timezone: string;
  today: string;
}): DayScore[] {
  const historyByDate = new Map<string, DayScore>();
  for (const { beach } of args.pool) {
    for (const forecast of args.forecastsByBeach.get(beach.id) ?? []) {
      const localDate = getLocalDateString(new Date(forecast.forecast_at), args.timezone);
      const localHour = getLocalHour(new Date(forecast.forecast_at), args.timezone);
      // Today counts: its forecast is known, and "first after flat" needs the
      // day before a peak that is tomorrow at the earliest.
      if (localDate > args.today || localHour < 6 || localHour >= 19) continue;
      const { score, verdict } = args.verdictFor(forecast, beach);
      const day = historyByDate.get(localDate);
      historyByDate.set(localDate, {
        localDate,
        bestScore: Math.max(day?.bestScore ?? 0, score),
        go: (day?.go ?? false) || verdict === "go",
      });
    }
  }
  return [...historyByDate.values()].sort((left, right) => left.localDate.localeCompare(right.localDate));
}
```

and in `evaluatePool` replace the block from `const today = getLocalDateString(now, profile.timezone);` (line 420) through the end of `const history = [...historyByDate.values()].sort(...)` (line 450) with:

```ts
  const today = getLocalDateString(now, profile.timezone);
  const verdictFor = makeVerdictFor(profile, now);
  const history = buildScoreHistory({ pool, forecastsByBeach, verdictFor, timezone: profile.timezone, today });
```

4. `sendFollowups`: add a last parameter `gate?: EngagementGate`. Immediately before `const claimed = await deps.claimFollowup(` insert:

```ts
      if (gate) {
        const decision = decideSend(gate.state, now, "followup", false);
        if (!decision.ok) {
          increment(summary, decision.reason);
          continue;
        }
      }
```

and immediately after `countSent(summary, kind);` in that function insert:

```ts
      if (gate) {
        gate.state = recordSend(gate.state, now, "followup", false);
        gate.dirty = true;
      }
```

5. Add before `runSwellAlertCron`:

```ts
function isOutlookRecipient(deps: RunnerDeps, userId: string): deps is OutlookRunnerDeps {
  return deps.isOutlookEnabled?.() === true
    && deps.isOutlookUserAllowed?.(userId) === true
    && Boolean(deps.loadOutlook && deps.loadEngagement && deps.saveEngagement
      && deps.hasFirstSightingAlert && deps.assessSwellRarity && deps.getTier);
}

async function sendFirstSighting(
  deps: OutlookRunnerDeps,
  summary: SwellAlertRunSummary,
  profile: SwellAlertProfile,
  now: Date,
  followupEnabled: boolean,
  gate: EngagementGate,
): Promise<void> {
  const hour = getLocalHour(now, profile.timezone);
  if (hour < SWELL_FOLLOWUP_THRESHOLDS.earliestLocalHour || hour > SWELL_FOLLOWUP_THRESHOLDS.latestLocalHour) {
    increment(summary, "first_sighting_window_closed");
    return;
  }
  const candidates = selectFirstSightingCandidates({
    swells: await deps.loadOutlook(profile, now),
    homeBeachId: profile.homeBeachId,
    tier: await deps.getTier(profile.id),
  });

  for (const swell of candidates) {
    if (await deps.hasFirstSightingAlert(profile.id, [swell.id, swell.eventKey])) continue;

    let decision = decideSend(gate.state, now, "first_sighting", false);
    if (!decision.ok && decision.exceptionEligible) {
      decision = decideSend(gate.state, now, "first_sighting", await deps.assessSwellRarity(profile, swell, now));
    }
    if (!decision.ok) {
      increment(summary, decision.reason);
      return;
    }

    const payload = buildFirstSightingPayload({ swell, timezone: profile.timezone });
    const alert = await deps.insertAlert({
      userId: profile.id,
      eventKey: swell.id,
      peakDate: payload.peak_date,
      leadBeachId: swell.beach.id,
      payload,
    });
    if (!alert) {
      increment(summary, "event_exists");
      continue;
    }
    const enqueued = await deps.enqueue({
      type: "swell_watch",
      recipientUserId: profile.id,
      dedupeKey: `swell_watch:${profile.id}:${swell.id}`,
      payload,
    });
    if (!enqueued.enqueued) {
      if (enqueued.reason === "duplicate") {
        summary.duplicates += 1;
      } else {
        increment(summary, "enqueue_failed");
        summary.errors += 1;
      }
      return;
    }
    await deps.markAlertEnqueued(alert.id, enqueued.eventId);
    countSent(summary, "coming");
    gate.state = recordSend(gate.state, now, "first_sighting", decision.exception);
    gate.dirty = true;

    // Only a swell the notable detector also sees can be followed: a pulse it never
    // detects would be reported as "dropped" by the follow-up evaluation.
    if (followupEnabled && swell.notable && swell.periodS !== null) {
      try {
        await deps.saveFirstTold({
          userId: profile.id,
          eventKey: swell.eventKey,
          beachId: swell.beach.id,
          told: {
            arrivalAt: swell.arrivalAt ?? swell.peakAt,
            peakAt: swell.peakAt,
            faceHeightFt: firstSightingFaceHeightFt(swell),
            periodS: swell.periodS,
            directionDeg: swell.directionDeg,
            serious: payload.awareness_severity === "major",
            kind: "coming",
            toldAt: now.toISOString(),
            status: "active",
          },
        });
      } catch (error) {
        console.error(`[swell-alert] Failed to pin ${swell.eventKey} for follow-ups:`, error);
        summary.followupStateFailures += 1;
      }
    }
    return;
  }
  increment(summary, "first_sighting_none");
}

async function runOutlookUser(
  deps: OutlookRunnerDeps,
  summary: SwellAlertRunSummary,
  profile: SwellAlertProfile,
  pinnedStates: readonly SwellFollowupState[],
  now: Date,
  followupEnabled: boolean,
): Promise<void> {
  const loaded = await deps.loadEngagement(profile.id);
  const settled = settle(loaded ?? EMPTY_SWELL_ENGAGEMENT, now);
  const gate: EngagementGate = {
    state: settled,
    dirty: loaded !== null && JSON.stringify(settled) !== JSON.stringify(loaded),
  };
  try {
    if (pinnedStates.length > 0 && deps.isFollowupUserAllowed(profile.id)) {
      await sendFollowups(deps, summary, profile, pinnedStates, now, gate);
    }
    await sendFirstSighting(deps, summary, profile, now, followupEnabled, gate);
  } catch (error) {
    console.error(`[swell-alert] Error processing outlook user ${profile.id}:`, error);
    summary.errors += 1;
  } finally {
    if (gate.dirty) {
      await deps.saveEngagement(profile.id, gate.state).catch((error: unknown) => {
        console.error(`[swell-alert] Failed to save engagement for ${profile.id}:`, error);
        summary.errors += 1;
      });
    }
  }
}
```

6. In the `runSwellAlertCron` loop, directly after the `isUserAllowed` check (the `continue` ending at line 922) insert:

```ts
    if (isOutlookRecipient(deps, profile.id)) {
      await runOutlookUser(deps, summary, profile, followupStates.get(profile.id) ?? [], args.now, followupEnabled);
      continue;
    }
```

7. In `defaultDependencies`, add before the closing of the returned object (after `markAlertEnqueued`):

```ts
    isOutlookEnabled: args.deps?.isOutlookEnabled ?? isSwellOutlookEnabled,
    isOutlookUserAllowed: args.deps?.isOutlookUserAllowed ?? isSwellOutlookUserAllowed,
    loadOutlook: args.deps?.loadOutlook ?? (async (profile, now) => (
      await loadSwellOutlookForUser({ client: getClient(), userId: profile.id, now, recordOpen: false })
    ).swells),
    loadEngagement: args.deps?.loadEngagement ?? ((userId) => loadSwellOutlookUserState(getClient(), userId)),
    saveEngagement: args.deps?.saveEngagement ?? (async (userId, engagement) => {
      // Merge into the stored row so the saved lists are never wiped.
      const current = await loadSwellOutlookUserState(getClient(), userId);
      await saveSwellOutlookUserState(getClient(), userId, { ...(current ?? EMPTY_SWELL_OUTLOOK_USER_STATE), ...engagement });
    }),
    hasFirstSightingAlert: args.deps?.hasFirstSightingAlert ?? (async (userId, eventKeys) => {
      const { data, error } = await getClient()
        .from("swell_event_alerts")
        .select("id")
        .eq("user_id", userId)
        .in("event_key", eventKeys)
        .limit(1);
      if (error) throw new Error(`Failed to check first-sighting alerts: ${error.message}`);
      return (data ?? []).length > 0;
    }),
    assessSwellRarity: args.deps?.assessSwellRarity
      ?? ((profile, swell, now) => assessSwellRarityForUser(getClient(), profile, swell, now)),
    getTier: args.deps?.getTier
      ?? ((userId) => getUserEntitlement(userId, getClient() as unknown as SupabaseClient)),
```

and add above `defaultDependencies`:

```ts
/** The existing rarity rule (best in 30 days, first after flat) judged on the swell's peak row. */
async function assessSwellRarityForUser(
  client: ServiceClient,
  profile: SwellAlertProfile,
  swell: OutlookSwell,
  now: Date,
): Promise<boolean> {
  const pool = await loadUserPool({
    supabase: client,
    userId: profile.id,
    homeBeachId: profile.homeBeachId,
    location: profile.location,
    maxDriveMinutes: profile.maxDriveMinutes,
  });
  const beach = pool.find((entry) => entry.beach.id === swell.beach.id)?.beach;
  if (!beach) return false;
  const forecasts = await loadForecasts(
    client,
    pool.map((entry) => entry.beach.id),
    new Date(now.getTime() - HISTORY_DAYS * DAY_MS),
    new Date(now.getTime() + LOOKAHEAD_DAYS * DAY_MS),
  );
  const forecastsByBeach = new Map<string, EnhancedForecastEntity[]>();
  for (const forecast of forecasts) {
    forecastsByBeach.set(forecast.beach_id, [...(forecastsByBeach.get(forecast.beach_id) ?? []), forecast]);
  }
  const peakForecast = rowNearest(forecastsByBeach.get(beach.id) ?? [], swell.peakAt);
  if (!peakForecast) return false;
  const verdictFor = makeVerdictFor(profile, now);
  const peak = verdictFor(peakForecast, beach);
  return assessRarity({
    peakDate: getLocalDateString(new Date(swell.peakAt), profile.timezone),
    history: buildScoreHistory({
      pool,
      forecastsByBeach,
      verdictFor,
      timezone: profile.timezone,
      today: getLocalDateString(now, profile.timezone),
    }),
    peakScore: peak.score,
    peakGo: peak.verdict === "go",
  }).rare;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit __tests__/lib/alerts/swell-outlook __tests__/lib/cron/swell-alert-runner-outlook.test.ts __tests__/lib/cron/swell-alert-runner.test.ts __tests__/lib/cron/swell-alert-runner-followups.test.ts __tests__/lib/cron/swell-alert-runner-pinned.test.ts __tests__/lib/cron/swell-alert-runner-swell-events.test.ts __tests__/lib/cron/swell-alert-runner-canonical-verdict.test.ts`
Expected: PASS, with every pre-existing runner test unmodified (this is the proof that non-allowlisted behaviour did not change).

- [ ] **Step 5: Commit**

```bash
npx tsc --noEmit
git add lib/alerts/swell-outlook/first-sighting.ts lib/cron/swell-alert-runner.ts __tests__/helpers/outlook-swell.ts __tests__/lib/alerts/swell-outlook/first-sighting.test.ts __tests__/lib/cron/swell-alert-runner-outlook.test.ts
git commit -m "feat(swell-outlook): first-sighting push with back-off for allowlisted users"
```

---

### Task 14: Full verification and pull request (do not merge)

**Files:** none new.

- [ ] **Step 1: Typecheck, lint, dead code**

```bash
npx tsc --noEmit
NODE_OPTIONS="--max-old-space-size=8192" npx eslint --max-warnings=0 $(git diff --name-only origin/main...HEAD -- 'lib/**/*.ts' 'app/**/*.ts')
npx eslint --max-warnings=0 $(git diff --name-only origin/main...HEAD -- '__tests__/**/*.ts' '__tests__/**/*.tsx')
yarn deadcode
```

Expected: no output from tsc and eslint; `yarn deadcode` reports nothing new. Resolve a knip finding by removing the `export` keyword (or the dead symbol), never by suppressing; candidates are `SWELL_OUTLOOK_HORIZON_DAYS`, `STICKY_MIN_FACE_FT`, `SWELL_ENGAGEMENT` and `parseActiveStorms` if only a test imports them and knip does not count tests as consumers.

- [ ] **Step 2: Full Jest**

Run: `SUPABASE_SERVICE_ROLE_KEY=x NEXT_PUBLIC_SUPABASE_URL=https://x.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=x yarn test:unit`
Expected: PASS. A failing unit test found here is fixed in the same change, pre-existing or not.

- [ ] **Step 3: Postgres harness (disposable local cluster only)**

Run: `bash scripts/test-swell-snapshot-outcomes-postgres.sh`
Expected: `swell snapshot outcomes OK: <n> rows resolved`, exit 0. This also proves both new migrations apply cleanly in order after `20260925150500`.

- [ ] **Step 4: Diff review against the hard rules**

```bash
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- vercel.json lib/alerts/swell-watch package.json
git diff origin/main...HEAD | grep -n "SWELL_EVENT_THRESHOLDS\." 
```

Expected: no change to `vercel.json`, `lib/alerts/swell-watch/` or `package.json`; no assignment to `SWELL_EVENT_THRESHOLDS`; the only runner changes outside the outlook branch are the `evaluatePool` extraction and the `.or` filter. Confirm no migration was applied (no `supabase db push`, no MCP `apply_migration`).

- [ ] **Step 5: Push and open the PR against main (do not merge)**

```bash
git push -u origin feat/swell-outlook-backend
gh pr create --base main --title "feat(swell-outlook): backend for Swell Outlook phase 1" --body "$(cat <<'EOF'
## What changes
- F1: swell detection no longer reads data_source = FALLBACK rows.
- Pulse rule (`lib/alerts/swell-events/outlook.ts`) with its own thresholds and snapshot version; pulse snapshots written by the nightly cron under `swell-outlook-pulse.v1` with a `:p` key marker.
- F4: lead_days and outcome on snapshots (migration written, not applied).
- `GET /api/swell/outlook`: fit by skill and boards, source label, NHC storm name, size by orientation, sticky tracking. Flag SWELL_OUTLOOK_ENABLED, allowlist SWELL_OUTLOOK_USER_ALLOWLIST (empty means nobody).
- First-sighting push and back-off for allowlisted users only; everyone else keeps the evening-before alert unchanged.

## Migration and environment impact
- Two migrations written, NOT applied: 20261004200000_add_swell_snapshot_lead_and_outcome.sql, 20261004210000_create_swell_outlook_user_state.sql. The database is shared prod/dev; applying needs Steven's approval.
- No new env vars are required to merge: both flags default off.
- Nothing is deployed or promoted by this PR.

## Verification
- npx tsc --noEmit, eslint, yarn deadcode, full yarn test:unit: results pasted below.
- scripts/test-swell-snapshot-outcomes-postgres.sh against a disposable local cluster: result pasted below.

## Not done / risks
- Authenticated reads of GET /api/swell/[eventKey] served from the CDN are not counted as answers.
- Pulse snapshots start accumulating when the cron deploys, flags or not.
EOF
)"
```

Paste the real command results into the PR body before requesting review. Do NOT merge, enable auto-merge, or promote to `prod`.

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Phase 0 F1: no `FALLBACK` rows in detection | 1 |
| Phase 0 F4: lead and outcome on snapshots | 5 |
| Pulse listing rule (tracking, local maximum, 25% prominence, skip today and past, 1.5 ft / 9 s floor, 3 beaches in the region, own thresholds, never touches `SWELL_EVENT_THRESHOLDS`) | 3, 4 |
| Own snapshot `detector_version`, history never mixed | 4 |
| Grouping (peak 36 h, period 3 s, direction 45 deg, no `maxSwells` cap), stable `id` | 2, 10 |
| Tiers and change labels reused, not forked | 2, 10 |
| Link to a notable event (45 deg, 36 h) | 10 |
| History from snapshots for the representative key | 10 |
| Whose beaches: the alert runner's pool; sized at home beach else largest face | 10, 12 |
| Fit: ideal for `in_range`, acceptable for the rest, boards, skill level, `unknown` | 6, 12 |
| Source label, `stormName` from NHC (cached, failure-tolerant), size by orientation | 7, 8, 10 |
| Sticky tracking (shrinking at 2 ft, faded once, never pushes or raises tier) | 9, 10 |
| `GET /api/swell/outlook` (signed in, flag, allowlist default nobody, response type, empty list valid) | 6, 10, 12 |
| First-sighting push (in-range only, one per swell, 72 h spacing, free home beach only, opens detail, evening-before replaced for allowlisted users only) | 13 |
| Back-off when ignored (answered within 48 h, pause after 3, resume on open with reset and no late sends, 14-day rarity exception, `skipped_unengaged`) | 11, 12, 13 |
| Honest labels: no AI or ML claim; no rarity claim on first sightings | 13 (payload test), Global Constraints |
| Migrations written, not applied; no deploy, flag or allowlist change | 5, 11, 14 |

Review Focus coverage: 1 (Tasks 10, 12), 2 (Tasks 6, 12), 3 (Tasks 7, 12), 4 (Tasks 3, 10), 5 (Tasks 9, 12), 6 (Task 1), 7 (Task 13), 8 (Task 11).

## Self-review notes

- Names used across tasks are spelled identically: `OutlookSwell`, `StoredOutlookList`, `SwellFit`, `swellFitFor`, `faceHeightRange`, `carryOverSwells`, `buildSwellOutlook`, `resolveOutlookRunDate`, `loadSwellOutlookForUser`, `SwellEngagementState`, `decideSend`, `recordSend`, `settle`, `applyOpen`, `SwellOutlookUserState`, `previousListFor`, `advanceLists`, `recordSwellOpen`, `selectFirstSightingCandidates`, `buildFirstSightingPayload`, `SWELL_OUTLOOK_PULSE_DETECTOR_VERSION`, `filterPulsesByRegionAgreement`.
- Type placement: the response types live in `swell-outlook-types.ts` (Task 6) so Task 9 can import them before Task 10 exists; `swell-outlook.ts` re-exports them.
- No step defers code: Task 2's moved bodies are written out in full above, and the runner edits give the exact replacement text.

## ⚠️ Human judgment / approvals

Stop and ask Steven before any of these. The executor never does them.

1. **Applying either migration** (`20261004200000_add_swell_snapshot_lead_and_outcome.sql`, `20261004210000_create_swell_outlook_user_state.sql`). The database is shared prod/dev, so applying is an approval-gated production write. Order matters: apply the F4 migration BEFORE the new snapshot cron code runs, because `toSwellEventSnapshotRow` writes `lead_days` on every snapshot row (notable events included) and the daily upsert would fail without the column. The `resolve_swell_event_outcomes` call fails soft (a warning) until its function exists.
2. **Setting any flag or allowlist** (`SWELL_OUTLOOK_ENABLED`, `SWELL_OUTLOOK_USER_ALLOWLIST`, `SWELL_ALERT_*`, `SWELL_FOLLOWUP_*`) in any environment.
3. **Merging the PR, promoting to `prod`, deploying, OTA or store actions.** The PR is opened, not merged.
4. **The pulse snapshot cron starts writing the day this deploys**, flags or not. That is a production data write; confirm Steven wants history to start accumulating before promotion.

Readings of the spec I had to choose between (what the plan does):

- **"Region" for the 3-beach agreement.** The plan uses beaches within 40 miles of the pulse's beach (no reliable region field in the data). Alternative: `beaches.region_id` once it is populated.
- **Face-height range formula.** The spec says "sizes are ranges" but gives no Phase 1 formula. The plan uses +/-15% of the representative beach's face height, rounded to 0.5 ft, at least 1 ft wide. `peakWindow` is peak +/- 12 h beyond 120 h.
- **Where `stormName` applies.** Only for swells labelled `tropical`. Alternative: any swell with a storm on its bearing.
- **Rule order for source labels.** `tropical` is checked before `southern_hemisphere` where 180-190 deg at 14 s or more overlaps.
- **`change` when no earlier run exists.** The spec's enum has no null; the plan returns `'new'` (first sighted in this run). Week Scout's own `changeFor` still returns null for the same case.
- **Send hours for first sightings.** The follow-up window (6-21 local), not the single 17:00 hour of the evening-before alert.
- **Free users on the swell runner.** The runner has no entitlement check today, so "free users home beach only, as today" is new here and applies to outlook users' first sightings only.
- **Rarity exception scope.** First-sighting pushes only (not follow-ups), judged with `assessRarity` on the swell's peak row.
- **Follow-up pinning.** Only `notable` swells are pinned; a non-notable pulse gets no follow-ups in Phase 1, because the follow-up evaluator would report it as dropped.
- **A swell whose peak day has begun.** Carried as `arrived` for 12 h after the peak (the pulse rule skips peaks today, so it would otherwise read as shrinking or faded on its own peak day).
- **Outlook response is the bare object**, not the `{ success, data }` envelope, matching the spec type and `/api/swell/[eventKey]`.
- **Answered signal on the public detail route is best effort.** CDN-cached reads are invisible to it. If Steven wants a reliable detail-page signal, the detail route needs a cache change or a small authenticated ping from native, which is a native and contract decision.
- **`skipped_unengaged`** is a type-level status with run-summary counts; no `alert_delivery_attempts` constraint change. A DB-recorded skip would need another migration.
- **Outcome `vanished`** includes a beach skipped as stale on the last run before the peak.
- **First-sighting copy.** The headline comes from `getSwellCardHeadline` (neutral generic pool: three whimsical titles, one serious) and the body is plain facts. No rarity claim is made. Steven may want dedicated copy.
- **Pulse key marker `:p`** extends the event-key format that native and the share page parse. Native treats keys as opaque today (`quiver://swell/<key>` goes to `/api/swell/<key>`); confirm before relying on it, since a native build with a strict key regex would reject `:p`.
