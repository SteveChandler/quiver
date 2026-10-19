# Quiver for Garmin: server and web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Quiver Connect IQ app a server to talk to, and give surfers the web screens around it:

- **Linking:** short-code linking and device tokens.
- **Upload API:** a chunked, idempotent upload API that turns a watch surf into a session through part 1's import pipeline.
- **Session stats:** paddle distance, heart rate and set rhythm on sessions.
- **Push:** notifications when a watch surf is ready or needs a beach.
- **Web pages:** link confirm, beach picker and Garmin settings.

**Architecture:**
- **Device-token auth:** the watch talks to new `/api/v1/garmin/*` and `/api/v1/watch/*` routes. Tokens are stored as SHA-256 hashes; plaintext is handed out once, at the first poll after the surfer confirms.
- **Uploads become imports:** chunks land in the private `session-tracks` bucket. `complete` assembles them into one `samples.json` and creates a `session_imports` row with `origin='garmin_watch'`. Part 1's `processImport` then runs, now origin-aware: a new `quiver_watch` parser, and the source, public rule and rating chosen by origin.
- **Ships dark** behind `GARMIN_WATCH_ENABLED` plus an allowlist.

**Tech Stack:** Next.js App Router (Node routes), Supabase (Postgres, RLS, Storage), TypeScript, zod, Jest.

