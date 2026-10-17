# Session Waves Shared Core (web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a surfer upload a FIT, GPX or Garmin ZIP export and get a session with server-detected waves, a ride map, conditions (backfilled when old) and corrections on the web.

**Architecture:** The upload goes straight to a private storage bucket, then an authenticated JSON call processes it:

- **Parse:** decode the file into a normalized track.
- **Find the beach:** resolve the nearest beach from where the surfer was in the water.
- **Merge or create:** attach to an existing session at that time and place, or insert a new one.
- **Detect:** run a pure, versioned wave detector.
- **Persist:** save `session_tracks` and `session_waves`.

Conditions come from the existing hourly enrich job, extended with an Open-Meteo hindcast fallback for older surfs. The web session view reads a new owner-only waves API.

**Tech Stack:** Next.js App Router (Node runtime routes), Supabase (Postgres, RLS, Storage), TypeScript, Jest, `mapbox-gl`, new deps `@garmin/fitsdk` (FIT decode) and `fflate` (ZIP), existing `fast-xml-parser` (GPX).

**Spec:** `docs/superpowers/specs/2026-10-17-session-waves-shared-core-design.md`

**Companion plan:** `quiver-native/docs/superpowers/plans/2026-10-17-session-waves-native.md` consumes the API from Task 10.

## Global Constraints

- **Repo rules:**
  - Follow `soul.md`.
  - Authenticated routes use `withAuth` (and `withRateLimit`, `withNoStore`) from `lib/middleware/api-wrappers`.
  - Real HTTP error statuses, never a 200 failure.
  - Mobile-consumed contracts are additive only.
  - RLS on every new user-data table.
  - Migrations are `YYYYMMDDHHMMSS_name.sql` inside `BEGIN; … COMMIT;`, sorting after `20261014220000_create_community_photo_terms_acceptances.sql`.
  - Never hand-edit `types/database.generated.ts`. Regenerate with `yarn db:types` against a local snapshot, never `db:types:remote`.
- **Shared database:** the prod/dev database is shared. Migrations are written and committed here but **applied only with Steven's approval**. Add a hold line to `/Users/stevenchandler/Desktop/dev/.quiver/ops/RELEASE-POOL.md`.
- **Coordinates:** use `lat`/`lon`, never `lng`, except the `get_nearby_beaches` RPC params (`input_lat`, `input_lng`).
- **New `sessions.source` value:** `'file_import'`. New `conditions_source` value: `'hindcast_open_meteo'`. Detection version string: `'wd-1.0.0'`.
- **Imports insert sessions as:**
  - `status='completed'`, `is_public=false`, `source='file_import'`
  - `arrival_time` = in-water start, `duration_minutes` = round(in-water span / 60)
  - `beach_name` = the beach name
- **`sessions.water_temp` is °F:** convert from the FIT's whole °C with `round(c * 9/5 + 32)`. Write only when null, and set `water_temp_source='watch'`.
- **Beach resolution:** `get_nearby_beaches(input_lat, input_lng, 3000, 3)` at the in-water centroid. The nearest beach wins. With none, the status is `needs_beach`.
- **Dedupe window:** an existing non-deleted session of the same user whose `arrival_time` is within ±90 min of the in-water start, at the same beach or within 3 km. Choose the closest start. If it already has a `session_tracks` row, the result is a 409 duplicate.
- **Historical import:** `source='file_import'` and `arrival_time + duration_minutes` more than 48 h before insert. These are excluded from the Pro-offer trigger and the completion-email stamp.
- **Flag:** `SESSION_IMPORTS_ENABLED` + `SESSION_IMPORTS_USER_ALLOWLIST`. An empty allowlist means nobody (the `lib/flags/swell-outlook.ts` pattern). Routes return 404 `{error:'not_found'}` when the flag is off.
- **Privacy:** tracks and waves are owner-only. Imported sessions are private. The purge happens 30 days after `deleted_at`, and immediately for deleted accounts.
- **Tests:** `npm run test:unit -- <file>`. Route tests use the `@jest-environment node` docblock and the `__tests__/api/sessions/session-update.test.ts` mocking pattern.

## Review Focus

1. **A file with no GPS at all** (pool swim, indoor) should give a clear 422 "This file has no GPS track", not an empty session. This goes in Task 9.
2. **The same file uploaded twice, or re-uploaded after the session was soft-deleted.** The first should return 409 linking the existing session. The second should re-link the import to a new session, not 409. This goes in Task 9.
3. **A track whose first fix comes before midnight local time and runs into the next day,** or one with a bad device clock (start in the future or before 2015), should be rejected with 422. Never insert a session with a nonsense `arrival_time`. This goes in Task 3.
4. **A surf at a beach with no `swell_window_center_deg` and no water-side fixes** (a GPS fix only on the sand): detection should still run with the beach-bearing fallback and must not throw. Confidence stays low. This goes in Task 6.
5. **An Open-Meteo hindcast call that fails or returns nulls for that hour** should leave the session's conditions unfilled and retryable, never written as `'none'`. This goes in Task 11.

---

## File structure

