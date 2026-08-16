# One-Tap Session Logging in Re-engagement Email — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing one-tap email session logging into re-engagement emails so users can log a session with a single click instead of navigating to a multi-step form.

**Architecture:** The one-tap flow already works end-to-end: `signEmailToken` generates a signed JWT, the `/session/confirm` endpoint verifies it and inserts a `session_log`. The session-prompt email already uses this pattern. We just need to replicate the same token generation in the re-engagement cron and pass the URL to the email template.

**Tech Stack:** Next.js API Route, React Email template, `jose` JWT signing, Jest

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `app/api/cron/reengagement-email/route.ts` | Add token generation per candidate, pass `logSessionUrl` to template |
| Modify | `lib/mailer/templates/ReengagementEmail.tsx` | Accept `logSessionUrl` prop instead of hardcoding `/sessions/new?mode=log` |
| Modify | `__tests__/app/api/cron/reengagement-email.test.ts` | Mock `email-token` module, verify token URL is passed to template |

No new files needed. The `/session/confirm` endpoint and `lib/utils/email-token.ts` are already fully functional.

---

## Reference Pattern

`app/api/cron/session-prompt-email/route.ts:130-145` is the canonical pattern:

```ts
// Generate a signed token for the one-tap email actions
const tokenSecret = getEmailTokenSecret();
const token = await signEmailToken(
  { user_id: candidate.user_id, purpose: "log_session" },
  tokenSecret
);

// Yesterday's date in YYYY-MM-DD format (UTC) for the session log
const yesterday = new Date();
yesterday.setUTCDate(yesterday.getUTCDate() - 1);
const sessionDate = yesterday.toISOString().slice(0, 10);

const confirmUrl =
  `${baseUrl}/session/confirm?token=${encodeURIComponent(token)}` +
  `&beach_id=${encodeURIComponent(candidate.home_beach_id)}` +
  `&date=${encodeURIComponent(sessionDate)}`;
```

**Key difference:** Session-prompt uses *yesterday's* date (asking about a past session). Re-engagement uses *today's* date (conditions are good right now — log your session today).

---

## Chunk 1: Cron Route + Template + Tests

### Task 1: Add email-token mock to test file

**Files:**
- Modify: `__tests__/app/api/cron/reengagement-email.test.ts:88-92` (after existing mocks, before `describe` block)

- [ ] **Step 1: Add the `email-token` mock**

Add this mock block after the existing `jest.mock("@/lib/mailer/templates/ReengagementEmail", ...)` block (after line 92):

```ts
// Mock email token utilities
jest.mock("@/lib/utils/email-token", () => ({
  signEmailToken: jest.fn().mockResolvedValue("mock-email-token-jwt"),
  getEmailTokenSecret: jest.fn().mockReturnValue("mock-secret"),
}));
```

- [ ] **Step 2: Run the test to verify the mock doesn't break existing tests**

Run: `npx jest __tests__/app/api/cron/reengagement-email.test.ts --no-coverage`
Expected: All existing tests still PASS (the mock is imported but not yet used by the route)

- [ ] **Step 3: Commit**

```bash
git add __tests__/app/api/cron/reengagement-email.test.ts
git commit -m "test: add email-token mock to reengagement-email tests"
```

---

### Task 2: Add `logSessionUrl` prop to email template

**Files:**
- Modify: `lib/mailer/templates/ReengagementEmail.tsx:5-19` (props interface)
- Modify: `lib/mailer/templates/ReengagementEmail.tsx:47-64` (component params + logSessionUrl usage)

- [ ] **Step 1: Write failing test — template receives `logSessionUrl` prop**

In `__tests__/app/api/cron/reengagement-email.test.ts`, find the test that verifies email sending (the test that checks `mockEmailsSend` was called with `ReengagementEmail(...)` args). Add a new test:

```ts
it("should pass logSessionUrl to the email template", async () => {
  const { ReengagementEmail } = require("@/lib/mailer/templates/ReengagementEmail");
  const { signEmailToken } = require("@/lib/utils/email-token");

  mockRpc.mockResolvedValueOnce({
    data: [makeMockCandidate()],
    error: null,
  });

  // Claim slot succeeds
  mockRpc.mockResolvedValueOnce({ data: true, error: null });

  await GET(mockRequest({ "x-vercel-cron": "true" }));

  expect(signEmailToken).toHaveBeenCalledWith(
    expect.objectContaining({
      user_id: expect.any(String),
      purpose: "log_session",
    }),
    "mock-secret"
  );

  expect(ReengagementEmail).toHaveBeenCalledWith(
    expect.objectContaining({
      logSessionUrl: expect.stringMatching(
        /\/session\/confirm\?token=.+&beach_id=.+&date=\d{4}-\d{2}-\d{2}/
      ),
    })
  );
});
```

Note: `makeMockCandidate()` is a helper — if one doesn't already exist in the test file, extract the candidate object from an existing test into a helper at the top of the `describe` block:

```ts
const makeMockCandidate = (overrides = {}) => ({
  user_id: "user-1",
  email: "surfer@example.com",
  display_name: "Test Surfer",
  home_beach_id: "beach-1",
  beach_name: "Blacks Beach",
  beach_slug: "blacks",
  conditions_score: 8,
  surf_description: "3-5ft with clean conditions",
  wind_description: "Light offshore winds",
  best_window_start: "06:00:00",
  best_window_end: "10:00:00",
  recommendation: "Go now!",
  ...overrides,
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx jest __tests__/app/api/cron/reengagement-email.test.ts -t "should pass logSessionUrl" --no-coverage`
Expected: FAIL — `signEmailToken` not called, `logSessionUrl` not in template props

