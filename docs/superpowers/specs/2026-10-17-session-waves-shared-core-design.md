# Surf sessions with waves: shared core design

- **Date:** 2026-10-17
- **Status:** Steven's answers incorporated (Oct 17); ready for his review
- **Scope:** Part 1 of 4. The later parts (Garmin watch app, Apple Watch app, then Strava, progress and boards) get their own designs.
- **Repos:** `quiver` (database, API, server detection, web UI) and `quiver-native` (session view)

## Why

Surfers want three things back from a session: how many waves they caught, how fast and how long they rode, and what the swell, wind and tide were doing at the time. Quiver already attaches conditions to logged sessions. What it lacks is the session's own movement data.

Watches record that movement, but on Garmin the existing apps fail. On Steven's Forerunner 165:

- BreakFinder crashed on launch.
- Surfilog crashed and never saved.
- Dawn Patrol recorded a session but wrote no wave data into the file.
- The surf apps on the Connect IQ store mostly have angry reviews about wave counts.
- No app ties each wave to the conditions it was ridden in.

Garmin has paused new cloud API approvals with no timeline (ticket 229566), so pulling activities from Garmin's servers isn't possible.

This part builds the brain every recording source will share:

- a session can carry waves and a GPS track;
- the server finds the waves;
- surfers see their waves with conditions on web and phone.

The first way in is uploading a FIT or GPX file. Every watch can export one, and it works today. Watch apps come later and feed the same pipeline.

## Evidence this design rests on

Full research is in `.quiver/reviews/garmin-surf-competitors-20261016/` in the workspace, outside this repo.

- **Swim mode smooths the track away.** Steven has 36 surfs recorded in Garmin's Open Water Swim mode. Speeds cap at 6–9 mph and rides look like 8–50 m blips, so ride speed can't be recovered. Rough wave counts are still possible, using speed bursts toward shore while paddle cadence drops to zero.
- **Non-swim recording keeps real speeds, but GPS drops out.** Dawn Patrol records as sport `surfing` at 1 Hz with no smoothing; max speed was 10.7 mph on Oct 17. But only 48% of seconds had a GPS fix, with 87 dropouts over 5 s and the longest 110 s. Ground truth that day: 3 waves, 1 good ride. Simple thresholds found 3 candidates, including the good ride: 9:04, toward shore, 10.7 mph, about 33 m.
- **Water temperature is usable.** Across 13 surfs, the wrist reading was within 0.72 °C of the nearest buoy (mean −0.28 °C). FIT stores whole °C.
- **Everyone serious re-counts on a server or phone after the watch,** and lets the user correct the count. BreakFinder keeps a device count and an estimated count plus a correction mode. Surfilog re-detects on its server and works out which way the shore is. Surftrail re-runs detection on the phone.

## Goals

1. A session can hold an ordered list of waves and a stored GPS track, alongside everything sessions already hold (beach, board, rating, notes, media, conditions).
2. Uploading a FIT or GPX file creates a session at the nearest Quiver beach, or attaches to an existing one, with waves found on the server.
3. Wave detection is a pure, versioned and tested server module that copes with GPS dropouts. It can be re-run over stored tracks when it improves.
4. The session view on web and native shows:
   - wave count, longest ride and top speed;
   - a ride map, with each wave drawn on the track;
   - a speed timeline;
   - a per-wave list;
   - conditions at the time of each wave.
5. Surfers can correct detection: remove a false wave, or say how many they actually caught. Corrections are stored, so accuracy can be measured.
6. The design accepts later sources (Garmin watch app, Apple Watch app, Strava) without schema changes beyond new `source` values and device tables.

## Non-goals (this part)

- Building any watch app, Garmin pairing, or the devices page. Those are parts 2 and 3.
- Strava import, progress charts, boards analytics.
- Showing tracks or waves on public sessions or the community feed.
- Estimating wave height from ride speed (the "layer 2" swell analysis). The design keeps the raw track so this can come later.
- Live or real-time anything.

## Anti-goals

These would make it a failure even if it technically works:

