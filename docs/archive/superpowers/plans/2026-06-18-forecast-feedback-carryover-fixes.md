# Plan: harden the forecast-feedback → session-log carry-over

**Date:** 2026-06-18
**Repo:** `quiver` (web). One optional task is in the sibling `seaside` repo (Python).
**Source:** adversarially-verified review (23 confirmed findings) of the uncommitted "forecast feedback carry-over" change.

## Feature under change

After one-tap forecast feedback saves ("Did this forecast feel right?"), a **Log the session** CTA carries `forecastFeedbackId` + `forecastFeedbackValue` into `/sessions/new`. The session form prefills forecast accuracy (`about_right → accurate`, `too_low|too_high → inaccurate`). On session create, `createLoggedSession` links the `forecast_feedback_contexts` row to the new `session_id`, guarded by `id + user_id + beach_id` via a service-role client; the feedback id is stripped before the `sessions` insert.

Touched files: `components/forecast/forecast-feedback-capture.tsx`, `app/sessions/new/page.tsx`, `app/sessions/new/useSessionSubmission.ts`, `actions/session-actions.ts`, `lib/utils/session-wizard-params.ts`, `lib/validation/schemas.ts`, `types/session-wizard.ts`, and tests.

## What is already verified-correct (do NOT "fix")

- Cross-repo contract works: Seaside returns the real `forecast_feedback_contexts.id` (v4 UUID); web links to it; graceful degradation when `id=null`.
- The link fires on the real submission path (`buildSessionPayload` emits db-schema keys → `else` branch strips the id and links).
- Authorization guard is sound: `.eq(id).eq(user_id).eq(beach_id)`; no cross-user hijack; anonymous (`user_id=null`) rows correctly excluded; service-role genuinely required (RLS on, grants to `service_role` only).

## Verification (run after each task)

- `yarn typecheck` — if the route-type validator errors on stale files, `rm -rf .next` first.
- The task's targeted `yarn jest ... --runInBand`.
- `npx eslint --max-warnings=0 <touched files>`.

Use Conventional Commits, one logical change per commit.

---

## Tier 1 — ship-blockers

### Task 1 — Recolor CTA off the verdict color (P1)

- **File:** `components/forecast/forecast-feedback-capture.tsx` (~line 326)
- **Change:** in the "Log the session" element className, replace `bg-[#00D4AA]` with `bg-[#F78E42]` (matches the in-component "Send" button ~line 306). Keep `text-[#11100D]` and all other classes.
- **Why:** `#00D4AA` (Pacific Teal) is reserved for YES/"Worth it" verdicts; primary CTAs use Charming Orange `#F78E42`.
- **Commit:** `fix(forecast): use primary-CTA color for log-session button`

### Task 2 — Don't prefill a future (or invalid) surf time (P2 functional; folds in the invalid-date P3)

- **File:** `components/forecast/forecast-feedback-capture.tsx`, `handleSubmit` success path (~lines 221-233)
- **Change:** replace the `setSessionLogUrl(buildSessionWizardUrl({...}))` block with:

```ts
const toValidDate = (value: string | null | undefined): Date | undefined => {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
};
const windowStart = toValidDate(payload.windowStart ?? payload.forecastAt);
const windowEnd = toValidDate(payload.windowEnd);
// "Log the session" records a surf that happened — never pre-date the form to a
// future forecast window (best window can be later today or tomorrow).
const carryWindow = windowStart ? windowStart.getTime() <= Date.now() : false;
setSessionLogUrl(
  buildSessionWizardUrl({
    mode: "log",
    quick: true,
    beachId: beach.id,
    beachName: beach.name,
    startTime: carryWindow ? windowStart : undefined,
    endTime: carryWindow ? windowEnd : undefined,
    targetStep: 1,
    forecastFeedbackId,
    forecastFeedbackValue: selectedValue,
  }),
);
```

