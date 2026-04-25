# Review Form Hygiene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two regressions surfaced by the `beach-review-tracking` E2E run on 2026-04-17, add happy-path submit coverage, and close the dashboard blind spot that let those gaps hide for weeks.

**Architecture:** Three narrowly-scoped code fixes in `components/beach/beach-review-form.tsx` and `components/ui/dialog.tsx` + `e2e/beach-review-tracking.spec.ts`, plus one skill-file edit to `~/.claude/skills/app-stats/SKILL.md`. No schema changes, no RLS changes, no NPC-cron changes (the NPC write path is out of scope — see "Deferred" at end).

**Tech Stack:** Next.js 16, React 19 (strict mode), Radix UI Dialog primitive, Playwright E2E, Jest unit tests, Supabase client SDK.

**Evidence this fixes something real:**
- `beach-review-tracking.spec.ts:336` fails — `review_form_abandon` fires twice per cancel (once from the dev-only strict-mode fake unmount at `duration_ms: 3`, once from the real cancel handler at `duration_ms: 2641`).
- `beach-review-tracking.spec.ts:389` fails — `button[aria-label="Close"]` selector times out. `components/ui/dialog.tsx:49` uses `<span className="sr-only">Close</span>`, not `aria-label`, so the test has been drifting since the Radix button swap.
- `review_submit` happy path has zero E2E coverage despite a prior false-negative investigation suggesting the submit path was broken (it was not — a `beach_reviews_history` DELETE row at `2026-04-10 02:23:03` proved the insert worked and the submitter self-deleted 15s later).
- `app-stats` SKILL.md filter `p.email NOT ILIKE '%test%'` drops profiles with `email IS NULL` silently (NULL → NULL → excluded), hiding 3 orphan profiles and 1,195 NPC rows with `is_mock=true`.

---

## File Structure

| File | Responsibility | Action |
|---|---|---|
| `components/beach/beach-review-form.tsx` | Form component — fix cancel/unmount abandon double-fire | Modify |
| `__tests__/components/beach/beach-review-form.test.tsx` | Unit test that mounting + cancelling fires exactly one abandon event under React strict mode | Create |
| `components/ui/dialog.tsx` | Add `aria-label="Close"` to the internal `DialogPrimitive.Close` button | Modify |
| `e2e/beach-review-tracking.spec.ts` | Update close-button selector + add happy-path submit test | Modify |
| `e2e/utils/test-data-cleanup.ts` | Add `deleteReviewsForTestUser` helper if not already present | Modify |
| `~/.claude/skills/app-stats/SKILL.md` | Tighten email filter with `COALESCE` + explicit `is_mock = false` guard on all profile joins | Modify |

---

## Task 1: Fix abandon double-fire in the review form

**Why:** The unmount cleanup effect at `beach-review-form.tsx:165-190` fires `review_form_abandon` on React 19 strict mode's dev-only fake unmount (3ms after mount). The cancel handler at line 200 then fires a second abandon because it *sets* `hasTrackedAbandonRef.current = true` unconditionally instead of checking it first. Production prod builds don't have strict-mode double-invocation, but every local dev session and every Jest render under `React.StrictMode` shows the bug.

**Files:**
- Modify: `components/beach/beach-review-form.tsx:165-217`
- Create: `__tests__/components/beach/beach-review-form.test.tsx`

- [ ] **Step 1: Write the failing unit test**

```tsx
// __tests__/components/beach/beach-review-form.test.tsx
import React, { StrictMode } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BeachReviewForm } from "@/components/beach/beach-review-form";

const mockTrack = jest.fn();
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));
jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: { id: "test-user-id" } }),
}));
jest.mock("@/actions/beach-review-actions", () => ({
  createBeachReview: jest.fn(),
  updateBeachReview: jest.fn(),
}));

describe("BeachReviewForm abandon single-fire guard", () => {
  beforeEach(() => {
    mockTrack.mockClear();
  });

  it("fires exactly one review_form_abandon under StrictMode + cancel", () => {
    render(
      <StrictMode>
        <BeachReviewForm beachId="beach-1" beachName="Test Beach" onCancel={jest.fn()} />
      </StrictMode>
    );

    // Strict mode already double-invoked the mount effect by now.
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    const abandonCalls = mockTrack.mock.calls.filter(
      ([eventType]) => eventType === "review_form_abandon"
    );
    expect(abandonCalls).toHaveLength(1);
  });

  it("fires exactly one review_form_abandon under StrictMode + unmount", () => {
    const { unmount } = render(
      <StrictMode>
        <BeachReviewForm beachId="beach-1" beachName="Test Beach" />
      </StrictMode>
    );
    unmount();

    const abandonCalls = mockTrack.mock.calls.filter(
      ([eventType]) => eventType === "review_form_abandon"
    );
    expect(abandonCalls).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/components/beach/beach-review-form.test.tsx`
