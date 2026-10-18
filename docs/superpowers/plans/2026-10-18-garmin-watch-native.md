# Quiver for Garmin: native screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the phone screens for the Garmin watch app in `quiver-native`:

- **Link confirm screen:** opened from the watch's Garmin Connect notification.
- **Beach picker:** for a watch surf that needs a beach.
- **Settings › Garmin:** linked watches, unlink, type the code, recent problems.
- **Session view additions:** paddle distance, heart rate and set rhythm.

**Architecture:** React Navigation (not expo-router). Each screen is a `RootStackParamList` route, plus a path in `linking.config` in `src/navigation/types.ts`, plus a lazy screen in `src/navigation/root-navigator.tsx`.

- **No new native dependency:** the screens are JavaScript only.
- **Links:** every link path sits under the `/sessions` prefix the installed app already claims, so this ships by OTA after a fingerprint check.
- **Data:** everything comes from the `quiver` web API through `src/lib/api-client.ts`.

**Tech Stack:** Expo / React Native, React Navigation 7, TanStack Query, Jest (`jest-expo`), the `api-client` (`apiGet`/`apiPost`/`apiDelete`).

**Spec:** `quiver/docs/superpowers/specs/2026-10-18-garmin-watch-app-design.md` (#1130)

**Depends on:**
- `quiver/docs/superpowers/plans/2026-10-18-garmin-watch-server.md`, Tasks 4, 7 and 9 (the API below).
- **Part 1's native plan** (branch `origin/docs/session-waves-native-plan`, quiver-native#529), which adds `WavesSection`. Task 5 of this plan runs only after that plan is merged and executed. Tasks 1–4 don't need it.

This plan is kept in `quiver` next to the spec. Executors work in a `quiver-native` worktree from `origin/main`.

## Global Constraints

- **Flag:** every new entry point is gated by `isGarminWatchEnabled()` in `src/lib/garmin-watch-flags.ts`, which returns `process.env.EXPO_PUBLIC_GARMIN_WATCH_ENABLED === 'true'`. Add `EXPO_PUBLIC_GARMIN_WATCH_ENABLED=false` to `.env.example` and register it in `scripts/release-feature-flags.sh`, matching its test.
- **Routes and paths:**
  - `GarminLink: { code?: string }` → `'sessions/garmin-link'`
  - `GarminImport: { importId: string }` → `'sessions/imports/:importId'`
  - `GarminSettings: undefined` → no URL path; in-app navigation only.
  - Do not touch `app.config.js` or `config/app-link-contract.json`.
- **API** (quiver server plan; envelope `{ success, data }`):
  ```
  POST   /api/v1/garmin/link-codes/{code}/confirm    → 200 data {linked:true, deviceName}; 404 "not_found" (unknown/expired); 404 "unavailable" (flag/allowlist off → "Garmin watches aren't available yet"); 409 "already_confirmed"
  GET    /api/v1/watch/devices                       → 200 data {devices:[{id,name,partNumber,linkedAt,lastSeenAt}], problems:[{importId,startedAt,status:"failed"|"needs_beach",reason:string|null}]}
  DELETE /api/v1/watch/devices/{id}                  → 200 data {unlinked:true}
  GET    /api/v1/session-imports/{id}                → 200 data {id,status,origin,startedAt:string|null,candidates:ImportBeach[],sessionId:string|null}
  POST   /api/v1/session-imports/{id}/beach {beachId} → part 1 contract (200 completed / 409 not_needs_beach / …)
  ```
  `ImportBeach = { id, name, lat, lon, swellWindowCenterDeg }`.
- **Waves summary additions** (nullable): `paddleDistanceM`, `heartRateAvg`, `heartRateMax`, `setIntervalMin`, `recordedWith`. These stats also show for FIT/GPX imports when present (R9); do not restrict them to watch-origin imports.
- **Push data:** keep `type` and the identifier fields when routing:
  - `watch_session_ready`: `{type:"watch_session_ready", session_id, url:"/sessions/{session_id}", deeplink:"quiver://sessions/{session_id}"}`.
  - `watch_session_needs_beach`: `{type:"watch_session_needs_beach", import_id, url:"/sessions/imports/{import_id}", deeplink:"quiver://sessions/imports/{import_id}"}`.
- **Copy:**
  - "Link this Garmin watch?"
  - "Pick the beach for your {Mon D} surf"
  - "Sets about every {N} min"
  - "About {X} km paddled" (or mi, by the user's units)
  - "Water ~{T}° (session median)"

  Never "the call".
- **Analytics:** add `garmin_link_confirmed`, `garmin_watch_unlinked` and `garmin_import_beach_chosen` to `NATIVE_ANALYTICS_EVENT_TYPES` in `src/lib/analytics.ts`, and to the pinned list in `src/__tests__/analytics.test.ts`.
- **Tests:** `npm test -- <path>`; full `npm test` before the PR (TZ is pinned to LA). The network guard fails unmocked fetches. Native PRs have no CI.

## Review Focus

1. **Tapping the watch's link while signed out** must not lose the code. Stash `{ code }` and open GarminLink right after sign-in. Covered in Task 2.
2. **An expired or already-used code** shows "That code expired. Start again on your watch." and doesn't spin forever. Covered in Task 2.
3. **`go.quiversurf.app/sessions/garmin-link` and `/sessions/imports/x`** resolve to GarminLink and GarminImport, never to `SessionDetail` with `sessionId:'garmin-link'`. Covered in Task 1.
4. **Opening a beach-picker link for an import that has already been resolved** shows its session (a "View session" button), not a dead picker. Covered in Task 3.
5. **The flag is off** but someone has an old link: GarminLink shows "Garmin watches aren't available yet" instead of calling the API. Covered in Task 2.

---

### Task 1: Flag, routes, linking and API module

**Files:**
- Create: `src/lib/garmin-watch-flags.ts`, `src/features/garmin-watch/api.ts`, `src/features/garmin-watch/types.ts`
- Modify: `src/navigation/types.ts` (RootStackParamList plus linking config), `.env.example`, `scripts/release-feature-flags.sh`, `docs/DEEP_LINKING.md` (route table), `src/navigation/ARCHITECTURE.md`
- Test: `src/__tests__/linking-config.test.ts` (extend), `src/features/garmin-watch/__tests__/api.test.ts`, `src/__tests__/release-feature-flags.test.ts` (extend)

**Interfaces:**
- Produces:
  ```ts
  export function isGarminWatchEnabled(): boolean
  export type ImportBeach = { id: string; name: string; lat: number; lon: number; swellWindowCenterDeg: number | null }
  export type WatchDevice = { id: string; name: string; partNumber: string; linkedAt: string; lastSeenAt: string | null }
  export type WatchProblem = { importId: string; startedAt: string | null; status: 'failed' | 'needs_beach'; reason: string | null }
  export type SessionImport = { id: string; status: 'uploaded' | 'needs_beach' | 'completed' | 'failed'; origin: 'file' | 'garmin_watch'; startedAt: string | null; candidates: ImportBeach[]; sessionId: string | null }
  export function confirmGarminLink(code: string): Promise<{ linked: true; deviceName: string }>
  export function listWatchDevices(): Promise<{ devices: WatchDevice[]; problems: WatchProblem[] }>
  export function unlinkWatchDevice(id: string): Promise<void>
  export function getSessionImport(id: string): Promise<SessionImport>
  export function chooseImportBeach(id: string, beachId: string): Promise<{ status: string; sessionId?: string }>
  ```

- [ ] **Step 1: Write the failing tests.**
  - Linking: `https://go.quiversurf.app/sessions/garmin-link?code=482913` → route `GarminLink`, params `{ code: '482913' }`.
  - `https://www.quiversurf.app/sessions/imports/<uuid>` → `GarminImport { importId }`.
  - `/sessions/<uuid>` still → `SessionDetail`.
  - `/sessions/new` still → `SessionForm`.
  - API: each function calls the exact path and method above through mocked `apiGet`/`apiPost`/`apiDelete`, and unwraps `data`.
- [ ] **Step 2:** Run `npm test -- src/__tests__/linking-config.test.ts src/features/garmin-watch`. Expected: FAIL.
- [ ] **Step 3:** Implement. Add the two `linking.config.screens` entries next to `SessionForm: 'sessions/new'`.
- [ ] **Step 4:** Run the tests, plus `npm run typecheck` and `npm run verify:app-link-parity` (with `QUIVER_WEB_REPO` pointing at a quiver checkout). Expected: PASS. The parity check passes because both paths sit under the `/sessions` prefix rule.
- [ ] **Step 5:** Commit with `feat(garmin): routes, flag and API client for watch screens`.

### Task 2: Link confirm screen

**Files:**
- Create: `src/screens/garmin-link.tsx`, `src/stores/pending-garmin-link.ts`
- Modify: `src/navigation/root-navigator.tsx` (lazy import, wrapper, `Stack.Screen` in the authenticated group), the post-sign-in handler that consumes stashed inbound links (follow how `handle-inbound-url.ts` stashes other links for after auth)
- Test: `src/__tests__/garmin-link.test.tsx`

**Interfaces:**
- Consumes: `confirmGarminLink` and `isGarminWatchEnabled`.
- Produces:
  - `GarminLinkScreen`.
  - `usePendingGarminLink` store, with `stash(code)` and `take(): string | null` (AsyncStorage-backed, 10-minute expiry).
- Screen states:
  - **Confirm:** "Link this Garmin watch?" with a code preview and a "Link watch" button.
  - **Linked:** "Linked. Your surfs will appear in Quiver after you save them on the watch."
  - **Expired** (404 or 409): "That code expired. Start again on your watch."
  - **No code:** a 6-digit code entry.
  - **Flag off:** "Garmin watches aren't available yet."

- [ ] **Step 1: Write the failing tests.**
  - The confirm tap posts the code and shows Linked.
  - 404 shows Expired.
  - Flag off shows the unavailable copy and makes no API call.
  - A signed-out inbound URL stashes the code, and after sign-in the app navigates to GarminLink with it.
  - The entry field accepts only 6 digits.
- [ ] **Step 2:** Run `npm test -- src/__tests__/garmin-link.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Implement, and track `garmin_link_confirmed` on success.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): confirm a watch link from the Garmin Connect notification`.

### Task 3: Beach picker for a watch surf

**Files:**
- Create: `src/screens/garmin-import.tsx`
- Modify:
  - `src/navigation/root-navigator.tsx`;
  - the native push-tap router: find where `data.type === 'like'` opens `SessionDetail` with `session_id`, and add `watch_session_ready` → `SessionDetail {sessionId: data.session_id}` and `watch_session_needs_beach` → `GarminImport {importId: data.import_id}`.
- Test: `src/__tests__/garmin-import.test.tsx`, plus the push router's existing test (two new cases)

**Interfaces:**
- Consumes: `getSessionImport`, `chooseImportBeach`, and the beach search component `SessionForm` uses for choosing a beach (reuse it, don't fork it).
- Produces: `GarminImportScreen`.
  - **`needs_beach`:** title "Pick the beach for your {Mon D} surf", the candidate list, then "Search beaches". Choosing calls `chooseImportBeach`; on completed it navigates to `SessionDetail`.
  - **`completed`:** "This surf is already in Quiver", with a "View session" button.
  - **`failed`:** the reason, plus "The activity is still in Garmin Connect."

- [ ] **Step 1: Write the failing tests** for the three states, the navigation to `SessionDetail` with the returned `sessionId`, and an analytics event on choose.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): pick a beach for a watch surf`.

### Task 4: Settings › Garmin

**Files:**
- Create: `src/screens/garmin-settings.tsx`
- Modify: `src/screens/settings.tsx` (a "Devices" `SettingsCard` with a "Garmin watch" `navRow`, testID `settings-garmin-watch`, rendered only when `isGarminWatchEnabled()`; place it after the APP card), `src/navigation/root-navigator.tsx`, `src/screens/ARCHITECTURE.md`
- Test: `src/__tests__/garmin-settings.test.tsx`, `src/__tests__/settings.test.tsx` (extend)

**Interfaces:**
- Consumes: `listWatchDevices`, `unlinkWatchDevice` and `confirmGarminLink`.
- Produces: `GarminSettingsScreen`.
  - **Linked watches:** name, "Linked {date}" and "Last sync {relative}". Unlink asks to confirm, then calls the API and tracks `garmin_watch_unlinked`.
  - **"Link a watch":** a 6-digit code entry that reuses the GarminLink confirm flow.
  - **"Needs attention":** problems. A needs_beach row opens GarminImport; a failed row shows its reason.
  - **Empty state:** "Install Quiver from the Connect IQ store on your Garmin, then open it and choose Link Quiver."

- [ ] **Step 1: Write the failing tests.**
  - The settings row is hidden when the flag is off.
  - Devices render.
  - Unlink confirms, then calls DELETE.
  - A problem row navigates to GarminImport.
  - Code entry posts confirm.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): Garmin watch settings`.

### Task 5: Session view additions (after part 1's native plan)

**Files:**
- Modify: `src/types/session-waves.ts` (part 1), `src/features/session-waves/waves-section.tsx` (part 1)
- Test: `src/features/session-waves/__tests__/waves-section.test.tsx` (part 1; extend)

**Interfaces:**
- Consumes: the `WavesSummary` additions.
- Produces: rows under the waves tiles. Each renders only when its value is non-null:
  - "About {X} km paddled"
  - "♥ avg {A} · max {M}"
  - "Sets about every {N} min"
  - "{recordedWith}"

- [ ] **Step 1: Write the failing tests:** each row renders from a fixture summary, and is absent when its field is null.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit with `feat(garmin): paddle distance, heart rate and set rhythm on sessions`.

### Task 6: Gate and OTA eligibility

- [ ] **Step 1:** Run `npm test` (full), `npm run typecheck` and `npm run lint`. Expected: all green.
- [ ] **Step 2:** Measure the Expo fingerprint on this branch against `origin/main`, per `soul.md` OTA guidance. Expected: unchanged, which makes the change OTA-eligible. If it changed, stop and report what changed.
- [ ] **Step 3:** Verify on the iOS Simulator:
  - open `https://go.quiversurf.app/sessions/garmin-link?code=123456` with `xcrun simctl openurl booted …` → GarminLink;
  - open Settings › Garmin with the flag on.

  Screenshot both.
- [ ] **Step 4:** Push, open a PR against native `main`, and note "OTA-eligible; flag off by default". No OTA without Steven's approval.


### Task 7: Confirm your surf (Oct 18 addendum)

**Files:**
- Create: `src/components/session/confirm-watch-surf-card.tsx`
- Modify: the session detail screen (owner view), the session update hook/API types (`forecast_accuracy`)
- Test: `src/__tests__/confirm-watch-surf-card.test.tsx`

**Interfaces:**
- Shows only for the owner of a session with `source === 'garmin_watch'` and `forecast_accuracy == null`.
- "Was the forecast right?" accurate / somewhat / off → `forecast_accuracy` `accurate | somewhat | inaccurate`; conditions chips (the session form's glassy / clean / choppy / blown out → `wave_characteristics`); crowd (the session form's crowd scale → `crowd_level`); size chips `WAVE_HEIGHT_CHIPS` preselected from the session's own `wave_height_ft` (the watch answer) and never from the forecast — no `chipValueForForecastFt` here.
- Saves with one `PATCH /api/sessions/{id}`; hides after a successful save; no new endpoint.

- [ ] Step 1: failing tests (hidden for non-owners, non-watch sessions and once answered; size preselect comes from the session not the forecast; one PATCH with exactly the touched fields).
- [ ] Step 2: run, expect FAIL. Step 3: implement. Step 4: run, expect PASS; sim screenshot.
- [ ] Step 5: commit `feat(garmin): confirm a watch surf's size and forecast`.
