# Session Conditions Capture (with CDIP MOP) Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (Native) or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax. The production migration (Task 1) and the beach→MOP mapping write (Task 4, Step 5) each need Steven's explicit `APPROVE: <sha>` before they touch production.

**Goal:** Every logged session records the surf it was surfed in, the way the app showed it, plus the nearshore truth for California beaches:
- swell period, direction and height;
- wind speed and direction;
- tide height;
- CDIP MOP height, period and direction.

Every session's Wave characteristics tags (`closeouts`/`walled`, `barreling`, `mushy`/`fat`, …) then become a clean example for break-character physics.

**Architecture:**
- **A migration adds:**
  - typed, provenance-tagged condition columns to `sessions`;
  - MOP mapping columns to `beaches`;
  - a fix to the tide trigger, which drops height whenever the user picks a tide chip.
- **An hourly cron fills nulls only:**
  - swell and wind come from the `enhanced_forecasts` row at or before paddle-out, resolved through the web's existing `resolveDisplaySwell`, so values match what the app showed;
  - nearshore comes from the CDIP MOP nowcast for the beach's mapped point. MOP lands about an hour behind, so this cannot be a DB trigger.
- **A one-off script** maps California beaches to MOP points.
- **The same cron, in backfill mode,** fills past sessions:
  - swell and wind from `session_forecast_snapshots`;
  - nearshore from MOP's ~18-month nowcast archive.

**Tech Stack:** Supabase Postgres (migration + trigger), Next.js cron route (Vercel, Production only), TypeScript, Jest, CDIP THREDDS OPeNDAP (plain HTTPS ASCII subsetting).

**Spec:** this plan's Problem section. Evidence comes from the 2026-10-01 investigation; see memory `break-character-research-2026-10-01`.

## Problem (the spec)

Measured on prod 2026-10-01, sessions not deleted:

| Field | All-time (215) | Last 90 d (124) | Cause |
|---|---|---|---|
| `wind_speed_mph` / `wind_direction` | 6.5% / 6.0% | 0.8% | Native never sends wind; nothing fills it server-side. The last session with wind is 2026-08-25. |
| `tide_height_ft` | 44.7% | 59.7% | `apply_session_tide_snapshot` sets `tide_data_source='user'` and leaves height null whenever the client sends any tide value. 50 of 124 recent rows. |
| swell period / direction | 0% | 0% | No columns. |
| `forecast_wave_height_ft` | 0% | 0% | Never set by any writer. |

**What already exists:**
- `create_session_forecast_snapshot` (AFTER INSERT) copies the nearest `enhanced_forecasts` row (±6 h) into `session_forecast_snapshots.forecast_snapshot`. About 95% coverage, but it takes the nearest row, not the row at or before paddle-out: 41% are up to 1.5 h after.
- **CDIP text swell and Open-Meteo numeric swell disagree** (~5 s on period, 20–45° on direction). The app resolves this with `resolveDisplaySwell` / native `rowDisplaySwell`, so captured values must go through the same rule.

**CDIP MOP (verified 2026-10-01):**
- THREDDS: `https://thredds.cdip.ucsd.edu/thredds/dodsC/cdip/model/MOP_alongshore/<POINT>_nowcast.nc`.
- Hourly `waveTime` (seconds since epoch, ~13,169 hours, about 18 months), `waveHs` (m), `waveTp` (s), `waveDp` and `waveDm` (deg), a 20-band spectrum, and per-point `metaLatitude`, `metaLongitude`, `metaShoreNormal`.
- ~100 m alongshore spacing at 10 m depth (15 m north of Point Conception). California only.
- Licence: "may be redistributed and used without restriction".

**Required behaviour:**
1. **Typed condition columns.** New sessions get swell period/direction/height and wind speed/direction. They come from the forecast row at or before `arrival_time` (≤ 3 h), resolved exactly as the app displays them, with provenance (`conditions_forecast_at`, `conditions_source`).
2. **Tide height always.** Tide height is filled even when the user picked a tide chip. The user's chosen status is kept, and a separate flag records that it was user-set.
3. **Nearshore for California.** Sessions at MOP-mapped beaches get the MOP nowcast for the hour containing `arrival_time`, plus the point id, so the full spectrum can be refetched later without storing it.
4. **Fill nulls only.** Never overwrite a value the client or a user sent. The job is idempotent.
5. **Backfill.** Every past session with a snapshot gets swell and wind. Every past California session within MOP's archive gets nearshore.
6. **Ship order.** Migrate the database before any client sends new columns: native posts raw JSON to PostgREST, and an unknown column fails the whole insert.