Expected: both tests FAIL — `cancel` case receives 2 abandon calls, `unmount` case receives 2 abandon calls.

- [ ] **Step 3: Fix the cancel handler to guard before firing**

Edit `components/beach/beach-review-form.tsx:200-217`:

```tsx
  const handleCancel = () => {
    // Single-fire guard: bail if cleanup already fired abandon.
    if (hasTrackedAbandonRef.current) {
      onCancel?.();
      return;
    }
    hasTrackedAbandonRef.current = true;
    track('review_form_abandon', {
      beachId,
      metadata: {
        source: trackingSource,
        beach_id: beachId,
        beach_name: beachName,
        is_edit: Boolean(existingReview),
        duration_ms: Date.now() - formOpenTimeRef.current,
        abandon_via: 'cancel_button',
        ...buildAbandonFieldSnapshot(),
      } as ReviewFormMetadata,
    });

    onCancel?.();
  };
```

- [ ] **Step 4: Fix the unmount cleanup to detect StrictMode fake-unmount by mount cycle count**

Add a new ref near the existing refs in the form component:

```tsx
  // Count how many times the mount effect has run. StrictMode re-runs mount in
  // dev — we use this to distinguish the fake-unmount (cycle 1, nothing after)
  // from a real unmount (cycle > 1, or cycle 1 in production).
  const mountCycleRef = useRef(0);
```

Then replace the existing unmount-cleanup `useEffect` with:

```tsx
  // Fire review_form_abandon on unmount when the user closes the dialog via X,
  // outside-click, or back navigation (anything that isn't Cancel or Submit).
  // Empty deps ensure the cleanup runs only on actual unmount.
  //
  // React 19 StrictMode fake-unmount fires within a few ms of mount. A plain
  // elapsed-time gate isn't sufficient because unit tests that render+unmount
  // synchronously also land under the threshold. Use mountCycleRef to detect
  // the specific case: first mount (cycleAtMount === 1), no subsequent mount
  // (mountCycleRef.current === 1), and short elapsed — that's StrictMode.
  // Real production unmount: cycleAtMount === 1 stays 1 forever, so the second
  // condition distinguishes test-environment StrictMode from prod.
  useEffect(() => {
    mountCycleRef.current += 1;
    const cycleAtMount = mountCycleRef.current;
    return () => {
      const elapsed = Date.now() - formOpenTimeRef.current;
      const isStrictModeFakeUnmount =
        cycleAtMount === 1 && mountCycleRef.current === 1 && elapsed < 50;
      if (
        !hasTrackedOpenRef.current ||
        hasSubmittedRef.current ||
        hasTrackedAbandonRef.current ||
        isStrictModeFakeUnmount
      ) {
        return;
      }
      hasTrackedAbandonRef.current = true;
      trackRef.current('review_form_abandon', {
        beachId: beachIdRef.current,
        metadata: {
          source: trackingSourceRef.current,
          beach_id: beachIdRef.current,
          beach_name: beachNameRef.current,
          is_edit: isEditRef.current,
          duration_ms: elapsed,
          abandon_via: 'unmount',
          ...abandonSnapshotRef.current,
        } as ReviewFormMetadata,
      });
    };
    // Empty deps intentional: cleanup must run only on real unmount.
  }, []);
```

**Why mount-cycle detection, not just elapsed-time:** The original plan used a plain `elapsed < 50` gate, but empirical testing showed this breaks the unit test's `render() → unmount()` flow — both the StrictMode fake-unmount AND the real unmount fall under 50ms in Jest, so the gate suppresses both and zero abandon events fire. Counting mount cycles disambiguates the two unmounts without any timing assumption that breaks in synchronous test environments. In production (no StrictMode), the mount body runs once, `mountCycleRef.current` stays at 1, and the short-elapsed case still suppresses — identical to the original gate's prod behavior.