**Spec:** `docs/superpowers/specs/2026-10-18-garmin-watch-app-design.md` (#1130)

**Companion plans:**
- `docs/superpowers/plans/2026-10-18-garmin-watch-app.md` defines the watch ↔ server contract; this plan implements it verbatim.
- `docs/superpowers/plans/2026-10-18-garmin-watch-native.md` consumes Tasks 4, 7 and 9.

## Global Constraints

- **Repo rules:**
  - Follow `soul.md`.
  - Authenticated routes use `withNoStore(withRateLimit(withAuth(handler,{errorMessage}), "authenticated-default"))`.
  - Real HTTP statuses, using the `createSuccessResponse` / `createErrorResponse` envelope.
  - Mobile-consumed contracts are additive only.
  - RLS on every new user table, with the `REVOKE ALL … GRANT` hardening from `20261018090000_session_waves_core.sql`.
- **Migration:**
  - `supabase/migrations/20261019090000_garmin_watch.sql` inside `BEGIN; … COMMIT;`, idempotent.
  - It refuses to run unless `public.session_tracks` and `public.session_imports` exist.
  - It is validated on an isolated snapshot stack (project `quiver_swcheck`, ports +100) and never applied to the shared DB without Steven.
  - Generated types: copy the regenerated file if its diff is only the new objects; otherwise splice only the new blocks.
- **Values:**
  - `sessions.source`: `'garmin_watch'`.
  - `session_tracks.format`: `'quiver_watch'`.
  - `session_imports.origin`: `'file' | 'garmin_watch'` (default `'file'`).
  - Analytics source and surface: `"garmin-watch"`.
  - Recorded-with label: `"Quiver for Garmin · {deviceName}"`.
- **Watch ↔ server contract:** exactly as in `2026-10-18-garmin-watch-app.md` ("Watch ↔ server contract").
- **Phone ↔ server additions:** exactly as in `2026-10-18-garmin-watch-native.md` (Global Constraints › API).
- **Flags:**
  - `GARMIN_WATCH_ENABLED` plus `GARMIN_WATCH_USER_ALLOWLIST`; an empty allowlist means nobody.
  - Waves reads are allowed when `isSessionImportsUserAllowed(u) || isGarminWatchUserAllowed(u)`.
  - Link-code creation and polls need only `isGarminWatchEnabled()`, since there's no user yet.
- **Watch surfs:**
  - New sessions use `source='garmin_watch'` and `status='completed'`.
  - `is_public` is true only when the in-water span is ≥ 600 s **and** there is ≥ 1 counted wave; otherwise false.
  - `rating` is the watch rating, filled only when the session's rating is null.
  - Never historical: `is_historical_file_import` already ignores this source.
- **Paddle distance:** GPS distance over the in-water span, excluding counted-wave windows, bridging gaps ≤ 30 s and skipping longer ones.
- **Set rhythm:** group counted, non-excluded ride starts within 90 s into sets. With ≥ 3 sets, report the median gap between set starts, rounded to whole minutes; otherwise null.
- **Copy:** never "the call".
- **Tests:** `npm run test:unit -- <file>`. Route tests follow `__tests__/api/session-imports/session-imports.test.ts`: the `next/server` mock, `server-only` mock, partial `@/lib/supabase` mock and the `withRateLimit` passthrough.

## Review Focus

1. **The same surf is uploaded twice** (the watch retries after a lost `complete` response). This returns the same final answer and never a second session. Covered in Task 6 (`complete` is idempotent on `watch_uploads.import_id`).
2. **A poll after the token has already been claimed** returns `{status:"claimed"}`, never a second token. A confirm for an expired code returns 404, not a link. Covered in Task 4.
3. **A revoked device keeps uploading.** Every Bearer route returns 401 and nothing is written. Covered in Task 3.
4. **Chunks arrive out of order or with gaps** (`complete` before chunk 3). This returns 409 `missing_chunks` with exactly the missing indexes. Covered in Task 6.
5. **A dry-land walk or an accidental 30-second start** must not create a public session in the feed. It's `failed` with `too_short` (under 300 s in the water), or a private session (under 600 s or no counted wave). Covered in Task 7.

---

### Task 1: Migration

**Files:**
- Create: `supabase/migrations/20261019090000_garmin_watch.sql`, `__tests__/migrations/garmin-watch.test.ts`
- Modify: `lib/analytics/event-taxonomy.ts` (`VALID_EVENTS` plus `garmin_link_confirmed`, `garmin_watch_unlinked`, `garmin_import_beach_chosen`), `types/implicit-preferences.ts` (zero weights), `types/database.generated.ts` (regenerated), `__tests__/api/events-taxonomy-characterization.test.ts` (pinned hash)

**Interfaces:**
- Produces:
  - **Guard:** a `DO` block that raises `apply 20261018090000_session_waves_core.sql first` when `to_regclass('public.session_tracks')` or `to_regclass('public.session_imports')` is null.
  - **`sessions_source_check`:** appends `'garmin_watch'`. Copy the `string_to_array` DO-block from the core migration.
  - **`session_tracks_format_check`:** drop and re-add as `format IN ('fit','gpx','quiver_watch')`.
  - **`session_tracks`** gains `paddle_distance_m real`, `hr_avg smallint`, `hr_max smallint`, `source_device text`.
  - **`watch_devices`:**
    - Columns: `id uuid pk default gen_random_uuid()`, `user_id uuid not null references auth.users on delete cascade`, `platform text not null default 'garmin' check (platform = 'garmin')`, `device_uid text not null`, `device_part_number text`, `device_name text`, `app_version text`, `token_hash text unique`, `created_at timestamptz default now()`, `last_seen_at timestamptz`, `revoked_at timestamptz`.
    - `unique (user_id, device_uid)`.
    - RLS: select own. Grants: authenticated SELECT; service_role ALL.
  - **`watch_link_codes`:**
    - Columns: `id uuid pk default gen_random_uuid()`, `code text not null`, `poll_secret_hash text not null`, `device_uid text not null`, `device_part_number text`, `app_version text`, `user_id uuid references auth.users on delete cascade`, `device_id uuid references watch_devices on delete set null`, `expires_at timestamptz not null`, `confirmed_at timestamptz`, `claimed_at timestamptz`, `created_at timestamptz default now()`.
    - A unique partial index on `code` where `confirmed_at is null`.
    - RLS on; no client grants; service_role ALL.
  - **`watch_uploads`:**
    - Columns: `id uuid pk` (the watch surf id), `device_id uuid not null references watch_devices on delete cascade`, `user_id uuid not null references auth.users on delete cascade`, `chunk_count int`, `received_chunks int[] not null default '{}'`, `header jsonb`, `import_id uuid references session_imports on delete set null`, `created_at`, `updated_at` (set_updated_at trigger).
    - RLS: select own. Grants: authenticated SELECT; service_role ALL.
  - **`session_imports`** gains `origin text not null default 'file' check (origin in ('file','garmin_watch'))` and `device_id uuid references watch_devices on delete set null`.
  - **`user_events_event_type_check`:** appends the three event names, using the candidate-events DO block.
  - **`delete_user_account`:** re-created from its latest body in `20261018090100_session_waves_triggers.sql`, adding only:
    - `UPDATE public.watch_devices SET revoked_at = now(), token_hash = NULL WHERE user_id = p_user_id AND revoked_at IS NULL;`
    - `DELETE FROM public.watch_link_codes WHERE user_id = p_user_id;`

- [ ] **Step 1:** Write the failing text test. It asserts the guard comes first; the `'garmin_watch'` and `'quiver_watch'` values; the three tables with `enable row level security`; the `REVOKE ALL` lines; the `origin` column; the two `delete_user_account` lines; and `BEGIN;`/`COMMIT;`.
- [ ] **Step 2:** Run `npm run test:unit -- __tests__/migrations/garmin-watch.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write the migration and the event registrations.
- [ ] **Step 4: Isolated stack.**
  - Boot it (copy `supabase/` to `/tmp/sw-check`, `project_id = "quiver_swcheck"`, ports +100, seed from snapshots). Apply part 1's two migrations, then this one, twice to prove it's idempotent.
  - In a `ROLLBACK` transaction, prove:
    - the guard fails on a database without `session_tracks`;
    - authenticated cannot insert into `watch_devices`, `watch_link_codes` or `watch_uploads`;
    - `delete_user_account` revokes a device.
  - Regenerate types into `/tmp`, then copy or splice.
- [ ] **Step 5:** Run the migration test, `__tests__/api/events-allowlist-db-sync.test.ts` and `__tests__/api/events-taxonomy-characterization.test.ts` (update the pinned `valid` hash). Expected: PASS.
- [ ] **Step 6:** Commit with `feat(garmin): watch devices, link codes, uploads and watch session source`.

### Task 2: Flags and shared waves access

**Files:**
- Create: `lib/flags/garmin-watch.ts`, `lib/flags/__tests__/garmin-watch.test.ts`, `lib/sessions/waves/waves-access.ts`
- Modify:
  - `app/api/v1/sessions/[id]/waves/route.ts` (GET l.18, PATCH l.75);
  - `app/api/v1/sessions/[id]/waves/[waveId]/route.ts:18`;
  - `app/api/v1/sessions/[id]/redetect/route.ts:18`;
  - `app/api/sessions/[id]/route.ts` (the `has_track` check, about l.256);
  - `app/api/users/[id]/sessions/route.ts` (`addOwnerTrackStatus` gate).
- Test: the existing waves and session-detail route tests (add a watch-flag case)

**Interfaces:**
- Produces:
  ```ts
  export function isGarminWatchEnabled(): boolean
  export function isGarminWatchUserAllowed(userId: string): boolean   // same shape as lib/flags/session-imports.ts
  export function canViewSessionWaves(userId: string): boolean        // imports OR garmin
  ```

- [ ] **Step 1: Write the failing tests.**
  - Flag: an empty allowlist means nobody; a listed id is allowed; flag off means nobody.
  - Waves GET returns 200 for a user allowed only by the garmin flag.
  - `has_track` is computed for a user allowed only by the garmin flag.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Replace every `isSessionImportsUserAllowed` in the waves read paths and `has_track` paths with `canViewSessionWaves`. Import creation and processing stay on the imports flag.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): watch flag and shared waves access`.

### Task 3: Device tokens and watch auth

**Files:**
- Create: `lib/watch/device-token.ts`, `lib/watch/with-watch-auth.ts`
- Test: `__tests__/lib/watch/device-token.test.ts`, `__tests__/lib/watch/with-watch-auth.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function generateSecret(): string                    // 32 random bytes, base64url
  export function hashSecret(secret: string): string          // sha256 hex
  export type WatchContext = { deviceId: string; userId: string; service: SupabaseClient; params: Record<string,string> }
  export function withWatchAuth(handler: (req: NextRequest, ctx: WatchContext) => Promise<Response>, opts: { errorMessage: string }): RouteHandler
  ```
- `withWatchAuth` behaviour:
  - Reads `Authorization: Bearer`, looks up `watch_devices` by `token_hash` with `revoked_at is null` (service client), and returns 401 `unauthorized` otherwise.
  - Returns 404 `not_found` when `!isGarminWatchUserAllowed(userId)`.
  - Updates `last_seen_at` only when it is older than 10 minutes.
  - Wrap it as `withNoStore(withRateLimit(withWatchAuth(...), "authenticated-default"))`.

- [ ] **Step 1: Write the failing tests:**
  - missing or malformed header → 401;
  - unknown token → 401;
  - revoked → 401, and the handler is not called;
  - valid → the handler gets the device and user;
  - user not allowlisted → 404;
  - `last_seen_at` is written when stale and skipped when fresh.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): device token auth for watch routes`.

### Task 4: Link codes

**Files:**
- Create: `lib/watch/link-codes.ts`, `app/api/v1/garmin/link-codes/route.ts`, `app/api/v1/garmin/link-codes/[id]/route.ts` (the GET poll, with `id` = linkId), `app/api/v1/garmin/link-codes/[id]/confirm/route.ts` (POST, with `id` = the 6-digit code)
- Modify: `lib/api/rate-limit-config.ts` (presets `watch-link-code`: 6/min, 30/h, burst 3; and `watch-link-confirm`: 10/min, 20/h, burst 3)
- Test: `__tests__/api/garmin/link-codes.test.ts`

**Interfaces:**
- Produces the contract routes:
  - **create:** no auth; `withErrorHandler(withRateLimit(handler, "watch-link-code"))`.
    - Body: zod `{deviceUid: 1..64, partNumber: 1..32, appVersion: 1..16}`.
    - Returns 404 when `!isGarminWatchEnabled()`.
    - Generates a 6-digit code (`000000`–`999999`, zero-padded, retrying on a collision among unconfirmed rows up to 5 times) and a `pollSecret` (stored hashed). The code expires in 10 minutes.
    - 201 `{code, linkId, pollSecret, expiresAt}`.
  - **poll:** no auth; `withRateLimit(…, "public-default")`.
    - A wrong poll secret → 404 `not_found`.
    - Expired and unconfirmed → 410 `expired`.
    - Unconfirmed → `{status:"pending"}`.
    - Confirmed but not yet claimed:
      - generate the device token;
      - store `hashSecret(token)` on the device row;
      - set `claimed_at`;
      - return `{status:"linked", deviceToken}`.
    - Already claimed → `{status:"claimed"}`.
  - **confirm:** `withNoStore(withRateLimit(withAuth(…), "watch-link-confirm"))`.
    - Returns 404 when `!isGarminWatchUserAllowed(user.id)`, or when the code is unknown or expired.
    - Already confirmed → 409 `already_confirmed`.
    - Otherwise:
      - upsert `watch_devices` on `(user_id, device_uid)`, setting `revoked_at=null`, `token_hash=null`, and the part number, name (from part number → name mapping, else the part number) and app version;
      - set the code's `user_id`, `device_id` and `confirmed_at`;
      - insert a `garmin_link_confirmed` user event;
      - return 200 `{linked:true, deviceName}`.
- `lib/watch/link-codes.ts` exports `deviceNameForPartNumber(part: string): string`. It's a small table: `006-B4432-00` → "Forerunner 165", plus the fr265, fenix7, fenix8, epix2, venu3 and instinct3 part numbers from the SDK's `compiler.json` files; anything unknown → "Garmin watch".

- [ ] **Step 1: Write the failing tests:**
  - create returns the shape and stores only hashes;
  - flag off → 404;
  - poll pending, then confirm, then poll → linked with a token whose hash matches the device row;
  - a second poll → claimed;
  - a wrong secret → 404;
  - expired → 410;
  - confirm for an unknown code → 404;
  - a second confirm → 409;
  - re-linking the same `device_uid` reuses the device row and clears `revoked_at`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): link a watch with a short code`.