| Path | Responsibility |
|---|---|
| `supabase/migrations/20261018090000_session_waves_core.sql` | Tables, columns, CHECK values (source, conditions_source, user_events), bucket and policies |
| `supabase/migrations/20261018090100_session_waves_triggers.sql` | Pro-offer and completion-email exclusions; `delete_user_account` purge request |
| `lib/sessions/tracks/types.ts` | `TrackSample`, `NormalizedTrack`, `TrackMeta` |
| `lib/sessions/tracks/read-track-file.ts` | Format sniffing (ZIP, FIT, GPX) and validation errors |
| `lib/sessions/tracks/parse-fit.ts`, `parse-gpx.ts` | Decoders into `NormalizedTrack` |
| `lib/sessions/tracks/track-geometry.ts` | `haversineM`, `bearingDeg`, `median`, `angleDiffDeg` |
| `lib/sessions/tracks/summarize-track.ts` | In-water span, coverage, gaps, centroid, water temp, downsampled GeoJSON and speed series |
| `lib/sessions/wave-detection/constants.ts`, `detect-waves.ts` | Detector v1 |
| `lib/sessions/waves/waves-summary.ts` | Applies corrections and builds the API summary |
| `lib/sessions/waves/wave-tides.ts` | Tide height per wave |
| `lib/sessions/imports/resolve-import-beach.ts`, `find-attach-target.ts`, `process-import.ts` | Ingest pipeline |
| `lib/flags/session-imports.ts` | Flag |
| `lib/services/open-meteo-hindcast.ts` | Historical swell (marine API) and wind (historical-forecast API) |
| `app/api/v1/session-imports/route.ts` and `[id]/process`, `[id]/beach` | Import routes |
| `app/api/v1/sessions/[id]/waves/route.ts`, `waves/[waveId]/route.ts`, `redetect/route.ts` | Waves API |
| `app/api/cron/session-tracks-purge/route.ts` | Purge job |
| `components/sessions/waves/*` | Waves section, ride map, speed timeline |
| `components/sessions/import/*`, `hooks/use-session-import.ts` | Upload flow |
| `scripts/session-tracks/make-track-fixture.mjs` | One-off fixture generator (plain JS, not imported by app code) |
| `__tests__/fixtures/session-tracks/*.json` | Offset real tracks |

---

### Task 1: Core migration (tables, values, bucket)

**Files:**
- Create: `supabase/migrations/20261018090000_session_waves_core.sql`
- Test: `__tests__/api/events-allowlist-db-sync.test.ts` (existing; must still pass), `__tests__/migrations/session-waves-core.test.ts`

**Interfaces:**
- **Produces:**
  - **`session_imports`:**
    - `id uuid pk default gen_random_uuid()`
    - `user_id uuid not null references auth.users on delete cascade`
    - `storage_path text not null`, `original_filename text`
    - `sha256 text`
    - `status text not null default 'uploaded' check (status in ('uploaded','needs_beach','completed','failed'))`
    - `error text`
    - `session_id uuid references sessions on delete set null`
    - `summary jsonb`
    - `purge_requested_at timestamptz`
    - `created_at`, `updated_at` timestamptz default now()
    - unique `(user_id, sha256)`
  - **`session_tracks`:**
    - `session_id uuid pk references sessions on delete cascade`
    - `user_id uuid not null`
    - `import_id uuid references session_imports on delete set null`
    - `storage_path text not null`
    - `format text not null check (format in ('fit','gpx'))`
    - `sha256 text not null`
    - `recorded_by text`
    - `sport text`, `sub_sport text`
    - `started_at timestamptz not null`, `ended_at timestamptz not null`
    - `sample_count int not null`
    - `gps_coverage real not null`, `max_gap_s int not null`
    - `speed_reliable boolean not null default true`
    - `user_wave_count int check (user_wave_count between 0 and 200)`
    - `timing_from_track boolean not null default true`
    - `user_arrival_time timestamptz`, `user_duration_minutes int`
    - `track_geojson jsonb not null`
    - `speed_series jsonb not null`
    - `water_temp_c real`
    - `purge_requested_at timestamptz`
    - `created_at timestamptz default now()`
  - **`session_waves`:**
    - `id uuid pk`
    - `session_id uuid not null references sessions on delete cascade`
    - `user_id uuid not null`
    - `detection_version text not null`
    - `wave_index int not null`
    - `is_current boolean not null default true`
    - `started_at`, `ended_at timestamptz not null`
    - `duration_s real not null`, `distance_m real not null`
    - `max_speed_mps real`, `avg_speed_mps real`
    - `start_lat`, `start_lon`, `end_lat`, `end_lon double precision not null`
    - `heading_deg real`
    - `confidence real not null check (confidence between 0 and 1)`
    - `created_at`
    - unique `(session_id, detection_version, wave_index)`
    - index `(session_id) where is_current`
  - **`session_wave_corrections`:**
    - `id uuid pk`
    - `session_id uuid not null references sessions on delete cascade`
    - `user_id uuid not null`
    - `started_at`, `ended_at timestamptz not null`
    - `action text not null check (action = 'exclude')`
    - `created_at`
  - **`sessions.water_temp_source text check (water_temp_source in ('user','watch'))`**
  - **Appended CHECK values:**
    - `sessions_source_check` gets `'file_import'`, using the `20260718140000_preserve_session_source_check.sql` pattern.
    - `conditions_source` CHECK gets `'hindcast_open_meteo'`.
    - `user_events_event_type_check` gets `session_import_failed`, `session_waves_viewed`, `session_wave_excluded`, `session_wave_count_reported`, using the `candidate_events` DO-block pattern from `20260626173436_add_session_created_event.sql`.
  - **Bucket `session-tracks`:**
    - `public=false`, `file_size_limit=10485760`
    - `allowed_mime_types = ARRAY['application/octet-stream','application/gpx+xml','text/xml','application/xml','application/zip','application/x-zip-compressed']`
    - insert and select policies on `(storage.foldername(name))[2] = auth.uid()::text` (mirror `20260811020500_create_session_videos.sql`)
  - **RLS:**
    - all four tables: `select` where `user_id = (select auth.uid())`;
    - `session_imports`: also owner `insert`;
    - `session_wave_corrections`: also owner `insert` and `delete`;
    - service role writes everything else.
  - **Event registration:** add the four event names to `VALID_EVENTS` in `lib/analytics/event-taxonomy.ts`.

- [ ] **Step 1: Write the failing migration test**

`__tests__/migrations/session-waves-core.test.ts` reads the migration file text and asserts:
- it contains `create table public.session_tracks`, `create table public.session_waves`, `create table public.session_wave_corrections` and `create table public.session_imports`;
- each has `enable row level security`;
- it contains `'file_import'`, `'hindcast_open_meteo'` and the four event names;
- it contains `'session-tracks'`;
- it starts with `BEGIN;` and ends with `COMMIT;`.

