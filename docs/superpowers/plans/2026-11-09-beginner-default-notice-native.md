# Beginner Default Notice (Native) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tell a signed-in user with no skill level, one time, that Quiver rates their calls as a beginner, and let them set a level in place on Home. The notice shows only when the server says so (`skillDefaultApplied === true` on `/api/surf/call`).

**Architecture:** The surf-call mapper reads one new optional hint, `skillDefaultApplied`, and keeps it only on a rated call. `useHomeForecast` passes it to Home. A new hook in `src/features/skill-default-notice/` (exported through its `index.ts`) decides when to show the notice. Its timer, latch and once guard copy `src/components/community/use-surf-game-sign.ts`, and its gates copy the founding gift. Home renders the shared, merged `FallingSign` (`src/components/ui/falling-sign.tsx`) with the notice copy, as `community.tsx` does. "Set my level" opens the existing `SkillSheet` with a new `source` prop from `onExited`.

**Tech Stack:** Expo React Native 0.83.6, TypeScript, react-native-reanimated 4.2.1 (test spies only), AsyncStorage 2.2.0, TanStack Query, jest 29 (jest-expo) with `@testing-library/react-native`.

**Spec:** /Users/stevenchandler/Desktop/dev/quiver/.worktrees/go-checks-design/docs/superpowers/specs/2026-11-09-board-and-skill-aware-go-checks-design.md (section D5).

## Global Constraints

- Code base: quiver-native `origin/main` d0519918. It contains #693: `FallingSign`, `FallingSignProps`, `SIGN_MOTION`, `SIGN_MAX_FONT_SCALE`, `sign-board.tsx`, `src/lib/sound/sign-sounds.ts` and `assets/audio/sign-sounds-LICENSE.md`. All line numbers are from d0519918. Lines move, so trust the grep anchor next to each line number.
- Use `FallingSign` only through `FallingSignProps` (anchor `export interface FallingSignProps`). Do not edit `falling-sign.tsx`, `sign-board.tsx`, `sign-sounds.ts`, `community.tsx` or their tests. Do not add a sign component, a wrapper sheet, or motion, sound, haptic or asset code (spec D5: "Do not make a second sign component").
- **Dismiss action (deviation from spec D5).** `FallingSignProps.onSecondary` is `() => void`, and it is also the backdrop tap and the Android back button. So the notice logs `action: 'set_level' | 'keep'` only. Spec D5's `'backdrop'` and `'back'` values are not sent. Task 5 puts this in the PR body as an open item for Steven.
- `SKILL_AWARE_GO_CHECKS_ENABLED` and `SKILL_AWARE_GO_CHECKS_USER_ALLOWLIST` are server-only. Native reads only `report.skillDefaultApplied`. Native has no scoring change: do not copy the 70 / 40 thresholds, the D2 gate values or the safety vetoes.
- Fail closed. When the field is absent or not `true`, the app behaves as today: no notice, no new request, no new event, and the same `skill_added` payload for `'value_first'`. Neither `isSurfCallApiReport` nor `surfCallReportContract` checks the field's type, so a bad value costs the notice, never the call.
- `skillSource` and `userTier` stay null for a no-skill user. Do not edit `const isGeneralReport` (`use-surf-call.ts:648`) or `query.data?.skillSource != null` (`:703`). `callAudience` stays `'general'`.
- Analytics are PostHog only, through `capturePostHogEvent` (`src/lib/posthog.ts:528`). Never write these events to `user_events`.
- "Keep beginner", backdrop tap and Android back write nothing to the profile.
- Release order: (1) server field on prod, (2) native OTA on iOS and Android (or a build on a lane with no OTA), dormant until the field arrives, (3) server flag and allowlist. Each prod step needs Steven's yes. This plan does not publish an OTA.
- Release gate: an older binary ignores the field, so its user gets the beginner rating with no notice. Before a no-level user goes on the allowlist, confirm from the OTA runtime per user (memory "Telemetry sources for app audits") that the user runs an iOS OTA id or an Android OTA or build that includes this PR. If not, keep that user off. Before spec D4 step 3 clears the allowlist, confirm this PR is on both platforms' live release lines.
- Commits: stage by explicit path only, never `git add -A` or `git add .`. Every commit message ends with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` (the second `-m` in each Commit step).
- Jest: never run the full suite by hand. Before each jest command, run `source ~/.nvm/nvm.sh && nvm use 22 && export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"` and confirm `which node`. Always pass `--runTestsByPath`, and check that "Test Suites: N" equals the number of files passed.
- Push gate (`scripts/native-qa-selection.ts`): `forecast.ts` matches the contract rule (`:186`, anchor `native<->web API contract change`), which runs `verify-api-contracts.ts` against the live API (needs network and `.maestro/env/local.env`). `home.tsx` and `use-surf-call.ts` match `:278` (anchor `home surf call change`), and `use-surf-call.ts` also matches `:460` (anchor `forecast/discovery API change`). The other files fall to `:749` (anchor `unmapped app source fallback`): the full jest suite and the Maestro `smoke` shard. Push with the machine quiet.
- Model routing: implementers on Opus, reviewers and verification on Sonnet.

## Review Focus

1. The hint makes the call `'personal'`, a beginner-default call shows a blank NO, a bad hint value voids the call, or the hint stays on a blocked or unavailable "no call" hero (but it must stay on a beach-skill veto). Pinned in Task 1 (`keeps a default-applied call general`, `rates a beginner-default call from the canonical decision with no raw general report`, `keeps a beginner-default general call out of hold`, `keeps the call when skillDefaultApplied is %p`, `drops the hint when the next call is unavailable`, `drops the hint on a blocked call`, `keeps the hint on a beach-skill safety veto`).
2. The notice shows twice, or it takes the latch when another ask holds it or a gate fails. Pinned in Task 3 (`never shows twice in one process, even when the key write fails`, `yields to another ask and writes no key`, `claims nothing when the surface check fails`).
3. The notice shows in the onboarding-finish session, to a guest, or after the user set a level during the 1.5 s settle. Pinned in Task 3 (`never shows in the session that finished onboarding`, `returns the module-load time on every call`, `never shows to a guest`, `re-checks the profile at present time`).
4. "Set my level" opens nothing for a user outside the `value_first` variant, or opens `SkillSheet` while the sign's modal is still up. Pinned in Task 4 (`opens the skill sheet only after the sign has gone, for a control-variant user`) and checked on the simulator in Task 5.
5. A save from the notice counts as value-first funnel step 7, or a later PersonalizeStrip save keeps `source: 'default_notice'`. Pinned in Task 4 (`logs skill_added from the notice outside the funnel, then value_first again`).