## Global Constraints

- **Production database access is read-only by default** (`soul.md`). The migration and the mapping write each need Steven's `APPROVE: <sha of the exact SQL>`. Verify after applying with `list_migrations` and `information_schema`. Migration auto-apply on merge is unreliable.
- **Grants:** `sessions` has table-level grants only (no column ACLs), so new columns inherit access. Re-check with `has_column_privilege` after migrating.
- **Cron:**
  - lives at `app/api/cron/session-conditions-enrich/route.ts`;
  - is registered in `vercel.json`, hourly at `:20` (MOP lands ~1 h behind);
  - is gated by `SESSION_CONDITIONS_ENRICH_ENABLED=true`;
  - uses the service-role client and is wrapped in `validateCronRequest` / `withCronOutcome` like its sibling crons.
- **Units in column names:** `_s`, `_deg` (0–359, smallint), `_ft`, `_mph`, `_m`. Cardinals are derived at display time.
- **Testing:** targeted Jest only, with placeholder `NEXT_PUBLIC_SUPABASE_URL`/`_ANON_KEY` in worktrees. Node 22. Conventional atomic commits, staged by path.

## Review Focus

1. **A session with no forecast row within 3 h** (a new beach, a forecast gap): columns stay null with `conditions_source='none'`, and the job doesn't retry it forever. Pinned in Task 2.
2. **MOP missing the hour** (a fill value of −999.99, a point outage, or `arrival_time` older than the archive): nearshore stays null with `nearshore_source='unavailable'`. Never borrow a neighbouring hour more than 1 h away. Pinned in Task 3.
3. **A session edited later** (arrival time or beach changed): condition columns recompute only if they were filled by the job (`conditions_source` not `client`), never when a user supplied them. Pinned in Task 2/5.
4. **A beach mapped to a MOP point more than 500 m away,** or across a headland: leave it unmapped. A wrong point is worse than none. Pinned in Task 4.
5. **Tide chip semantics:** the user's status ("rising") must not be replaced by the computed one. Only the height is added. Pinned in Task 1.

---

### Task 1: Migration — columns, MOP mapping, tide fix

**Files:**
- Create: `supabase/migrations/20261002090000_session_conditions_capture.sql`
- Test: `__tests__/integration/session-tide-snapshot.sql`, run with the repo's PG15 SQL harness (see `local-verification-env-gotchas-2026-09`)

**Migration SQL** (this exact text is what Steven approves):