Follow any existing migration-text test under `__tests__/` if there is one.

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- __tests__/migrations/session-waves-core.test.ts`
Expected: FAIL (file not found).

- [ ] **Step 3: Write the migration with the exact columns above, and add the event names to `VALID_EVENTS`.**

- [ ] **Step 4: Apply it to a local snapshot database** (per `docs/MIGRATION_SAFETY.md` and `docs/SUPABASE_GUIDE.md`; never apply it to the shared database).

Then run `yarn db:types`.
Expected: the migration applies cleanly and `types/database.generated.ts` gains the four tables.

- [ ] **Step 5: Run the tests**

Run: `npm run test:unit -- __tests__/migrations/session-waves-core.test.ts __tests__/api/events-allowlist-db-sync.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20261018090000_session_waves_core.sql lib/analytics/event-taxonomy.ts types/database.generated.ts __tests__/migrations/session-waves-core.test.ts
git commit -m "feat(sessions): add session waves tables, track bucket and source values"
```

### Task 2: Trigger and account-deletion migration

**Files:**
- Create: `supabase/migrations/20261018090100_session_waves_triggers.sql`
- Test: `__tests__/migrations/session-waves-triggers.test.ts`

**Interfaces:**
- **Produces:** SQL function `public.is_historical_file_import(p_source text, p_arrival timestamptz, p_duration_minutes int) returns boolean`, which is true when `p_source = 'file_import' AND p_arrival + make_interval(mins => coalesce(p_duration_minutes,0)) < now() - interval '48 hours'`.
- **Modifies:**
  - `earn_pro_offer_on_session` (from `20260912030000_pro_offer_fulfillment.sql`): its gate gains `AND NOT public.is_historical_file_import(NEW.source, NEW.arrival_time, NEW.duration_minutes)`.
  - `stamp_email_session_completion` (from `20260912010000_startup_email_lifecycle.sql`): on insert it leaves `email_completed_at` null when that function is true.
  - `delete_user_account(p_user_id uuid)`: re-create it from its latest body in `20260717170000_create_regional_recommendation_holds.sql`, adding `UPDATE public.session_tracks SET purge_requested_at = now() WHERE user_id = p_user_id;` and the same for `session_imports`, plus `DELETE FROM public.session_wave_corrections WHERE user_id = p_user_id;`. Storage files are removed by Task 14's job.

- [ ] **Step 1: Write the failing test**

Assert that the file text contains the three `create or replace function` statements, `is_historical_file_import`, `purge_requested_at = now()`, and the unchanged `earn_five_session_offer` call.

- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Write the migration.** Copy each function's latest body verbatim, adding only the lines above.
- [ ] **Step 4: Apply it on the local snapshot,** then check in `psql`:
  - insert a `file_import` session with `arrival_time = now() - interval '5 days'`, `status='completed'`;
  - `email_completed_at` is null, and no `five_sessions_month` progress row changed;
  - the same insert with `arrival_time = now()` stamps `email_completed_at`.
- [ ] **Step 5: Run the test.** Expected: PASS.
- [ ] **Step 6: Commit** with `feat(sessions): exclude historical imports from offer and email; request track purge on account deletion`.

### Task 3: Track model and file parsing

**Files:**
- Create: `lib/sessions/tracks/types.ts`, `lib/sessions/tracks/parse-fit.ts`, `lib/sessions/tracks/parse-gpx.ts`, `lib/sessions/tracks/read-track-file.ts`
- Modify: `package.json` (add `@garmin/fitsdk` and `fflate`)
- Test: `__tests__/lib/sessions/tracks/read-track-file.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export type TrackSample = { t: string; lat: number | null; lon: number | null; speedMps: number | null;
    hr: number | null; tempC: number | null; cadence: number | null };
  export type TrackMeta = { format: "fit" | "gpx"; sport: string | null; subSport: string | null;
    recordedBy: string | null; startedAt: string; endedAt: string };
  export type NormalizedTrack = { meta: TrackMeta; samples: TrackSample[] };
  export class TrackFileError extends Error { constructor(public code: "unsupported_format" | "no_gps" | "bad_time" | "corrupt", message: string) }
  export function readTrackFile(bytes: Uint8Array, filename: string, now?: Date): NormalizedTrack  // throws TrackFileError
  ```
- `recordedBy` is built from the FIT `device_info` creator product name plus the developer app, when present. The known app id `adb20c3398b5458981649e383a9ac1a1` maps to "Dawn Patrol". Otherwise it's `Garmin <product>`.

- [ ] **Step 1: Write the failing tests**

```ts
it("reads a FIT export inside a Garmin ZIP", () => {
  const track = readTrackFile(zipBytes(fitFixtureBytes, "1_ACTIVITY.fit"), "1.zip");
  expect(track.meta.format).toBe("fit");
  expect(track.samples.length).toBeGreaterThan(100);
});
it("reads GPX trkpt time/lat/lon", () => { /* 3-point inline GPX -> 3 samples, speedMps null */ });
it("rejects a file with no GPS", () => expect(() => readTrackFile(fitWithoutPositions, "a.fit")).toThrow(expect.objectContaining({ code: "no_gps" })));
it("rejects start in the future or before 2015", () => expect(() => readTrackFile(gpxAt("2031-01-01T00:00:00Z"), "a.gpx", new Date("2026-10-17"))).toThrow(expect.objectContaining({ code: "bad_time" })));
it("rejects unknown bytes", () => expect(() => readTrackFile(new Uint8Array([1,2,3]), "x.bin")).toThrow(expect.objectContaining({ code: "unsupported_format" })));
```

Build the FIT bytes in the test with `@garmin/fitsdk`'s `Encoder` (a small synthetic activity with `record` messages). If the installed SDK version has no JavaScript `Encoder`, commit tiny binary FITs generated once with Garmin's FIT SDK tooling under `__tests__/fixtures/session-tracks/bin/` (no real coordinates). Inline GPX is fine.

- [ ] **Step 2: Run it.** `npm run test:unit -- __tests__/lib/sessions/tracks/read-track-file.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement.**
  - Sniff the format: ZIP magic `PK\x03\x04` (unzip with `fflate.unzipSync`, take the first `.fit`/`.gpx`), FIT `.FIT` signature at bytes 8–11, or XML with `<gpx`.
  - FIT: decode `record_mesgs` (semicircles to degrees = `x * 180 / 2**31`; speed from `enhanced_speed ?? speed`; cadence; temperature), `session_mesgs[0].sport/sub_sport`, `device_info`, `developer_data_id`.
  - GPX: use `fast-xml-parser`.
  - Confirm the `@garmin/fitsdk` license permits server use and note it in the PR. If it doesn't, switch to `fit-file-parser` with the same output.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): parse FIT, GPX and Garmin ZIP exports into a normalized track`.