---

## Workspace

- Run `git -C /Users/stevenchandler/Desktop/dev/quiver-native fetch -q origin && git -C /Users/stevenchandler/Desktop/dev/quiver-native worktree add .worktrees/skill-default-notice -b feat/skill-default-notice origin/main`. All paths below are relative to it. Use `.worktrees/`, not `.claude/worktrees/`, because jest ignores the latter.
- Bootstrap it in a Node 22 shell: `npm ci`, then copy `.env`, `.env.local`, `.env.production`, `.env.production.local` and `.maestro/env/local.env` from `/Users/stevenchandler/Desktop/dev/quiver-native` (never stage them). Check: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/api-contracts.test.ts` gives PASS, "Test Suites: 1 passed".

---

### Task 1: Read `skillDefaultApplied` from the surf-call report

**Files:**
- Modify: `src/hooks/use-surf-call.ts`:
  - `SurfCall`: after `userTier?` `:103` (anchor `export interface SurfCall {`, then its `userTier?: string | null;`).
  - `SurfCallApiReport`: after `userTier?` `:134` (anchor `interface SurfCallApiReport {`; this is the second `userTier?: string | null;` match).
  - `sanitizeBlockedSurfCall` `:293-310` (anchor `function sanitizeBlockedSurfCall(`).
  - The mapper return after `const canonicalCall =` (anchor `const keepRawGeneralReport =`, `:659`).
  - Do not change `isSurfCallApiReport` (`:235`).
- Modify: `src/lib/api-contracts/forecast.ts` (anchor `export const surfCallReportContract`, `:54`; add after `userTier` `:66`).
- Create: `src/__tests__/fixtures/surf-call-skill-default-v1.json`, the native half of the paired contract fixture (spec section 7). It is the exact bytes of the server's `__tests__/fixtures/surf-call-skill-default-v1.json` (server plan, "Native coupling"); the Step 1 pin test shows its shape.
- Test: `src/__tests__/api-contracts.test.ts` (in `describe('surf call contract tracks the client guard')`, after `accepts additive skill sources`).
- Test: `src/__tests__/use-surf-call-hook.test.ts` (after `drops a previous hold when the next call is unavailable` `:223`).
- Test: `src/__tests__/surf-decision.test.ts` (in `describe('deriveSharedSurfDecision')` `:1453`, after `allows a guest general report for an unknown-skill-only hold`).

**Interfaces:**
- Produces: `SurfCall.skillDefaultApplied?: true` (exported). `SurfCallApiReport.skillDefaultApplied?: unknown`.

Decisions:
- The guard does not check the field, and the contract declares it `z.unknown().optional()`. So both layers accept any value and still agree, as the `forecast.ts` header requires (anchor `deliberately a`). `skillSource` and `userTier` are different, because they feed `callAudience`.
- The hint goes only on a rated call. `apiCall` does not get the field. After `canonicalCall`, the mapper adds `skillDefaultApplied: true` only when `report.skillDefaultApplied === true && !isRecommendationBlocked(canonicalCall.recommendationAvailability)`. Both return branches (with and without `rawGeneralReport`) use that call. This covers `sanitizeBlockedSurfCall(apiCall, …)` and the not-matching-window branch of `applyCanonicalDecisionToSurfCall`, because both set a `state: 'none'` availability.
- The hint stays on a `safety_override` "no" with an unblocked availability. On quiver `origin/main` 49173e339, `beach_skill_exceeds_user` gives `decisionBasis: 'safety_override'` when no candidate is safe (`lib/recommendations/canonical-decision/engine.ts:406-411`, anchor `const safetyOverride =`). With D3b, a no-level user gets that veto from the beginner default, so that user needs the notice most. The hint also stays on an after-dark no-call (`'after_dark'`); the next day's call still uses the beginner rating.
- `sanitizeBlockedSurfCall` returns no `skillDefaultApplied` key. `unavailableCall` (`:532`) always calls it, so a cached `previous` call loses the hint on a 4xx (`:693`), a guard failure (`:569`) and `res.success === false`.

- [ ] **Step 1: Write the fixture and the failing tests**

Write the fixture first. When the server file is on quiver `origin/main`, copy its bytes (`git -C /Users/stevenchandler/Desktop/dev/quiver show origin/main:__tests__/fixtures/surf-call-skill-default-v1.json`). Before merge, compare both files with `cmp` and put the result in the PR body.

In `api-contracts.test.ts` (add `import skillDefaultFixture from '@/__tests__/fixtures/surf-call-skill-default-v1.json';`):
- `pins the paired server fixture and accepts it in both layers`: `expect(skillDefaultFixture).toEqual({ report: { skillDefaultApplied: true, skillSource: null, userTier: null }, skillEligibility: { skill: 'beginner', state: 'eligible', reasonCodes: [] } })`. Then, for `merged = { ...report(), ...skillDefaultFixture.report }`, `surfCallReportContract.safeParse(merged).success` and `isSurfCallApiReport(merged)` are both `true`.
- `both accept skillDefaultApplied %p, because it is a notice-only hint` (`it.each([undefined, true, false, null, 'yes', 1])`): the same two checks are `true` for the report with that value (no key for `undefined`).

In `use-surf-call-hook.test.ts` (same fixture import, plus `import type { CanonicalSessionDecision } from '@/types/canonical-session-decision';`; uses the file's `mockApiGet`, `successResponse`, `createWrapper()` and `ApiError`):

```ts
const withReport = (extra: Record<string, unknown>) => ({
  ...successResponse,
  data: { ...successResponse.data, report: { ...successResponse.data.report, skillSource: null, userTier: null, ...extra } },
});
const renderCall = () => renderHook(() => useSurfCall('beach-1'), { wrapper: createWrapper() });

it('keeps a default-applied call general', async () => {
  mockApiGet.mockResolvedValue(withReport(skillDefaultFixture.report));
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toMatchObject({ skillDefaultApplied: true, source: 'api', skillSource: null, userTier: null });
  expect(result.current.callAudience).toBe('general');
});

it.each([undefined, false, null, 'yes', 1])('keeps the call when skillDefaultApplied is %p', async (value) => {
  mockApiGet.mockResolvedValue(withReport(value === undefined ? {} : { skillDefaultApplied: value }));
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.data).toMatchObject({ source: 'api', verdict: 'YES' });
  expect(result.current.data?.recommendationAvailability?.reasonCode).not.toBe('hold_state_unavailable');
  expect(result.current.data).not.toHaveProperty('skillDefaultApplied');
});

it('drops the hint when the next call is unavailable', async () => {
  mockApiGet.mockResolvedValueOnce(withReport(skillDefaultFixture.report)).mockRejectedValueOnce(new ApiError(404, 'Unavailable'));
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data?.skillDefaultApplied).toBe(true));
  await act(async () => { await result.current.refetch(); });
  await waitFor(() => expect(result.current.data?.recommendationAvailability?.reasonCode).toBe('hold_state_unavailable'));
  expect(result.current.data).toMatchObject({ source: 'api', verdict: 'NO' });
  expect(result.current.data).not.toHaveProperty('skillDefaultApplied');
});

