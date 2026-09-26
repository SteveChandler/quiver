# Week Scout swell planning — build contract

**Date:** 2026-09-25 · **Owner:** Steven · **Repos:** `quiver` (web/API/cron/DB), `quiver-native` (app)
**Decision (Steven, 2026-09-25):** the swell page *is* Week Scout. Week Scout becomes the user's research/planning page. Swell alert pushes open Week Scout. Build steps 1–5 below, plus a "how was your session?" prompt when the app sees a user was at a beach and has left.

This file is the interface contract between four parallel workstreams. Field names, types, file paths and export signatures written here are binding. If a workstream finds a contract field impossible, it stops and reports rather than inventing a different shape.

## Why (one paragraph)

We do not out-forecast NOAA WaveWatch III / Open-Meteo. The product is the translation: which of *your* beaches see a swell (direction vs each beach's swell window), when the window is (the existing Week Scout window authority), whether it is your size, and how sure we are (run-to-run stability). The primary metric is **precision of the named call** (was the beach + window we named actually good), measured physically (buoy) and by users (sessions logged against the swell). Secondary: D7 return (baseline 4.5%). Guardrails: a few swell alerts per user per month; downgrade/cancel rate after send.

## Workstreams

| ID | Repo / worktree / branch | Owns |
|---|---|---|
| W-A | `quiver/.worktrees/swell-alerts-20260925` · `feat/swell-alert-verification-20260925` | Step 1 (one go/no-go rule), step 2 (verification), session-prompt response table |
| W-B | `quiver/.worktrees/swell-planning-20260925` · `feat/week-scout-swells-20260925` | Step 5 (swell-event detector), forecast snapshots, Week Scout `swells` API field (step 3 backend) |
| N-A | `quiver-native/.worktrees/week-scout-swells-20260925` · `feat/week-scout-swells-20260925` | Week Scout "Swells this week" UI (step 3), swell push → Week Scout, seen-swells store |
| N-B | `quiver-native/.worktrees/session-prompts-20260925` · `feat/session-prompts-20260925` | Step 4: "How was it?" prompts (beach visit + swell), session linkage |

The coordinator (not a workstream) switches the swell-alert runner from the old detector to W-B's detector after W-A and W-B land, and merges N-A's seen-swells store over N-B's stub.

No workstream commits, pushes, applies migrations, changes env flags, or touches production. Migrations are written, not applied.

---

## Step 1 — one go/no-go rule (W-A)

`lib/cron/swell-alert-runner.ts` decides "go" with its own `GO_SCORE = 70` over `scoreNativeForecastSlot` (`scoreForecast`, ~:155-170, :283-300, :498). The daily call decides with `scoreWindowConditionScore` + `buildCanonicalSessionDecision` (`lib/cron/daily-call-runner.ts` `evaluateForecast`, ~:311-355). Two rules for one question.

- Extract the daily call's per-row evaluation into **`lib/alerts/canonical-forecast-verdict.ts`**:
  ```ts
  export interface ForecastVerdictBeach {
    id: string; name: string; skill_level: string | null;
    /* plus whatever scoreWindowConditionScore needs from the beach row — reuse its parameter type */
  }
  export interface ForecastVerdict {
    forecast: EnhancedForecastEntity;
    score: number;                       // scoreWindowConditionScore(...)
    verdict: 'go' | 'maybe' | 'no';      // canonical engine verdict
    decision: CanonicalSessionDecision;
  }
  export function evaluateForecastVerdict(args: {
    forecast: EnhancedForecastEntity;
    beach: ForecastVerdictBeach;
    experienceLevel: string | null;
    timezone: string;
    now: Date;
    candidateIdPrefix: string;           // 'daily-call' | 'swell-alert'
  }): ForecastVerdict;
  ```
  Behavior must be identical to today's daily-call `evaluateForecast` (same candidate shape, same `getRecommendationLabel`). `daily-call-runner.ts` calls it with `candidateIdPrefix: 'daily-call'`; its existing tests pass unchanged.
- Swell-alert runner: history day scores and the peak go test use `evaluateForecastVerdict` (`candidateIdPrefix: 'swell-alert'`). `DayScore.bestScore` = max `score` over the day's daylight rows across the pool; `DayScore.go` = any row's `verdict === 'go'`. `peakGo` = the peak row's verdict is `'go'`. Delete `GO_SCORE` and the runner's `scoreForecast` if nothing else uses them. `swell-rarity.ts` keeps its thresholds (`FLAT_SCORE_CEILING = 39` stays on the same 0–100 score scale).
- Contained bug to fix in the same change: `lib/notifications/types/major-swell.ts` requires `beaches` to have exactly 3 items (`.length(3)`), but the runner passes `candidates.slice(0, 3)`. A user with 1–2 qualifying beaches fails validation. Change to `.min(1).max(3)`; add a test with one beach. Check native parses `beaches` of length 1–3 (`quiver-native/src/lib/alert-context.ts` ~:85-98) — report, don't edit native.

## Step 2 — verification (W-A)

### Table `swell_event_verifications` (new migration)
```
id uuid pk default gen_random_uuid()
event_key text not null
beach_id uuid not null references beaches(id) on delete cascade
source text not null check (source in ('alert','snapshot'))
detector_version text not null
forecast_issued_at timestamptz not null        -- when this forecast was made (send time for alerts)
forecast_arrival_at timestamptz null
forecast_peak_at timestamptz not null
forecast_fade_at timestamptz null
forecast_peak_offshore_height_ft numeric null  -- offshore swell component height at peak
forecast_peak_face_height_ft numeric null      -- projected surf face height at peak
forecast_peak_period_s numeric null
forecast_direction_deg numeric null
station_id text null                           -- resolved at verification time
status text not null default 'pending' check (status in ('pending','hit','miss_no_show','miss_timing','miss_size','no_observations'))
observed_baseline_height_ft numeric null
observed_peak_height_ft numeric null
observed_peak_at timestamptz null
observed_peak_period_s numeric null
observed_peak_direction_deg numeric null
observation_count int null
peak_error_hours numeric null                  -- observed_peak_at - forecast_peak_at, hours (signed)
height_ratio numeric null                      -- observed_peak_height_ft / forecast_peak_offshore_height_ft
verified_at timestamptz null
created_at timestamptz not null default now()
unique (event_key, beach_id, source)
```
RLS enabled, no policies (service role only). Index on `(status, forecast_peak_at)`.

### Record at send — `lib/alerts/swell-verification/record.ts`
```ts
export interface SwellEventForecastRecord {
  eventKey: string; beachId: string; source: 'alert' | 'snapshot'; detectorVersion: string;
  issuedAt: string; arrivalAt: string | null; peakAt: string; fadeAt: string | null;
  peakOffshoreHeightFt: number | null; peakFaceHeightFt: number | null;
  peakPeriodS: number | null; directionDeg: number | null;
}
export async function recordSwellEventForecast(
  supabase: SupabaseClient<Database>, record: SwellEventForecastRecord,
): Promise<{ inserted: boolean }>;   // insert ... on conflict (event_key, beach_id, source) do nothing
```
The swell-alert runner calls it once per alert, for the lead beach, after the `swell_event_alerts` insert succeeds, with `source: 'alert'` and `detectorVersion: 'swell-watch-detector.v1'` (the current detector; the coordinator changes this when switching detectors). A failure is logged and counted; it never blocks the send.

### Verify cron — `app/api/cron/swell-event-verify/route.ts` + `lib/alerts/swell-verification/verify.ts`
Daily (`vercel.json`, `"0 16 * * *"`), wrapped like the other crons (`withObservedCron`, cron auth). For `status = 'pending'` rows where `coalesce(forecast_fade_at, forecast_peak_at + 24h) + 12h < now()` and `forecast_peak_at > now() - 30 days`, batch ≤ 200 per run:
1. `station_id` = `rpc('get_beach_observation_station', { p_beach_id })`. Null → `no_observations`.
2. Observations: `unified_wave_observations` for that station, `observed_at` in `[coalesce(arrival, peak - 24h) - 24h, coalesce(fade, peak + 24h) + 12h]`. Fewer than 6 rows → `no_observations`.
3. Baseline = median `wave_height_m` over rows before `coalesce(arrival, peak - 24h) - 6h` (fall back to the first quarter of rows). Observed peak = max `wave_height_m` row. Convert m → ft.
4. Classify with exported constants (initial values; tuned later on this table's data):
   `VERIFY_RULES = { minRiseRatio: 1.25, maxPeakErrorHours: 18, heightRatioMin: 0.6, heightRatioMax: 1.6 }`
   - peak/baseline < `minRiseRatio` → `miss_no_show`
   - |peak_error_hours| > `maxPeakErrorHours` → `miss_timing`
   - height_ratio outside `[heightRatioMin, heightRatioMax]` (only when forecast offshore height is known) → `miss_size`
   - else `hit`
   Buoys report total Hs (includes wind sea) and no partitions; record that limitation in the module doc comment. Direction/period are stored, not used for status yet.
5. Write all observed fields, `verified_at = now()`. Per-row failures isolate (one bad row never voids the batch).

## Session prompt responses (W-A writes the table; N-B writes rows)

Table `session_prompt_responses` (new migration):
```
id uuid pk                    -- client-generated (idempotent upsert)
user_id uuid not null references profiles(id) on delete cascade default auth.uid()
source text not null check (source in ('beach_visit','swell_event'))
beach_id uuid null references beaches(id) on delete set null
swell_event_key text null
prompted_at timestamptz not null
response text not null check (response in ('logged','not_surfed','dismissed'))
session_id uuid null          -- sessions.id when response = 'logged' (no FK: the session may sync later)
created_at timestamptz not null default now()
updated_at timestamptz not null default now()
```
RLS: user can insert/select/update own rows (`user_id = auth.uid()`). Index `(user_id, created_at desc)`. Native writes directly via PostgREST upsert on `id` (simple user-owned CRUD). Native must treat any failure (including the table not existing yet) as non-fatal.

---

## Step 5 — swell-event detector (W-B)

Module `lib/alerts/swell-events/` with `index.ts` re-exporting the public API. Pure functions, no I/O except the snapshot store.

Inputs are `enhanced_forecasts` rows: `swell_1_height` / `swell_2_height` are text feet (`"3.4 ft"`, `0` = absent), `swell_*_period` text (`"12s"`), `swell_*_direction` 16-point compass text or numeric. Reuse `lib/alerts/forecast-parsers.ts` (`parsePeriodSeconds`, `parseSwellDirectionToDegrees`) and add a feet parser only if none exists. Wind waves are ignored.

```ts
export const SWELL_EVENT_DETECTOR_VERSION = 'swell-events.v1';
export const SWELL_EVENT_THRESHOLDS = {
  minPeakFaceHeightFt: 3, minPeriodS: 11, minFaceRiseFt: 2, minEnergyRatio: 2.5,
  exposureTaperDeg: 20, trackDirectionDeg: 45, trackPeriodS: 3,
  daylightStartHour: 6, daylightEndHour: 19, maxHorizonDays: 9,
} as const;

export interface SwellWindow { centerDeg: number; halfWidthDeg: number }
/** 1 inside the window; cos² taper to 0 over exposureTaperDeg outside it; null when the beach has no window. */
export function exposureFactor(directionDeg: number, window: SwellWindow | null): number | null;
export function exposureLabel(factor: number): 'open' | 'partial' | 'shadowed'; // >=0.75 open, >=0.25 partial

export type SwellEventBeach = BeachTerrainConfig & {
  id: string; name: string;
  swell_window_center_deg: number | null; swell_window_halfwidth_deg: number | null;
};

export interface BeachSwellEvent {
  beachId: string;
  eventKey: string;                 // `${beachId}:${directionBand}:${peakLocalDate}` unless tracking reuses an earlier key
  directionDeg: number;             // dominant exposed partition at peak
  directionBand: string;            // 8-point compass of directionDeg: N NE E SE S SW W NW
  directionLabel: string;           // 16-point compass
  periodS: number;
  peakOffshoreHeightFt: number;     // partition height at peak
  peakFaceHeightFt: number;         // transformToFaceHeightDecomposed on the dominant partition
  baselineFaceHeightFt: number;
  peakEnergy: number;               // exposure * H^2 * T
  baselineEnergy: number;
  energyRatio: number;
  exposure: number;                 // exposureFactor at peak direction
  arrivalAt: string;                // first row where tracked energy >= baseline + 0.5 * (peak - baseline)
  peakAt: string;
  fadeAt: string | null;            // first row after peak below that onset level; null if beyond horizon
  peakLocalDate: string;            // YYYY-MM-DD in timezone
}

export function detectBeachSwellEvents(input: {
  beach: SwellEventBeach; forecasts: EnhancedForecastEntity[]; now: Date; timezone: string;
}): BeachSwellEvent[];               // chronological; [] when the beach has no swell window or no partitions
```
Detection: exposed energy per partition = `exposureFactor · H² · T`; per row, the dominant partition is the max exposed energy. Per local day (daylight hours) take the dominant peak. Baseline = the minimum daily exposed energy (and matching face height) from today up to the candidate day. A day qualifies when peak face ≥ `minPeakFaceHeightFt`, period ≥ `minPeriodS`, and (face rise ≥ `minFaceRiseFt` or energy ratio ≥ `minEnergyRatio`). An event continues across consecutive qualifying days while the dominant partition stays within `trackDirectionDeg` and `trackPeriodS`; its peak is the max-energy row; after it fades, detection can start a new event with a fresh baseline. Missing window, direction, or partitions can never create an event. One bad row is skipped, never throws for the whole beach.

### Snapshots — cross-run tracking
Table `swell_event_forecast_snapshots` (new migration, service role only, RLS on with no policies):
```
id uuid pk default gen_random_uuid()
beach_id uuid not null references beaches(id) on delete cascade
event_key text not null
detector_version text not null
run_date date not null                  -- UTC date of the run
detected_at timestamptz not null default now()
direction_deg numeric not null, direction_band text not null, period_s numeric not null
peak_offshore_height_ft numeric not null, peak_face_height_ft numeric not null
exposure numeric not null, energy_ratio numeric not null
arrival_at timestamptz not null, peak_at timestamptz not null, fade_at timestamptz null
unique (beach_id, event_key, run_date)
```
Index `(beach_id, detected_at desc)`.
- Key reuse: when a detection matches a snapshot for the same beach from the last 4 days with the same `direction_band`, |peak_at diff| ≤ 36 h and |period diff| ≤ 3 s, reuse that snapshot's `event_key`.
- Cron `app/api/cron/swell-event-snapshots/route.ts`, daily `"30 14 * * *"`, runs detection for every beach with a swell window and future forecasts (batched, per-beach failures isolated) and upserts today's snapshot rows.
- Exported helpers used by both the cron and Week Scout:
  ```ts
  export async function loadRecentSwellSnapshots(supabase, beachIds: string[], since: Date): Promise<SwellEventSnapshot[]>;
  export function resolveEventKeys(events: BeachSwellEvent[], snapshots: SwellEventSnapshot[]): BeachSwellEvent[];
  ```

## Step 3 backend — Week Scout `swells` (W-B)

Additive optional field on the `POST /api/surf/week-scout` response data (`CanonicalWeekScoutResponse`). Not on the weekend or snapshot routes. Old binaries ignore it.

Gate: `WEEK_SCOUT_SWELLS_ENABLED === 'true'` and user in `WEEK_SCOUT_SWELLS_USER_ALLOWLIST` (CSV; empty = everyone) — `lib/flags/week-scout-swells.ts`, same shape as `lib/flags/swell-alert.ts`. Flag off → field absent.

Computation (`lib/services/discovery/week-scout-swells.ts`, `buildWeekScoutSwells(...)`), after the main Week Scout result is built, reusing the forecasts and beaches the service already loaded (no second forecast fetch if avoidable). Wrapped in try/catch: any failure logs and omits `swells`; it never fails or slows the main response beyond a small budget (skip if it would need a new network round trip that the service did not already make, other than the one snapshot query).

1. `detectBeachSwellEvents` per candidate beach → `resolveEventKeys` against snapshots from the last 4 days.
2. Group across beaches: same `directionBand`, |peakAt diff| ≤ 36 h, |period diff| ≤ 3 s. The lead member is the max `peakEnergy`; the group `eventKey` is the lead member's `eventKey`. Direction = energy-weighted circular mean of members; period = lead's.
3. For each group, list **every candidate beach with a swell window** whose `exposureFactor(group.directionDeg)` > 0, plus any candidate whose best window in the event span is `worth_it`. `peakFaceHeightFt` for non-members comes from their own row nearest `peakAt`, partitions within `trackDirectionDeg` of the group direction.
4. `bestWindow` per beach = that beach's `isBeachDayBest` window from the already-computed `days[].windows[]` whose `localDate` is within `[arrival local date, (fade ?? peak) local date]`, choosing the best verdict (`worth_it` > `maybe` > `skip`), then higher `conditionScore`. This is the same window Week Scout and Beach Detail name; do not select a second window.
5. `sizeFit` compares `peakFaceHeightFt` to the rideable band Week Scout already uses for the user's skill/boards (reuse that band function).
6. Rank beaches: verdict rank, then `conditionScore` desc, then `exposure * peakFaceHeightFt` desc. Max 8.
7. `confidence`: lead = hours from now to `peakAt`. `stable` = a snapshot of the same `eventKey` from ≥ 18 h ago exists with peak within ±12 h and offshore height within ±30%. lead ≤ 36 h → `locked` if stable else `likely`; lead ≤ 120 h → `likely` if stable else `on_the_radar`; else `on_the_radar`.
8. `change`: compare with the newest snapshot of the lead `eventKey` detected ≥ 18 h ago. None → `{ kind: 'new', … }` only if an older snapshot set exists for these beaches at all, else `null`. Height ±15% → `upgraded`/`downgraded`; peak moved ≥ 6 h → `earlier`/`later`; else `steady`. `summary` is one short factual line ("Up from 3.1 ft since yesterday", "Peak moved to Thursday morning").
9. `narrative`: 1–3 plain sentences built from data only, e.g. "SW swell, 4.2 ft at 16 s, builds Tuesday afternoon and peaks Wednesday morning. Blacks and Scripps face it most directly; La Jolla Shores is partly blocked, so expect smaller surf there." Add a size line when the top beach is `above_range`: name the best `in_range` beach if any. Voice: chill, reliable, smart; no hype, no emoji.
10. Return at most 3 groups sorted by `peakAt` ascending, only groups with at least one beach whose `bestWindow.verdict` is not null.

### Response types (binding)
```ts
swells?: WeekScoutSwell[];

interface WeekScoutSwell {
  eventKey: string;
  directionDeg: number;
  directionLabel: string;             // 16-point compass
  periodS: number;
  peakOffshoreHeightFt: number;       // offshore swell, NOT surf height
  arrivalAt: string;                  // ISO instant
  peakAt: string;
  fadeAt: string | null;
  peakLocalDate: string;              // YYYY-MM-DD in `timezone`
  timezone: string;                   // the request localTimezone
  confidence: 'on_the_radar' | 'likely' | 'locked';
  change: WeekScoutSwellChange | null;
  narrative: string;
  beaches: WeekScoutSwellBeach[];     // ranked best first, max 8
}
interface WeekScoutSwellChange {
  kind: 'new' | 'upgraded' | 'downgraded' | 'earlier' | 'later' | 'steady';
  comparedToIssuedAt: string;
  previousPeakOffshoreHeightFt: number | null;
  previousPeakAt: string | null;
  summary: string;
}
interface WeekScoutSwellBeach {
  beachId: string;
  beachName: string;
  exposure: number;                   // 0..1
  exposureLabel: 'open' | 'partial' | 'shadowed';
  swellWindow: { centerDeg: number; halfWidthDeg: number } | null;
  peakFaceHeightFt: number | null;
  sizeFit: 'in_range' | 'above_range' | 'below_range' | 'unknown';
  bestWindow: {
    windowId: string;                 // equals a days[].windows[].id in the same response
    localDate: string;
    displayWindowStart: string;
    displayWindowEnd: string;
    verdict: 'worth_it' | 'maybe' | 'skip' | null;
    conditionScore: number | null;
  } | null;
}
```

---

## Step 3 native — Week Scout as the planning page (N-A)

Week Scout is the Explore tab in `tabs` mode (`src/screens/explore-tabs.tsx` → `src/screens/week-scout.tsx` `WeekScoutResearchScreen`). Keep every existing testID and flow working (`.maestro/flows/discovery/week-scout-outlook.yaml` and others anchor on them).

- Types: add the `WeekScoutSwell*` types above to `src/lib/week-scout/canonical-week-scout.ts` (or a sibling `swells.ts`) and the optional `swells` field on the response type and its contract schema (`src/lib/api-contracts/forecast.ts`). Unknown/malformed swells are dropped individually, never failing the Week Scout response.
- New feature module **`src/features/week-scout-swells/`** (index.ts named exports): a "Swells this week" section rendered in Week Scout above the day strip when `swells` has items. Nothing renders (no empty placeholder) when absent. Per swell, one card:
  - Title: `{directionLabel} {periodS}s · peaks {weekday + part of day}` in beach-local time (`timezone`). Offshore height shown as "{h} ft offshore swell" — never labelled as surf height.
  - Confidence chip: On the radar / Likely / Locked. Change line from `change.summary` when present.
  - Compass graphic (react-native-svg, already a dependency — verify): the swell direction as an arrow, and a wedge per listed beach (top 3) from `swellWindow`, with the beach name. Reduced motion respected; accessible label describing it in words.
  - `narrative` text.
  - Ranked beach rows: name, exposure label (Open / Partly blocked / Blocked), `peakFaceHeightFt` with the established uncertainty treatment, size-fit note when not `in_range`, and the window time + verdict label via `src/lib/score-labels.ts` (no second verdict mapping). Tapping a row opens BeachDetail through the existing `buildWeekScoutCtaParams` path for `bestWindow.windowId` (same destination the day strip uses).
  - Design: `docs/DESIGN_SYSTEM.md` tokens, `StyleSheet.create`, typography components, 44×44 targets, haptics per policy. testIDs: `week-scout-swells-section`, `week-scout-swell-card-{index}`, `week-scout-swell-beach-row-{cardIndex}-{rowIndex}`, `week-scout-swell-compass-{index}`.
- Push routing: `swell_watch` taps (`src/lib/push-notifications.ts` ~:803-819) now open `Main/Explore` with `{ mode: 'tabs', focusSwell: { eventKey?, beachId?, peakDate? } }` (new optional param on `Explore` in `src/navigation/types.ts`). Fallback to today's BeachDetail route only if Explore cannot be reached. Week Scout scrolls to and highlights the matching card: exact `eventKey` first, else a swell containing `beachId` with `peakLocalDate` within ±1 day of `peakDate`. Update the deferred-push sanitizer if it filters Explore params. Keep `alertContext` behaviour for other types unchanged.
- **Seen-swells store (N-A owns; N-B consumes).** `src/lib/seen-swells-store.ts`, device-local (zustand persist + AsyncStorage like `src/stores/week-scout-filter-store.ts`), pruned to 14 days:
  ```ts
  export interface SeenSwell {
    eventKey: string; leadBeachId: string; leadBeachName: string;
    directionLabel: string; periodS: number;
    arrivalAt: string; peakAt: string; fadeAt: string | null;
    timezone: string; seenAt: string; source: 'week_scout' | 'push';
  }
  export function recordSeenSwell(swell: Omit<SeenSwell, 'seenAt'>, now?: Date): void;
  export function listSeenSwells(now?: Date): SeenSwell[];
  ```
  Record when a swell card is on screen in Week Scout and when a swell push is opened (push has `beach_id`, `peak_date`, `event_key`, `beaches` — record what is available; skip if eventKey or leadBeachId is missing).

## Step 4 native — "How was it?" prompts (N-B)

New feature module **`src/features/session-prompts/`**.

### Beach visit (foreground only — no new permission, no background location)
- Only when foreground location permission is already granted. Never request permission for this.
- On app foreground/cold start (AppState `active`, throttled: skip if checked < 10 min ago and moved < 500 m), read a fix (last known first, then a balanced-accuracy current fix with a short timeout).
- Nearest beach from a beach list that already has coordinates on device or via the existing public nearby-beaches client (reuse; do not add a new endpoint). Within **400 m** → record/refresh a visit `{ beachId, beachName, firstSeenAt, lastSeenAt }` (device-local, per user, persisted).
- Departure: a later check where the fix is ≥ **2 km** from the visit beach, or the fix is ≥ 400 m away with speed ≥ 6 m/s (driving), or no fix is available and ≥ 2 h have passed since `lastSeenAt`. Only visits with `lastSeenAt` within 18 h qualify.
- Eligible prompt: departed visit, no session for that beach on that local date (check the pending-sessions outbox and the user's recent sessions query already used on device), not answered/dismissed before, max one beach-visit prompt per day.

### Swell
- From `listSeenSwells()` (N-A's store; create a stub with the exact signature above if it does not exist yet in this branch, marked `// Replaced by N-A's store at merge`): a swell whose `coalesce(fadeAt, peakAt + 12 h)` has passed within the last 3 days, with no session logged between `arrivalAt` and `coalesce(fadeAt, peakAt + 24 h)`, not answered before.

### UI and linkage
- One Home card at a time (beach visit wins over swell), above the fold, below the hero, dismissible. Copy: beach visit — title "How was {beach}?", body "You were there {time phrase}." Swell — title "Did you surf the {directionLabel} swell?", body "It peaked {weekday + part of day} at {leadBeachName}." Actions: **Log it** (primary), **Didn't surf**, dismiss (×).
- **Log it** opens SessionForm through `startSessionLogFlow` with `beachId`, `beachName`, `startedAt` (visit `firstSeenAt`; swell `peakAt` clamped to now), a new `SessionEntrySource`/entry point value for prompts, and new optional route params `promptId` + `promptSource` + `swellEventKey` carried to the save path. On successful local enqueue of the session, upsert `session_prompt_responses` `{ id: promptId, source, beach_id, swell_event_key, prompted_at, response: 'logged', session_id }`.
- **Didn't surf** / dismiss → upsert with `'not_surfed'` / `'dismissed'`, `session_id: null`.
- The upsert is best-effort: direct PostgREST upsert on `id` (follow the existing authenticated Supabase client pattern), one attempt plus the next app foreground retry at most, never blocks UI, never affects the session outbox.
- Analytics: follow the existing event helper; `session_prompt_shown` and `session_prompt_answered` with `{ source, response }`. Check whether native events must be allowlisted server-side and report if so (do not edit web).
- Do **not** change `sessions.source` or its native union; the session row stays `source: 'manual'`.

### Out of scope, report only
True "driving away" detection while the app is closed needs Always location + background geofencing (`expo-task-manager`, `UIBackgroundModes`, Android `ACCESS_BACKGROUND_LOCATION`), a new binary and App Store review justification. Not built.

---

## Verification each workstream runs before reporting

- Web (Node 22): `yarn typecheck`; focused Jest via `yarn test:unit --runTestsByPath <files>`; `npx eslint --max-warnings=0 <changed files>`; for migrations, a SQL review (no local reset — it is known-broken on an unrelated migration).
- Native (Node 22): `npm run typecheck`; focused Jest via `npx jest --runTestsByPath <files>` from the worktree root (confirm tests were discovered); no full suite.
- Report: files changed, commands with exact pass/fail, anything not run, contract deviations.