- **A confident-looking wave count that's wrong.** Counts must carry a confidence, and the UI must say when GPS coverage was too poor to trust them (*Trust beats hype*).
- **Exposing a surfer's precise GPS track** to anyone but them.
- **Duplicate sessions** when someone logs by hand and also uploads the same surf.
- **Breaking installed native builds** by changing an existing API contract in place.

## Constraints

- **`soul.md` applies:**
  - Native writes go through API routes (or the existing PostgREST outbox), never server actions.
  - Mobile-consumed contracts change additively only.
  - RLS on every user-data table.
  - Migrations go in `supabase/migrations/` inside `BEGIN; … COMMIT;`.
  - The production database is read-only by default.
- **The database is shared between prod and dev, and migrations aren't applied automatically.** Applying them needs Steven's approval.
- **`sessions` facts:**
  - `user_id` and `beach_id` are NOT NULL, so a session can't exist without a beach.
  - `status` defaults to `'planned'`, `duration_minutes` defaults to 60, and `is_public` defaults to **true**.
  - `conditions_queued_at` defaults to `now()`, so every new row is queued for the hourly conditions job automatically.
  - Insert triggers fill tide and rip-current risk.
  - The forecast-snapshot trigger runs `sync_session_wave_observation_candidate`, which needs `status='completed'` and a `wave_height_ft`.
- **`sessions_source_check` allows:** NULL, `manual`, `auto_title`, `conditions_report`, `email_one_tap`, `maestro_smoke`. `20260718140000_preserve_session_source_check.sql` shows how to add values without clobbering the live expression.
- **Native today:**
  - It reads sessions directly from Supabase (`useSession`, `useUserSessions`).
  - It creates them through the PostgREST outbox.
  - It edits them through `PATCH /api/sessions/[id]`.
  - It has no document picker and no map line layer (`@rnmapbox/maps` 10.3.5 is installed; only circle markers exist).
- **Web today:**
  - `GET /api/sessions/[id]` is owner-only.
  - `components/session-detail-view.tsx` shows a static Mapbox image of the beach.
  - Interactive maps use `mapbox-gl`.
  - No FIT library is installed. `fast-xml-parser` is.
- **Storage:** follow the `session-videos` pattern.
  - It's a private bucket with RLS on `(storage.foldername(name))[2] = auth.uid()`.
  - The client uploads directly to storage, then a JSON call finalizes.
  - Signed URLs come from the service role.
  - The `session-media` bucket and table expose media from public sessions, so tracks must not go there.

## Decisions already made (Steven, Oct 16–17)

1. **One session model.** Watch, upload and hand-logged surfs are all `sessions` rows. Extra detail lives beside them, and the `source` field says where each came from.
2. **Order:** this shared core first, then the Garmin watch app, then the Apple Watch app, then Strava, progress and boards.
3. **Web gets parity with native for sessions,** including a place where imported and watch sessions land.
4. **Wave counting happens on the server** and is the same for every source.

## Design

### Data model (new migration)

