# Alert quality guards: minimum score floor + late-send suppression

**Date:** 2026-08-11
**Status:** Ready for Codex
**Origin:** Review of the 56 alerts queued in the 7 days after the pipeline repair, while `FORECAST_ALERT_DELIVERY_ENABLED` is still off.

---

## Goal

Two guards, so that when the delivery flag is eventually flipped, users do not receive
(a) recommendations for surf that has already happened, or (b) alerts for sessions that
technically clear their thresholds but are not worth the trip.

Delivery is still flag-gated. This change does **not** flip that flag and must not.

## The evidence

All 56 queued alerts were checked against their own rule's stated conditions — time
window, wave min/max, tide min/max, avoid-tide-status. **Zero violations.** The matching
engine is honest; the defects are in timing and quality.

### 1. Eleven of 56 would arrive after the session

```
best_hour = 2026-08-10T15:00:00Z
send_at   = 2026-08-10T15:58:49Z    → 58 minutes LATE
```

Timezone-independent (both UTC). Affected: La Jolla Shores, Tourmaline Beach ×2,
Tourmaline Surf Park, Pacific Beach ×5, Mission Beach, Pacific City — scores 0.64–0.82,
so these are *good* sessions arriving too late to act on.

**Root cause is precise.** `selectActionableAlertWindow`
(`lib/alerts/actionable-window-selector.ts:11-14`) filters windows on
`window_end > now`. A 15:00–16:00 window at 15:58 still passes that test — two minutes
of window remain — even though `best_hour` (15:00) is 58 minutes gone. The selector
guarantees the window has not *ended*; it never guarantees the recommendation is still
actionable.

Lead time across all 56: **median 2.0h**, min -1.0h, max 8.0h.

### 2. Half the alerts are for mediocre surf

| best_score | count |
|---|---:|
| 0.9+ | 3 |
| 0.6–0.9 | 24 |
| 0.3–0.6 | 20 |
| **below 0.3** | **9** |

Weakest is **0.09 at Pipes** (2.3 ft @ 12 s) — inside the user's thresholds, not worth
driving to. Alerts that consistently under-deliver train users to ignore the channel,
which matters given the pre-outage read rate was ~2%.

### Out of scope, deliberately

14 of 24 `mellow_session` rules carry no `local_time_start`/`local_time_end`, so they can
fire at 17:00 or 20:00 despite the preset implying a morning surf. That is a product
question about what the preset should mean, not a bug. **Do not change preset defaults
or backfill rule conditions in this task.**

---

## Task 1 — Require real runway before recommending a window

**Files**
- Modify: `lib/alerts/actionable-window-selector.ts`
- Test: `__tests__/lib/alerts/actionable-window-selector.test.ts`

A window is only actionable if enough of it is still ahead of the surfer. Replace the
`window_end > now` test with a check anchored on `best_hour`, keeping a small grace so a
session that just started is still worth sending.

- [ ] **Step 1: Write the failing tests**

Add to `__tests__/lib/alerts/actionable-window-selector.test.ts`:

```ts
import {
  selectActionableAlertWindow,
  ALERT_MIN_ACTIONABLE_LEAD_MINUTES,
} from "@/lib/alerts/actionable-window-selector";

function window(overrides: Partial<FoundWindow> = {}): FoundWindow {
  return {
    window_start: "2026-08-10T15:00:00.000Z",
    window_end: "2026-08-10T16:00:00.000Z",
    best_hour: "2026-08-10T15:00:00.000Z",
    best_score: 0.7,
    conditions_snapshot: {},
    ...overrides,
  } as FoundWindow;
}

describe("late-window suppression", () => {
  // Reproduces production 2026-08-10: window_end was 2 minutes away so the old
  // `window_end > now` test passed, but best_hour was already 58 minutes gone.
  it("rejects a window whose best hour has already passed", () => {
    const now = new Date("2026-08-10T15:58:49.000Z");
    expect(selectActionableAlertWindow([window()], now)).toBeNull();
  });

  it("keeps a window whose best hour is still ahead", () => {
    const now = new Date("2026-08-10T13:00:00.000Z");
    expect(selectActionableAlertWindow([window()], now)?.best_hour).toBe(
      "2026-08-10T15:00:00.000Z",
    );
  });

  it("allows a short grace so a just-started session still sends", () => {
    const graceMs = (ALERT_MIN_ACTIONABLE_LEAD_MINUTES - 1) * 60_000;
    const now = new Date(Date.parse("2026-08-10T15:00:00.000Z") + graceMs);
    expect(selectActionableAlertWindow([window()], now)).not.toBeNull();
  });

  it("prefers a later actionable window over a stale earlier one", () => {
    const now = new Date("2026-08-10T15:58:49.000Z");
    const later = window({
      window_start: "2026-08-10T18:00:00.000Z",
      window_end: "2026-08-10T19:00:00.000Z",
      best_hour: "2026-08-10T18:00:00.000Z",
      best_score: 0.5,
    });
    expect(selectActionableAlertWindow([window(), later], now)?.best_hour).toBe(
      "2026-08-10T18:00:00.000Z",
    );
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

```bash
yarn test:unit __tests__/lib/alerts/actionable-window-selector.test.ts
```

Expected: the first and fourth fail — the current filter accepts the stale window.

- [ ] **Step 3: Implement**

In `lib/alerts/actionable-window-selector.ts`:

```ts
/**
 * How far past `best_hour` a window may still be sent. A surfer who gets the alert a
 * few minutes into the best hour can still act on it; an hour late they cannot.
 * Production 2026-08-10 sent 11 alerts up to 58 minutes after best_hour because the
 * only guard was `window_end > now`, and a 15:00-16:00 window is still "unfinished"
 * at 15:58.
 */
export const ALERT_MIN_ACTIONABLE_LEAD_MINUTES = 15;
```

Replace the `futureWindows` filter:

```ts
  const futureWindows = windows.filter((window) => {
    const bestHourMs = new Date(window.best_hour).getTime();
    const endMs = new Date(window.window_end).getTime();
    if (!Number.isFinite(bestHourMs) || !Number.isFinite(endMs)) return false;
    // The window must not be over AND the best hour must still be reachable.
    return (
      endMs > nowMs &&
      bestHourMs + ALERT_MIN_ACTIONABLE_LEAD_MINUTES * 60_000 > nowMs
    );
  });
```

Keep the existing earliest-vs-top scoring logic below unchanged.

- [ ] **Step 4: Run the tests — expect PASS**

```bash
yarn test:unit __tests__/lib/alerts/actionable-window-selector.test.ts
```

Also run `__tests__/lib/alerts/revalidate-alert-window.test.ts` — it exercises this
selector through `selectFreshAlertWindow`. If a fixture there now returns null, check
whether its `now` is genuinely past `best_hour` before changing the assertion; a test
that was passing on a stale window is asserting the bug.

- [ ] **Step 5: Commit**

```bash
git add lib/alerts/actionable-window-selector.ts __tests__/lib/alerts/actionable-window-selector.test.ts
git commit -m "fix(alerts): do not recommend a window whose best hour has passed"
```

---

## Task 2 — Suppress alerts below a minimum score

**Files**
- Modify: `app/api/cron/condition-alert-deliver/route.ts`
- Test: `__tests__/app/api/cron/condition-alert-deliver.test.ts` (or the nearest existing
  delivery-route suite — find it, do not create a parallel one)

**Interfaces**
- Consumes: `QUEUE_MARK_REASONS` / `QueueMarkReason` (route-local, ~line 75)
- Produces: a new `below_score_floor` reason, counted in `queueMarkedByReason`

Put the floor at the **delivery** decision, not at queue time. Queue rows stay as the
record of what matched; the delivery gate decides what is worth sending, and the existing
`queueMarkedByReason` counters make the suppression measurable before the flag is flipped.

- [ ] **Step 1: Write the failing test**

Follow the mocking style already used by the delivery-route suite. Assert that a queue
item with `best_score` below the floor is consumed with reason `below_score_floor`, records
no delivery attempt, and that an item above the floor is unaffected.

```ts
it("suppresses a queued alert whose best score is below the floor", async () => {
  // queue item with best_score: 0.09 (production: Pipes, 2.3ft @ 12s)
  const response = await GET(authorizedCronRequest());
  const body = await response.json();

  expect(body.data.queueMarkedByReason.below_score_floor).toBe(1);
  expect(recordAttempt).not.toHaveBeenCalled();
});