it('drops the hint on a blocked call', async () => {
  mockApiGet.mockResolvedValue(withReport({
    ...skillDefaultFixture.report,
    recommendationAvailability: { state: 'none', reasonCode: 'major_event_hold', holdEpoch: 'hold-1' },
  }));
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data?.verdict).toBe('NO'));
  expect(result.current.data).not.toHaveProperty('skillDefaultApplied');
});

it('keeps the hint on a beach-skill safety veto', async () => {
  mockApiGet.mockResolvedValue({ ...withReport(skillDefaultFixture.report), data: { ...withReport(skillDefaultFixture.report).data,
    sessionDecision: { ...successResponse.data.sessionDecision,
      verdict: 'no', decisionBasis: 'safety_override', reasonCode: 'beach_skill_exceeds_user', selection: null } } });
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data?.sessionDecision?.reasonCode).toBe('beach_skill_exceeds_user'));
  expect(result.current.data).toMatchObject({ verdict: 'NO', skillDefaultApplied: true });
});

it('rates a beginner-default call from the canonical decision with no raw general report', async () => {
  const eligibility = skillDefaultFixture.skillEligibility as CanonicalSessionDecision['skillEligibility'];
  const decision = successResponse.data.sessionDecision;
  const base = withReport(skillDefaultFixture.report);
  mockApiGet.mockResolvedValue({ ...base, data: { ...base.data, sessionDecision: { ...decision, decisionBasis: 'physical_fallback', skillEligibility: eligibility,
      selection: { ...decision.selection, skillEligibility: eligibility, evidence: { ...decision.selection.evidence, personalMatch: null } } } } });
  const { result } = renderCall();
  await waitFor(() => expect(result.current.data).toBeDefined());
  expect(result.current.callAudience).toBe('general');
  expect(result.current.data).toMatchObject({ verdict: 'YES', whySentence: 'Glassy with 4 ft swell.', skillSource: null, userTier: null });
  expect(result.current.data?.recommendationAvailability?.state).not.toBe('none');
  expect(result.current.data).not.toHaveProperty('rawGeneralReport');
});
```

In `surf-decision.test.ts`, add `keeps a beginner-default general call out of hold`: a `makeSurfCall` with `verdict: 'YES'`, `score: 82`, null `skillSource` and `userTier`, an `'available'` availability, `sessionDecision: makeCanonicalDecision({ decisionBasis: 'physical_fallback', skillEligibility, selection: { ...makeCanonicalDecision().selection!, skillEligibility, evidence: { ...makeCanonicalDecision().selection!.evidence, personalMatch: null } } })` with `skillEligibility` from the imported fixture (cast as above), no `rawGeneralReport`. With the guest test's other inputs, `deriveSharedSurfDecision` gives `isHold: false` and `whySentence: 'Waist-high, clean conditions.'`.

Both proof tests use `decisionBasis: 'physical_fallback'`, because `personalMatch: null` with `'personal_match'` fails `canonicalSessionDecisionInvalidInvariant` (`src/lib/canonical-session-decision.ts:194`, anchor `value.decisionBasis === 'personal_match' &&`). `parseSelection` also requires the selection skill to equal the decision skill (anchor `eligibility.skill !== decisionSkill`). These two tests are the native proof for the server plan's "Native coupling" gate. They pass before Step 3, because the mapper ignores the hint today. If one fails, stop and report. They cover the matched window only: a mismatch still gives a blank NO, as for a known level.

- [ ] **Step 2: Run the tests and see them fail**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/api-contracts.test.ts src/__tests__/use-surf-call-hook.test.ts`
Expected: FAIL in `use-surf-call-hook.test.ts`: `keeps a default-applied call general`, `drops the hint when the next call is unavailable` and `keeps the hint on a beach-skill safety veto` get no `skillDefaultApplied`. The `api-contracts.test.ts` cases and the two beginner-default proof tests already PASS. They pin that this stays true.

- [ ] **Step 3: Implement**

- `use-surf-call.ts`: add `skillDefaultApplied?: true;` to `SurfCall`, with the JSDoc "True only when the server rated this no-level user as a beginner by default, on a rated call. It never changes `callAudience`." Add `skillDefaultApplied?: unknown;` to `SurfCallApiReport`, with the comment "Notice-only hint. Never validated, so a bad value costs the notice and not the call." Make the mapper and `sanitizeBlockedSurfCall` changes in the Decisions.
- `forecast.ts`: add `skillDefaultApplied: z.unknown().optional(),` after `userTier`, with the same comment.
- Do not add a file under `src/lib/api-contracts/__fixtures__/` (`has a reference fixture for every declared contract` would fail). Do not edit the `live/` fixtures (their sha256 is checked).

- [ ] **Step 4: Run the tests and see them pass**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/api-contracts.test.ts src/__tests__/use-surf-call-hook.test.ts src/__tests__/live-api-contracts.test.ts src/__tests__/surf-decision.test.ts`
Expected: PASS, "Test Suites: 4 passed".

- [ ] **Step 5: Commit**

```bash
git add src/hooks/use-surf-call.ts src/lib/api-contracts/forecast.ts src/__tests__/fixtures/surf-call-skill-default-v1.json src/__tests__/api-contracts.test.ts src/__tests__/use-surf-call-hook.test.ts src/__tests__/surf-decision.test.ts
git commit -m "feat(surf-call): read the optional skillDefaultApplied hint on rated calls" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 2: Expose the hint on the Home forecast

**Files:**
- Modify: `src/features/home/use-home-forecast.ts`: after `const blocked = isRecommendationBlocked(availability);` `:204`, and the return `:274` (anchor `return { state, model, conditionsLoading, availability, blocked, callSettled };`).
- Create test: `src/features/home/__tests__/use-home-forecast-skill-default.test.tsx`. Copy the mocks and `input` from `use-home-forecast-wind.test.tsx:1-23`, but make `useForecastContext` return a mutable `mockContext`.