### Task 5: The quiver_watch track format

**Files:**
- Create: `lib/sessions/tracks/parse-quiver-watch.ts`, `__tests__/fixtures/session-tracks/watch-ob-2026-10-17.json` (generated)
- Modify:
  - `lib/sessions/tracks/types.ts`: `TrackMeta.format` gains `"quiver_watch"`; `NormalizedTrack` gains optional `extras?: { rating: number | null; deviceName: string | null }`.
  - `lib/sessions/tracks/read-track-file.ts`: a JSON branch before the GPX sniff when the first non-space byte is `{` and the parsed object has `quiverWatch === 1`.
- Test: `__tests__/lib/sessions/tracks/parse-quiver-watch.test.ts`, plus `__tests__/lib/sessions/tracks/watch-encode.ts` (a test-only encoder from `NormalizedTrack` to the chunk format)

**Interfaces:**
- **Assembled file:** `{ quiverWatch: 1, header: {surfId, startedAt, endedAt, sport, partNumber, deviceName, appVersion, rating, chunkCount}, chunks: Chunk[] }`. Each `Chunk` is exactly the contract chunk.
- **Produces:** `parseQuiverWatch(json: unknown): NormalizedTrack`.
  - Decodes deltas back to degrees, m/s, °C and ISO time.
  - `meta.recordedBy` is `Quiver for Garmin · {deviceName}`.
  - `meta.sport` is `"surfing"`.
  - `extras` holds the rating and device name.
  - Throws `TrackFileError("corrupt")` on schema errors and `("no_gps")` when no row has a fix.

