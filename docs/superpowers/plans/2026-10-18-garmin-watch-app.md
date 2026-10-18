# Quiver for Garmin: Connect IQ watch app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Quiver Connect IQ watch app. It records a surf at 1 Hz with no swim smoothing, shows time, heart rate, water temperature and paddle distance, asks for a rating, and sends the surf to Quiver through Garmin Connect, so Quiver makes the session.

**Architecture:**
- **Foreground app:** records a Garmin `SPORT_SURFING` activity (the FIT goes to Garmin Connect) and, in parallel, a compact delta-encoded sample buffer, chunked into `Application.Storage`.
- **Uploader:** drains the queue chunk by chunk over `Communications.makeWebRequest` (relayed by Garmin Connect on the phone) to the watch API in `quiver`.
- **Linking:** a 6-digit code plus `openWebPage`.
- **Pure logic** (encoding, filters, queue, upload state machine) is separated from Toybox calls so it runs under Monkey C unit tests.

**Tech Stack:** Monkey C, Connect IQ SDK 9.2.0 (installed Oct 18 at `~/Library/Application Support/Garmin/ConnectIQ/Sdks/connectiq-sdk-mac-9.2.0-2026-06-09-92a1605b2`), minimum API level 3.2.0, Connect IQ simulator.

**Spec:** `quiver/docs/superpowers/specs/2026-10-18-garmin-watch-app-design.md` (#1130)

**Companion plans:**
- `quiver/docs/superpowers/plans/2026-10-18-garmin-watch-server.md` provides the watch API this app calls (its Task 4 and Task 6).
- `quiver-native/docs/superpowers/plans/2026-10-18-garmin-watch-native.md` covers the phone screens.

**Repo:** new private repo `quiver-garmin`. Steven creates it, or OKs Claude creating it under `SteveChandler`. This plan lives in `quiver` until then and moves to `quiver-garmin/docs/superpowers/plans/` in Task 1.

## Global Constraints

- **Manifest:**
  - `type="watch-app"`, `minApiLevel="3.2.0"`.
  - Permissions exactly `Positioning`, `Sensor`, `Fit`, `Communications`, `Background`.
- **Sport:** `Activity.SPORT_SURFING` (38), session name "Surf".
- **Recording:**
  - 1 Hz, best multi-constellation GPS the device offers. Never swim mode.
  - Buttons only once recording starts: touch input does nothing in the Recording, Stop, Rate and Saved views.
- **Look (approved Oct 18):**
  - black background, Quiver orange `0xF78E42` timer and primary actions, Quiver teal `0x00D4AA` status and water temp, red `0xE24B4A` heart rate, white text;
  - copy exactly as in the spec's screens table ("QUIVER", "GPS ready", "START", "settling", "How was it?", "Saved", "Sends to Quiver when your phone is near", "N surfs waiting", "Link Quiver", "Open the Garmin Connect notification on your phone", "or Quiver › Settings › Garmin").
- **Water temp:** "settling" until 600 s elapsed, then the median of the last 180 s of wrist temperature.
- **Paddle distance (watch):** GPS distance accumulated only while speed < 2.5 m/s.
- **Units** follow `System.getDeviceSettings()` temperature and distance units.
- **Storage:** one `Application.Storage` value per chunk, each < 32 KB. Never delete an unsent surf. Delete a surf only after `complete` returns a final status.
- **Device token:** in `Application.Storage` key `"deviceToken"`, never `Properties`.
- **API base:** `https://www.quiversurf.app`. Watch requests send `Authorization: Bearer <deviceToken>`. Every response uses the `{ success, data }` / `{ success:false, error, details }` envelope.
- **Developer signing key:**
  - Generated once, stored outside the repo (`~/.garmin/quiver_developer_key.der`, plus a copy in Steven's password manager).
  - Every store update must be signed with the same key. Losing it means the app can never be updated.
- **No GitHub Actions** (private repos stay off for cost). Tests run locally.

## Watch ↔ server contract

Defined here; the server plan implements it verbatim.

```
POST /api/v1/garmin/link-codes            (no auth, rate-limited)
  body {deviceUid, partNumber, appVersion}          → 201 data {code:"482913", linkId, pollSecret, expiresAt}
GET  /api/v1/garmin/link-codes/{linkId}?pollSecret=…  → 200 data {status:"pending"} | {status:"linked", deviceToken} (token returned once) | {status:"claimed"}
                                                      → 410 error "expired"
GET  /api/v1/watch/spots                    (Bearer)  → 200 data {spots:[{id,name,lat,lon}]}  (≤ 20)
POST /api/v1/watch/uploads/{surfId}/chunks/{index}   (Bearer)
  body {header?, t0, lat0, lon0, rows:[[dt,dlat,dlon,speedCms,hr,tempDeci],…]}  → 200 data {received:index}
POST /api/v1/watch/uploads/{surfId}/complete         (Bearer)
  body {chunkCount}                                   → 200 data {status:"completed"|"needs_beach"|"failed"|"duplicate", sessionId:string|null}
                                                      → 409 error "missing_chunks" details {missing:[…]}
401 on any Bearer route = token revoked/unknown → watch returns to "not linked", queue kept.
```

**Chunk encoding:**
- `t0` is the epoch second of the chunk's first row.
- `lat0`/`lon0` are the first fix in the chunk, in 1e-7° integers, or `null` if the chunk has no fix.
- Each row holds:
  - `dt`: seconds since the previous row (0 for the first);
  - `dlat`/`dlon`: 1e-7° change from the previous row that had a fix (the first fix is relative to `lat0`/`lon0`, so it is `0,0`), or `null` when this second has no fix;
  - `speedCms`: integer cm/s or `null`;
  - `hr`: bpm or `null`;
  - `tempDeci`: 0.1 °C or `null`.
- At most 300 rows per chunk.

**Header** (on chunk 0 only):
`{surfId, startedAt, endedAt, sport:"surfing", partNumber, deviceName, appVersion, rating:1..5|null, chunkCount}`

## Review Focus

1. **The phone is in the car for a whole surf and the next day too.** Expect several surfs queued, nothing lost, and all of them draining later in order. Covered in Task 5 (queue) and Task 8 (uploader).
2. **A chunk is too big for the BLE relay** (`Communications.BLE_REQUEST_TOO_LARGE`, -102). The chunk splits in half and retries; it never loops forever on the same size. Covered in Task 8.
3. **The watch was never linked, or was unlinked mid-queue (401).** Recording still works, the queue is kept, and the Saved screen still counts waiting surfs. Covered in Task 5, Task 7 and Task 8.
4. **GPS drops out for minutes while the wrist is underwater.** Rows still write every second, with `null` positions. Paddle distance and the encoder handle the gap without a jump on re-fix. Covered in Task 2 and Task 3.
5. **Storage fills mid-surf.** The current surf keeps recording to the FIT. The buffer stops appending and marks the surf truncated, and the Saved screen says "Storage full — open Quiver near your phone". It never crashes, and never deletes another unsent surf. Covered in Task 5 and Task 6.

---

## File structure (`quiver-garmin`)

| Path | Responsibility |
|---|---|
| `manifest.xml`, `monkey.jungle` | App id, products, permissions, API floor |
| `resources/strings/strings.xml`, `resources/drawables/` | Copy and launcher icon |
| `source/QuiverApp.mc` | AppBase: views, background service delegate, temporal event registration |
| `source/core/SampleEncoder.mc` | Pure: rows → chunk dictionaries |
| `source/core/WaterTemp.mc`, `source/core/PaddleMeter.mc` | Pure: display filters |
| `source/core/Geo.mc` | Pure: haversine, nearest spot |
| `source/store/SurfStore.mc` | `Application.Storage` queue of surfs and chunks |
| `source/record/Recorder.mc` | ActivityRecording + Position + Sensor → rows → SurfStore |
| `source/net/Api.mc`, `source/net/Uploader.mc`, `source/net/Linker.mc`, `source/net/Spots.mc` | Watch API client, queue drain, linking, spots cache |
| `source/ui/*.mc` | Start, Recording, StopMenu, Rate, Saved, Link views + delegates |
| `source/bg/DrainService.mc` | `(:background)` ServiceDelegate draining the queue |
| `source/test/*.mc` | `(:test)` unit tests, compiled with `monkeyc -t` |
| `scripts/build.sh`, `scripts/test.sh`, `scripts/products.py` | Build per device, run unit tests in the simulator, generate the product list |

---

### Task 1: Repo, manifest, build and test harness

**Files:**
- Create: `manifest.xml`, `monkey.jungle`, `resources/strings/strings.xml`, `resources/drawables/drawables.xml`, `resources/drawables/launcher_icon.png`, `source/QuiverApp.mc`, `source/test/SmokeTest.mc`, `scripts/build.sh`, `scripts/test.sh`, `scripts/products.py`, `.gitignore`, `README.md`, and move this plan to `docs/superpowers/plans/2026-10-18-garmin-watch-app.md`

**Interfaces:**
- Produces:
  - `scripts/build.sh <device> [--release]` writes `bin/quiver-<device>.prg`.
  - `scripts/test.sh <device>` builds with `-t`, starts the simulator if it isn't running (`connectiq`), runs `monkeydo bin/quiver-test.prg <device> -t`, and exits non-zero on any failed test.
  - `scripts/products.py` prints the `<iq:product>` list.

- [ ] **Step 1:** Generate the developer key outside the repo, and add `*.der`, `*.pem` and `bin/` to `.gitignore`:
  `openssl genrsa -out ~/.garmin/quiver_developer_key.pem 4096 && openssl pkcs8 -topk8 -inform PEM -outform DER -in ~/.garmin/quiver_developer_key.pem -out ~/.garmin/quiver_developer_key.der -nocrypt`
  Record in `README.md` that the key must be backed up.
- [ ] **Step 2:** Write `scripts/products.py`. It reads `~/Library/Application Support/Garmin/ConnectIQ/Devices/*/compiler.json` and keeps devices that meet all of these:
  - `appTypes` contains `watchApp` with `memoryLimit >= 262144`;
  - any `partNumbers[].connectIQVersion >= "3.2.0"`;
  - `deviceFamily` is not edge, approach, oregon, montana, gpsmap or descent.

  It prints sorted `<iq:product id="…"/>` lines. Paste the output into `manifest.xml`. `fr165` must be in it.
- [ ] **Step 3:** Write `manifest.xml` with the Global Constraints values, `monkey.jungle` (`project.manifest = manifest.xml`), and a `QuiverApp` showing a placeholder view.
- [ ] **Step 4:** Write `source/test/SmokeTest.mc`, containing `(:test) function smokeTest(logger as Test.Logger) as Boolean { return true; }`.
- [ ] **Step 5:** Run `scripts/build.sh fr165` and `scripts/test.sh fr165`. Expected: build OK, then `PASSED 1 of 1`.
- [ ] **Step 6:** Commit with `chore: scaffold Quiver Connect IQ watch app`.

### Task 2: Sample encoder

**Files:**
- Create: `source/core/SampleEncoder.mc`
- Test: `source/test/SampleEncoderTest.mc`

**Interfaces:**
- Produces:
  ```
  class SampleEncoder {
    function initialize(t0 as Number)            // epoch seconds of first row
    function add(t as Number, lat as Double or Null, lon as Double or Null, speed as Float or Null, hr as Number or Null, tempC as Float or Null) as Void
    function size() as Number                    // rows in this chunk
    function isFull() as Boolean                 // size() >= 300
    function toChunk() as Dictionary             // {"t0","lat0","lon0","rows"} per the contract
  }
  function decodeChunkForTest(chunk as Dictionary) as Array<Array>   // (:test)-only helper: absolute rows back
  ```

- [ ] **Step 1: Write the failing tests.**
  - `roundTripsFixesWithin1e7`: 5 rows with fixes; decoding gives back each lat/lon within 1e-7°, plus the same speed (cm/s rounded), hr and tempDeci.
  - `nullFixRowsKeepTimeAndDeltasResume`:
    - rows 1–3 have fixes, rows 4–6 have `null` lat/lon, row 7 has a fix;
    - rows 4–6 encode `dlat`/`dlon` as `null`;
    - row 7's delta is relative to row 3;
    - decoding restores row 7 exactly.
  - `firstFixMidChunk`: `lat0`/`lon0` is the first non-null fix, and earlier rows are `null`.
  - `chunkWithNoFixHasNullOrigin`: `lat0`/`lon0` are `null`.
  - `fullAt300`: `isFull()` is false at 299 and true at 300.
  - `serializedChunkUnder32KB`: 300 rows of worst-case values (7-digit deltas, all fields present) serialize below 32768 bytes. Check with `Toybox.StringUtil`/JSON length, or a conservative character count.
- [ ] **Step 2:** Run `scripts/test.sh fr165`. Expected: FAIL (undefined symbol).
- [ ] **Step 3:** Implement. Round degrees with `Math.round(deg * 1e7).toNumber()`, speed with `Math.round(mps * 100)`, and temperature with `Math.round(c * 10)`.
- [ ] **Step 4:** Run `scripts/test.sh fr165`. Expected: all pass.
- [ ] **Step 5:** Commit with `feat: delta-encode 1 Hz samples into upload chunks`.

### Task 3: Water temperature and paddle distance filters

**Files:**
- Create: `source/core/WaterTemp.mc`, `source/core/PaddleMeter.mc`, `source/core/Geo.mc`
- Test: `source/test/FiltersTest.mc`

**Interfaces:**
- Produces:
  ```
  class WaterTemp { function add(elapsedS as Number, tempC as Float or Null) as Void; function display() as Float or Null }  // null = "settling"
  class PaddleMeter { function add(lat as Double or Null, lon as Double or Null, speed as Float or Null) as Void; function meters() as Float }
  module Geo { function haversineM(lat1, lon1, lat2, lon2) as Float; function nearest(spots as Array<Dictionary>, lat as Double, lon as Double, maxM as Float) as Dictionary or Null }
  ```

- [ ] **Step 1: Write the failing tests.**
  - `settlingBefore600s`: `display()` is null at elapsed 599.
  - `medianOfLast180s`: after 600 s, `display()` is the median of readings in the last 180 s; older readings are ignored.
  - `ignoresNullTemps`.
  - `paddleCountsOnlyBelow2_5`: moving 10 m at 1.0 m/s adds ~10 m; moving 30 m at 4.0 m/s adds 0.
  - `paddleSkipsNullFixWithoutJump`:
    - fix A, then 60 null rows, then fix B 50 m away at speed 1.0;
    - adds at most 50 m;
    - and the leg is skipped if more than 30 s passed, matching the server's 30 s bridging rule. Assert 0 for a 60 s gap.
  - `nearestWithin3km`: of 3 spots, returns the nearest one under 3000 m, and null when all are farther.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The median uses a small ring buffer of at most 180 values.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: water temp settle filter, paddle meter and spot distance`.

### Task 4: Device token, API client and spots cache

**Files:**
- Create: `source/net/Api.mc`, `source/net/Spots.mc`
- Test: `source/test/ApiTest.mc`

**Interfaces:**
- Produces:
  ```
  module Api {
    const BASE = "https://www.quiversurf.app";
    function token() as String or Null;                 // Storage "deviceToken"
    function setToken(t as String or Null) as Void;
    function isLinked() as Boolean;
    function request(method, path as String, body as Dictionary or Null, cb as Method(code as Number, data as Dictionary or Null) as Void) as Void  // JSON in/out, Bearer when linked, unwraps {success,data}
    function unwrap(code as Number, body as Dictionary or Null) as Dictionary or Null   // pure, testable
  }
  module Spots { function refresh() as Void; function cached() as Array<Dictionary>; }  // Storage "spots"
  ```

- [ ] **Step 1: Write the failing tests** for `unwrap`:
  - 200 `{success:true,data:{a:1}}` → `{a:1}`;
  - 409 `{success:false,error:"missing_chunks",details:{missing:[2]}}` → `{error:"missing_chunks",details:{…}}`;
  - a null body → null;
  - 401 → `{error:"unauthorized"}`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `request` uses `Communications.makeWebRequest` with `:method`, `:headers` (`Content-Type: application/json`, plus `Authorization: Bearer …` when linked), and `:responseType` JSON. A 401 anywhere calls `setToken(null)`. `Spots.refresh` runs on app open when linked and caches at most 20 spots.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: watch API client, device token storage and spots cache`.

### Task 5: Surf queue in Application.Storage

**Files:**
- Create: `source/store/SurfStore.mc`
- Test: `source/test/SurfStoreTest.mc`

**Interfaces:**
- Produces:
  ```
  module SurfStore {
    function begin(surfId as String, startedAt as Number) as Void          // creates header {status:"recording", chunkCount:0, truncated:false}
    function appendChunk(surfId as String, chunk as Dictionary) as Boolean // false when storage is full → header.truncated = true
    function finish(surfId as String, endedAt as Number, rating as Number or Null) as Void  // status "queued"
    function discard(surfId as String) as Void
    function queued() as Array<String>                                     // oldest first
    function header(surfId as String) as Dictionary or Null
    function chunk(surfId as String, index as Number) as Dictionary or Null
    function replaceChunk(surfId as String, index as Number, parts as Array<Dictionary>) as Void  // split on too-large
    function remove(surfId as String) as Void                              // after a final server answer only
    function waitingCount() as Number
  }
  ```
  Storage keys: `"q"` (array of surf ids), `"h.<id>"` (header) and `"c.<id>.<n>"` (chunks).

- [ ] **Step 1: Write the failing tests.**
  - `beginAppendFinishQueues`: 3 chunks, then `finish` → `queued()` is `[id]` and `header.chunkCount == 3`.
  - `queueKeepsOrder`: three surfs come back oldest first.
  - `discardRemovesAllKeys`: after discard, no `h.`/`c.` keys remain.
  - `appendFailureMarksTruncatedAndKeepsOthers`:
    - simulate a full store with an injected `put` that throws `StorageFullException` on the 4th chunk;
    - `appendChunk` returns false and `header.truncated` is true;
    - earlier surfs are untouched.
  - `replaceChunkRenumbers`: splitting chunk 1 of 3 into two gives chunkCount 4, in order.
  - `removeOnlyAfterFinal`: `remove` deletes header and chunks, and `waitingCount` drops by one.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. Wrap `Application.Storage.setValue` so tests can inject a failing writer, as a module-level function reference.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: on-watch surf queue with truncation and split support`.

### Task 6: Recorder

**Files:**
- Create: `source/record/Recorder.mc`
- Test: `source/test/RecorderTest.mc`

**Interfaces:**
- Consumes: `SampleEncoder`, `WaterTemp`, `PaddleMeter` and `SurfStore`.
- Produces:
  ```
  class Recorder {
    function start() as Void      // ActivityRecording.createSession({:name=>"Surf", :sport=>Activity.SPORT_SURFING}); session.start(); Position + Sensor listeners; 1 s timer
    function tick(nowEpoch as Number, info as Dictionary) as Void   // pure-ish: info = {lat,lon,speed,hr,tempC}; feeds encoder/filters; flushes full chunks to SurfStore
    function stop() as Void; function resume() as Void
    function save(rating as Number or Null) as Void   // session.save(); flush last chunk; SurfStore.finish
    function discard() as Void                       // session.discard(); SurfStore.discard
    function elapsed() as Number; function heartRate() as Number or Null; function waterTemp() as Float or Null; function paddleMeters() as Float
    function gpsQuality() as Number   // 0..4 from Position.Info.accuracy
  }
  ```

- [ ] **Step 1: Write the failing tests** for `tick` with a fake clock and no hardware:
  - `flushesEvery300Rows`: 650 ticks → 2 chunks stored, 50 rows pending; `save(null)` → 3 chunks.
  - `rowEverySecondEvenWithoutFix`: null lat/lon ticks still add rows.
  - `saveStoresRating`: `save(4)` → `header.rating == 4`.
  - `truncatedStillSaves`: when `appendChunk` returns false, ticks continue without throwing, and `save` still finishes the surf.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Position config: request `Position.CONFIGURATION_GPS_GLONASS_GALILEO_BEIDOU_L1_L5` when `Position has :hasConfigurationSupport` and the device supports it. Otherwise fall back through the device's supported list to `LOCATION_CONTINUOUS`.
  - HR and temperature come from `Sensor.getInfo()`.
  - The surf id is a random UUID-shaped string from `Cryptography.randomBytes(16)`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: record surfing activity and 1 Hz Quiver sample buffer`.

### Task 7: Linking

**Files:**
- Create: `source/net/Linker.mc`
- Test: `source/test/LinkerTest.mc`

**Interfaces:**
- Consumes: `Api`.
- Produces:
  ```
  class Linker {
    function begin(onCode as Method(code as String) as Void, onDone as Method(linked as Boolean) as Void) as Void
      // POST link-codes {deviceUid: System.getDeviceSettings().uniqueIdentifier, partNumber, appVersion}
      // then Communications.openWebPage("https://go.quiversurf.app/sessions/garmin-link", {"code"=>code}, null)
      // then poll GET link-codes/{linkId}?pollSecret= every 3 s until linked / expired / cancel()
    function cancel() as Void
    function handlePoll(code as Number, data as Dictionary or Null) as Symbol   // pure: :pending | :linked | :expired | :retry
  }
  ```

- [ ] **Step 1: Write the failing tests** for `handlePoll`:
  - 200 `{status:"pending"}` → `:pending`;
  - 200 `{status:"linked",deviceToken:"t"}` → `:linked`, and `Api.token() == "t"`;
  - 200 `{status:"claimed"}` → `:expired` (the token was already taken; start over);
  - 410 → `:expired`;
  - -104 (`BLE_CONNECTION_UNAVAILABLE`) → `:retry`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. The partNumber comes from the device's part number in `System.getDeviceSettings()` where available. Otherwise use the manifest product id baked in at build time from the jungle `:product`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: link the watch to Quiver with a short code`.

### Task 8: Uploader and background drain

**Files:**
- Create: `source/net/Uploader.mc`, `source/bg/DrainService.mc`
- Modify: `source/QuiverApp.mc`:
  - `getServiceDelegate`;
  - `onStart` calls `Uploader.drain` and `Spots.refresh` when linked;
  - `Background.registerForTemporalEvent(new Time.Duration(900))` while `SurfStore.waitingCount() > 0` and linked;
  - delete the registration when the queue is empty.
- Test: `source/test/UploaderTest.mc`

**Interfaces:**
- Consumes: `Api` and `SurfStore`.
- Produces:
  ```
  class Uploader {
    function initialize(send as Method(path as String, body as Dictionary, cb as Method) as Void)   // injectable transport
    function drain(onIdle as Method(waiting as Number) as Void) as Void   // one surf at a time, oldest first
    function onChunkResult(code as Number, data as Dictionary or Null) as Void
    function onCompleteResult(code as Number, data as Dictionary or Null) as Void
  }
  ```
  Behaviour:
  - Chunks go in index order, with the header on chunk 0.
  - On 200 → next chunk.
  - On -102 `BLE_REQUEST_TOO_LARGE` → `SurfStore.replaceChunk` splits it into two halves and retries. If a chunk is already 1 row, mark the surf failed locally and leave it queued.
  - On network errors (-104, -2, -3, -300, -400 range) → stop draining, retry on the next drain.
  - On 401 → `Api.setToken(null)`, stop, keep the queue.
  - On `complete` 200 with any final status → `SurfStore.remove(id)`.
  - On 409 `missing_chunks` → re-send the listed chunks, then complete again.

- [ ] **Step 1: Write the failing tests** with a fake transport scripted per call:
  - `uploadsAllChunksThenCompletesAndRemoves`.
  - `splitsOnTooLargeAndContinues`: chunk 1 returns -102 once → it is split, both halves are sent, and complete sends the new chunkCount.
  - `stopsOnNetworkErrorAndKeepsQueue`.
  - `unauthorizedUnlinksAndKeepsQueue`.
  - `missingChunksResent`.
  - `drainsOldestFirstAcrossThreeSurfs`.
  - `finalStatusesAllRemove`: completed, needs_beach, failed and duplicate each remove the surf.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement. `DrainService` is `(:background)` and runs one `drain`. Annotate only what the background needs as `(:background)`, and verify the background build stays under the 64 KB background limit (simulator: File › View Memory, while the background event fires).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat: drain queued surfs to Quiver, foreground and background`.

### Task 9: Screens

**Files:**
- Create: `source/ui/StartView.mc`, `source/ui/RecordView.mc`, `source/ui/StopMenu.mc`, `source/ui/RateView.mc`, `source/ui/SavedView.mc`, `source/ui/LinkView.mc`, `source/ui/Delegates.mc`, `source/ui/Theme.mc`
- Modify: `source/QuiverApp.mc`, `resources/strings/strings.xml`

**Interfaces:**
- Consumes: `Recorder`, `Linker`, `Uploader`, `Spots`, `SurfStore` and `Geo.nearest`.
- Produces: the seven screens from the spec table, with their button mapping:
  - **Start:** Start begins recording only when `gpsQuality() >= 3`. Before that, the arc reads "Waiting for GPS". Back exits; Menu opens Link and Settings.
  - **Recording:** Start/Stop opens StopMenu; the Light button toggles the backlight; touch is ignored.
  - **StopMenu** (Menu2): Resume / Save / Discard. Discard asks for confirmation.
  - **Rate:** Up/Down from 0–5, Start saves, Back skips and saves with null.
  - **Saved:** Shows the waiting count, or "Storage full — open Quiver near your phone" when the surf was truncated. Any key returns to Start and triggers `Uploader.drain`.
  - **Link:** Shows the code and polls; Back cancels.

- [ ] **Step 1:** Implement the views. Draw the arcs with `dc.drawArc` scaled to `dc.getWidth()`. Positions are proportional so round 260–454 px and MIP screens all fit.
- [ ] **Step 2:** In the simulator, run fr165, fenix7, epix2pro47mm, instinct3 (or its nearest available MIP model) and venu3. Screenshot all seven screens on fr165 and Start/Recording on the others. Compare fr165 against the approved mock-ups.

  Expected:
  - no clipped text;
  - the timer is legible at 1:12:34;
  - "settling" shows before 10 min.
- [ ] **Step 3:** Commit with `feat: Quiver watch screens in the approved look`.

### Task 10: End-to-end check

**Files:**
- Modify: `README.md` (how to sideload and how to export for the store)

This task is verification only. Store submission is Steven's step.

- [ ] **Step 1: Simulator replay against the dev server.**
  - Point `Api.BASE` at the dev deployment through a jungle build flag (`(:debug)` constant). Never ship that flag in release builds.
  - Link with the dev web confirm page.
  - Replay `.quiver/reviews/garmin-surf-competitors-20261016/fixtures/2026-10-17-ob-dawn-patrol.fit` using Simulation › FIT data playback, then save with rating 3.

  Expected:
  - the server returns `completed`;
  - the session shows waves at Ocean Beach Pier;
  - the queue empties.
- [ ] **Step 2: Offline queue.**
  - In the simulator, disconnect the phone (Settings › Connection Type: none).
  - Record and save 3 short surfs. The Saved screen shows "3 surfs waiting".
  - Reconnect and open the app.

  Expected: all 3 drain oldest first.
- [ ] **Step 3: Revoke.** Unlink the watch on the dev web. The next drain gets 401: the watch shows not linked and the queue is kept.
- [ ] **Step 4: Sideload to Steven's FR165.**
  - Build: `scripts/build.sh fr165 --release`.
  - Copy `bin/quiver-fr165.prg` to `GARMIN/Apps` over MTP (memory: re-list MTP object ids before each copy).
  - Do a 2-minute dry-land walk, record and save: it must appear as `failed` (`too_short`) in Settings › Garmin, never as a session.
  - A 15-minute walk near a beach becomes a *private* session (no counted wave), never a public one.
- [ ] **Step 5: Export the store build.** Run `monkeyc -e -r -f monkey.jungle -o bin/quiver.iq -y ~/.garmin/quiver_developer_key.der`. Keep `bin/quiver.iq` for Steven's beta upload.
- [ ] **Step 6:** Commit the README changes with `docs: sideload and store export steps`.