it("still delivers a queued alert at or above the floor", async () => {
  // queue item with best_score: 0.64
  const response = await GET(authorizedCronRequest());
  const body = await response.json();

  expect(body.data.queueMarkedByReason.below_score_floor).toBe(0);
});
```

- [ ] **Step 2: Run it and confirm it fails**

```bash
yarn test:unit <the delivery-route suite>
```

Expected: `below_score_floor` is not a key on `queueMarkedByReason`.

- [ ] **Step 3: Implement**

Add `"below_score_floor"` to the `QUEUE_MARK_REASONS` tuple (~line 75). Add the constant
next to it:

```ts
/**
 * Minimum best_score worth interrupting someone for. Rules match on thresholds, which
 * says a session is acceptable, not that it is worth the drive. In the 7 days after the
 * 2026-08-10 pipeline repair, 9 of 56 queued alerts scored below this — the weakest 0.09.
 */
const ALERT_MIN_DELIVERABLE_SCORE = 0.3;
```

After the queue rows are refreshed and the stale ones are split out (~line 790, right
after the `staleItems` handling), partition the remaining `items` on score and consume the
low ones:

```ts
    const lowScoreItems = items.filter(
      (item) => parseQueuedBestScore(item.best_score) < ALERT_MIN_DELIVERABLE_SCORE,
    );
    if (lowScoreItems.length > 0) {
      await markQueueItemsConsumed(lowScoreItems, "below_score_floor");
    }
    const deliverableItems = items.filter(
      (item) => parseQueuedBestScore(item.best_score) >= ALERT_MIN_DELIVERABLE_SCORE,
    );
```

Then use `deliverableItems` everywhere `items` currently feeds the delivery path. Read the
surrounding code before wiring this — `items` is referenced in several places and every
one of them must move to the filtered list, or a low-score item will be suppressed in the
counters while still being delivered.

Use the existing `parseQueuedBestScore` helper (~line 762). A row with a null or
unparseable score must **not** be suppressed — treat it as deliverable so a parsing
regression cannot silently mute the whole channel.

- [ ] **Step 4: Run the tests — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/condition-alert-deliver/route.ts <test file>
git commit -m "feat(alerts): suppress deliveries below the minimum session score"
```

---

## Verification before handing back

```bash
yarn typecheck
yarn test:unit __tests__/lib/alerts __tests__/app/api/cron
npx eslint --max-warnings=0 lib/alerts/actionable-window-selector.ts app/api/cron/condition-alert-deliver/route.ts
yarn build
```

Then state, from the counters rather than from reasoning: with both guards in place, how
many of the 56 production-shaped alerts would still send. Expected ≈ 36 (56 − 9 low score
− 11 late, with the two sets possibly overlapping — report the real number, do not assume
they are disjoint).

## Definition of done

- [ ] Two commits on `codex/alert-quality-guards-20260811`, branched from `origin/main`
- [ ] `yarn typecheck`, scoped eslint, and both suites green
- [ ] A window whose `best_hour` has passed is never selected; one still ahead is
- [ ] Alerts below 0.3 are consumed as `below_score_floor` and record no attempt
- [ ] Null/unparseable scores are treated as deliverable, never suppressed

## Hard constraints

- **Do not flip `FORECAST_ALERT_DELIVERY_ENABLED` or touch any Vercel env var.** Delivery
  stays gated; this task only changes what *would* be sent.
- **No database writes, migrations, or backfills.** Do not modify `alert_rules` rows,
  preset defaults, or existing `alert_queue` data.
- Do not change preset definitions or add time windows to `mellow_session` — that is the
  out-of-scope product question above.
- Do not weaken or reorder the existing gates (major-event hold, canonical safety,
  cooldown, user cap). The new guards are additive.
- Do not push, open a PR, or merge. Commit locally only.
- Stage explicit paths in each `git add`. Never `git add -A`.