- [ ] **Step 1: Write the failing tests.**
  - Round trip: encode the offset OB fixture (`__tests__/fixtures/session-tracks/ob-2026-10-17.json`) with the test encoder, parse it, and match every sample within 1e-7° and 0.01 m/s.
  - Null-fix rows survive.
  - Deltas resume after a gap.
  - `readTrackFile` dispatches the JSON.
  - Missing `chunks` → corrupt.
  - All-null positions → `no_gps`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Generate `watch-ob-2026-10-17.json` with the test encoder from the offset fixture; never from the real FIT.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): parse assembled watch uploads into a normalized track`.

### Task 6: Chunk upload and complete

**Files:**
- Create: `lib/watch/uploads.ts`, `app/api/v1/watch/uploads/[surfId]/chunks/[index]/route.ts`, `app/api/v1/watch/uploads/[surfId]/complete/route.ts`
- Test: `__tests__/api/watch/uploads.test.ts`

**Interfaces:**
- Consumes: `withWatchAuth`, `processImport` (Task 7) and `TrackFileError`.
- Produces:
  - **chunk route** (`withWatchAuth`):
    - Validation: zod for the contract chunk (`rows` ≤ 600, `index` 0..999, `surfId` a uuid); `header` required when `index === 0`.
    - Validation errors: 400 `invalid_chunk` when the chunk fails validation; 400 `invalid_header` when the header fails validation.
    - Upserts `watch_uploads` (id = surfId, device, user; `header` and `chunk_count` from the chunk 0 header).
    - Writes `{surfId}/{userId}/chunks/{index}.json` to bucket `session-tracks` with `contentType: "application/octet-stream"` and `upsert: true`.
    - Adds the index to `received_chunks` if missing.
    - 200 `{received:index}`.
    - A `surfId` owned by another user → 404.
  - **complete route** (`withWatchAuth`, `maxDuration = 60`):
    - When `watch_uploads.import_id` is already set, return the import's current mapped status (idempotent).
    - Otherwise, with any index in `0..chunkCount-1` missing → 409 `missing_chunks` with `{missing}`.
    - Otherwise:
      1. assemble `{surfId}/{userId}/samples.json` (octet-stream);
      2. insert `session_imports {user_id, storage_path, original_filename: "garmin-{surfId}.json", origin:"garmin_watch", device_id}`;
      3. set `watch_uploads.import_id`;
      4. call `processImport({userClient: service, serviceClient: service, now}, importId, userId)`;
      5. best-effort delete of the chunk objects.
    - **Status mapping:**
      - `completed` → `{status:"completed", sessionId}`;
      - `needs_beach` → `{status:"needs_beach", sessionId:null}`;
      - `duplicate` → `{status:"duplicate", sessionId}`;
      - `TrackFileError` → `{status:"failed", sessionId:null}`.

      All return 200.
- `processImport` is called with the service client as `userClient` because a watch has no user JWT. Every query in `processImport` and `findAttachTarget` already filters by `user_id`. Add a test proving no row from another user can be touched.

- [ ] **Step 1: Write the failing tests:**
  - chunk 0 without a header → 400;
  - a chunk for another user's surf → 404;
  - a repeated chunk stays idempotent;
  - complete with gaps → 409 with the exact missing list;
  - full complete → assembles, creates the import with `origin` `garmin_watch`, maps `completed`;
  - a second complete returns the same answer without a second import;
  - `TrackFileError("no_gps")` → 200 `failed`;
  - revoked device → 401 (via Task 3).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): chunked, idempotent watch surf uploads`.