```sql
BEGIN;

ALTER TABLE public.sessions
  ADD COLUMN swell_period_s numeric(4,1),
  ADD COLUMN swell_direction_deg smallint,
  ADD COLUMN swell_height_ft numeric(4,1),
  -- Open-Meteo primary swell partition, stored raw: in the 2026-10-01 backtest its period was the
  -- only close-out predictor that held (AUC 0.74), and the display rule often shows CDIP's instead.
  ADD COLUMN offshore_swell_period_s numeric(4,1),
  ADD COLUMN offshore_swell_direction_deg smallint,
  ADD COLUMN offshore_swell_height_ft numeric(4,1),
  ADD COLUMN wind_direction_deg smallint,
  ADD COLUMN conditions_forecast_at timestamptz,
  ADD COLUMN conditions_source text,
  ADD COLUMN tide_status_user_set boolean NOT NULL DEFAULT false,
  ADD COLUMN nearshore_point_id text,
  ADD COLUMN nearshore_observed_at timestamptz,
  ADD COLUMN nearshore_hs_m numeric(4,2),
  ADD COLUMN nearshore_tp_s numeric(4,1),
  ADD COLUMN nearshore_dp_deg smallint,
  ADD COLUMN nearshore_dm_deg smallint,
  -- Swell-band (0.04–0.10 Hz) mean period: MOP's peak Tp is often the local wind sea (7 s at La Jolla Shores 9/30).
  ADD COLUMN nearshore_swellband_tm_s numeric(4,1),
  -- Hs at the point ÷ mean Hs of the ±2 neighbouring MOP points: canyon focusing (LJS 9/30 = 1.53, 93rd pct).
  ADD COLUMN nearshore_focus_ratio numeric(4,2),
  ADD COLUMN nearshore_source text;

ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_swell_direction_deg_check CHECK (swell_direction_deg IS NULL OR swell_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_offshore_swell_direction_deg_check CHECK (offshore_swell_direction_deg IS NULL OR offshore_swell_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_wind_direction_deg_check CHECK (wind_direction_deg IS NULL OR wind_direction_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_nearshore_dp_deg_check CHECK (nearshore_dp_deg IS NULL OR nearshore_dp_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_nearshore_dm_deg_check CHECK (nearshore_dm_deg IS NULL OR nearshore_dm_deg BETWEEN 0 AND 359),
  ADD CONSTRAINT sessions_conditions_source_check CHECK (conditions_source IS NULL OR conditions_source IN ('client', 'forecast_row', 'snapshot_backfill', 'none')),
  ADD CONSTRAINT sessions_nearshore_source_check CHECK (nearshore_source IS NULL OR nearshore_source IN ('cdip_mop_nowcast', 'cdip_mop_backfill', 'unavailable', 'unmapped'));

-- The enrich cron selects sessions still missing conditions; keep that scan cheap.
CREATE INDEX sessions_conditions_pending_idx
  ON public.sessions (arrival_time)
  WHERE deleted_at IS NULL AND (conditions_source IS NULL OR nearshore_source IS NULL);

ALTER TABLE public.beaches
  ADD COLUMN mop_point_id text,
  ADD COLUMN mop_shore_normal_deg smallint,
  ADD COLUMN mop_point_distance_m integer;

ALTER TABLE public.beaches
  ADD CONSTRAINT beaches_mop_shore_normal_deg_check CHECK (mop_shore_normal_deg IS NULL OR mop_shore_normal_deg BETWEEN 0 AND 359);
```

The `apply_session_tide_snapshot` change comes next: compute the tide height even when the client set a status.
- **Read the current definition** first with `SELECT pg_get_functiondef('public.apply_session_tide_snapshot'::regproc);` and change only its branch that skips the snapshot when the client sends tide values.
- **New behaviour:**
  - If the client sent `tide_status` but no `tide_height_ft`: keep `NEW.tide_status`, set `NEW.tide_status_user_set := true`, and fill `tide_height_ft`, `tide_rate_ft_per_hr` and `tide_data_source` from `compute_session_tide_snapshot(NEW.beach_id, NEW.arrival_time)`.
  - If the client sent a height: unchanged (`tide_data_source = 'user'`).
- **Also in `compute_session_tide_snapshot`:** restrict each `tide_forecasts` lookup to one series, the latest station, preferring `source='noaa'`. This mirrors `lib/services/tide-forecast-selection.ts` `selectTideSeries`, so neighbouring points cannot mix series. It is the bug just fixed for alerts in quiver#906.

```sql
COMMIT;
```

- [ ] **Step 1:** Read both functions' current definitions from prod (read-only). Write the trigger and function bodies in the migration with the changes above. Include the full `CREATE OR REPLACE` text; no ellipses.
- [ ] **Step 2: SQL integration tests** (PG15 harness, local only):
  - (a) client sends `tide_status='rising'` only → status stays 'rising', `tide_status_user_set` true, height filled from fixtures;
  - (b) client sends a height → unchanged;
  - (c) fixtures with both `noaa` and `noaa_hilo_interpolated` rows for an hour → the `noaa` row is used.
  Run them and watch (a) and (c) fail against the current functions, then pass.
- [ ] **Step 3:** Commit. Compute the SHA-256 of the migration file. Stop and present the SQL plus the SHA to Steven for `APPROVE:`.
- [ ] **Step 4 (after approval):**
  - apply via the Supabase MCP `apply_migration` (or `psql -f` with `POSTGRES_URL_NON_POOLING`);
  - verify columns with `information_schema` and grants with `has_column_privilege('authenticated', 'public.sessions', 'swell_period_s', 'SELECT')`;
  - run `migration repair` if the ledger lags;
  - regenerate `types/database.generated.ts` (`yarn db:types:remote`) and commit.

### Task 2: Resolve a session's conditions from the forecast it was surfed in

**Files:**
- Create: `lib/sessions/session-conditions.ts`
- Test: `__tests__/lib/sessions/session-conditions.test.ts`