- [ ] **Step 3: Add `logSessionUrl` prop to `ReengagementEmailProps`**

In `lib/mailer/templates/ReengagementEmail.tsx`, add the prop to the interface (line 17, before `ctaUrl`):

```ts
// Before:
  ctaUrl: string;

// After:
  logSessionUrl: string;
  ctaUrl: string;
```

- [ ] **Step 4: Use `logSessionUrl` prop instead of hardcoded URL**

In the component function signature (line 47-58), add `logSessionUrl` to destructuring. Then replace line 64:

```ts
// Before:
  const logSessionUrl = `${baseUrl}/sessions/new?mode=log`;

// After:
  // logSessionUrl is now passed as a prop — no local construction needed
```

Delete line 64 entirely (`const logSessionUrl = ...`). The prop `logSessionUrl` from the destructured params replaces it.

- [ ] **Step 5: Import `signEmailToken` and `getEmailTokenSecret` in the cron route**

In `app/api/cron/reengagement-email/route.ts`, add the import after line 36:

```ts
import { signEmailToken, getEmailTokenSecret } from "@/lib/utils/email-token";
```

- [ ] **Step 6: Generate token and `logSessionUrl` in `processCandidate`**

In `app/api/cron/reengagement-email/route.ts`, inside `processCandidate` function, after the `ctaUrl` line (line 173), add:

```ts
  // 4b. Generate one-tap session log URL
  const tokenSecret = getEmailTokenSecret();
  const token = await signEmailToken(
    { user_id: candidate.user_id, purpose: "log_session" },
    tokenSecret
  );
  // UTC date -- matches cron schedule at 18:00 UTC (10 AM Pacific)
  const today = new Date().toISOString().slice(0, 10);
  const logSessionUrl =
    `${baseUrl}/session/confirm?token=${encodeURIComponent(token)}` +
    `&beach_id=${encodeURIComponent(candidate.home_beach_id)}` +
    `&date=${encodeURIComponent(today)}`;
```

- [ ] **Step 7: Pass `logSessionUrl` to `ReengagementEmail` call**

In the same file, in the `ReengagementEmail({...})` call (around line 186-198), add `logSessionUrl`:

```ts
    react: ReengagementEmail({
      displayName: candidate.display_name,
      beachName: candidate.beach_name,
      beachSlug: candidate.beach_slug,
      conditionsScore: candidate.conditions_score,
      surfDescription: candidate.surf_description,
      windDescription: candidate.wind_description,
      bestWindow,
      recentIntel,
      logSessionUrl,       // <-- add this line
      ctaUrl,
      unsubscribeUrl,
      baseUrl,
    }),
```

- [ ] **Step 8: Run the new test to verify it passes**

Run: `npx jest __tests__/app/api/cron/reengagement-email.test.ts -t "should pass logSessionUrl" --no-coverage`
Expected: PASS

- [ ] **Step 9: Run the full test suite for this file**

Run: `npx jest __tests__/app/api/cron/reengagement-email.test.ts --no-coverage`
Expected: ALL tests PASS

- [ ] **Step 10: Commit**

```bash
git add app/api/cron/reengagement-email/route.ts lib/mailer/templates/ReengagementEmail.tsx __tests__/app/api/cron/reengagement-email.test.ts
git commit -m "feat: wire one-tap session logging into re-engagement email

Replace hardcoded /sessions/new?mode=log with a signed JWT token URL
pointing to /session/confirm. Users can now log a session with a single
click from the re-engagement email instead of navigating to a multi-step form.

Success metric: email click rate from 0% → >10%"
```

---

### Task 3: TypeScript and lint check

**Files:** None new — verify existing changes compile

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npx tsc --noEmit --pretty 2>&1 | head -50`
Expected: No new errors (existing errors may be present but nothing from our changed files)

- [ ] **Step 2: Run lint on changed files**

Run: `npx eslint app/api/cron/reengagement-email/route.ts lib/mailer/templates/ReengagementEmail.tsx --no-error-on-unmatched-pattern`
Expected: No errors

- [ ] **Step 3: Fix any issues in a new commit if needed**

---

### Task 4: Verify end-to-end flow manually (optional — Playwright MCP)

- [ ] **Step 1: Check the email template renders without errors**

Using Playwright MCP or local dev, trigger the cron endpoint manually with a valid cron secret and verify:
1. The email is generated without errors
2. The "Log Your Session" button href contains `/session/confirm?token=...&beach_id=...&date=...`
3. Clicking the link hits the `/session/confirm` endpoint (which is already tested and working)

---

## Summary of Changes

| File | What changed | Why |
|------|-------------|-----|
| `route.ts` (cron) | Import `signEmailToken`/`getEmailTokenSecret`, generate token + `logSessionUrl` per candidate, pass to template | Wire existing one-tap flow into email |
| `ReengagementEmail.tsx` | Add `logSessionUrl` prop, remove hardcoded URL | Template receives the URL from caller instead of constructing a dead-end URL |
| `reengagement-email.test.ts` | Mock `email-token`, add test verifying token generation + template prop | Ensure one-tap URL is generated and passed correctly |

**Total lines changed:** ~25 in route, ~3 in template, ~30 in tests. This is a small, focused change because all the infrastructure already exists.