### Task 7: Origin-aware processImport, track stats and too-short surfs

**Files:**
- Create: `lib/sessions/tracks/track-stats.ts`
- Modify:
  - `lib/sessions/imports/process-import.ts`: export `ProcessImportResult`; read `imported.origin`; the source, public, rating and analytics rules below; detect waves before the insert to decide `is_public`; pass `paddleDistanceM`, `hrAvg`, `hrMax` and `sourceDevice` to `insertSessionTrack`.
  - `lib/sessions/tracks/types.ts` (TrackFileError code `"too_short"`).
  - `lib/analytics/session-created.ts` (add `"garmin-watch"` to `SessionCreatedSource`).
  - `hooks/use-session-import.ts` (`ERROR_COPY.too_short = "This track is too short to be a surf."`).
- Test: `__tests__/lib/sessions/tracks/track-stats.test.ts`, `__tests__/lib/sessions/imports/process-import.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  export function paddleDistanceM(track: NormalizedTrack, summary: TrackSummary, rideWindows: { start: string; end: string }[]): number
  export function heartRateStats(track: NormalizedTrack, summary: TrackSummary): { avg: number; max: number } | null
  ```
- **Rules inside `processImport`:**
  - An in-water span under 300 s throws `TrackFileError("too_short")`, for both origins.
  - **`origin='garmin_watch'`, new session:**
    - `source:"garmin_watch"`;
    - `is_public` = span ≥ 600 s && counted waves ≥ 1;
    - `rating: track.extras?.rating ?? null`;
    - analytics `source:"garmin-watch"`, `surface:"garmin-watch"`.
  - **`origin='garmin_watch'`, attach:** set `rating` only `.is("rating", null)`; visibility and source are untouched.
  - **`origin='file'`:** unchanged from part 1 (private, `file_import`).
  - `paddleDistanceM` and `heartRateStats` run for every origin. FIT uploads have HR too.

