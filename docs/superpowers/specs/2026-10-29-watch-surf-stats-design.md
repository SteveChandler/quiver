# Watch surf stats in the app

Approved by Steven on Oct 29, 2026, after his Forerunner 165 surf at Del Mar.

## Why

A Quiver watch surf already gives the server:
- a per-second track, with speed, heart rate and wrist temperature;
- per-ride detection (`detectWaves`, `wd-1.0.0`, rows in `session_waves`);
- a summary (`WavesSummary`: wave count, longest ride, top speed, paddle distance, heart rate);
- an edit path (`PATCH /api/v1/sessions/{id}/waves`).

None of this is shown in the native app. Steven wants to see, and adjust:
- wave count;
- longest ride;
- each ride: time, length, distance and top speed;
- distance;
- top speed;
- heart rate;
- calories;
- water temperature, and whether it went up or down during the surf.

These are additive to what sessions already have.

## Ground truth

`__tests__/fixtures/session-tracks/fr165-del-mar-2026-10-29.json` holds Steven's surf. Absolute position and heart rate are removed. He confirmed six waves, starting at the UTC times in `confirmedRidesUtc` (07:09, 07:14, 07:24, 07:35, 07:45 and 08:20 PT), "plus some attempts".

The rule that matched him: a ride is speed ≥ 3.0 m/s held ≥ 6 s, covering ≥ 30 m. The looser rule (≥ 2.5 m/s for ≥ 4 s) gave 22, which he called far too high.

## Server (quiver)

1. **Detector.** Tune `lib/sessions/wave-detection` so this fixture counts exactly the 6 confirmed rides, each matched within ±5 s of its start. Bump the detection version to `wd-1.1.0`.
   - Existing detection fixtures and tests must still pass. Change any expected counts only when the new rule is clearly right for that track, and say why in the commit.
   - Rides below the bar stay in `session_waves` as not counted (`counted: false`), so "attempts" remain visible and a user can count one.
2. **Water temperature.** Add `water_temp_start_c` and `water_temp_end_c` (`real`, nullable) to `session_tracks`:
   - start is the median of the first 10 in-water minutes;
   - end is the median of the last 10 in-water minutes;
   - both are null when the in-water span is shorter than 20 minutes or there are fewer than 60 readings.
   - Keep `water_temp_c` as it is.
3. **Calories.** Add `calories` (`smallint`, nullable) to `session_tracks`. Read it from:
   - the Quiver watch header's optional `calories` (an integer 0-5000; anything else is ignored), and
   - FIT `session.total_calories` when present.
4. **Migration.** One `ADD COLUMN IF NOT EXISTS` migration for the three columns. Regenerate the `types/database.generated.ts` entries by hand, never with `db:types:remote`. Applying it to prod needs Steven's approval; it is a release step.
5. **API.** `WavesSummary`, returned by `GET /api/v1/sessions/{id}/waves`, gains `calories`, `waterTempStartC` and `waterTempEndC`, each null when unknown.
   - The existing fields and the `PATCH {userWaveCount}` and per-wave exclude routes stay unchanged.
   - Everything must work before the migration is applied: missing columns read as null.
6. **Contract.** `lib/watch/watch-contract.json` gains `"headerOptional": ["calories"]`, with `contractVersion` unchanged. The pelican copy must match.

## Watch (pelican)

At stop, read `Activity.getActivityInfo().calories` inside try/catch, store it in the surf header, and send it as `calories` (an integer) in the chunk-0 header. Missing or invalid means the field is omitted. Version 0.2.2.

## App (quiver-native)

A "Your surf" card on the session detail screen. It shows only when `GET /api/v1/sessions/{id}/waves` returns a summary, which means a track exists.
- **Wave count:** large, editable with − and +, saved through `PATCH {userWaveCount}`. A "Reset" option goes back to the detected count.
- **Longest ride:** seconds and metres.
- **Top speed:** mph.
- **Distance:** paddle distance.
- **Heart rate:** average and max.
- **Calories:** when present.
- **Water:** start and end temperature with an up or down arrow and the difference, °F (for example "73°F → 71°F, ▼ 2°"). When the start or end is unknown, show the single water temperature.
- **Rides:** each counted ride with its local time, seconds, metres and top speed in mph. Attempts sit under a collapsed "Attempts" row. Tapping a ride toggles whether it counts, through the per-wave route that exists.
- Units: feet and mph. Follow the app's existing session card styles and the quiver-product-unity rules. Never add a headline score.

## Not in scope

- Garmin Connect auto-sync. That waits on Garmin approving the Starter application.
- Web UI.