**Interfaces (produces):**

```ts
export interface SessionConditions {
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  swell_height_ft: number | null;
  wind_speed_mph: number | null;
  wind_direction_deg: number | null;
  wind_direction: string | null; // cardinal, kept for the existing column
  conditions_forecast_at: string | null;
  conditions_source: "forecast_row" | "snapshot_backfill" | "none";
}
/** The row at or before arrival within 3 h; a later row is a different hour than the one surfed. */
export function pickForecastRowAtOrBefore<T extends { forecast_at: string }>(rows: T[], arrivalTime: string): T | null;
export function resolveSessionConditions(
  row: (DisplaySwellRow & { forecast_at: string; wind_speed?: string | null; wind_direction?: string | null; wind_direction_deg?: number | null }) | null,
  window: DisplaySwellWindow | null,
  source: "forecast_row" | "snapshot_backfill",
): SessionConditions;
```

**Tests:**
- picks the row at or before arrival, never the nearer later row;
- returns null past 3 h;
- swell goes through `resolveDisplaySwell`. Cover a CDIP row whose numeric direction conflicts by 45° or more, and an Open-Meteo-in-window row: same answers as the app;
- wind "10 mph" + 180° → 10, 180, "S";
- a row of nulls → all null with `conditions_source='none'`;
- period rounds to one decimal, direction normalises 360→0.

- [ ] Steps: write the failing tests → watch them fail → implement → pass → commit.

### Task 3: CDIP MOP client

**Files:**
- Create: `lib/services/cdip-mop/mop-client.ts`
- Test: `__tests__/lib/services/cdip-mop/mop-client.test.ts`, with recorded ASCII fixtures in `__tests__/fixtures/cdip-mop/`

**Interfaces (produces):**

```ts
export interface MopHour { pointId: string; observedAt: string; hsM: number; tpS: number; dpDeg: number; dmDeg: number | null; swellbandTmS: number | null }
/** Hs at the point divided by the mean Hs of its ±2 alongshore neighbours for the same hour (canyon/reef focusing). */
export function fetchMopFocusRatio(pointId: string, at: Date, fetchImpl?: typeof fetch): Promise<number | null>;
export interface MopPointMeta { pointId: string; lat: number; lon: number; shoreNormalDeg: number }
/** The nowcast hour containing `at`, or null when MOP has no valid value within ±1 h (fill -999.99, outage, older than the archive). */
export function fetchMopHour(pointId: string, at: Date, fetchImpl?: typeof fetch): Promise<MopHour | null>;
export function fetchMopPointMeta(pointId: string, fetchImpl?: typeof fetch): Promise<MopPointMeta>;
```

**Implementation notes:**
- Read `waveTime` once per point per run, then cache it in memory for the cron run.
- Binary-search the index nearest `at`.
- Request `.ascii?waveHs[i:1:i],waveTp[i:1:i],waveDp[i:1:i],waveDm[i:1:i]`.
- Treat −999.99 or a flagged primary value as null. Set an `User-Agent: Quiver (support@quiversurf.app)` header and a 15 s timeout.

**Tests:**
- parses a recorded D0505 response for 2026-09-30 15:00Z (Hs ≈ 1.20 m, Dp ≈ 280° per the 2026-10-01 research);
- returns null on a fill value;
- returns null when the nearest hour is more than 1 h away;
- never calls the network in tests.

### Task 4: Map California beaches to MOP points

**Files:**
- Create: `scripts/map-beaches-to-mop.ts`
- Output: `.planning/2026-10-02-mop-beach-mapping.sql`, for review, not executed by the script

**Steps:**
- [ ] **Step 1:** List point files from the THREDDS catalog (`.../MOP_alongshore/catalog.xml`, `*_nowcast.nc`). Fetch `metaLatitude`/`metaLongitude`/`metaShoreNormal` per point via `fetchMopPointMeta`, with ≤ 4 concurrent requests, cached to `.planning/mop-points.json`.
- [ ] **Step 2:** Load California beaches (read-only SQL): lat, lon, name.
- [ ] **Step 3:**
  - Map each beach to its nearest point by haversine, within 500 m (Review Focus 4).
  - Write `UPDATE public.beaches SET mop_point_id=…, mop_shore_normal_deg=…, mop_point_distance_m=… WHERE id=…;`.
  - Include a summary header: mapped count, unmapped count, and the largest distance kept.