- **Why:** `windowStart = surfCall.bestWindowStart` is frequently future (explicit `isTomorrow` fallback / best-window-later-today), so accepting the prefill records a session timestamped before the surf happened. The `toValidDate` guard also removes the `Invalid Date → toISOString() throws → saved feedback shows "error"` failure mode. Accuracy prefill is unaffected (rides `forecastFeedbackValue`, not `startTime`).
- **Verify:** unit test in Task 8e/8f; `yarn jest .../session-wizard-params.test.ts`.
- **Commit:** `fix(forecast): don't carry future/invalid surf window into session log`

---

## Tier 2 — robustness, security, nav, a11y

### Task 3 — Idempotent link; don't relink an already-linked row (P2)

- **File:** `actions/session-actions.ts`, the `forecast_feedback_contexts` update (~lines 420-431)
- **Change:** append `.is("session_id", null)` to the update chain so only an unlinked row is claimed:

```ts
.eq("beach_id", session.beach_id)
.is("session_id", null);
```

Also add `is: jest.fn().mockReturnThis() as MockFn` to `createSupabaseMock()` in `__tests__/actions/session-actions-create-logged.test.ts`.
- **Why:** column is `text NULL` with no unique/FK; re-submitting the bookmarkable carry-over URL otherwise re-points `session_id` last-write-wins.
- **Decision (do NOT code):** migrating `session_id` to `uuid REFERENCES sessions(id) ON DELETE SET NULL` requires prod DB approval — leave as a follow-up.
- **Commit:** `fix(sessions): only link unclaimed forecast-feedback rows`

### Task 4 — Validate the feedback id inside the server action (P2 defense-in-depth)

- **File:** `actions/session-actions.ts`
- **Change:** add `import { z } from "zod";` if absent. After `forecastFeedbackContextId` is resolved (and before the link block), drop it if malformed:

```ts
if (forecastFeedbackContextId && !z.string().uuid().safeParse(forecastFeedbackContextId).success) {
  forecastFeedbackContextId = undefined;
}
```

- **Why:** `createLoggedSession` is a public RPC; the UUID is only Zod-validated on the page path. Not exploitable, but a service-role write shouldn't trust an unvalidated id. Skip silently (no throw) to match the existing degrade-safely pattern.
- **Commit:** `fix(sessions): validate forecast-feedback id before service-role link`

### Task 5 — Client-side navigation for the CTA (P2)

- **File:** `components/forecast/forecast-feedback-capture.tsx`
- **Change:** add `import Link from "next/link";`; replace `<a href={sessionLogUrl} className={...}>Log the session</a>` with `<Link href={sessionLogUrl} className={...}>Log the session</Link>` (identical classes).
- **Why:** every other `/sessions/new` nav uses `<Link>`/`router.push`; a bare `<a>` forces a full document reload.
- **Commit:** `fix(forecast): client-side nav for log-session CTA`

### Task 6 — Announce success/error state (P2 a11y)

- **File:** `components/forecast/forecast-feedback-capture.tsx` (success block ~318, error block ~333)
- **Change:** add `role="status" aria-live="polite"` to the success container `<div>`; wrap/annotate the error `<p>` with `role="status" aria-live="polite"`. Precedent: `components/app-store/send-to-phone-cta.tsx`.
- **Why:** WCAG 4.1.3 — SR users get no announcement that the save succeeded or that a new CTA appeared.
- **Commit:** `fix(forecast): announce feedback save status to screen readers`

---

## Tier 3 — tests & cleanup

### Task 7 — Cleanups (P3, one commit)

- `components/forecast/forecast-feedback-capture.tsx` — make `isUuid` version-agnostic so a future UUIDv7 id isn't silently dropped:

```ts
/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
```

- `actions/session-actions.ts` — extract `forecast_feedback_context_id` **before** the FormState/SessionInput branch so both paths strip/capture it consistently:

```ts
const { forecast_feedback_context_id, ...rest } = data as SessionInputWithFeedbackContext;
let forecastFeedbackContextId = forecast_feedback_context_id; // run the Task 4 guard here
let sessionData: Partial<Session>;
if ('selectedBeach' in rest || 'selectedBeachId' in rest || 'boardId' in rest) {
  sessionData = transformSessionFormStateToDbSchema(rest as SessionFormState);
} else {
  sessionData = rest as SessionInput;
}
```