**Interfaces:**
- Produces: `useHomeForecast(input).skillDefaultApplied: boolean`.

Decision: read the raw `surfCall` (`:178`), not `model.surfCall`, because `resolveHomeForecast` sets `model.surfCall` to null when the hour-scoped call does not match. Also require `!blocked`, so a Home-level hold shows no notice. No E2E fixture sets `skillDefaultApplied` (`e2e-home-fixture.ts:377` has `source: 'api'` but no hint).

- [ ] **Step 1: Write the failing test**

`reports skillDefaultApplied for call %j as %s` is an `it.each`. Each case sets `mockContext = { surfCall: call === null ? null : { ...baseCall, ...call }, isSuccess: true }`, renders `useHomeForecast({ ...input, item: null, current: false })`, and expects `result.current.skillDefaultApplied` to be:

| `call` | Expected |
|---|---|
| `{ source: 'api', skillDefaultApplied: true }` | `true` |
| `{ source: 'api' }` | `false` |
| `{ source: 'offline', skillDefaultApplied: true }` and `{ source: 'local', skillDefaultApplied: true }` | `false` |
| `{ source: 'api', skillDefaultApplied: true, recommendationAvailability: { state: 'none', reasonCode: 'major_event_hold', holdEpoch: 'hold-1' } }` | `false` |
| `null` | `false` |

Also `is false while the forecast is disabled`: the first row's call with `enabled: false` gives `false`. `baseCall` is a minimal `SurfCall`: `verdict: 'NO'`, `whySentence: ''`, `score: null`, `forecastConfidence: 0`, `lowForecastConfidence: false`, and the nullable strings null.

- [ ] **Step 2: Run the test and see it fail**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/features/home/__tests__/use-home-forecast-skill-default.test.tsx`
Expected: FAIL, `skillDefaultApplied` is `undefined`.

- [ ] **Step 3: Implement**

After `:204` add `const skillDefaultApplied = !blocked && surfCall?.source === 'api' && surfCall.skillDefaultApplied === true;`. Add it to the return object and the result type.

- [ ] **Step 4: Run the tests and see them pass**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/features/home/__tests__/use-home-forecast-skill-default.test.tsx src/features/home/__tests__/use-home-forecast-wind.test.tsx src/features/home/__tests__/home-forecast.test.ts`
Expected: PASS, "Test Suites: 3 passed".

- [ ] **Step 5: Commit**

```bash
git add src/features/home/use-home-forecast.ts src/features/home/__tests__/use-home-forecast-skill-default.test.tsx
git commit -m "feat(home): expose the server's skill default hint from the hero call" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 3: `useSkillDefaultNotice` trigger and gates

**Files:**
- Create: `src/features/skill-default-notice/use-skill-default-notice.ts` and `src/features/skill-default-notice/copy.ts`.
- Modify: `src/lib/perf-marks.ts:11` (anchor `const appStartedAt = Date.now();`). Add one export.
- Create: `src/features/skill-default-notice/index.ts`, the feature entry point (spec D5, soul.md "expose cross-feature imports through the feature index"). It re-exports `useSkillDefaultNotice`, `SKILL_DEFAULT_NOTICE_COPY` and `SKILL_DEFAULT_NOTICE_TEST_ID`, and nothing for tests. Not `gift.ts`.
- Test: `src/__tests__/perf-marks.test.ts`, new case `returns the module-load time on every call`: `jest.useFakeTimers({ now: T0 })`, load the module in `jest.isolateModules`, `jest.setSystemTime(T0 + 60_000)`, then `getAppStartedAtMs()` equals `T0` on two calls. Restore real timers in a `finally` (the other cases need them).
- Create test: `src/features/skill-default-notice/__tests__/use-skill-default-notice.test.tsx`. Copy the setup of `src/features/founding-access/__tests__/use-founding-gift.test.tsx:1-130`: the mocks for `@/lib/posthog`, `@/lib/review-prompt-surface` (`mockedSurface`) and `@/stores/onboarding-store` (`mockGetPendingPostOnboardingPaywallSource`), the `InteractionManager` and `Linking` spies, `flush()`, `settle()`, and `useAuthStore.setState({ status: 'authenticated', user: { id: USER_ID } })` with `const USER_ID = 'user-notice';`. Drop the entitlement, founding access, visits and AppState parts. Add `jest.mock('@/lib/perf-marks', () => ({ getAppStartedAtMs: () => Date.parse('2026-11-09T12:00:00.000Z') }))`.

**Interfaces:**
- Consumes: `claimSessionAsk` (`src/lib/session-ask-latch.ts:6`), `isSafeToPresentReviewPrompt`, `useOnboardingStore.getState().getPendingPostOnboardingPaywallSource(userId)`, `useAuthStore`, `Profile`, `capturePostHogEvent`.
- Produces:

```ts
// src/lib/perf-marks.ts
export function getAppStartedAtMs(): number; // the existing module-level appStartedAt

// src/features/skill-default-notice/copy.ts (exact spec D5 copy)
export const SKILL_DEFAULT_NOTICE_COPY = {
  title: 'Rated for a beginner',
  body: "You haven't picked a level, so Quiver rates each call as if you're just starting out. Pick yours and the calls fit how you surf.",
  hint: 'Change it anytime in Settings, under Surfing.',
  primary: 'Set my level',
  secondary: 'Keep beginner',
} as const;
export const SKILL_DEFAULT_NOTICE_TEST_ID = 'skill-default-notice';