### Task 4: Real-track fixtures

**Files:**
- Create: `scripts/session-tracks/make-track-fixture.mjs`, `__tests__/fixtures/session-tracks/ob-2026-10-17.json`, `__tests__/fixtures/session-tracks/cardiff-2026-10-03.json`

**Interfaces:**
- **Produces:** JSON files of shape `{ track: NormalizedTrack, beach: { lat, lon, swellWindowCenterDeg }, truth: { waves: number | null, note: string } }`.
  - Every lat/lon is offset by `+0.31` (lat) and `-0.47` (lon), beach included.
  - Timestamps are unchanged.

- [ ] **Step 1: Write the script.** `node scripts/session-tracks/make-track-fixture.mjs <in.fit> <out.json> <beachLat> <beachLon> <swellWindowCenterDeg> <truthWaves|null> "<note>"`. It uses `@garmin/fitsdk` directly and must not import TypeScript.
- [ ] **Step 2: Generate the two fixtures** from `/Users/stevenchandler/Desktop/dev/.quiver/reviews/garmin-surf-competitors-20261016/fixtures/`.
  - Read each beach's real `lat`, `lon` and `swell_window_center_deg` from the local snapshot (`beaches` rows "Ocean Beach" and "Pipes").
  - Truth: OB `3`, with the note "3 waves, 1 good ride ~09:04 PT"; Cardiff `null`, with the note "Steven: ~8 seemed right; swim-mode smoothed".
- [ ] **Step 3: Check that no real coordinate survives.** `node -e` loads each JSON and asserts every `lat` is more than 0.3 from the real beach lat.
- [ ] **Step 4: Commit** with `test(sessions): add offset real-surf track fixtures`.

### Task 5: Track summary

**Files:**
- Create: `lib/sessions/tracks/track-geometry.ts`, `lib/sessions/tracks/summarize-track.ts`
- Test: `__tests__/lib/sessions/tracks/summarize-track.test.ts`

**Interfaces:**
- **Consumes:** `NormalizedTrack` (Task 3).
- **Produces:**
  ```ts
  export function haversineM(a: {lat:number;lon:number}, b: {lat:number;lon:number}): number
  export function bearingDeg(a: {lat:number;lon:number}, b: {lat:number;lon:number}): number
  export function angleDiffDeg(a: number, b: number): number   // 0..180
  export type TrackSummary = { inWaterStart: string; inWaterEnd: string; centroid: {lat:number;lon:number};
    gpsCoverage: number; maxGapS: number; sampleCount: number; waterTempC: number | null;
    speedReliable: boolean; trackGeojson: { type: "LineString"; coordinates: [number, number][] };
    speedSeries: { t: string; mps: number }[] };
  export function summarizeTrack(track: NormalizedTrack, keepWindows?: { start: string; end: string }[]): TrackSummary
  ```
- **Rules:**
  - In-water span is the first to the last fix more than 40 m from both the first and the last fix.
  - Coverage is the fraction of whole seconds in the span with a fix.
  - The centroid is the median lat and lon of fixes in the span, excluding the first and last 180 s.
  - Water temp is the median `tempC` of the second half of the span.
  - `speedReliable = !(sport === "swimming" && subSport === "open_water")`.
  - GeoJSON keeps one fix per 5 s, plus every fix inside `keepWindows`.
  - The speed series is the median speed per 5 s bucket.

- [ ] **Step 1: Write the failing tests**
  - On the OB fixture: `gpsCoverage` is between 0.40 and 0.55, `maxGapS >= 100`, `speedReliable === true`, and `waterTempC === 22`.
  - On the Cardiff fixture: `speedReliable === false`.
  - On a synthetic track that starts and ends on the same sand point: `inWaterStart` is later than the first sample.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): summarize tracks (in-water span, coverage, temp, display geometry)`.

### Task 6: Wave detector v1

**Files:**
- Create: `lib/sessions/wave-detection/constants.ts`, `lib/sessions/wave-detection/detect-waves.ts`
- Test: `__tests__/lib/sessions/wave-detection/detect-waves.test.ts`

**Interfaces:**
- **Consumes:** `NormalizedTrack`, `TrackSummary`, and the geometry helpers (Tasks 3 and 5).
- **Produces:**
  ```ts
  export const WAVE_DETECTION_VERSION = "wd-1.0.0";
  export type DetectedWave = { index: number; startedAt: string; endedAt: string; durationS: number; distanceM: number;
    maxSpeedMps: number | null; avgSpeedMps: number | null; start: {lat:number;lon:number}; end: {lat:number;lon:number};
    headingDeg: number | null; confidence: number };
  export type DetectionBeach = { lat: number; lon: number; swellWindowCenterDeg: number | null };
  export function detectWaves(track: NormalizedTrack, summary: TrackSummary, beach: DetectionBeach): DetectedWave[]
  ```
- **Constants (starting values from the spec):**
  - `MAX_FIX_JUMP_MPS = 12`
  - `GAP_S = 5`
  - `RIDE_START_MPS = 2.5`, `RIDE_START_HOLD_S = 3`
  - `RIDE_END_MPS = 1.5`, `RIDE_END_HOLD_S = 2`
  - `RIDE_KEEP_PEAK_MPS = 3.6`, `RIDE_KEEP_DURATION_S = 6`
  - `SHOREWARD_TOLERANCE_DEG = 100`, `OFF_SHOREWARD_FACTOR = 0.3`
  - `COUNT_MIN_CONFIDENCE = 0.5`
- **Shoreward** is `(swellWindowCenterDeg + 180) % 360`. Without it, use `bearingDeg(summary.centroid, beach)`.
- **Speed** is the 3-sample median of `speedMps` when present, else position delta over time.
- **Confidence:**
  - base 0.7, +0.2 when peak ≥ 3.6 m/s and duration ≥ 6 s;
  - +0.1 when cadence shows paddling (above 10 /min on average) in the 10 s before and drops to at most 5 during the ride;
  - × 0.3 off-shoreward;
  - clamp to [0, 1].
- Candidates outside the in-water span are dropped. A ride never spans a gap longer than `GAP_S`.

- [ ] **Step 1: Write the failing tests**
  - OB fixture: `detectWaves(...).filter(w => w.confidence >= 0.5)` has length between 2 and 4, and one wave starts within 10 s of `2026-10-17T16:04:17Z` with `maxSpeedMps > 4.4`.
  - Cardiff fixture: the counted waves number between 5 and 9.
  - Synthetic 1 Hz track, 30 min, with 4 injected shoreward rides (8 s at 4.5 m/s, preceded by 10 s of cadence 30): exactly 4 waves, each start and end within ±2 s.
  - Same track with a 110 s gap starting mid-ride: no wave crosses the gap.
  - Beach with `swellWindowCenterDeg: null` and only sand fixes: returns `[]` without throwing.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** If the fixtures need different thresholds, change only `constants.ts` and record the final values and fixture counts in the PR description.
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): wave detection v1 with gap handling and shoreward confidence`.