- [ ] **Step 5: Run the unit test again**

Run: `yarn test:unit __tests__/components/beach/beach-review-form.test.tsx`
Expected: both tests PASS.

- [ ] **Step 6: Re-run the Playwright abandon test**

Run: `npx playwright test e2e/beach-review-tracking.spec.ts --project=auth -g "should track review_form_abandon when cancel is clicked"`
Expected: PASS — receives exactly one abandon with `abandon_via: "cancel_button"`, `duration_ms > 0`.

- [ ] **Step 7: Commit**

```bash
git add components/beach/beach-review-form.tsx __tests__/components/beach/beach-review-form.test.tsx
git commit -m "fix(review-form): single-fire guard on cancel + 50ms gate on unmount abandon

Cancel handler now bails if hasTrackedAbandonRef is already set instead of
setting-then-firing unconditionally. Unmount cleanup gates on a 50ms minimum
mount duration to skip React 19 StrictMode fake-unmount firings.

Regression surfaced by e2e/beach-review-tracking.spec.ts:336 on 2026-04-17."
```

---

## Task 2: Fix dialog close-button accessibility + E2E selector

**Why:** `components/ui/dialog.tsx:47-50` renders the close button with an `sr-only` span child for its accessible name, but has no `aria-label`. Role-based locators still work (`getByRole('button', { name: /close/i })`), but the existing spec uses an `aria-label="Close"` attribute selector which never matched. Two-sided fix: add the explicit `aria-label` to the component (hardens a11y — a screen reader hearing *both* the sr-only text and the aria-label still reads "Close" once because aria-label wins), and update the test to use role-based locator.

**Files:**
- Modify: `components/ui/dialog.tsx:47`
- Modify: `e2e/beach-review-tracking.spec.ts:388`

- [ ] **Step 1: Add explicit aria-label to DialogPrimitive.Close**

Edit `components/ui/dialog.tsx:47`:

```tsx
      <DialogPrimitive.Close
        aria-label="Close"
        className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
      >
        <X className="h-4 w-4" />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
```

- [ ] **Step 2: Update the E2E test selector to role-based**

Edit `e2e/beach-review-tracking.spec.ts:388`:

```tsx
      // Click the Radix DialogContent close button. Dialog renders both an
      // aria-label="Close" and an sr-only "Close" span; role-based locator works
      // without coupling to either.
      const closeButton = dialog.getByRole("button", { name: /close/i });
      await closeButton.click();
```

- [ ] **Step 3: Run the E2E test**

Run: `npx playwright test e2e/beach-review-tracking.spec.ts --project=auth -g "should track review_form_abandon when dialog is closed via X button"`
Expected: PASS.

- [ ] **Step 4: Blast radius check for the Dialog change**

Run: `npx playwright test e2e/ --project=auth --grep "dialog|Dialog"`
Expected: no regressions in other dialogs that rely on absence of aria-label.

- [ ] **Step 5: Commit**

```bash
git add components/ui/dialog.tsx e2e/beach-review-tracking.spec.ts
git commit -m "fix(ui): add aria-label to DialogContent close + role-based e2e selector

DialogPrimitive.Close only had an sr-only span for its accessible name. Added
aria-label=Close (screen readers still read it once — aria-label wins over
sr-only child). Updated abandon E2E to role-based getByRole locator."
```

---

## Task 3: Add review_submit happy-path E2E coverage

**Why:** The spec file header at `e2e/beach-review-tracking.spec.ts:13` claims "Successful submit tracking" but no test asserts `review_submit` fires after a successful `createBeachReview`. The `2026-04-17 verify-dead-table` audit relied on `beach_reviews_history` evidence (an Apr 10 created-then-deleted row) to confirm the write path — that's a fragile way to keep a happy-path protected. Add a test that fills the form, submits, asserts the event fires with correct metadata, asserts the row exists in Supabase, and **deletes the row in afterEach so we don't accumulate test-bait on beach pages.**

**Files:**
- Modify: `e2e/beach-review-tracking.spec.ts` (add new describe block)
- Check: `e2e/utils/test-data-cleanup.ts` already exists; add helper if missing

- [ ] **Step 1: Verify test cleanup utility exists**

Run: `grep -n "deleteReviewsForUser\|cleanupReviews" e2e/utils/test-data-cleanup.ts`
Expected: either shows existing helper, or returns nothing (Step 2 adds it).