// use-skill-default-notice.ts
export const SKILL_DEFAULT_NOTICE_SETTLE_MS = 1_500;
export const SKILL_DEFAULT_NOTICE_OWNER = 'skill_default_notice';
export type SkillDefaultNoticeDismissAction = 'set_level' | 'keep';
export function skillDefaultNoticeShownKey(userId: string): string; // `@quiver/skill-default-notice-shown/${userId}`
export function isSkillDefaultNoticeProfile(profile: Profile | null | undefined, appStartedAtMs: number): boolean;
export interface SkillDefaultNoticeInput {
  isFocused: boolean;
  ready: boolean; // Home's homeOfferReady
  serverApplied: boolean; // useHomeForecast().skillDefaultApplied
  profile: Profile | null | undefined; // undefined while it loads
}
export interface SkillDefaultNoticeState { visible: boolean; dismiss: (action: SkillDefaultNoticeDismissAction) => void }
export function useSkillDefaultNotice(input: SkillDefaultNoticeInput): SkillDefaultNoticeState;
export function __resetSkillDefaultNoticeForTests(): void; // clears the in-process Set; not in index.ts
```

Decisions:
- **Shape from `use-surf-game-sign.ts`.** A module-level once guard, here a `Set<string>` of user ids because the notice is per user. One effect owns the wait and has a cleanup. The latch is claimed at show time, so a cancelled wait claims nothing ("Claim at drop time"). The hook never releases the latch, because the ask reached the user. The hook owns the wait, so Home passes no `delayMs`.
- **Onboarding-finish session.** Both finish paths write `onboarding_completed_at: new Date().toISOString()` (`src/stores/onboarding-store.ts:714`, `:725`, anchor `onboarding_completed_at: new Date()`). `perf-marks.ts` loads at boot (`App.tsx` calls `markPerf('app_launch')` at module top level), so `appStartedAt` is the process start. Do not take a new timestamp in the notice module. `isSkillDefaultNoticeProfile` is true only when `profile` is an object, `!profile.experience_level` (the blank test of `homeHasSkill`, `home.tsx:680`), and `Date.parse(profile.onboarding_completed_at)` is a finite time before `appStartedAtMs`. A null or bad date gives false.
- **Armed** = `isFocused && ready && serverApplied && userId !== null && isSkillDefaultNoticeProfile(profile, getAppStartedAtMs()) && !visible`. `userId` is non-null only when `useAuthStore` `status === 'authenticated'`, so guests never arm. The effect keys on `[armed, userId]`.
- **Wait.** `InteractionManager.runAfterInteractions`, then a `SKILL_DEFAULT_NOTICE_SETTLE_MS` timer. The cleanup cancels both and sets `cancelled`.
- **Gates, in the gift's order** (`use-founding-gift.ts:46-64`, anchor `async function canPresent`): the user id is not in the Set; the shown key reads `null` (a read error stops the show); no pending post-onboarding paywall; `Linking.getInitialURL()` is null. After each `await`, stop if `isStale()`. `isStale = () => cancelled || the auth user changed || !serverAppliedRef.current || !isSkillDefaultNoticeProfile(profileRef.current, getAppStartedAtMs())`. The refs update on each render, so a level set during the settle stops the show with no re-render.
- **Show, in one synchronous step after the last `await`:** `!isStale()`, then `isSafeToPresentReviewPrompt({ routeAtTrigger: 'Home' }).ok`, then `claimSessionAsk(SKILL_DEFAULT_NOTICE_OWNER)`. If all pass: add to the Set, `setVisible(true)`, `capturePostHogEvent('skill_default_notice_shown', {})`, and `AsyncStorage.setItem(key, new Date().toISOString()).catch(() => undefined)`. The Set is added before the key write, so a failed write still blocks a second show in this process. `claimSessionAsk` returns true for the same owner again (anchor `return claimedBy === owner`), so only the Set and the key stop a repeat.
- **dismiss(action)**: `setVisible(false)` and `capturePostHogEvent('skill_default_notice_dismissed', { action })`. It writes nothing to the profile.
- **Focus loss** (the reference's second effect): when `!isFocused && visible`, set `visible` false and log nothing. The key is already written, so the notice does not return.

- [ ] **Step 1: Write the failing tests**

`renderNotice(props = DEFAULT_PROPS)` is `renderHook((p: SkillDefaultNoticeInput) => useSkillDefaultNotice(p), { initialProps: props })`. `DEFAULT_PROPS = { isFocused: true, ready: true, serverApplied: true, profile: PROFILE }`, and `PROFILE = { id: USER_ID, experience_level: null, onboarding_completed_at: '2026-01-01T00:00:00.000Z' } as Profile`. `beforeEach` calls `__resetSkillDefaultNoticeForTests()` and `__resetSessionAskLatchForTests()`. `shownEvents()` filters `jest.mocked(capturePostHogEvent).mock.calls` on `'skill_default_notice_shown'`. `noKey()` is `expect(AsyncStorage.getItem(skillDefaultNoticeShownKey(USER_ID))).resolves.toBeNull()`.

```ts
it('shows once on Home after the settle and records it', async () => {
  const { result } = renderNotice();
  await act(async () => { jest.advanceTimersByTime(SKILL_DEFAULT_NOTICE_SETTLE_MS - 1); });
  expect(result.current.visible).toBe(false);
  await settle();
  expect(result.current.visible).toBe(true);
  expect(capturePostHogEvent).toHaveBeenCalledWith('skill_default_notice_shown', {});
  expect(getSessionAskOwner()).toBe('skill_default_notice');
  expect(mockedSurface).toHaveBeenCalledWith({ routeAtTrigger: 'Home' });
  await expect(AsyncStorage.getItem(skillDefaultNoticeShownKey(USER_ID))).resolves.not.toBeNull();
});

it('never shows twice in one process, even when the key write fails', async () => {
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  const { result, rerender } = renderNotice();
  await settle();
  act(() => result.current.dismiss('keep'));
  await noKey();
  __resetSessionAskLatchForTests();
  rerender({ ...DEFAULT_PROPS, isFocused: false });
  rerender(DEFAULT_PROPS);
  await settle();
  expect(result.current.visible).toBe(false);
  expect(shownEvents()).toHaveLength(1);
});

it('yields to another ask and writes no key', async () => {
  claimSessionAsk('review_prompt');
  const { result } = renderNotice();
  await settle();
  expect(result.current.visible).toBe(false);
  expect(getSessionAskOwner()).toBe('review_prompt');
  await noKey();
});