### Task 7: Corrections-aware summary and per-wave tide

**Files:**
- Create: `lib/sessions/waves/waves-summary.ts`, `lib/sessions/waves/wave-tides.ts`
- Test: `__tests__/lib/sessions/waves/waves-summary.test.ts`, `__tests__/lib/sessions/waves/wave-tides.test.ts`

**Interfaces:**
- **Consumes:** `DetectedWave` shape (as stored rows), `interpolateTideHeight` from `lib/utils/tide-interpolation.ts`, and `fetchCachedHourlyTidePredictions(supabase, beachId, startIso, endIso)` from `lib/services/noaa-tide-service.ts`.
- **Produces:**
  ```ts
  export type StoredWave = DetectedWave & { id: string };
  export type Correction = { startedAt: string; endedAt: string };
  export function isExcluded(wave: StoredWave, corrections: Correction[]): boolean   // overlap ≥ 50% of the wave
  export type WavesSummary = { waveCount: number; detectedWaveCount: number; userWaveCount: number | null;
    longestRideS: number | null; longestRideM: number | null; topSpeedMps: number | null;
    gpsCoverage: number; lowCoverage: boolean; speedReliable: boolean; detectionVersion: string };
  export function buildWavesSummary(waves: StoredWave[], corrections: Correction[], track: { gpsCoverage: number; speedReliable: boolean; userWaveCount: number | null }, version: string): WavesSummary
  export function tideFtAtWaves(supabase: SupabaseClient, beachId: string, waves: StoredWave[]): Promise<Map<string, number | null>>
  ```
- **Summary rules:**
  - `detectedWaveCount` counts non-excluded waves with confidence ≥ 0.5.
  - `waveCount = userWaveCount ?? detectedWaveCount`.
  - `topSpeedMps` is null when `!speedReliable`.
  - `lowCoverage = gpsCoverage < 0.5`.
- **Tide:** fetch from 1 h before the first wave to 1 h after the last. A null result returns null per wave.

- [ ] **Step 1: Write the failing tests** (exclusion at exactly 50% overlap counts; `userWaveCount` overrides the headline; speed is hidden when unreliable; tide is interpolated between two hourly points and null when there are no predictions).
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): waves summary with user corrections and per-wave tide`.

### Task 8: Beach resolution and attach target

**Files:**
- Create: `lib/sessions/imports/resolve-import-beach.ts`, `lib/sessions/imports/find-attach-target.ts`
- Test: `__tests__/lib/sessions/imports/resolve-and-attach.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export type ImportBeach = { id: string; name: string; lat: number; lon: number; swellWindowCenterDeg: number | null };
  export type BeachResolution = { status: "resolved"; beach: ImportBeach } | { status: "needs_beach"; candidates: ImportBeach[] };
  export function resolveImportBeach(supabase: SupabaseClient, centroid: {lat:number;lon:number}): Promise<BeachResolution>
  export function loadImportBeach(supabase: SupabaseClient, beachId: string): Promise<ImportBeach | null>
  export function findAttachTarget(supabase: SupabaseClient, userId: string, beach: ImportBeach, inWaterStart: string):
    Promise<{ sessionId: string; hasTrack: boolean } | null>
  ```
- **RPC call:** `supabase.rpc("get_nearby_beaches", { input_lat, input_lng, max_distance_meters: 3000, limit_count: 3 })`, then load `swell_window_center_deg` for the chosen ids. With no rows, the result is `needs_beach` with `candidates: []` (the UI then offers beach search).
- **Attach query:** same `user_id`, `deleted_at is null`, `arrival_time` between start −90 min and start +90 min, and `beach_id = beach.id` or the beach lat/lon within 3 km. Order by absolute time difference, then `limit 1`. `hasTrack` comes from `session_tracks`.

- [ ] **Step 1: Write the failing tests** with a mocked `rpc` and `from` (patterns from `__tests__/setup/supabase-mock.ts`): resolves the first row; returns `needs_beach` on empty; picks the closer of two matching sessions; ignores deleted ones; reports `hasTrack`.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): resolve import beach and find a session to attach to`.

### Task 9: Import pipeline and routes, behind the flag

**Files:**
- Create: `lib/flags/session-imports.ts`, `lib/sessions/imports/process-import.ts`, `app/api/v1/session-imports/route.ts`, `app/api/v1/session-imports/[id]/process/route.ts`, `app/api/v1/session-imports/[id]/beach/route.ts`
- Modify: `lib/analytics/session-created.ts` (add `"web-file-import"` to `SessionCreatedSource` and the surface union, plus optional `metadata?: Record<string, unknown>` merged into the event metadata)
- Test: `lib/flags/__tests__/session-imports.test.ts`, `__tests__/api/session-imports/session-imports.test.ts`, `__tests__/lib/sessions/imports/process-import.test.ts`