- [ ] **Step 2: Add delete helper if missing**

If the grep in Step 1 returned nothing, append to `e2e/utils/test-data-cleanup.ts`:

```tsx
import { createClient } from "@supabase/supabase-js";

/**
 * Hard-delete every beach_reviews row owned by the given user. Used by happy-path
 * review submit tests to keep the table clean. Uses the service-role key so RLS
 * doesn't block; requires E2E_SUPABASE_SERVICE_ROLE_KEY in env.
 */
export async function deleteReviewsForUser(userId: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "deleteReviewsForUser requires NEXT_PUBLIC_SUPABASE_URL and E2E_SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  const client = createClient(url, key);
  const { error } = await client.from("beach_reviews").delete().eq("user_id", userId);
  if (error) throw new Error(`cleanup failed: ${error.message}`);
}
```

- [ ] **Step 3: Write the happy-path E2E test**

Append to `e2e/beach-review-tracking.spec.ts` after the existing `Form Abandon Tracking` describe:

```tsx
import { deleteReviewsForUser } from "./utils/test-data-cleanup";
import { getCurrentUserId } from "./utils/auth-helpers";

test.describe("Successful Submit Tracking", () => {
  let errorCapture: ErrorCapture;
  let testUserId: string | null = null;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    // Clean up the review this test inserted, regardless of pass/fail.
    if (testUserId) {
      await deleteReviewsForUser(testUserId).catch((err) => {
        console.warn("Review cleanup failed:", err);
      });
      testUserId = null;
    }
    await assertNoErrors(page, errorCapture, { context: "Successful Submit Tracking" });
  });

  test("fires review_submit and writes row on valid submit", async ({ page }) => {
    await ensureAuthenticated(page);
    await setupTrackingCapture(page);

    await navigateToBeach(page, TEST_BEACHES.blacks);
    await waitForTrackingReady(page);
    testUserId = await getCurrentUserId(page);
    await page.evaluate(() => { (window as any).__capturedTrackingEvents = []; });

    // Default tab is Forecast — switch to Overview where the review CTA lives.
    await page.getByRole("tab", { name: /overview/i }).click();
    await page.getByRole("button", { name: /write a review/i }).first().click();

    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Fill all 5 rating categories with star 4.
    const starButtons = dialog.locator('button[aria-label*="Rate"]');
    for (let category = 0; category < 5; category++) {
      await starButtons.nth(category * 5 + 3).click();
    }

    // Fill title + content.
    await dialog.getByPlaceholder(/summarize your experience/i).fill("E2E happy-path title");
    await dialog.locator("textarea").fill("E2E happy-path content body for verification.");

    // Submit.
    await dialog.getByRole("button", { name: /post review/i }).click();

    // Dialog should close on success.
    await expect(dialog).not.toBeVisible({ timeout: 10000 });

    // Wait for review_submit event.
    await page.waitForFunction(
      () => (window as any).__capturedTrackingEvents?.some((e: any) => e.eventType === "review_submit"),
      { timeout: 5000 }
    );

    const events = await getCapturedEvents(page);
    const submitEvent = events.find((e) => e.eventType === "review_submit");
    expect(submitEvent).toBeDefined();
    expect(submitEvent?.metadata?.source).toBe("overview_cta");
    expect(submitEvent?.metadata?.duration_ms).toBeGreaterThan(0);
    expect(submitEvent?.metadata?.is_edit).toBe(false);
  });
});
```

- [ ] **Step 4: Add getCurrentUserId helper if missing**

Run: `grep -n "getCurrentUserId" e2e/utils/auth-helpers.ts`
If missing, append to `e2e/utils/auth-helpers.ts`:

```tsx
/**
 * Read the authenticated user's id from the page context. Reads the Supabase
 * session cookie via a client-side evaluate. Returns null if not signed in.
 */
export async function getCurrentUserId(page: Page): Promise<string | null> {
  return page.evaluate(async () => {
    const keys = Object.keys(localStorage).filter((k) =>
      k.startsWith("sb-") && k.includes("auth-token")
    );
    for (const k of keys) {
      try {
        const raw = localStorage.getItem(k);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        const sub = parsed?.user?.id ?? parsed?.currentSession?.user?.id;
        if (typeof sub === "string") return sub;
      } catch {
        // continue
      }
    }
    return null;
  });
}
```