it('re-checks the profile at present time', async () => {
  let resolvePaywall: (value: null) => void = () => undefined;
  mockGetPendingPostOnboardingPaywallSource.mockReturnValue(new Promise((resolve) => { resolvePaywall = resolve; }));
  const profile = { ...PROFILE } as Profile;
  const { result } = renderNotice({ ...DEFAULT_PROPS, profile });
  await settle(); // the gates now wait on the pending-paywall read
  profile.experience_level = 'advanced'; // same object, no re-render: only profileRef sees it
  await act(async () => { resolvePaywall(null); });
  await flush();
  expect(result.current.visible).toBe(false);
  expect(getSessionAskOwner()).toBeNull();
  await noKey();
});
```

Each case in this table renders, runs `settle()`, and then asserts `visible` false, `getSessionAskOwner()` null, `shownEvents()` empty and `noKey()`:

| Test name | Setup |
|---|---|
| `claims nothing when the surface check fails` | `mockedSurface.mockReturnValue({ ok: false, reason: 'navigation_not_ready' })` |
| `never shows when the shown key cannot be read` | `jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('read failed'))` |
| `never shows to a guest` | `useAuthStore.setState({ status: 'unauthenticated', user: null })` |
| `never shows in the session that finished onboarding` | `profile: { ...PROFILE, onboarding_completed_at: '2026-11-09T12:05:00.000Z' }` |
| `never shows on a pending post-onboarding paywall` | `mockGetPendingPostOnboardingPaywallSource.mockResolvedValueOnce('onboarding')` |
| `never shows on a deep-link launch` | `jest.spyOn(Linking, 'getInitialURL').mockResolvedValue('quiver://beach/1')` |
| `never shows when %s` (`it.each`) | one prop each: `serverApplied: false`; `profile: undefined`; `profile: null`; `profile: { ...PROFILE, experience_level: 'intermediate' }`; `isFocused: false`; `ready: false` |

Three more cases and the pure tests:
- `never shows again on this device once shown`: show, `dismiss('keep')`, unmount, call both `__reset…ForTests()` (a new process), render again and `settle()`. Expect `visible` false and `shownEvents()` length 1.
- `logs the %s dismissal` (`'set_level'`, `'keep'`): after the show, `dismiss(action)` gives `visible` false and `capturePostHogEvent('skill_default_notice_dismissed', { action })`.
- `closes without an event when Home loses focus`: after the show, `rerender({ ...DEFAULT_PROPS, isFocused: false })` gives `visible` false and no `skill_default_notice_dismissed` call.
- `isSkillDefaultNoticeProfile(profile, Date.parse('2026-11-09T12:00:00.000Z'))` is false for `onboarding_completed_at: null` and `'not-a-date'`, and true for `experience_level: ''` with a past date. `SKILL_DEFAULT_NOTICE_COPY` equals the five spec strings.

- [ ] **Step 2: Run the test and see it fail**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/features/skill-default-notice/__tests__/use-skill-default-notice.test.tsx src/__tests__/perf-marks.test.ts`
Expected: FAIL, "Cannot find module '@/features/skill-default-notice/use-skill-default-notice'" and "getAppStartedAtMs is not a function".

- [ ] **Step 3: Implement** `getAppStartedAtMs`, `copy.ts`, `index.ts` and the hook with the signatures and decisions above.

- [ ] **Step 4: Run the tests and see them pass**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/features/skill-default-notice/__tests__/use-skill-default-notice.test.tsx src/__tests__/perf-marks.test.ts src/features/founding-access/__tests__/use-founding-gift.test.tsx src/lib/__tests__/session-ask-latch.test.ts`
Expected: PASS, "Test Suites: 4 passed".

- [ ] **Step 5: Commit**

```bash
git add src/lib/perf-marks.ts src/__tests__/perf-marks.test.ts src/features/skill-default-notice/index.ts src/features/skill-default-notice/use-skill-default-notice.ts src/features/skill-default-notice/copy.ts src/features/skill-default-notice/__tests__/use-skill-default-notice.test.tsx
git commit -m "feat(skill-default-notice): add the once-per-device Home trigger" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 4: `SkillSheet` source prop and the Home mount

**Files:**
- Modify: `src/features/value-first-onboarding/skill-sheet.tsx`: props `:15-21` (anchor `interface SkillSheetProps`), signature `:23` (anchor `export function SkillSheet(`), event `:37-41` (anchor `captureValueFirstFunnelEvent('skill_added'`).
- Modify: `src/screens/home.tsx`: imports near `:80` (anchor `founding-access/gift`); state after `:620` (anchor `const [homeSkillSheetVisible`); hook after `:3135` (anchor `handleFoundingGiftSupporter`); the sign after the `<FoundingGiftSheet` block (`:4642`); the `SkillSheet` mount `:4647-4654` (anchor `visible={homeSkillSheetVisible}`; its `{showHomePersonalize ? (` wrapper line also matches `:4334`, so do not anchor on that text).
- Test: `src/__tests__/skill-sheet.test.tsx` (after `writes experience level and emits skill_added` `:59`).
- Test: `src/__tests__/home-screen.test.tsx`, new `describe('Home skill default notice')`. Helpers: `renderWithProviders` `:381`, `mockCurrentHomeCall` `:886`, `configureHomeHeroWithForecast` `:1222`, `mockGetCachedValueFirstAssignment` `:186`, `mockUseHomeLocation` `:146`, `baseLocation` `:400`, `mockCapturePostHogEvent` `:147`.

**Interfaces:**
- Consumes: `useSkillDefaultNotice`, `SKILL_DEFAULT_NOTICE_COPY`, `SKILL_DEFAULT_NOTICE_TEST_ID` (Task 3), which `home.tsx` imports from `@/features/skill-default-notice` only; `homeForecast.skillDefaultApplied` (Task 2); `FallingSign`; `profile` (`home.tsx:672`); `homeOfferReady` (`:3119`); `isFocused` (`:592`).
- Produces: `SkillSheetProps.source?: 'value_first' | 'default_notice'` (default `'value_first'`).

Decisions:
- `SkillSheet` with `'value_first'` keeps `captureValueFirstFunnelEvent` as today. With `'default_notice'` it calls `capturePostHogEvent('skill_added', { experience_level, beach_id, source: 'default_notice' })` directly, as `surfing-section.tsx:121` does for `'edit_profile'`. So notice users are not funnel step 7 (`value-first-funnel-steps.ts:27`).
- Home state: `const [homeSkillSheetSource, setHomeSkillSheetSource] = useState<'value_first' | 'default_notice'>('value_first')` and `const openSkillSheetAfterNoticeRef = useRef(false)`. Remove the `showHomePersonalize` wrapper, so `SkillSheet` always renders (spec D5) and only `visible` shows it. The PersonalizeStrip at `:4334` keeps its gate, so a control user still has no way in except the notice. The sheet gets `source={homeSkillSheetSource}`. Its `onClose` sets `homeSkillSheetVisible` false and the source back to `'value_first'`.
- `const skillNotice = useSkillDefaultNotice({ isFocused, ready: homeOfferReady, serverApplied: homeForecast.skillDefaultApplied, profile });` goes after the founding gift lines. `homeOfferReady` already includes `!homeSkillSheetVisible`.
- `handleSkillNoticeSetLevel` sets the ref true, then calls `skillNotice.dismiss('set_level')`. `handleSkillNoticeKeep` calls `skillNotice.dismiss('keep')`. `handleSkillNoticeExited`: if the ref is true, set it false, then `setHomeSkillSheetSource('default_notice')` and `setHomeSkillSheetVisible(true)`. This is the `handleSurfGameSignExited` pattern (`community.tsx:461`, anchor `iOS cannot present it while the sign's modal is still up`).
- Mount after `<FoundingGiftSheet .../>`: `<FallingSign visible={skillNotice.visible} title={COPY.title} body={COPY.body} hint={COPY.hint} primaryLabel={COPY.primary} onPrimary={handleSkillNoticeSetLevel} secondaryLabel={COPY.secondary} onSecondary={handleSkillNoticeKeep} onExited={handleSkillNoticeExited} testID={SKILL_DEFAULT_NOTICE_TEST_ID} />`. The ids are `skill-default-notice`, `-primary`, `-secondary` and `-backdrop`.