- [ ] **Step 1: Write the failing tests.**
  - Track stats:
    - paddle distance excludes ride windows;
    - it bridges a 20 s gap and skips a 45 s gap;
    - HR avg and max cover only the in-water span;
    - null when no HR.
  - processImport with `origin` `garmin_watch` and the watch fixture:
    - inserts `source garmin_watch`, `is_public true`, `rating 3`;
    - `session_tracks` has `paddle_distance_m > 0`, `hr_avg` and `source_device "Forerunner 165"`.
  - A 7-minute fixture slice with no counted wave → `is_public false`.
  - A 4-minute slice → `failed` with `too_short`, and no session.
  - Attaching to a rated session keeps its rating.
  - The `file` origin is unchanged; all existing process-import tests still pass.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run `npm run test:unit -- __tests__/lib/sessions` and `yarn typecheck`. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): watch-aware import pipeline with paddle distance and heart rate`.

### Task 8: Push when a watch surf is ready or needs a beach

**Files:**
- Modify: `lib/notifications/registry.ts` (two entries), `lib/notifications/types.ts` (payload schemas, if that's where schemas live), `lib/watch/uploads.ts` (enqueue after `processImport`)
- Test: `__tests__/lib/notifications/watch-session-notifications.test.ts`, `__tests__/api/watch/uploads.test.ts` (extend)

**Interfaces:**
- Produces two registry types, following `log_session_nudge`. Both use channels `["push"]`, master pref `notif_push_enabled`, no per-type pref, and `DEFAULT_QUIET` quiet hours.
  - **`watch_session_ready`:**
    - payload `{session_id, beach_name, wave_count}`;
    - title "Your surf is in Quiver";
    - body "{beach_name}: {wave_count} wave(s)" ("1 wave" singular);
    - data `{type:"watch_session_ready", session_id}`.
  - **`watch_session_needs_beach`:**
    - payload `{import_id, started_at}`;
    - title "Pick the beach for your surf";
    - body "Your {Mon D} surf needs a beach before it can be saved";
    - data `{type:"watch_session_needs_beach", import_id}`.
- `complete` calls `enqueueNotification` with `dedupeKey: "watch_session:{importId}:{status}"` for `completed` (new or attached) and `needs_beach`. Nothing is sent for `failed` or `duplicate`.

- [ ] **Step 1: Write the failing tests:**
  - registry payloads validate and build the exact title, body and data;
  - complete enqueues once per import and status, and not at all for `failed`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): notify when a watch surf is ready or needs a beach`.

### Task 9: Spots, devices, import status and summary additions

**Files:**
- Create: `app/api/v1/watch/spots/route.ts`, `app/api/v1/watch/devices/route.ts`, `app/api/v1/watch/devices/[id]/route.ts`, `app/api/v1/session-imports/[id]/route.ts` (GET)
- Modify:
  - `lib/sessions/waves/waves-summary.ts` (`WavesSummary` plus `paddleDistanceM`, `heartRateAvg`, `heartRateMax`, `setIntervalMin`, `recordedWith`; a new `setIntervalMin(waves, corrections)`);
  - `app/api/v1/sessions/[id]/waves/route.ts` (read the new `session_tracks` columns and `recorded_by`/`source_device`).