- [ ] **Step 5: Run the new happy-path test**

Run: `npx playwright test e2e/beach-review-tracking.spec.ts --project=auth -g "fires review_submit"`
Expected: PASS — one `review_submit` event captured, dialog closed, afterEach deletes the row.

- [ ] **Step 6: Verify cleanup actually happened**

Run the SQL via Supabase MCP:
```sql
SELECT COUNT(*) FROM beach_reviews WHERE title = 'E2E happy-path title';
```
Expected: `0`.

- [ ] **Step 7: Commit**

```bash
git add e2e/beach-review-tracking.spec.ts e2e/utils/test-data-cleanup.ts e2e/utils/auth-helpers.ts
git commit -m "test(review-form): add happy-path review_submit e2e with cleanup

Covers the gap documented in the file header — 'Successful submit tracking'
had no actual test. afterEach deletes the inserted row via service-role
client so the table stays clean."
```

---

## Task 4: Tighten app-stats filter — exclude mock profiles universally, handle NULL emails

**Why:** The 2026-04-17 audit found the SKILL filter `p.email NOT ILIKE '%test%'` drops 3 orphan profiles whose `email IS NULL` silently (SQL `NULL NOT ILIKE '%test%'` → NULL → row excluded from a `WHERE x AND NULL` clause). One of those profiles ("Test User", 610a5745) was the author of the Apr 10 `review_submit` test event that triggered this whole investigation. Also: the filter only applies `p.is_mock = false` to intel_posts queries, so 1,195 NPC `beach_reviews` rows stay silently hidden from the dashboard — but any future feature that joins profiles without this explicit guard will show inflated counts. Standardize both guards across all profile-join queries.

**Files:**
- Modify: `~/.claude/skills/app-stats/SKILL.md`

- [ ] **Step 1: Define the canonical filter clause**

The new filter, to be used everywhere a profile is joined:
```
p.is_mock = false
AND (p.email IS NULL OR (
  p.email NOT ILIKE '%test%'
  AND p.email NOT LIKE '%@local.test'
  AND p.email NOT LIKE '%@example.invalid'
))
```

Rationale:
- `p.is_mock = false` catches every NPC/seed profile regardless of email tenancy.
- `p.email IS NULL OR (...)` explicitly includes NULL-email real profiles (Apple relay can produce these) instead of silently dropping them.

- [ ] **Step 2: Replace the "Exclusion filter" section at the top**

Edit `~/.claude/skills/app-stats/SKILL.md`. Find the current section:

```markdown
**Exclusion filter** (applied to all queries joining profiles):
\`\`\`
p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid'
\`\`\`
This filters out test accounts, local dev accounts, and seed/demo data (`@example.invalid`).

**Additional intel-post exclusion:** Queries that count `intel_posts` activity (Queries 3, 6, 10) also add `AND p.is_mock = false` to exclude automated cron accounts like `morning.intel@quiversurf.app` (seeded with `is_mock=true` by `quiver/scripts/create-morning-intel-bot.sql`). Without this filter, daily cron posts inflate the organic intel count ~8x.
```

Replace with:

```markdown
**Exclusion filter** (applied to all queries joining profiles):
\`\`\`
p.is_mock = false
AND (p.email IS NULL OR (
  p.email NOT ILIKE '%test%'
  AND p.email NOT LIKE '%@local.test'
  AND p.email NOT LIKE '%@example.invalid'
))
\`\`\`
This filters out:
- Mock/NPC profiles of every kind via `p.is_mock = false` (includes `morning.intel@quiversurf.app`, the seeded NPC review authors at `@example.invalid`, and any future seed script that sets the flag).
- Test accounts and local-dev accounts via the email substring guards.
- But explicitly INCLUDES real profiles with `email IS NULL` (Apple relay accounts, social logins that didn't surface an email). Without the `OR p.email IS NULL` branch, `NULL NOT ILIKE '%test%'` returns NULL and those rows silently drop out of every dashboard count.
```

- [ ] **Step 3: Update every SQL query that joins profiles**

For each of Queries 1–27 in the skill file, replace the profile filter. Examples:

Query 1 (user count) — replace:
```sql
WHERE email NOT ILIKE '%test%' AND email NOT LIKE '%@local.test' AND email NOT LIKE '%@example.invalid'
```
With:
```sql
WHERE is_mock = false
  AND (email IS NULL OR (
    email NOT ILIKE '%test%'
    AND email NOT LIKE '%@local.test'
    AND email NOT LIKE '%@example.invalid'
  ))
```

Query 2 (sessions) — replace:
```sql
AND p.email NOT ILIKE '%test%' AND p.email NOT LIKE '%@local.test' AND p.email NOT LIKE '%@example.invalid';
```
With:
```sql
AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

Apply the same substitution across Queries 3, 4, 6, 8, 9, 10, 18, 19, 20, 21, 22, 23, 26, 27. For Queries 3, 6, 10 which already had a separate `AND p.is_mock = false` appended to intel/content subqueries, remove the separate line since the canonical filter now includes it.

- [ ] **Step 4: Sanity-check against the DB before committing**

Run via Supabase MCP to confirm totals change as expected:

```sql
SELECT
  COUNT(*) FILTER (WHERE is_mock = false) AS real_profiles,
  COUNT(*) FILTER (WHERE is_mock = false AND email IS NULL) AS real_null_email,
  COUNT(*) FILTER (WHERE email NOT ILIKE '%test%' AND email NOT LIKE '%@local.test' AND email NOT LIKE '%@example.invalid') AS old_filter_match
FROM profiles;
```

Expected: `real_profiles ≥ old_filter_match + real_null_email`. The `real_null_email` bucket is the slice the old filter was dropping.

Also confirm Query 3 (content) now shows `total_reviews > 0` if any real user has ever written a review:

```sql
SELECT COUNT(*) FROM beach_reviews br
JOIN profiles p ON br.user_id = p.id
WHERE br.deleted_at IS NULL
  AND p.is_mock = false
  AND (p.email IS NULL OR (
    p.email NOT ILIKE '%test%'
    AND p.email NOT LIKE '%@local.test'
    AND p.email NOT LIKE '%@example.invalid'
  ));
```

As of 2026-04-17 the expected value is `0` (no real reviews exist yet). Any non-zero result is new signal, not drift.

- [ ] **Step 5: Run the skill end-to-end to confirm no regressions**

Invoke `/app-stats` in a fresh conversation. Verify:
- Dashboard renders without SQL errors.
- "Total Users", "DAU", "New Signups Roster" counts match or slightly exceed pre-fix numbers (never below — we only added rows back, never removed them).
- Any NULL-email profile now appears in the New Signups Roster if within 7d.

---

## Deferred / out-of-scope

- **NPC review cron** (`app/api/cron/npc-activity/route.ts:310`) is still writing `is_mock=true` reviews every run. With the Task 4 filter fix, these are correctly invisible to the dashboard — so this is a policy decision, not a bug. Memory entry `project_quiver_pmf_status_apr2026` frames it as social-proof seeding. Leave on. If this changes, a follow-up plan should cover either stopping the cron or surfacing NPC reviews publicly with `is_mock` exposure.
- **Orphan "Test User" profile** (610a5745, email=NULL, is_mock=false). Survives the Jan NPC cleanup migration. Not harmful — no reviews attached now. Tracking via user_events only. Leave alone; if it writes future noise, update SQL scripts to include `p.full_name NOT ILIKE 'Test User'` alongside email guards.
- **Strict-mode audit of other tracked events** — abandon double-fire was caught here, but other components with `useEffect(() => () => track(...), [])` patterns (session-log form? cam-share?) may have the same bug. Worth a grep pass, but separate plan.

---

## Self-review results

**Spec coverage:**
- 2026-04-17 abandon double-fire E2E failure → Task 1 ✓
- 2026-04-17 Close-button E2E failure → Task 2 ✓
- `review_submit` happy-path coverage gap → Task 3 ✓
- `app-stats` filter null-email + is_mock blind spot → Task 4 ✓
- NPC review cleanup policy → deferred, flagged ✓

**Placeholder scan:** None found — every step has exact code, exact commands, exact file paths.

**Type/naming consistency:**
- `hasTrackedAbandonRef` used identically in Tasks 1 Step 3 + Step 4 ✓
- `deleteReviewsForUser` + `getCurrentUserId` signatures match between Task 3 Steps 2, 3, 4 ✓
- Task 4 filter clause identical in Steps 1, 2, 3, 4 ✓