- [ ] **Step 1: Write the failing tests**

In `skill-sheet.test.tsx`, add `logs skill_added with the default_notice source outside the value-first funnel`: render `<SkillSheet visible beachId="beach-1" source="default_notice" onClose={jest.fn()} />` in a `QueryClientProvider`, press `value-first-skill-option-intermediate`, then `value-first-skill-save`, and `waitFor` `mockCapturePostHogEvent` to have been called with `('skill_added', { experience_level: 'intermediate', beach_id: 'beach-1', source: 'default_notice' })`. The existing `writes experience level and emits skill_added` test stays unchanged and pins the default payload.

In `home-screen.test.tsx`, mock the hook with real state, and keep the real `FallingSign` and `SkillSheet`:

```tsx
let mockNoticeStartsVisible = false;
const mockNoticeInput = jest.fn();
const mockNoticeDismiss = jest.fn();
const mockMutateAsync = jest.fn();
jest.mock('@/features/skill-default-notice', () => ({
  ...jest.requireActual('@/features/skill-default-notice'),
  useSkillDefaultNotice: (input: unknown) => {
    mockNoticeInput(input);
    const [visible, setVisible] = jest.requireActual('react').useState(mockNoticeStartsVisible);
    return { visible, dismiss: (action: string) => { mockNoticeDismiss(action); setVisible(false); } };
  },
}));
// Inside describe('Home skill default notice'), placed last in the file (after `Home days to watch` :10069):
const noticeSpies: jest.SpyInstance[] = []; // the withTiming spy below is pushed here too
beforeEach(() => {
  mockNoticeStartsVisible = false;
  [mockMutateAsync, mockNoticeDismiss, mockNoticeInput, mockCapturePostHogEvent].forEach((mock) => mock.mockClear());
  mockMutateAsync.mockResolvedValue(undefined);
  noticeSpies.push(jest.spyOn(updateProfileModule, 'useUpdateProfile').mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false } as never));
  for (const cue of ['drop', 'land', 'exit'] as const) noticeSpies.push(jest.spyOn(signSounds, cue).mockImplementation(() => {}));
});
afterEach(() => { mockNoticeStartsVisible = false; noticeSpies.splice(0).forEach((spy) => spy.mockRestore()); });
// Imports: `* as updateProfileModule` from '@/hooks/use-update-profile', `* as Reanimated` from
// 'react-native-reanimated', `{ signSounds }` from '@/lib/sound/sign-sounds' (as community-screen.test.tsx:17),
// `{ SIGN_MOTION }` from '@/components/ui/falling-sign'.

it('opens the skill sheet only after the sign has gone, for a control-variant user', () => {
  mockGetCachedValueFirstAssignment.mockReturnValue({ variant: 'control' });
  mockUseHomeLocation.mockReturnValue(baseLocation);
  mockNoticeStartsVisible = true;
  const view = renderWithProviders(<HomeScreen />);
  const exitCallbacks: Array<(finished?: boolean) => void> = [];
  noticeSpies.push(jest.spyOn(Reanimated, 'withTiming').mockImplementation((toValue: any, config?: any, callback?: any) => {
    if (callback && config?.duration === SIGN_MOTION.exitMs) exitCallbacks.push(callback);
    return toValue;
  }));
  fireEvent.press(view.getByTestId('skill-default-notice-primary'));
  expect(mockNoticeDismiss).toHaveBeenCalledWith('set_level');
  expect(view.getByTestId('skill-default-notice')).toBeTruthy(); // still pulling up
  expect(view.queryByTestId('value-first-skill-sheet', { includeHiddenElements: true })).toBeNull();
  act(() => { exitCallbacks.forEach((done) => done(true)); });
  expect(view.queryByTestId('skill-default-notice')).toBeNull();
  expect(view.getByTestId('value-first-skill-sheet', { includeHiddenElements: true })).toBeTruthy();
});

it('logs skill_added from the notice outside the funnel, then value_first again', async () => {
  mockGetCachedValueFirstAssignment.mockReturnValue({ variant: 'value_first' });
  mockUseHomeLocation.mockReturnValue(baseLocation);
  mockNoticeStartsVisible = true;
  const view = renderWithProviders(<HomeScreen />);
  const saveLevel = async (): Promise<void> => {
    await waitFor(() => expect(view.getByTestId('value-first-skill-save')).toBeTruthy());
    fireEvent.press(view.getByTestId('value-first-skill-option-intermediate'));
    // SkillSheet.save closes after awaits, so the press must run in async act.
    await act(async () => {
      fireEvent.press(view.getByTestId('value-first-skill-save'));
    });
    await waitFor(() => expect(view.queryByTestId('value-first-skill-save')).toBeNull());
  };
  fireEvent.press(view.getByTestId('skill-default-notice-primary'));
  await saveLevel();
  expect(mockCapturePostHogEvent).toHaveBeenCalledWith('skill_added', {
    experience_level: 'intermediate', beach_id: expect.any(String), source: 'default_notice',
  });
  mockCapturePostHogEvent.mockClear();
  fireEvent.press(view.getByTestId('value-first-personalize-skill'));
  await saveLevel();
  expect(mockCapturePostHogEvent).toHaveBeenCalledWith('skill_added', {
    experience_level: 'intermediate', beach_id: expect.any(String), source: 'value_first',
    step_index: 7, step_name: 'personalization',
  });
});
```

The hold copies `still removes the overlay when the exit animation is cut short` (`falling-sign.test.tsx`). The spy is set after the first render, so the drop runs on the global mock (`src/test/reanimated-mock.ts`). `includeHiddenElements` is needed because the sign's `accessibilityViewIsModal` hides its siblings. `mockProfile` has no `experience_level`, so the PersonalizeStrip skill button shows.