- Test: `__tests__/api/watch/devices-spots.test.ts`, `__tests__/api/session-imports/session-import-get.test.ts`, `__tests__/lib/sessions/waves/waves-summary.test.ts` (extend), `__tests__/api/sessions/session-waves.test.ts` (extend)

**Interfaces:**
- Produces:
  - **`GET /api/v1/watch/spots`** (`withWatchAuth`): home beach first, then `favorite_beaches` by rank (beaches and custom spots with lat/lon). De-duplicated, at most 20, as `{id,name,lat,lon}`.
  - **`GET /api/v1/watch/devices`** (`withAuth`, watch flag):
    - `devices`: non-revoked, newest first.
    - `problems`: `session_imports` with `origin='garmin_watch'` and `status in ('failed','needs_beach')` from the last 30 days. `startedAt` comes from the import summary or the `watch_uploads` header; `reason` is the import `error`.
  - **`DELETE /api/v1/watch/devices/{id}`:**
    - owner only, else 404;
    - sets `revoked_at` and `token_hash=null`;
    - inserts a `garmin_watch_unlinked` event;
    - 200 `{unlinked:true}`.
  - **`GET /api/v1/session-imports/{id}`** (`withAuth`, owner, either flag):
    - returns `{id, status, origin, startedAt, candidates, sessionId}`;
    - `candidates` is re-resolved with `resolveImportBeach` from the stored summary centroid when the status is `needs_beach`, else `[]`.
  - **`setIntervalMin`:** the Global Constraints rule. The GET summary fills:
    - `paddleDistanceM` from `paddle_distance_m`;
    - `heartRateAvg`/`heartRateMax` from `hr_avg`/`hr_max`;
    - `setIntervalMin`;
    - `recordedWith` as `"Quiver for Garmin · {source_device}"` when the session source is `garmin_watch`, else `recorded_by`.

- [ ] **Step 1: Write the failing tests.**
  - Spots: home first, de-duplicated, capped at 20, 401 for a revoked device.
  - Devices: lists only the owner's watches; problems are limited to 30 days and `garmin_watch`.
  - Unlink: another user's device → 404; the token hash is cleared.
  - Import GET: candidates are recomputed for `needs_beach` and empty otherwise; not the owner → 404.
  - `setIntervalMin`:
    - rides at 0, 30 s, 8:00, 8:20, 16:10 and 24:05 → sets at 0, 8:00, 16:10 and 24:05 → median gap 8 min;
    - 2 sets → null;
    - excluded rides are ignored.
  - Waves GET carries the five new fields.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): spots, devices, import status and session stats API`.

### Task 10: Web pages

**Files:**
- Create:
  - `app/sessions/garmin-link/page.tsx` plus `components/garmin/garmin-link-confirm.tsx`;
  - `app/sessions/imports/[id]/page.tsx` plus `components/garmin/import-beach-page.tsx`;
  - `components/garmin/garmin-watch-section.tsx`;
  - `hooks/use-watch-devices.ts`.
- Modify:
  - `components/profile-view.tsx`: render `<GarminWatchSection />` in the surf-profile tab beside `<SurfProfileSection />` (about l.656), only for the profile owner;
  - `components/sessions/waves/session-waves-section.tsx`: tiles or rows for the new summary fields, following the existing tile classes (l.143-165).
  - `app/privacy/page.tsx`: add the spec's watch-data line covering GPS track, heart rate, temperature, device model and an app-specific device ID, stored privately, with tracks owner-only.
- Test: `__tests__/components/garmin/garmin-link-confirm.test.tsx`, `__tests__/components/garmin/import-beach-page.test.tsx`, `__tests__/components/garmin/garmin-watch-section.test.tsx`, `__tests__/components/sessions/session-waves-section.test.tsx` (extend)

**Interfaces:**
- Consumes: the Task 4 confirm route, the Task 9 routes, part 1's `ImportBeachPicker({candidates, onChoose})` and `/api/v1/session-imports/{id}/beach`.
- Produces: the pages and copy from the native plan's Global Constraints (same strings on web).
  - **Garmin link page:**
    - Reads `code` from the query.
    - Signed out → redirect to sign-in with `next` back to this URL. `go.quiversurf.app` already 308s to `www` with the query kept.
    - States: confirm, linked, expired, entry, unavailable (404 from confirm while the flag is off).
  - **Import page:** the needs_beach picker, a completed state with a "View session" link, and a failed reason.
  - **Section:** devices, unlink (with confirm), a 6-digit code entry and problems.
  - **Waves section additions:**
    - "About {X} km paddled"
    - "♥ avg {A} · max {M}"
    - "Sets about every {N} min"
    - "{recordedWith}"
    - Water temp labelled "(session median)"

    Each renders only when its value is non-null.

- [ ] **Step 1: Write the failing tests** for each state above, using mocked `fetch`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement with the zine primitives already used by the session waves section.
- [ ] **Step 4:** Run the tests, `yarn typecheck` and scoped eslint. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): web link confirm, beach picker and Garmin settings`.