- `actions/session-actions.ts` — add a one-line comment at the link update noting `updated_at` is set manually because there is no DB trigger on this table.
- **Commit:** `refactor(sessions): tidy feedback-id handling and uuid guard`

### Task 8 — Test coverage (P2/P3)

All under `__tests__/`:

- **8a — wrong-client regression** (`actions/session-actions-create-logged.test.ts`): give the service-role client a **distinct** mock — `const mockServiceRoleSupabase = createSupabaseMock();` and `createSupabaseServiceRoleClient: jest.fn(() => mockServiceRoleSupabase)` — while `withAuthenticatedAction` passes the user-scoped `mockSupabase`. Assert the link `update` ran on `mockServiceRoleSupabase` and **not** on the user client. Ensure both mocks expose `is`/`update`.
- **8b — link-failure swallowed:** make the service-role update resolve to `{ error: { message: 'rls denied' } }` (and a second case that throws); assert `result.success === true`, session intact, `expectConsoleWarnings([/forecast feedback link failed/i])`.
- **8c — `updated_at` asserted:** tighten the happy-path assertion to `expect.objectContaining({ session_id: 'session-123', updated_at: expect.any(String) })`.
- **8d — hook threading** (`app/sessions/use-session-submission.test.tsx`): render `useSessionSubmission({ mode:'log', user, forecastFeedbackId:'<uuid>' })`, run `handleSessionComplete`, assert `createLoggedSession` called with `expect.objectContaining({ forecast_feedback_context_id: '<uuid>' })`; negative case with no id.
- **8e — component tests** (new `components/forecast/forecast-feedback-capture.test.tsx`, jsdom): mock `fetch` → `{success:true, data:{id:'<uuid>'}}`, assert CTA href contains `forecastFeedbackId` + `forecastFeedbackValue`; `data.id:null` → CTA renders without `forecastFeedbackId`; error (`response.ok=false`) → error message shown, no CTA; **future-window case** → href has no `startTime` (validates Task 2).
- **8f — `buildSessionWizardUrl` invalid date** (`lib/utils/session-wizard-params.test.ts`): document behavior with `startTime: new Date('garbage')`.
- **8g — narrow the eslint-disable:** remove the file-level `/* eslint-disable jest/no-conditional-expect, jest/no-restricted-matchers */` in `lib/utils/session-wizard-params.test.ts`; add `// eslint-disable-next-line` only on the specific offending lines.
- **Verify:** `yarn jest __tests__/actions/session-actions-create-logged.test.ts __tests__/lib/utils/session-wizard-params.test.ts __tests__/app/sessions/use-session-submission.test.tsx __tests__/components/forecast/forecast-feedback-capture.test.tsx --runInBand`
- **Commit:** `test(forecast): cover feedback carry-over link, client choice, and CTA states`

---

## Optional / separate repo

### Task 9 — Make Seaside's id contract observable (P2, `seaside/`)

- **Files:** `seaside/feedback_service.py` (`insert_feedback_context`), `seaside/tests/test_feedback_service.py`
- **Change:** when the insert succeeds but returns empty `data` (the `return row` fallback ~line 80, which has no `id`), `logger.warning(...)` that the row id is unavailable. Add a test asserting the happy path propagates the real `data[0]["id"]`.
- **Do NOT** raise — the row is already written; failing the request would show the user an error for a saved row. Logging is the right level.
- **Commit (seaside):** `feat(feedback): log when inserted row id is unavailable`

---

## Decisions needed (flag to product — not code)

- **Double-signal canonical source:** `forecast_feedback_contexts.feedback_value` (3-way) vs editable `sessions.forecast_accuracy` (2-way, lossy) can diverge on a linked pair. Decide source of truth, or lock the prefilled accuracy. Safe to defer (no reader joins them today).
- **`session_id` FK/type** (Task 3): keep `text`/no-FK vs migrate to `uuid` + `ON DELETE SET NULL`. Requires prod DB approval.

## Suggested cutoff if time-boxed

Tier 1 + Tasks 3, 5, 6, 8a/8d is the high-value core. Tier 3 cleanup and Task 9 can follow.
