# Quiver for Garmin: the watch app (part 2)

- **Status:** written from Steven's answers (Oct 17–18); ready for his review
- **Scope:** Part 2 of 4. Part 1, the session waves shared core, is on `main` (#1128): upload, server wave detection, waves API, web waves section. Part 3 is the Apple Watch app; part 4 is Strava, progress and boards.
- **Repos:**
  - **`quiver-garmin` (new, private):** the Connect IQ watch app in Monkey C.
  - **`quiver`:** linking, watch upload API, session fields, web screens.
  - **`quiver-native`:** link confirm screen, Garmin settings, session view fields.

## Why

Steven records his surfs on a Forerunner 165 today with a custom profile cloned from Open Water Swim. That mode smooths GPS, so ride speed and wave detail are lost, and every surf has to be exported and uploaded by hand.

He wants to start a surf on the watch and have Quiver make the session on its own.

Garmin has paused new cloud API approvals with no timeline (ticket 229566), so the only way to get the watch's per-second data into Quiver is Quiver's own Connect IQ app. It sends data through Garmin Connect on the phone to Quiver's server.

What the competitor teardown found (`.quiver/reviews/garmin-surf-competitors-20261016/REPORT.md`):
- Everyone serious re-counts on a phone or server and lets the surfer correct it; the live count on the wrist is a rough guess.
- The two that create sessions automatically (BreakFinder, Surfilog) record in their own watch app and send the track through the Garmin Connect relay to their own server.
- Reviews punish:
  - wrong wave counts;
  - crashes on start;
  - lost syncs;
  - forced sign-ups;
  - small on-watch queues (Surfilog keeps 2 unsent surfs and drops the oldest).

## Decided by Steven

1. **Record on the watch, and Quiver makes the session automatically.** No file export.
2. **In the water the watch shows:** session time, heart rate, water temperature, distance paddled.
3. **No live wave count. No buzzing, including set alerts**, because a wrong buzz is worse than none.
4. **After stopping, the watch asks for a rating** before saving.
5. **Watch sessions are public by default**, like a hand-logged session.
6. **It goes on the Garmin Connect IQ store** for Quiver users, **free**.
7. **The look follows the competitors' common style:**
   - black screen;
   - big orange session timer;
   - heart rate across the top;
   - a small stat row;
   - a plain Resume / Save / Discard menu.

   Steven approved the seven mock-up screens (Oct 18).
8. **Paddle distance is captured** and shown.

## Goals

1. A surfer starts **Quiver** on a Garmin watch, surfs, saves. The surf reaches Quiver as a session with waves, conditions, heart rate, paddle distance and water temperature, without opening anything else, as long as the phone is in reach at some point.
2. No surf is lost because the phone stayed in the car or the account wasn't linked yet.
3. The watch records raw 1 Hz GPS with no swim smoothing, so part 1's detector sees real ride speeds.
4. Linking is a one-time short code, and the app is usable before linking.
5. Runs on every Connect IQ watch with GPS and API level 3.2 or later that has enough storage.

## Non-goals (this part)

- Wave count, ride speed, or any wave detection on the watch.
- Set prediction or set alerts on the watch. The session page instead reports the set rhythm that actually happened.
- Conditions screens on the wrist (spot forecast, tide, swell). That was the other half of the Oct 16 concept and comes later.
- Paddle strokes from the motion sensor. Paddle distance comes from GPS in this part.
- Apple Watch, Wear OS, Strava.
- Uploading from the phone app. Imports from files stay web-only, as in part 1.

## Anti-goals

These would make it a failure even if it technically worked:

- A crash or freeze at Start or Save, the top complaint in competitor reviews.
- A surf silently lost: dropped from a full queue, a failed upload never retried, or a sync that leaves no trace.
- Forcing an account before the first surf can be recorded.
- Numbers on the watch that disagree with Quiver for no reason the surfer can understand.
- Using the touchscreen in the water. Buttons only once recording starts.

## The watch app

### Screens

These match the approved mock-ups:

| # | Screen | What it shows | Buttons |
|---|---|---|---|
| 1 | Start | "QUIVER", time of day, the nearest saved spot (or "Surf"), GPS status bars and "GPS ready", an orange START arc | Start begins recording once GPS is ready. Back exits. Menu opens Link / Settings. |
| 2 | Recording | Heart-rate arc and "♥ 128" across the top; big orange session timer; water temp (teal) and distance paddled; a small recording dot and time of day | Start/Stop opens the stop menu. Light toggles the backlight. |
| 3 | Recording, first ~10 min | Same, but water temp reads "settling" | Same |
| 4 | Stop menu | Elapsed time; Resume / Save / Discard | Up/Down to move, Start to choose. Discard asks to confirm. |
| 5 | Rate | "How was it?", five stars | Up/Down changes, Start saves, Back skips (no rating) |
| 6 | Saved | Check mark, "Saved", "Sends to Quiver when your phone is near", "N surfs waiting" | Any button returns to Start |
| 7 | Link Quiver | "Link Quiver", a 6-digit code, "Open the Garmin Connect notification on your phone", "or Quiver › Settings › Garmin" | Back returns. Polls for confirmation while open. |

**Colours:**
- Quiver orange `#F78E42` for the timer and primary actions.
- Quiver teal `#00D4AA` for status and water temperature.
- Red for heart rate, white text on black.

**Units** follow the watch's own settings (°C or °F, km or mi).

### Recording

- **Activity:** `ActivityRecording.createSession` with `Activity.SPORT_SURFING` (API 3.2+), named "Surf".
  - The FIT goes to Garmin Connect like any other activity, so the surfer always has the raw file there. That also means part 1's web upload works as a fallback.
- **GPS:** 1 Hz, with the best multi-constellation configuration the device supports (all systems, multi-band where available).
- **Data per second:** time, latitude, longitude, speed, heart rate, wrist temperature. These go both into the FIT and into Quiver's own sample buffer (below).
- **Water temperature:**
  - comes from the wrist sensor;
  - shown as "settling" for the first 10 minutes of the session, then the live median of the last 3 minutes;
  - this matched nearby buoys to about 1 °C on Steven's 13 measured surfs.
  - The session in Quiver stores one value for the whole surf: part 1's server rule, the median of the second half of the in-water span. The session page labels it "session median" so it isn't read as the last number the watch showed.
- **Distance paddled on the watch:** GPS distance accumulated only while speed is below 2.5 m/s. It's a running approximation; Quiver's number from the server is the one that counts. The session page labels both clearly so a small mismatch isn't confusing.
- **Heart rate:** current value, plus a zone arc coloured by the watch's own HR zones.

### The sample buffer and queue

Connect IQ can't read back its own FIT, so the app keeps its own compact copy of each surf for Quiver.

- **Chunks:**
  - Samples are packed into chunks of at most ~300 samples (5 minutes).
  - Each chunk is one `Application.Storage` value. Values are limited to 32 KB each, and the total store size varies by device.
  - Encoding: delta-encoded integers per sample — time offset, lat/lon in 1e-7°, speed in cm/s, HR, temperature in 0.1 °C.
- **Surf record:** a saved surf is a small header (id, start time, sport, device, app version, rating, chunk count) plus its chunks. The id is a client-generated UUID and is the idempotency key end to end.
- **Queue:**
  - Holds as many surfs as the device's store allows.
  - When full, the app warns on the Saved screen ("Storage full — open Quiver near your phone") and never deletes an unsent surf.
  - If a new surf can't be stored, the FIT in Garmin Connect is still there, and the Saved screen says so.
- **Draining the queue:**
  - right after Save;
  - whenever the app opens;
  - from a background temporal event every 15 minutes while surfs are waiting, if the device allows background processes.
- **Uploads:** one surf at a time, chunk by chunk.
  - A chunk is deleted from the watch only after the server confirms it.
  - On `BLE_REQUEST_TOO_LARGE` the chunk is split in half and retried.
  - Network errors back off and retry on the next drain.
- **Unlinked watches** keep everything queued. Surfs send once the watch is linked.
- **When a surf leaves the watch:**
  - The watch deletes a surf only after `complete` returns a final answer: a session, needs a beach, failed, or duplicate.
  - From that point the server owns it, so one bad surf can never block the queue behind it.
  - The FIT in Garmin Connect is always there as a backup.

### Linking

This is the short-code flow from the Oct 16 pairing sketch.

1. Menu › Link Quiver: the watch calls `POST /api/v1/garmin/link-codes` with:
   - its device part number (the model);
   - its app-scoped device ID (`System.getDeviceSettings().uniqueIdentifier`);
   - its app version.

   It gets back `{ code, linkId, pollSecret, expiresAt }`, with a 6-digit code that lasts 10 minutes.
2. The watch shows the code and calls `Communications.openWebPage("https://go.quiversurf.app/sessions/garmin-link", { code })` (API 3.1+). Garmin Connect then shows a phone notification that opens the link.
3. The link opens the Quiver app on iOS and Android, or the website for people without the app. The signed-in surfer sees "Link this Garmin watch?" and confirms. That calls `POST /api/v1/garmin/link-codes/{code}/confirm` (`withAuth`).
   - **Why this path:** `/sessions` is already a prefix-matched app link in `config/app-link-contract.json`, the AASA file and the installed Android intent filters. A path under it opens the app without a new native build, and the in-app screen ships by OTA.
   - `/settings` is exact-match only and `/garmin` isn't registered at all, so neither works without a native build.
4. The watch polls `GET /api/v1/garmin/link-codes/{linkId}?pollSecret=…` every 3 seconds while the Link screen is open. On confirm it receives a device token once.
5. **Fallback:** if the notification is missed, the surfer types the code in Quiver › Settings › Garmin (web and app).

**Device token:**
- 32 random bytes.
- Stored on the watch with `Application.Storage`, not `Properties`. Properties land in the readable `GARMIN/Apps/SETTINGS/*.SET` files, which is where BreakFinder's `apiToken` sat.
- The server stores only its SHA-256.
- Every watch request sends it as `Authorization: Bearer`.
- It works until the surfer unlinks the watch in Quiver settings, which revokes it.
- A revoked token gets 401, and the watch returns to "not linked" with its queue intact.

**Spots:** linked watches fetch `GET /api/v1/watch/spots` (favourite beaches plus home beach, with lat/lon) on app open and cache it. The Start screen shows the nearest cached spot within 3 km of the first GPS fix, otherwise "Surf". It's display-only; the server still picks the beach from the track.

## Server (`quiver`)

### Data

These go in a new migration, held for Steven's approval like part 1's:

- **`sessions_source_check`** gains `'garmin_watch'` (the preserve-and-append pattern).
- **`session_tracks.format`** CHECK gains `'quiver_watch'`.
- **`watch_devices`:**
  - Columns: `id`, `user_id`, `platform ('garmin')`, `device_uid`, `device_part_number`, `app_version`, `token_hash` (unique), `created_at`, `last_seen_at`, `revoked_at`.
  - Unique on `(user_id, device_uid)`. Re-linking the same watch reuses its row and issues a new token.
  - RLS: owner select. Writes go through the service role.
- **`watch_link_codes`:**
  - Columns: `id`, `code` (unique while active), `poll_secret_hash`, `device_part_number`, `app_version`, `user_id` (null until confirmed), `device_id`, `expires_at`, `confirmed_at`, `claimed_at`.
  - Service role only.
- **`watch_uploads`:**
  - Columns: `id` (the watch's surf UUID), `device_id`, `user_id`, `started_at`, `chunk_count`, `received_chunks int[]`, `import_id`, timestamps.
  - This table tracks chunk receipt only.
  - Owner select; service role writes.
- **`session_imports`** (part 1) gains `origin text not null default 'file' check (origin in ('file','garmin_watch'))` and `device_id`.
  - Every completed watch upload becomes an import row, with its `storage_path` pointing at the assembled `samples.json`.
  - Part 1's import states then cover watch surfs too: completed, needs_beach, failed, duplicate. So do the sha256 duplicate check and the 30-day purge.
- **`session_tracks` gains:**
  - `paddle_distance_m real`
  - `hr_avg smallint`, `hr_max smallint`
  - `source_device text` (e.g. "Garmin Forerunner 165")

### Endpoints

- **Link codes** (above):
  - `POST /api/v1/garmin/link-codes` is unauthenticated and rate-limited per IP and device.
  - Confirm is `withAuth`.
  - The poll checks the poll secret.
- **`GET /api/v1/watch/spots`:** device token.
- **`PUT /api/v1/watch/uploads/{uploadId}/chunks/{index}`:**
  - Device token. The body is one encoded chunk plus the header on chunk 0.
  - Idempotent: a repeated chunk is ignored and acknowledged.
  - The chunk is written to the private `session-tracks` bucket at `{uploadId}/{userId}/chunks/{index}.json`, the same `{id}/{userId}/…` shape as part 1.
- **`POST /api/v1/watch/uploads/{uploadId}/complete`:** device token.
  - Once every chunk is present, it:
    1. assembles the samples into one `{uploadId}/{userId}/samples.json`;
    2. creates the import row (`origin='garmin_watch'`);
    3. runs the pipeline.
  - Returns `{ status: "completed" | "needs_beach" | "failed" | "duplicate", sessionId? }`, the final answer the watch waits for.
  - Repeat calls return the same result.
  - Link-code creation is rate-limited per IP and per `device_uid`.

All responses use the `createSuccessResponse` / `createErrorResponse` envelope.

**Flags and rollout order:**

- **Flag:** linking and upload sit behind `GARMIN_WATCH_ENABLED` plus `GARMIN_WATCH_USER_ALLOWLIST` (the `lib/flags/session-imports.ts` pattern).
- **Waves read API:** the waves read and correction routes (part 1) allow a user when *either* the imports flag or the watch flag allows them. Otherwise a watch user's "3 waves" push would open a session with the waves hidden.
- **Release order** (each step needs Steven's approval):
  1. Apply part 1's migrations: `20261018090000_session_waves_core.sql`, then `20261018090100_session_waves_triggers.sql`. Keep both server flags off.
  2. Apply part 2's `20261019090000_garmin_watch.sql`, which requires both part 1 migrations. All three migrations must be applied before EITHER flag is enabled: part 2's pipeline writes the new `session_tracks` columns on every import, including FIT/GPX.
  3. Enable server flags for Steven's accounts only after all three migrations are applied.
  4. Private store beta.
  5. Public listing, with both flags opened to everyone at the same time.

### Pipeline

Part 1's `processImport` already handles import rows end to end: download, sha256 claim, parse, beach, attach or create, detect, persist, and the import state. Part 2 keeps that flow and passes the source along instead of hard-coding the file case:

- **`readTrackFile`** learns the `quiver_watch` format (`parse-quiver-watch.ts`), so both the pipeline and admin redetect can read `samples.json`.
- **`processImport`** reads the import's `origin`. For `garmin_watch` it inserts sessions with:
  - `source='garmin_watch'`;
  - the watch rating;
  - the public rule below;
  - `source_device`.
- The watch header (rating, device, app version) is stored with the samples, so a retry or `/beach` resolution has it.

This is a refactor of part 1's code, not a copy of it.

Rules for watch surfs:

- **New sessions:** `source='garmin_watch'`, `status='completed'`, **`is_public=true`**.
  - **Exception:** a surf with under 10 minutes in the water, or with no counted wave, is created private. Accidental starts and dry-land walks then never appear in the community feed, and the surfer can still make it public.
- **No beach within 3 km** (`needs_beach`):
  - The surfer gets a push: "Pick the beach for your Oct 18 surf". It opens `/sessions/imports/{importId}`, a page on web and in the app that lists the candidates and offers beach search. That's part 1's picker, reused.
  - Choosing a beach calls part 1's existing `/beach` route, and the session is then created with the watch rating and public rule.
  - **New native scope:** the in-app version of that page, shipped by OTA, under the registered `/sessions` prefix.
- **No GPS, a nonsense clock, or a track that never entered the water:**
  - The import is `failed` with a reason, and no session is made.
  - Settings › Garmin lists the last failed surfs with the reason, so nothing disappears silently.
- **Already recorded** (the surf matches a session that already has a track, for example the surfer also uploaded the FIT): the import is `duplicate` and the existing session is left alone.
- **Attaching to a session the surfer logged by hand:** same ±90 min / 3 km rule as part 1. The existing session keeps its visibility and source.
- **Rating** fills `sessions.rating` only when it's null.
- **Historical exclusion:** a watch surf is never treated as historical for the Pro-offer and email exclusions, even if it arrives days late. It was recorded live, unlike a back-filled file.
- **`session_created`** fires with `source: "garmin_watch"`, `surface: "garmin-watch"` when a new session is inserted.
- **Push notification:** after a watch surf is processed, the surfer gets one push through the existing `dispatchPushMessages` pipeline and notification preferences: "Your surf at Ocean Beach Pier is in Quiver — 3 waves". Tapping it opens the session.
- **Paddle distance (server):** GPS distance across the in-water span, excluding detected rides. Gaps up to 30 s are bridged with a straight line; longer ones are left out, so it reads a little short and is labelled "about". It's stored on `session_tracks`.
- **Heart rate:** avg and max over the in-water span.
- **Set rhythm,** computed at read time from counted, non-excluded waves:
  - group ride starts that fall within 90 s of each other into sets;
  - with 3 or more sets, report the median gap between set starts, rounded to the minute ("Sets about every 8 min");
  - otherwise omit it.

  This is the measured version of Steven's set idea. It gives the data needed to judge, later, whether a prediction is ever worth putting on the wrist.

### Waves API and session view (additive)

`WavesSummary` gains `paddleDistanceM`, `heartRateAvg`, `heartRateMax`, `setIntervalMin` and `recordedWith` (e.g. "Quiver for Garmin · Forerunner 165"). All are nullable.

The web session view and the native session view show:
- paddle distance;
- heart rate;
- the set rhythm line.

Unit tests cover the set grouping, paddle distance and gap bridging.

## Web and app screens

- **Web:**
  - `/sessions/garmin-link?code=` confirm page: signed-in confirm, or sign in first.
  - `/sessions/imports/{importId}` beach picker for a watch surf that needs a beach.
  - Settings › Garmin: linked watches with model, linked date and last sync, an Unlink action, and a type-the-code fallback.
  - The session view additions above.
- **Native (quiver-native):**
  - the `sessions/garmin-link` confirm screen;
  - the `sessions/imports/[id]` beach picker;
  - Settings › Garmin (same as web);
  - the session view additions.

  All of these sit under paths the installed app already claims, so they ship through the normal OTA path with Steven's approval. It doesn't need a native build or the Connect IQ mobile SDK.

## Store release

- **Garmin developer account:** a free Connect IQ developer account on a Garmin login with a Quiver email, display name "Quiver". Steven creates it; it's needed only at submission.
- **Listing:**
  - name "Quiver: Surf Tracker", type device app, free;
  - permissions: Positioning, Sensor, Fit, Communications, Background;
  - screenshots from the simulator in the approved look;
  - a privacy line added to quiversurf.app/privacy covering watch data: GPS track, heart rate, temperature, device model and an app-specific device ID; stored privately; tracks owner-only as in part 1.
- **Devices:** every GPS watch at API 3.2+ where the simulator run passes and the store fits at least 3 two-hour surfs. The FR165 is the reference device.
- **Rollout:**
  1. A private beta build on the store for Steven's devices.
  2. Server flag allowlist.
  3. Public listing after Steven's sign-off.

## Testing

- **Simulator:**
  - Replay Steven's real FITs (`.quiver/reviews/garmin-surf-competitors-20261016/fixtures/`) through the Connect IQ simulator's FIT playback.
  - Covers recording, chunking and the full upload against a dev server.
  - Also: queue-full behaviour, unlinked recording, revoked token, split-on-too-large, kill-mid-upload then resume.
- **Device matrix:** build for every target device in the simulator, and launch, record and save on each.
- **On the FR165:**
  - Sideload over USB.
  - One dry-land walk.
  - Then one real surf with the phone left in the car, to prove the queue drains later.
  - Compare the Quiver session against the FIT in Garmin Connect.
- **Monkey C unit tests** for encoding, chunking and the queue.
- **Server tests** for link codes (expiry, single use, rate limit), chunk idempotency, completion idempotency, `processTrack` with the new source, and the summary additions.

## Left to the builder

- Monkey C project layout, the exact delta encoding, and the chunk size, within the 32 KB value limit.
- Exact GPS configuration constants per device family.
- How to detect "GPS ready" (fix quality threshold).
- Background-drain details per device memory limits, if the background process can't fit, drain only on app open and after Save.
- The push notification's category and preference key, following the existing push code.
- Exact copy for errors and empty states, following Quiver's copy rules (never "the call").

## Calls Claude made (check these while reading)

1. **No beach within 3 km:** a push opens a beach picker on web and in the app (part 1's picker). The surf isn't dropped, and no custom spot is created.
2. **Private exception:** a surf under 10 minutes in the water, or with no counted wave, is created private. Everything else is public, per Steven.
3. **Watch surfs reuse part 1's import rows** (`origin='garmin_watch'`), so duplicates, failures, needs-beach and the 30-day purge all work the same way.
4. **The watch deletes a surf** only after the server gives a final answer. The FIT in Garmin Connect is always the backup.
5. **The link URL lives under `/sessions/`** (`go.quiversurf.app/sessions/garmin-link`), so it opens the installed app on iOS and Android without a new native build.
6. **Device identity:** the watch sends an app-scoped device ID, so two watches of the same model stay separate. The privacy line mentions it.
7. **Water temperature:** the watch shows a live value. The session stores the server's whole-surf median, labelled "session median".
8. **Waves read API:** opens to a user when either the imports flag or the watch flag allows them. Release order: part 1's two migrations → part 2's migration → enable either flag for Steven's accounts → store beta → public. All three migrations must precede EITHER flag because part 2's pipeline writes the new `session_tracks` columns on every import.
9. **Paddle distance on the watch** counts GPS distance below 2.5 m/s; the server's figure excludes detected rides and is the one stored.
10. **Store name** "Quiver: Surf Tracker"; free; every GPS watch at API 3.2+ that passes the simulator run and fits at least 3 two-hour surfs.
11. **A separate private `quiver-garmin` repo** for the Monkey C app.

## Needs Steven

1. **Approve this design.**
2. **Create the private `quiver-garmin` repo,** or OK Claude creating it under `SteveChandler`. Keeping the watch app out of `quiver-native` avoids changing Expo's fingerprint.
3. **Sign in to the Connect IQ SDK Manager** (installed Oct 18) so the SDK and device files download.
4. **Before store submission:** the Quiver Garmin developer account and the privacy-page wording.
5. **At release:** approve the new migration on the shared database, the server flag, and the native OTA.