### Task 11: Gate, release-pool line, review, PR

**Files:**
- Modify: `/Users/stevenchandler/Desktop/dev/.quiver/ops/RELEASE-POOL.md`

- [ ] **Step 1: Full gate:**
  - `npm run test:unit`
  - `yarn typecheck`
  - `NODE_OPTIONS="--max-old-space-size=8192" yarn lint`
  - `yarn deadcode` (no new findings in this branch's files)
  - `VERCEL_ENV=preview yarn build`

  Expected: all pass.
- [ ] **Step 2:** Add one Release steps line: "#PR Garmin watch server ships dark — release step, Steven's approval: apply `20261019090000_garmin_watch.sql` after part 1's two migrations; set `GARMIN_WATCH_ENABLED=true` + `GARMIN_WATCH_USER_ALLOWLIST=<Steven's ids>`; then the store beta."
- [ ] **Step 3:** Run `/code-review high` (the PR touches `supabase/migrations`), fix confirmed findings, push, open the PR, and enable Auto-fix and squash auto-merge.


### Task 12: Forecast validation fields for watch surfs (Oct 18 addendum)

**Files:**
- Modify: `lib/watch/uploads.ts` (header schema), `lib/sessions/tracks/parse-quiver-watch.ts` (header + `extras.waveHeightFt`), `lib/sessions/tracks/types.ts`, `lib/sessions/imports/process-import.ts` (wave height + call link), `app/api/sessions/[id]/route.ts` (PATCH `forecast_accuracy`)
- Create: `lib/sessions/imports/link-recent-call.ts`
- Test: `__tests__/api/watch/uploads.test.ts`, `__tests__/lib/sessions/tracks/parse-quiver-watch.test.ts`, `__tests__/lib/sessions/imports/process-import.test.ts`, `__tests__/lib/sessions/imports/link-recent-call.test.ts`, the sessions PATCH route test

**Interfaces:**
- Header field `waveHeightFt: 1.5 | 2.5 | 3.5 | 5 | 7 | 8.5 | null`, optional for older watch builds (missing = null). Any other number → 400 `invalid_header` at ingest and `corrupt` in the parser.
- `linkRecentCall(service, {userId, sessionId, beachId, arrivalTime}): Promise<string | null>` — newest `user_events.board_pick_exposed` for that user and beach created within 36 h before `arrivalTime` whose metadata `forecastAt` is within 3 h of `arrivalTime` (parse metadata the way `app/api/recommendations/pending-call-check/route.ts` does); sets `sessions.call_id` only where it is null; returns the call id or null. Best-effort: failures warn and never fail the import.
- `processImport` (watch origin): new session inserts `wave_height_ft`; attached session updates `wave_height_ft` only where null; then `linkRecentCall` for both.
- `PATCH /api/sessions/{id}`: `forecast_accuracy: z.enum(["accurate","somewhat","inaccurate"]).nullable().optional()` (matches `check_forecast_accuracy`).

- [ ] Step 1: failing tests (header accepts each chip value and null/missing, rejects 4 and 3; parser carries `waveHeightFt`; new watch session stores it; attached session fills only an empty value; call link picks the right exposure — wrong beach, > 36 h old, forecastAt 4 h off and an already-linked session are all ignored; PATCH accepts and rejects accuracy values).
- [ ] Step 2: run, expect FAIL. Step 3: implement. Step 4: run, expect PASS.
- [ ] Step 5: commit `feat(garmin): wave size, call link and forecast verdict for watch surfs`.