**Interfaces:**
- **Consumes:** Tasks 3, 5, 6, 7 and 8, plus `createServiceRoleClient` (the same import as `app/api/sessions/[id]/videos/[mediaId]/route.ts`).
- **Produces:**
  ```ts
  export function isSessionImportsEnabled(): boolean; export function isSessionImportsUserAllowed(userId: string): boolean  // swell-outlook pattern
  export type ProcessImportResult =
    | { status: "completed"; sessionId: string; attached: boolean; summary: WavesSummary }
    | { status: "needs_beach"; importId: string; candidates: ImportBeach[] }
    | { status: "duplicate"; sessionId: string };
  export function processImport(deps: { userClient: SupabaseClient; serviceClient: SupabaseClient; now: Date }, importId: string, userId: string, beachOverride?: string): Promise<ProcessImportResult>  // throws TrackFileError
  export function persistDetection(serviceClient: SupabaseClient, sessionId: string, userId: string, track: NormalizedTrack, summary: TrackSummary, beach: ImportBeach): Promise<void>  // Task 10 reuses it for redetect
  ```
- **Routes** (all `export const runtime = "nodejs"`, `withNoStore(withRateLimit(withAuth(handler,{errorMessage}), "authenticated-default"))`, 404 when the flag is off for the user):
  - **`POST /api/v1/session-imports`** `{ filename: string }` (1–200 chars):
    - inserts an `uploaded` import;
    - returns 201 `{ importId, uploadPath: "${importId}/${userId}/${safeFilename}" }`.
  - **`POST /api/v1/session-imports/{id}/process`:**
    - checks ownership of the import;
    - downloads with the service client;
    - computes sha256;
    - then calls `processImport`.
    - Responses: 200 `completed`, 202 `needs_beach`, 409 `duplicate` with the existing `sessionId`, 422 `{ error: TrackFileError.code }`.
  - **`POST /api/v1/session-imports/{id}/beach`** `{ beachId: uuid }`: re-runs `processImport` with `beachOverride`. Only valid when the status is `needs_beach`, else 409.
- **`processImport` order:**
  1. Read and parse.
  2. Summarize.
  3. Resolve the beach (or use `beachOverride`). Store `summary` jsonb on `needs_beach`.
  4. Find the attach target. With `hasTrack`, the result is `duplicate`.
  5. Sha256 duplicate check:
     - an existing completed import with the same `(user_id, sha256)` whose session is not deleted → `duplicate`;
     - if its session is deleted → re-link that import row instead of inserting.
  6. Attach (update `arrival_time` and `duration_minutes`, `status='completed'` when `planned`, keep the old values on the track row) or insert the session (Global Constraints values) with the user client.
  7. `persistDetection`: insert `session_tracks` and the current `session_waves` with the service client.
  8. Fill `water_temp` and `water_temp_source` if null.
  9. Mark the import `completed` with `session_id`.
  10. Emit `session_created` with `source: "web-file-import"`, `surface: "web-file-import"`, metadata `{ is_historical, wave_count, gps_coverage, format, recorded_by_family }`, only when a new session was inserted.
- **On `TrackFileError`:** mark the import `failed` with `error`, and insert a `user_events` `session_import_failed` row with `{ code }`.

- [ ] **Step 1: Write the failing flag tests** (empty allowlist means nobody; a listed id is allowed).
- [ ] **Step 2: Write the failing `processImport` tests** with fixture bytes and mocked clients:
  - the OB fixture inserts a session with `is_public:false`, `source:'file_import'`, `status:'completed'`, and stores 2–4 waves;
  - an existing session 60 min away gets attached, its `arrival_time` is updated, and `user_arrival_time` is preserved;
  - the same sha twice gives `duplicate`;
  - the same sha after a soft delete re-links the import;
  - a no-GPS file gives `TrackFileError("no_gps")` and the import is `failed`;
  - an empty RPC gives `needs_beach` and nothing is inserted.
- [ ] **Step 3: Write the failing route tests:** 404 when the flag is off; 201 shape for create; 409 and 422 mapping for process; 409 for `/beach` when not `needs_beach`.
- [ ] **Step 4: Run them.** `npm run test:unit -- lib/flags/__tests__/session-imports.test.ts __tests__/lib/sessions/imports/process-import.test.ts __tests__/api/session-imports/session-imports.test.ts`. Expected: FAIL.
- [ ] **Step 5: Implement.**
- [ ] **Step 6: Run them again, plus `yarn typecheck`.** Expected: PASS.
- [ ] **Step 7: Commit** with `feat(sessions): FIT/GPX import pipeline and routes behind SESSION_IMPORTS flag`.

### Task 10: Waves read, correction and redetect API

**Files:**
- Create: `app/api/v1/sessions/[id]/waves/route.ts`, `app/api/v1/sessions/[id]/waves/[waveId]/route.ts`, `app/api/v1/sessions/[id]/redetect/route.ts`
- Test: `__tests__/api/sessions/session-waves.test.ts`

**Interfaces:**
- **Consumes:** Tasks 7 and 9 (`buildWavesSummary`, `tideFtAtWaves`, `persistDetection`, flag).
- **Produces (the contract the native plan relies on; additive and versioned under `/api/v1`):**
  ```ts
  // GET /api/v1/sessions/{id}/waves -> 200 createSuccessResponse(data) | 404 (flag off, not owner, no track, session deleted)
  type SessionWavesResponse = {
    summary: WavesSummary;
    waves: { id: string; index: number; startedAt: string; endedAt: string; durationS: number; distanceM: number;
      maxSpeedMps: number | null; avgSpeedMps: number | null; headingDeg: number | null; confidence: number;
      excluded: boolean; tideFt: number | null; start: {lat:number;lon:number}; end: {lat:number;lon:number} }[];
    track: { type: "LineString"; coordinates: [number, number][] };   // [lon, lat]
    speedSeries: { t: string; mps: number }[];
    recordedBy: string | null;
  };
  // PATCH /api/v1/sessions/{id}/waves  { userWaveCount: number | null } (0..200) -> 200 { summary }
  // PATCH /api/v1/sessions/{id}/waves/{waveId}  { excluded: boolean } -> 200 { summary }
  // POST  /api/v1/sessions/{id}/redetect  (admin only: profiles.is_admin) -> 200 { detectionVersion, waveCount }
  ```
