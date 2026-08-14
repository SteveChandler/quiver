# SPEC: cron outcome assertions

**Problem:** Quiver has 47 cron routes. One records a run. One asserts it produced anything. So 46
scheduled jobs can do nothing indefinitely and nothing notices.

Every silent failure found on 2026-08-13 has this shape — the process reported success while
delivering nothing:

| Failure | What the system reported | Days undetected |
|---|---|---|
| Alert pipeline dead | cron ran fine | 16 |
| 19,637 WQ samples stranded | `cron_runs` 200/200 ok | months |
| Migration replay no-ops | migrations applied | unknown |
| Sentry monitors mis-slugged | jobs looked dead, were healthy | weeks |

**Goal:** a cron that does nothing is loud within one cycle.

---

## The contract

Every cron declares the minimum effect it must produce, and reports the effect it actually produced.

```ts
export interface CronOutcome {
  /** Stable id, matches the route. */
  job: string;
  /** What this job exists to produce. */
  unit: string;               // "samples_evaluated" | "notifications_sent" | ...
  produced: number;
  /** Below this, the run is a FAILURE even if no error was thrown. */
  expectedMin: number;
  /** Optional: a run producing more than this is also suspicious. */
  expectedMax?: number;
  /** Set when producing nothing is legitimately correct this cycle. */
  legitimatelyZero?: { reason: string };
}
```

Two rules do the work:

1. **Zero is a failure by default.** A run that produces nothing must either fail, or explicitly
   declare `legitimatelyZero` with a reason. Silence is not success.
2. **The assertion is on the OUTCOME, not the step.** "Query returned OK" is not an outcome.
   "993 samples evaluated" is. Count the thing the job exists to produce.

---

## Implementation

### 1. Shared helper

`lib/cron/outcome.ts` — wraps a cron handler, records the outcome to `cron_runs`, and converts a
below-minimum run into a failed status plus an alert. It must NOT swallow the underlying result.

### 2. Persist outcomes

Extend `cron_runs` (or add `cron_outcomes`) with `job`, `unit`, `produced`, `expected_min`,
`status`, `ran_at`. **UNAPPLIED migration; owner applies.**

This table is the answer to "is Quiver actually working?" — one query, 47 rows, any row at zero is a
dead subsystem.

### 3. Per-job minimums — derive them, don't guess

For each of the 47 routes, set `expectedMin` from observed history, not intuition. A job that
normally writes 900 rows should not have a minimum of 1. Where history is unavailable, start at 1
and tighten after two weeks of data.

Jobs that are legitimately often-zero (an alert evaluator on a flat day) use `legitimatelyZero`
with a reason, so "zero" is a decision someone made rather than a silence.

### 4. Alerting

One alert when a job reports below-minimum, and one when a job has not reported at all within
1.5× its schedule interval. The second catches "never ran", which the first cannot see.

Route to the existing Sentry setup — but verify the monitor slug matches the route, because a
slug mismatch already made healthy jobs look dead once.

---

## Rollout

Do not convert 47 routes at once. Convert in three passes so the pattern is proven before it is
replicated:

1. **Pass 1 (5 jobs):** the ones whose failure is most expensive — alert delivery, water-quality
   sync + evaluate, forecast ingestion, notification worker. Prove the helper, the table, and the
   alert path end to end.
2. **Pass 2:** every job that writes user-visible data.
3. **Pass 3:** the remainder, including the ones that legitimately produce nothing most cycles.

## Acceptance

- A job that returns zero rows fails and alerts, without throwing.
- A job that does not run at all alerts within 1.5 intervals.
- A `legitimatelyZero` job does not alert, and its reason is recorded.
- Tests: per converted job, a test that FAILS if the assertion is removed.
- A single query answers "which subsystems produced nothing in the last cycle".

## What this does NOT solve

It catches jobs producing nothing. It does not catch a job producing *wrong* output — the CEDEN
pipeline wrote 19,637 rows correctly and still evaluated the wrong 30-day window. Output-correctness
needs separate invariants and is out of scope here.

## Estimated value

Six of the nine failures found on 2026-08-13 would have alerted within one cycle instead of
persisting for days to months.