- **`sessions.source`:** add `'file_import'` to `sessions_source_check`, using the preserve-and-append pattern. `garmin_watch` and `apple_watch` get added in their own parts.
- **`session_tracks`:** one row per session that has movement data.
  - **Columns:**
    - `session_id` (PK, FK to sessions, on delete cascade)
    - `user_id`
    - `storage_path` for the original file in a private bucket
    - `format` (`fit` | `gpx`)
    - `sha256`, unique per user, for dedupe
    - `recorded_by` (text, e.g. `"Garmin Forerunner 165 / Dawn Patrol"`, from FIT file_id, device_info and developer_data_id)
    - `started_at`, `ended_at`
    - `sample_count`
    - `gps_coverage` (0–1)
    - `max_gap_s`
    - `sport`, `sub_sport` (from FIT)
    - `speed_reliable` (false for `swimming/open_water`)
    - `user_wave_count` (nullable int: the surfer's own count, never overwritten by detection)
    - `timing_from_track` (bool), plus `user_arrival_time` / `user_duration_minutes` holding the session's previous values when an import attached to an existing session
    - `track_geojson` (downsampled LineString for display, about 1 point per 5 s, plus every point inside a wave)
    - `created_at`
  - **RLS:** owner select. Only the service role inserts and updates, through the API; owners update only `user_wave_count`, through the API.
- **`session_waves`:** one row per detected wave.
  - **Columns:**
    - `id`, `session_id`, `user_id`
    - `wave_index`
    - `started_at`, `ended_at`
    - `duration_s`, `distance_m`, `max_speed_mps`, `avg_speed_mps`
    - `start_lat`, `start_lon`, `end_lat`, `end_lon` (using `lat`/`lon` naming)
    - `heading_deg`
    - `confidence` (0–1)
    - `detection_version`
    - `is_current` (bool; only the latest version's rows are current)
    - `created_at`
  - Unique on `(session_id, detection_version, wave_index)`. Re-detection inserts a new version and flips `is_current`. Older versions are kept so accuracy can be compared across versions.
  - **RLS:** owner select only. Writes go through the service role.
- **`session_wave_corrections`:**
  - **Columns:** `id`, `session_id`, `user_id`, `started_at`, `ended_at` (the wave the user marked), `action` (`exclude`), `created_at`.
  - Corrections are stored by time, not wave id, so they survive re-detection. A current wave counts as excluded when it overlaps a correction by at least 50%.
  - **RLS:** owner select, insert and delete.
- **Session summary columns:** the summary (wave count, longest ride, top speed) is not added to `sessions` in this part. It's computed from `session_waves` in the API, so the label, value and detection version always come from the same detection run.
- **`sessions.water_temp`** already exists. Fill it from the track only when it's null, and add `water_temp_source` (`user` | `watch` | null), so the value and where it came from stay together.
- **`session_imports`:** an upload's lifecycle. Unique on `(user_id, sha256)`. Re-importing a file whose session was deleted re-links the existing import row to the new session instead of failing.
  - **Columns:**
    - `id`, `user_id`
    - `storage_path`, `sha256`
    - `status` (`uploaded` | `needs_beach` | `completed` | `failed`)
    - `error`
    - `session_id` (nullable)
    - `summary` (jsonb parse result, so a needs-beach import can finish without re-parsing)
    - `created_at`, `updated_at`
  - **RLS:** owner only.
- **Storage bucket `session-tracks`:** private, about a 10 MB limit, MIME types `application/octet-stream` (FIT), `application/gpx+xml` / `text/xml` and `application/zip`. Garmin Connect's "Export File" gives a ZIP containing `<id>_ACTIVITY.fit`, so ZIPs are unpacked server-side with a small zip library. Path is `{importId}/{userId}/{filename}`, with insert and select RLS on folder[2] = uid, mirroring `session-videos`.

Leave the July `garmin_accounts` and `garmin_session_candidates` tables alone. They belong to the paused cloud-API route. Whether to drop them is a separate decision.

### Ingest flow (file upload)

1. The client creates an import with `POST /api/v1/session-imports` (`withAuth`, rate-limited). It gets back `{importId, uploadPath}`.
2. The client uploads the file straight to `session-tracks/{importId}/{userId}/…` with its own JWT. This avoids function body-size limits and matches how video uploads work.
3. The client calls `POST /api/v1/session-imports/{id}/process`. The server:
   - downloads the file with the service role;
   - checks size, type and sha256, and rejects a file the user already imported, pointing to the existing session;
   - parses it into a normalized track: samples of `{t, lat?, lon?, speed_mps?, hr?, temp_c?, cadence?}` plus metadata (sport and sub-sport, device, app, start and end);
   - resolves the beach with `get_nearby_beaches(input_lat, input_lng, 3000, 3)` from the track's in-water centroid. That's the median position excluding the first and last 3 minutes, so the car park doesn't decide the break.
     - The nearest beach wins, even when several are within 1 km. The surfer can change it with the existing session edit.
     - If nothing is within about 3 km, the status becomes `needs_beach`. The surfer can then pick any beach through search, or one of their custom spots (`custom_spot_id` plus that spot's nearest `beach_id`, the same as hand-logged custom spots);
   - **dedupes:** if the user already has a non-deleted session at the same beach (or within 3 km) whose `arrival_time` is within ±90 minutes of the track start, it attaches to the closest one:
     - The track replaces `arrival_time` and `duration_minutes` together, so timing comes from one source. The old values go in `session_tracks.user_arrival_time` / `user_duration_minutes`.
     - A `planned` session flips to `completed`.
     - Everything else the user entered (board, rating, notes, wave height, media) is left alone.
     - The response says it attached ("Added to your Oct 17 session at Pipes").
     - If that session already has a track, the import fails as a duplicate and links to it;
   - otherwise inserts a session with:
     - `source='file_import'`
     - `status='completed'`
     - `arrival_time` = track start
     - `duration_minutes` from the track
     - `is_public=false` (deliberately not the column default)
     - `beach_name` from the beach
   - runs detection and writes `session_tracks` and `session_waves`;
   - fills `water_temp` (the column is °F; convert from the FIT's whole °C and round) and `water_temp_source='watch'` if null;
   - emits the standard `session_created` event with source `file-import` (extending its source union) and `is_historical=true` when the track ended more than 48 h ago;
   - returns `{sessionId, summary}`.
4. For `needs_beach`, `POST /api/v1/session-imports/{id}/beach` with `{beachId}` finishes from the stored summary.

The hourly conditions job then fills swell, wind and nearshore readings on its own, since `conditions_queued_at` defaults to now and the job reads only `beach_id` and `arrival_time`. Tide comes from the existing insert trigger.

**Backfill for older surfs (Steven: "do a backfill"):**
- **The gap:** forecast rows are kept only about 1–2 weeks. Today, for an older session, the job finds no swell or wind, writes `conditions_source='none'` and never retries. The CDIP MOP nearshore backfill already covers older sessions, but only at California beaches with a `mop_point_id`.
- **The fix:** extend `lib/sessions/session-conditions-enrich.ts` with an Open-Meteo hindcast fallback. It's used when neither a forecast row nor a session snapshot is near `arrival_time`:
  - swell height, period and direction, plus total wave height, from the Open-Meteo Marine API (`marine-api.open-meteo.com/v1/marine`, `start_date`/`end_date`);
  - wind speed and direction at 10 m from the Open-Meteo Historical Forecast API (`historical-forecast-api.open-meteo.com/v1/forecast`);
  - the beach's `lat`/`lon` at the arrival hour.
  - Verified Oct 17 for 32.86, −117.26 on 2026-07-03 18:00 UTC: swell 0.8 m at 12.45 s from 199°, wind 8.9 mph from 297°.
- **Provenance:**
  - Write the swell and wind groups whole, with a new `conditions_source='hindcast_open_meteo'` (added to its CHECK) and `conditions_forecast_at` set to the hour used.
  - Map to the same Open-Meteo variables and units the forecast pipeline stores as its `*_om` fields, so hindcast and forecast-row values mean the same thing.
- **Re-queue:** imports are always eligible. Existing sessions with `conditions_source='none'` get one hindcast retry through the existing `?mode=backfill` path, so older hand-logged sessions benefit too.
- **Batching:** fetch once per beach per date and reuse the hours. Quiver's Open-Meteo usage is already settled, so this adds no licensing work.

**Side effects of inserting completed sessions:** inserting `status='completed'` fires the Pro-offer pilot (`earn_pro_offer_on_session`), the completion email (`email_session_completion`) and beach affinity.
- Historical imports (track ended more than 48 h ago) are excluded from the Pro offer and the completion email, using `source='file_import'` plus the track end time. Both trigger functions need updating for this.
- Recent imports count like any other session.
- Beach affinity counts all of them.

**Known gap:** uploading first and then hand-logging the same surf on native isn't merged in v1. Installed builds write through the outbox, which can't change. A follow-up adds a "you already have a session here" warning to the web and native session forms.

**Parsers:**
- **FIT:** add Garmin's official JavaScript FIT SDK (`@garmin/fitsdk`). It's the same decoder family used in the Python analysis behind this design.
- **GPX:** use the existing `fast-xml-parser`.
- Read speed from FIT `enhanced_speed` when present. Otherwise derive it from positions.
- Keep developer fields where they're recognized (for example Dawn Patrol's `is_paddling`), but don't depend on them. They were all zero in Dawn Patrol's free tier.

### Wave detection v1 (`lib/sessions/wave-detection/`)

A pure function `detectWaves(track, beach) → { waves, coverage, summary, version }`. It has no I/O and is deterministic.

1. **Clean:**
   - Drop fixes implying more than 12 m/s (27 mph) from the previous fix, which removes single-sample GPS jumps.
   - Drop the first 60 s if the start is on land.
   - Mark gaps longer than 5 s, and never interpolate speed across them.
2. **Speed:** use the device speed field when present (FIT `enhanced_speed`), otherwise the position delta over time. Smooth with a 3-sample median.
3. **Candidates:**
   - The ride starts when speed is at least 2.5 m/s (5.6 mph) for at least 3 s.
   - The ride ends when speed stays below 1.5 m/s for 2 s, or a gap begins.
   - Keep the ride if peak speed is at least 3.6 m/s (8 mph) or its duration is at least 6 s.
4. **Shoreward check:**
   - Shoreward is `beaches.swell_window_center_deg + 180°`, which already exists for the conditions job. If that's missing, use the bearing from the session's mean water position to the beach point.
   - A candidate whose median heading is more than 100° from shoreward gets confidence × 0.3 instead of being dropped. This allows lefts and rights at angled breaks.
5. **Paddling filter:** if cadence or stroke data is present, and the 10 s before the candidate show paddling while it drops during the candidate, raise confidence. Swim-mode files have stroke cadence and non-swim files don't, so this only adds information, never requires it.
6. **Coverage:** `gps_coverage` = fraction of seconds with a fix during time in the water.
   - Below 0.5, the summary is flagged `low_coverage`.
   - The UI must then say "GPS dropped out for much of this surf, so the count may be low."
7. **Output:** waves with confidence. Counts and longest ride use current waves with confidence of at least 0.5 that no correction excludes. `version` is a string such as `"wd-1.0.0"`.

Tune the thresholds against the fixtures below. These numbers come from Surf Tracker's published defaults (9 km/h held 6 s, peak 13 km/h) and the Oct 17 and Oct 3 traces. They are a starting point, not a finding.

**In-water time:** there's no coastline data, so "on land" is approximated.
- In-water time runs from the first to the last sample more than 40 m from both the first and the last GPS fix.
- Speed bursts before or after that span (walking, driving) are ignored.
- Tune this against the fixtures.

**Fixtures for tests:**
- The real source files and ground truth live in the workspace at `.quiver/reviews/garmin-surf-competitors-20261016/fixtures/` (see `GROUND_TRUTH.md`): the Oct 17 Dawn Patrol FIT, the Oct 3 swim-mode FIT and all 36 swim-mode surfs.
- Commit only normalized JSON derived from them to `__tests__/fixtures/session-tracks/`, with coordinates offset by a constant so they don't reveal real spots.

| Fixture | Ground truth | Expected |
|---|---|---|
| Oct 17 Ocean Beach (Dawn Patrol, raw 1 Hz, 48% coverage) | 3 waves, 1 clear | 3 detected, including the 9:04 ride; `low_coverage` flagged |
| Oct 3 Cardiff (Open Water Swim, smoothed) | Steven: "8 doesn't seem off" | 5–9 detected; speeds flagged as swim-smoothed |
| Synthetic | Clean 1 Hz track with 4 injected rides | Exactly 4, correct start and end ±2 s |
| Synthetic | Track with a 110 s gap mid-ride | No ride invented across the gap |

**Swim-smoothed files:** when the FIT sport is `swimming/open_water`, store `speed_reliable=false` on `session_tracks` and hide speed stats. Counting rides from shoreward bursts still runs.

**Re-detection:** `POST /api/v1/sessions/{id}/redetect` (service role or admin only) re-runs the current version from the stored file. It writes a new version of `session_waves` and flips `is_current`; corrections carry over through time overlap. When the version is bumped, a backfill runs over all tracks. The original file is kept while the session exists (see Privacy for deletion).

### Read API

`GET /api/v1/sessions/{id}/waves`:
- `withAuth`, owner-only, the same ownership check as `GET /api/sessions/[id]`;
- new route, additive;
- returns `{ summary: {wave_count, longest_ride_s, longest_ride_m, top_speed_mps|null, gps_coverage, low_coverage, speed_reliable, detection_version}, waves: [...], track: GeoJSON LineString, recorded_by }`.

Both web and native use it. Native keeps reading the session row from Supabase as it does today and calls this route only for the waves section.

**Per-wave conditions (settled Oct 17):**
- The session's swell and wind (from the existing job, or the hindcast) apply to the whole session.
- Tide height per wave comes from the existing tide prediction path for the beach's tide station, evaluated at each wave's `started_at`.
- **Why not hour-by-hour swell per wave:**
  - Model and buoy swell barely moves within a surf. On Oct 17 at the Mission Bay buoy it read 1.0, 1.2 and 1.1 m across the hour.
  - What actually differs wave to wave (sets versus lulls) isn't in any hourly product. The watch is the only thing that sees individual waves.
  - Tide does move enough within a session to matter, so it's per wave.
  - A later option: plot the nearest buoy's or station's 30-minute readings along the session timeline for long surfs.

### Corrections

`PATCH /api/v1/sessions/{id}/waves/{waveId}` with `{excluded: boolean}`:
- owner only;
- writes or removes a `session_wave_corrections` row;
- corrections are kept, so detection accuracy can be measured;
- re-computes the summary.

**"How many did you catch?"**
- Asked in the waves section of the session view, and offered on the import result.
- Stored in `session_tracks.user_wave_count` through `PATCH /api/v1/sessions/{id}/waves` with `{userWaveCount}`.
- When set, the headline shows the surfer's number, with Quiver's count beside it ("You: 3 · Quiver found 3").
- It's the ground truth for tuning, and detection never overwrites it.

### Web UI

- **`components/session-detail-view.tsx`:** when `/waves` returns data, show a waves section with:
  - three stat tiles (waves, longest ride, top speed; speed hidden when unreliable);
  - a ride map;
  - a speed timeline with wave markers;
  - the per-wave list (time, duration, distance, top speed, tide), each with "Not a wave" to exclude it;
  - the coverage warning when needed.
  - Follow `docs/STYLE_GUIDE.md` and the `components/zine/` primitives.
- **Ride map:** a small `mapbox-gl` component with a line source for the track and a highlighted line for each wave. It's a new focused component next to `components/map/`, not the beach-marker `interactive-map.tsx`.
- **"My sessions" and upload:**
  - extend the existing `/sessions` page, which already lists the signed-in user's sessions through `/api/users/{id}/sessions`, with a waves badge on sessions that have a track;
  - add an "Upload a surf (FIT or GPX)" button that runs the ingest flow;
  - the empty state says how to export a file from Garmin Connect: activity › gear › Export File.

### Native UI

- **`src/screens/session-detail.tsx`:** add a Waves section between the Details card and Notes when `/api/v1/sessions/{id}/waves` returns data, with the same content as web.
- **Map:** v1 uses a Mapbox Static Images URL with a path overlay (an encoded polyline of the downsampled track, with waves in Quiver orange) built in `src/lib/mapbox-static-images.ts`. Native has no line layer yet, and a static image ships without new native code. An interactive `LineLayer` comes later.
- **No upload on native in v1:** there's no document picker, and FIT files usually live on a computer or in Garmin Connect web. Imported sessions show up in native history automatically, because they're ordinary `sessions` rows.
- The `Session` types gain an optional `source` field, read-only.

### Privacy

- Tracks and waves are owner-only.
- Imported sessions are created private (`is_public=false`), even though the column defaults to true.
- If the surfer later makes the session public, other people see the existing public session view. No track, no waves and no coordinates are exposed in this part.
- **Deletion:**
  - Native deletes by setting `deleted_at` and keeps media so the session can be restored. Tracks follow the same rule: hidden from the API while soft-deleted, and purged (rows plus storage file) 30 days after `deleted_at` by a daily job.
  - Web's hard delete cascades to `session_tracks`, `session_waves` and `session_wave_corrections`, and removes the storage file.
  - `delete_user_account()` must add the new tables and the user's `session-tracks` objects to its explicit cleanup list, so precise tracks never outlive the account.

### Flags, analytics, rollout

- **Flags:** use the existing `*_USER_ALLOWLIST` flag pattern in `lib/flags`. `SESSION_IMPORTS_ENABLED` with `SESSION_IMPORTS_USER_ALLOWLIST` gates the upload UI and the import and waves routes, so it can be on for Steven's two accounts first. Native `EXPO_PUBLIC_SESSION_WAVES_ENABLED` gates the Waves section, which also needs the route to return data.
- **Events:** `session_import_started`, `session_import_completed` (with `wave_count`, `gps_coverage`, `format`, `recorded_by` app family), `session_import_failed` (reason), `session_waves_viewed`, `session_wave_excluded`, `session_wave_count_reported`. Keep the event taxonomy, server allowlist and TypeScript unions aligned, as `soul.md` requires.
- **Rollout:**
  1. Migration PR, applied to the shared database only with Steven's approval.
  2. Web PR(s), shipped through the daily release pool with the flag off.
  3. Enable for Steven's two accounts and upload his 36 swim-mode surfs and the Oct 17 Dawn Patrol file.
  4. Compare counts with his memory.
  5. Native PR and OTA (OTA needs approval).
  6. Widen the flag.

### How later parts plug in

- **Garmin watch app (part 2):**
  - adds `source='garmin_watch'`, a `watch_devices` / pairing table and the link-code routes from the pairing mock-up;
  - adds an upload endpoint that accepts the watch's own payload (samples, plus device-detected wave marks as hints);
  - the payload goes through the same normalize → detect → session pipeline.
- **Apple Watch (part 3):** adds `source='apple_watch'`. The iPhone app forwards the workout's route and samples to the same pipeline.
- **Strava (part 4):** another adapter into the normalized track, after a Strava API terms check.

## Left to the builder

- Exact route path for "Your sessions" on web, and its navigation entry.
- Component names, file layout inside `lib/sessions/wave-detection/`, and test file names.
- Downsampling method for `track_geojson` (any method that keeps every point inside a wave).
- Static Images URL size budget: Mapbox path overlays have a URL length limit, so simplify the polyline as needed.
- Whether storage cleanup on session delete is a trigger, a cron or an API side effect, provided it can't leave orphaned files.
- Exact threshold values after tuning against the fixtures. Record the final numbers and fixture results in the PR.
- Confirm that the Garmin FIT SDK license (`@garmin/fitsdk`, Garmin's own `LICENSE.txt`) permits use in a server, or choose another FIT decoder with the same output.

## Calls made while writing this (Claude's, for Steven to check)

- **Imports start private** (`is_public=false`), because they carry precise GPS, even though the column defaults to public.
- **Attaching to an existing session replaces its timing with the track's,** keeps everything else, and flips a `planned` session to `completed`.
- **Ambiguous beaches:** the nearest to the in-water centroid wins, and the surfer can change it. With nothing within 3 km, the surfer picks any beach or a custom spot.
- **Corrections are stored by time,** so they survive re-detection. Old detection versions are kept.
- **The surfer's own count wins the headline** when given, with Quiver's count shown beside it.
- **Historical imports** (over 48 h old) don't trigger the Pro offer or the completion email.
- **Soft-deleted sessions keep their track for 30 days,** then it's purged. Account deletion removes all tracks.
- **Garmin's ZIP export is accepted.**
- **Uploading first and then hand-logging on native** creates two sessions in v1. That's a known gap with a planned warning.

## Steven's answers (Oct 17)

1. **Conditions for older surfs:** backfill them, through the Open-Meteo hindcast described under the ingest flow.
2. **Per-wave conditions:** session-level swell and wind plus per-wave tide. Hour-by-hour swell per wave isn't meaningful (see Read API).
3. **Finished or draft:** finished. There's no draft state, since "people barely use it as is". The "How many did you catch?" prompt lives in the waves section.
4. **Phone upload:** web-only for v1 (Claude's recommendation, from how competitors work; Steven to confirm).
   - Nobody uses phone file upload as a main path.
   - Surfline Sessions pulls native Surf activities from Garmin's cloud.
   - Dawn Patrol and BreakFinder sync from their own watch apps and link Garmin Connect, Strava and others.
   - Surftrail syncs watch to phone over Bluetooth.
   - Surfilog's FIT/GPX/ZIP upload is web-only.
   - Quiver's phone path comes with its own watch apps (parts 2 and 3) and Strava (part 4).