- `maxSpeedMps` and `avgSpeedMps` are null in each wave when `!speedReliable`.
- PATCH `excluded:true` inserts a correction spanning the wave. `false` deletes corrections overlapping it.
- `userWaveCount` updates `session_tracks` through the service client after the ownership check, and emits `session_wave_count_reported`.
- Excluding a wave emits `session_wave_excluded`.
- `redetect` re-downloads the file, re-runs detection and inserts a new version with `is_current=true`, after flipping the previous rows to false.

- [ ] **Step 1: Write the failing route tests:**
  - GET returns the shape, with `excluded` true for an overlapped wave and `summary.waveCount` equal to `userWaveCount` when set;
  - 404 for a non-owner, and for a soft-deleted session;
  - PATCH validation 400 on `userWaveCount: 201`;
  - redetect 403 for a non-admin.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, plus `yarn typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): waves API with corrections, user count and admin redetect`.

### Task 11: Open-Meteo hindcast in the conditions job

**Files:**
- Create: `lib/services/open-meteo-hindcast.ts`
- Modify: `lib/sessions/session-conditions.ts` (`SessionConditionsSource` gains `"hindcast_open_meteo"`), `lib/sessions/session-conditions-enrich.ts`, `app/api/cron/session-conditions-enrich/route.ts`
- Test: `__tests__/lib/services/open-meteo-hindcast.test.ts`, `__tests__/lib/sessions/session-conditions-enrich-hindcast.test.ts`

**Interfaces:**
- **Produces:**
  ```ts
  export type HindcastHour = { at: string; waveHeightM: number | null; swellHeightM: number | null; swellPeriodS: number | null;
    swellDirectionDeg: number | null; windSpeedMph: number | null; windDirectionDeg: number | null };
  export function fetchOpenMeteoHindcastDay(lat: number, lon: number, dateUtc: string, fetchImpl?: typeof fetch): Promise<HindcastHour[] | null>
  export function hindcastToConditionsRow(hour: HindcastHour): SessionConditionsRow
  ```
- **Endpoints:**
  - `https://marine-api.open-meteo.com/v1/marine?latitude&longitude&hourly=wave_height,swell_wave_height,swell_wave_period,swell_wave_direction&start_date=D&end_date=D&timezone=UTC`
  - `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude&longitude&hourly=wind_speed_10m,wind_direction_10m&wind_speed_unit=mph&start_date=D&end_date=D&timezone=UTC`
  - 10 s timeout each.
  - Returns null on any HTTP or parse failure, or when both hourly arrays are missing.
- `hindcastToConditionsRow` fills exactly the fields `resolveSessionConditions` reads from a forecast row, in the same units `enhanced_forecasts` stores (read `pickForecastRowAtOrBefore` and `resolveSessionConditions` and copy the field set). `resolveSessionConditions(row, window, "hindcast_open_meteo")` then produces the groups.
- **Enrich changes:**
  - `EnrichOptions` gains `hindcast?: { fetchDay: typeof fetchOpenMeteoHindcastDay }` and `retryNone?: boolean`.
  - In `resolveConditions`, when there's no forecast row and no snapshot and `hindcast` is set, fetch the beach-day once (cache per `beachId+date` within a run) and take the hour at or before `arrival_time`.
  - **When the hindcast is null, return without writing.** No `'none'`.
  - `listPendingSessions` in backfill mode with `retryNone` also selects `conditions_source = 'none'`.
  - `updateSession` may overwrite `conditions_source` only when it is currently `'none'`. All other columns keep the null-only guard.
  - The cron passes `hindcast: { fetchDay: fetchOpenMeteoHindcastDay }` in both modes, and `retryNone: true` when `?retryNone=1` in backfill mode.

- [ ] **Step 1: Write the failing tests:**
  - `fetchOpenMeteoHindcastDay` with a mocked fetch parses 24 hours;
  - it returns null on 500;
  - enrich with no forecast row and a hindcast hour writes the swell and wind groups with `conditions_source: 'hindcast_open_meteo'` and `conditions_forecast_at` = that hour;
  - with a null hindcast, `updateSession` is not called;
  - a `'none'` session is picked up only when `retryNone` is set;
  - the cache makes one fetch for two sessions at the same beach on the same date.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run these and the existing tests:** `npm run test:unit -- __tests__/lib/sessions/session-conditions __tests__/lib/services/open-meteo-hindcast.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): Open-Meteo hindcast fallback for session conditions`.

### Task 12: Track purge job

**Files:**
- Create: `app/api/cron/session-tracks-purge/route.ts`
- Modify: `vercel.json` (schedule `40 9 * * *`)
- Test: `__tests__/api/cron/session-tracks-purge.test.ts`

**Interfaces:**
- **Consumes:** `validateCronRequest` and the cron wrappers used by `app/api/cron/session-conditions-enrich/route.ts`.
- **Behavior:** selects `session_tracks` rows whose session has `deleted_at < now() - interval '30 days'` or whose `purge_requested_at` is set, and `session_imports` with `purge_requested_at` set or (`status` in (`uploaded`,`failed`,`needs_beach`) and `created_at < now() - 30 days`). For each, in batches of 100:
  1. remove the storage object from `session-tracks`;
  2. delete the waves and corrections for the session;
  3. delete the track row;
  4. delete the import row.

  Returns `{ purgedTracks, purgedImports, errors }`.