- [ ] **Step 4:** Spot-check against the 2026-10-01 research: La Jolla Shores → around D0505, shore normal 278–300°. List any beach whose MOP normal differs from `aspect_deg` by more than 20° for review.
- [ ] **Step 5:** Present the SQL file plus its SHA-256 to Steven for `APPROVE:`, then apply it.

### Task 5: The enrichment cron (live and backfill)

**Files:**
- Create: `app/api/cron/session-conditions-enrich/route.ts`
- Create: `lib/flags/session-conditions-enrich.ts`
- Modify: `vercel.json` (add `{ "path": "/api/cron/session-conditions-enrich", "schedule": "20 * * * *" }`)
- Test: `__tests__/api/cron/session-conditions-enrich.test.ts`

**Behaviour:**
- **Select** up to 200 sessions per run, `deleted_at` null, where either source is still null. Live mode: `arrival_time` within the last 72 h. Backfill mode (`?mode=backfill&since=2025-04-01`): wider window, same batch size, oldest first.
- **Offshore swell (raw Open-Meteo):** fill `offshore_swell_*` straight from the same row's `swell_period_om`, `swell_direction_om` and `swell_height_om` (×3.28084), independent of the display rule.
- **Conditions:**
  - Live: read the `enhanced_forecasts` rows for the beach within 3 h before arrival, then `pickForecastRowAtOrBefore` → `resolveSessionConditions(row, beachWindow, 'forecast_row')`.
  - Backfill, when `enhanced_forecasts` no longer holds the hour (it keeps about 7 days): use `session_forecast_snapshots.forecast_snapshot` with source `snapshot_backfill`, but only if its `forecast_at` is at or before arrival + 30 min. Otherwise mark it `none`.
  - Only fill columns that are null.
  - Never touch rows whose `conditions_source='client'` (Review Focus 3).
- **Nearshore:**
  - beach has a `mop_point_id` → `fetchMopHour` → fill the `nearshore_*` fields with source `cdip_mop_nowcast` (live) or `cdip_mop_backfill`; null → `unavailable`;
  - no point → `unmapped`.
- **Write:**
  - one `update` per session, with `.is(column, null)` guards so it can't overwrite;
  - a summary `{ selected, conditionsFilled, nearshoreFilled, unavailable, unmapped, errors }` through `withCronOutcome`.

**Tests:**
- fills nulls from the at-or-before row;
- leaves user-supplied wind alone;
- marks `none` when no row is within 3 h;
- marks `unmapped` and `unavailable` correctly;
- the flag off → no writes;
- backfill uses the snapshot only when it isn't after arrival.

### Task 6: Show it and use it

**Files:**
- Modify: web `app/api/sessions/[id]/route.ts` and `app/api/users/[id]/sessions/route.ts` (explicit select lists).
- Native:
  - `src/types/session.ts`, `src/types/public-session.ts`, `src/lib/session-normalizers.ts` (hand-written types);
  - `src/screens/session-detail.tsx`: a "Conditions" row with swell period/direction, wind and nearshore height, each hidden when null.
- Analytics: add `swell_period_s` and `wind_speed_mph` to `session_log_submit` only after they exist server-side. Native does not send them on insert; the server fills them.
- Tests: the session-detail renders conditions when present and hides nulls; the normalizer keeps the new fields.

### Task 7: Rollout (operator steps, each needs Steven)

1. Approve and apply the migration (Task 1). Verify.
2. Approve and apply the MOP mapping SQL (Task 4).
3. Merge → prod slice → deploy. Set `SESSION_CONDITIONS_ENRICH_ENABLED=true`. Watch two hourly runs.
4. Run backfill mode in batches until `selected` = 0.
5. Measure on the last 30 days of sessions: % with swell period, wind, and tide height (expected above 95%), and % of California sessions with nearshore.
6. Rerun the physics backtest on the new columns. This replaces the ad-hoc joins from 2026-10-01.

## Out of scope / follow-ups
- **Hawaii, East Coast and international nearshore sources** (NWPS, PacIOOS SWAN, CMEMS). Pending the 2026-10-01 regional survey; the `nearshore_source` enum gets new values then.
- **Writing these fields from the client** at log time (instant display). The server fill is enough for analysis.
- **Removing `session_forecast_snapshots`.** Keep it as the raw record.