Four more Home cases:
- `passes the server hint from the hero call`: `configureHomeHeroWithForecast()` and `mockCurrentHomeCall('hb-state', { skillDefaultApplied: true })`. Expect `mockNoticeInput` last called with `expect.objectContaining({ serverApplied: true })`.
- `stays inert when the server omits the hint`: `configureHomeHeroWithForecast()` only. Expect `serverApplied: false` and no `skill-default-notice`.
- `shows the exact spec copy on the shared sign`: with `mockNoticeStartsVisible = true`, `getByText('Rated for a beginner')` has `accessibilityRole` `'header'`, and the body, the hint, "Set my level" and "Keep beginner" are present as the spec strings.
- `keeps beginner without opening the skill sheet or writing the profile`: with the notice up, press `skill-default-notice-secondary`. Expect `mockNoticeDismiss` called with `'keep'`, no `skill-default-notice`, no `value-first-skill-sheet` (with `includeHiddenElements`) and `mockMutateAsync` not called.

- [ ] **Step 2: Run the tests and see them fail**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/skill-sheet.test.tsx src/__tests__/home-screen.test.tsx`
Expected: FAIL. The `skill_added` source is `'value_first'`. `serverApplied` is never passed. `skill-default-notice-primary` is not found.

- [ ] **Step 3: Implement** the `SkillSheet` and `home.tsx` changes above.

- [ ] **Step 4: Run the tests and see them pass**

Run: `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/skill-sheet.test.tsx src/__tests__/home-screen.test.tsx src/__tests__/beach-detail.test.tsx src/features/founding-access/__tests__/use-founding-gift.test.tsx src/__tests__/community-screen.test.tsx`
Expected: PASS, "Test Suites: 5 passed". `beach-detail.test.tsx` covers the other `SkillSheet` mount, which keeps the default source.

- [ ] **Step 5: Typecheck and lint.** Run `npm run typecheck && npm run lint`. Expected: exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/features/value-first-onboarding/skill-sheet.tsx src/screens/home.tsx src/__tests__/skill-sheet.test.tsx src/__tests__/home-screen.test.tsx
git commit -m "feat(home): show the skill default notice on the falling sign and open SkillSheet after it" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

### Task 5: Simulator check and land

**Files:**
- Modify only to fix a failed check, a gate failure or a confirmed review finding.

**Interfaces:**
- Consumes: Tasks 1-4. Produces: one merged native PR.

- [ ] **Step 1: Force the notice locally, with no data write.** Make a scratch edit in `src/screens/home.tsx` that you never stage: pass `serverApplied: true` and `profile: profile ? { ...profile, experience_level: null } : profile` to `useSkillDefaultNotice`. Sign in with the test account from `.maestro/env/local.env`. Reinstall the app to clear the shown key. Follow the memory notes "Sim and Simulator recipes" and "Metro EMFILE in a nested worktree". Take screenshots with `xcrun simctl io booted screenshot`.
- [ ] **Step 2: Check the hand-off.** Expected: the notice is the same sign as the Community surf game sign, with the Task 3 copy. Tap "Set my level". Expected: the sign pulls up, then `SkillSheet` slides up. Tap "Not now" in the sheet, so nothing is saved. Cold-start the app. Expected: the notice does not come back. If "Rated for a beginner" wraps at the default text size, write that in the PR body. Do not change the shared title style.
- [ ] **Step 3: If `SkillSheet` does not present on iOS:** drop the scratch edit (`git checkout -- src/screens/home.tsx`), wrap the two setters in `handleSkillNoticeExited` in `InteractionManager.runAfterInteractions`, and put the hold test's last expectation in `waitFor`. Run the Task 4 Step 4 command (PASS). Commit both files by path with `fix(home): open SkillSheet after the interactions that close the notice` and the Co-Authored-By line. Put the scratch edit back and repeat Step 2.
- [ ] **Step 4: Revert the scratch edit** with `git checkout -- src/screens/home.tsx`. Confirm with `git status --short` that only committed work remains.
- [ ] **Step 5: Local gate.** Run `TZ=America/Los_Angeles npx jest --runInBand --runTestsByPath src/__tests__/api-contracts.test.ts src/__tests__/use-surf-call-hook.test.ts src/__tests__/surf-decision.test.ts src/features/home/__tests__/use-home-forecast-skill-default.test.tsx src/features/skill-default-notice/__tests__/use-skill-default-notice.test.tsx src/__tests__/perf-marks.test.ts src/__tests__/skill-sheet.test.tsx src/__tests__/home-screen.test.tsx src/components/ui/falling-sign.test.tsx src/__tests__/community-screen.test.tsx`. Expected: PASS, "Test Suites: 10 passed". Then `npm run typecheck && npm run lint`. Expected: exit 0.
- [ ] **Step 6: Prebuild for the push gate.** Run `set -a; source .env.production; source .env.production.local; set +a; EXPO_NO_DOTENV=1 NODE_ENV=production EXPO_UPDATE_CHANNEL=production CI=1 npx expo prebuild --platform ios --no-install --clean`, then `npm run verify:updates-channel`. Expected: exit 0. Do not stage `ios/`.
- [ ] **Step 7: Push and open the PR.** Push `feat/skill-default-notice` from `.worktrees/skill-default-notice`, and open a PR to `main`. The PR body has:
  - the paired fixture note, with the `cmp` result against the server file;
  - the Step 2 screenshots, and any title-wrap finding;
  - the open item for Steven: backdrop and Android back are logged as `'keep'`, because `FallingSignProps.onSecondary` takes no reason. Spec D5's `'backdrop'` and `'back'` values need a separate `FallingSign` change;
  - the note that spec D5's `SkillDefaultNoticeSheet` is not built: Home renders the shared `FallingSign` directly, as `community.tsx` does. The feature entry point is `src/features/skill-default-notice/index.ts`;
  - the Task 1 beginner-default proof tests, and that the server allowlist gate stays closed until this PR is on an approved iOS OTA and an Android OTA or build;
  - the release order and the release gate from Global Constraints (each allowlisted no-level user must run a build with this PR);
  - as the last line: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
- [ ] **Step 8: Review.** Run `/code-review high` on the PR. Fix confirmed findings, re-run Step 5, and push again.
- [ ] **Step 9: Merge.** Native PRs do not use auto-merge. When the push gate is green, run `gh pr merge --squash`.
- [ ] **Step 10: Hand back to Steven.** Report the merged PR. The notice reaches phones only through an iOS OTA (`quiver-ios-ota` skill) and an Android OTA or build that Steven approves. Do not publish one. The release order stays: server field on prod, then the native OTA, then the server flag and allowlist. Each prod step needs his yes. Before each allowlist step, apply the release gate in Global Constraints.