- [ ] **Step 1: Write the failing test:** a 31-day-old deleted session is purged; a 29-day-old one is not; account purge requests are purged immediately; a storage error is counted and the rows are kept.
- [ ] **Step 2: Run it.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): purge deleted session tracks after 30 days`.

### Task 13: Waves section on the web session page

**Files:**
- Create: `components/sessions/waves/session-waves-section.tsx`, `components/sessions/waves/session-ride-map.tsx`, `components/sessions/waves/speed-timeline.tsx`, `hooks/use-session-waves.ts`
- Modify: `components/session-detail-view.tsx` (insert `<SessionWavesSection sessionId={id} />` between the stat-grid close, about L637, and `{/* Forecast Comparison */}`, about L639)
- Test: `__tests__/components/sessions/session-waves-section.test.tsx`

**Interfaces:**
- **Consumes:** the Task 10 contract (`GET`/`PATCH /api/v1/sessions/{id}/waves`, `PATCH …/waves/{waveId}`).
- **Produces:** `useSessionWaves(sessionId: string): { data: SessionWavesResponse | null; isLoading: boolean; refresh: () => void }`, using the `useDataFetcher` pattern. A 404 resolves to `data: null` and the section renders nothing.
- **Content:**
  - **Stat tiles:** "Waves" (`summary.waveCount`, plus "You: N · Quiver found M" when `userWaveCount` differs), "Longest ride" (s and m), "Top speed" (mph, hidden when `!speedReliable`).
  - **Coverage warning** when `lowCoverage`: "GPS dropped out for much of this surf, so the count may be low."
  - **Ride map:**
    - `mapbox-gl`: the track line in ink at 0.5 opacity, each non-excluded wave line in Charming Orange;
    - fit bounds to the track;
    - `NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN`;
    - honor `prefers-reduced-motion` (no fly animation).
  - **Speed timeline:** inline SVG of `speedSeries` (mph) with wave spans shaded. Omitted when `!speedReliable`.
  - **Per-wave list:** time (local), duration, distance, top speed, tide ft, and a "Not a wave" / "Undo" toggle.
  - **"How many did you catch?"** number input, 0–200, saved on blur.
  - **Analytics:** `session_waves_viewed` (through the existing client event path in `lib/analytics`) on first render with data.
  - **Styling:** the `components/zine/` primitives and `docs/STYLE_GUIDE.md`.

- [ ] **Step 1: Write the failing tests** (mock `fetch`; mock `mapbox-gl` the way existing map component tests do):
  - renders the tile values from a fixture response;
  - hides top speed when `speedReliable:false`;
  - shows the coverage copy when `lowCoverage`;
  - "Not a wave" PATCHes `/api/v1/sessions/s1/waves/w1` with `{excluded:true}` and re-renders the count;
  - renders nothing on 404.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, plus scoped eslint on the changed files.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): waves section with ride map, speed timeline and corrections`.

### Task 14: Upload flow on /sessions

**Files:**
- Create: `components/sessions/import/upload-surf-button.tsx`, `components/sessions/import/import-beach-picker.tsx`, `hooks/use-session-import.ts`
- Modify: `app/sessions/page.tsx` (render `UploadSurfButton` beside the existing `log-session-btn` at about L386–398 when `user && !isLoading` and the flag is on for the user; add a waves badge on items that have a track)
- Modify: `app/api/users/[id]/sessions/route.ts` (additively include `has_track: boolean` per item for the owner)
- Test: `__tests__/components/sessions/upload-surf-button.test.tsx`

**Interfaces:**
- **Consumes:** the Task 9 routes. The browser Supabase client storage upload goes to bucket `session-tracks` at `uploadPath`.
- **Produces:** `useSessionImport(): { start: (file: File) => Promise<void>; state: { phase: "idle"|"uploading"|"processing"|"needs_beach"|"done"|"error"; sessionId?: string; candidates?: ImportBeach[]; error?: string; attached?: boolean } ; chooseBeach: (beachId: string) => Promise<void> }`
- **Flag exposure:** a small server-rendered prop or an existing user-flags endpoint, following how `/sessions` gates other features. Hide the button entirely when the flag is off.
- **Copy:**
  - **Button:** "Upload a surf (FIT or GPX)".
  - **Help line:** "From Garmin Connect on the web: open the activity, then the gear menu › Export File."
  - **Done:** "Added N waves to your Oct 17 session at Pipes" (attached) or "New session at Pipes: N waves". Then navigate to `/sessions/{id}`.
  - **Errors by code:** `no_gps`: "This file has no GPS track." `bad_time`: "This file's date looks wrong." `unsupported_format`: "Upload a .fit, .gpx or Garmin .zip file." Duplicate: "You've already uploaded this surf" with a link.
- **`needs_beach`:** the picker lists `candidates` and falls back to the existing beach search component used by `/sessions/new`.

- [ ] **Step 1: Write the failing tests** (mock `fetch` and the storage upload): the happy path navigates to the session; 202 shows the picker and choosing calls `/beach`; 422 `no_gps` shows its copy; the button is hidden when the flag is off.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run them, plus `yarn typecheck`.** Expected: PASS.
- [ ] **Step 5: Commit** with `feat(sessions): upload a surf file from the sessions page`.

### Task 15: Release gate and pool entry

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/.quiver/ops/RELEASE-POOL.md` (workspace file, outside the repo)

- [ ] **Step 1: Run the full gate:** `npm run test:unit`, `yarn typecheck`, `NODE_OPTIONS="--max-old-space-size=8192" yarn lint`, `yarn deadcode`, `VERCEL_ENV=preview yarn build`. Expected: all pass. Record any pre-existing failure verbatim in the PR.
- [ ] **Step 2: Add one hold line to RELEASE-POOL.md:**

  > session waves (#PR): hold until Steven approves applying `20261018090000_session_waves_core.sql` and `20261018090100_session_waves_triggers.sql` to the shared DB; then set `SESSION_IMPORTS_ENABLED=true` and `SESSION_IMPORTS_USER_ALLOWLIST=<Steven's two user ids>` on prod; flag off for everyone else.

- [ ] **Step 3: Push the branch and open the PR.**
  - Run `/code-review high` first, because the change touches `supabase/migrations` and forecast conditions. Fix confirmed findings.
  - Then enable Auto-fix and squash auto-merge.
