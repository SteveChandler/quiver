# Phase 20.1 — Retention Loop Evidence

**Opened:** 2026-08-25 · **Status:** scaffold — Tasks 1 and 2 complete, Tasks 3 and 4 blocked
**Implementation:** merged (quiver `a84c7119a`, quiver-native `944afed7`)
**Released:** **no** — see "Why no results appear here yet"

This document is the evidence trail for Plan 20.1-06. It currently contains the frozen session
baseline (Task 1) and the reproducible query definitions (Task 2). It deliberately contains **no
results**, because nothing measurable has happened yet.

---

## Why no results appear here yet

Phase 20.1's code is merged to `main` in both repositories. It is **not released to anybody**:

| Gate | State | Consequence for measurement |
|---|---|---|
| Web `main` → `prod` | not promoted | No visitor can reach Follow / My Coast / exact-call CTA |
| Native build/OTA | not published | No user has Home continuity, one-tap Watch, or exact resolution |
| `beach_follows` migration | **unapplied** | Follow sync cannot persist; account-side denominator is structurally zero |
| `user_events` CHECK migration | **unapplied** | BFR events are rejected at insert; the funnel cannot record |
| `alert_rules` preset CHECK migration | **unapplied** | `watched_call` rules cannot be created |
| `EXPO_PUBLIC_WEEK_SCOUT_STABILITY_ENABLED` | **unset in every config source** | BFR-08 stability is off for all users (see `20.1-05-STABILITY-FLAG-EVIDENCE.md`) |

Every denominator in Task 2's queries is therefore zero by construction. Running them today would
produce empty results that could be misread as "the feature did not work" rather than "the feature
was never switched on". Plan 20.1-06 Task 4 explicitly forbids declaring success from immature
cohorts or internal-only flag state; the symmetric error — declaring failure from an unreleased
feature — is equally out of bounds.

**Order of operations before this document can hold results:** promote web to prod → apply the
three migrations → set the stability flag → publish an approved native build → allow cohorts to
mature (D7 needs at least seven days plus the maturity buffer defined below). Each step is
approval-gated and belongs to Steven.

---

## Task 1 — Existing session behaviour is the frozen baseline, not the hypothesis

### What ships today

One-tap session logging already exists and is untouched by Phase 20.1:

- Home quick-log entry point → `home_quick_log_tapped` (native, `src/lib/analytics.ts:648`)
- Session rating → `session_log_rating_set` (`lib/analytics/event-taxonomy.ts:743`)
- Session prefill shown → `session_prefill_shown` (`:729`)
- Full submit → `session_log_submit` (`:656`)
- Plus reminders, board-fit feedback, and the full SessionForm route.

### Measured baseline

Physical-device users, test accounts excluded, **2026-06-01 → 2026-08-23**:

- **9** users tapped Home quick log.
- **4** submitted within one day.

**Product conclusion of record (Steven's):** this did not materially move retention or sales.
Phase 20.1 therefore does **not** treat session friction as the open hypothesis, and adds no
second outcome surface. See `20.1-INFLIGHT-AUDIT.md` § "Existing one-tap sessions: baseline
boundary".

**Limitations of that baseline, stated so it is not over-read:** n=9 is far too small to support
any causal claim in either direction; the window predates every Phase 20.1 surface; and the counts
are a funnel snapshot, not a retention measurement. It is recorded as a floor and a
non-regression guardrail — never as evidence that session completion does or does not drive return.

### Non-regression proof (verified 2026-08-25 against merged main)

Wave 3 introduced no new outcome prompt, learning receipt, post-window session prompt, session
schema, or session-history path:

- Files touching session logging in the web wave-3 range (`49d9f848b..a84c7119a`): **none**.
- Files touching session logging in the native wave-3 range (`f51257e9..944afed7`): **none**.
- The four baseline events above are **byte-unchanged** in `src/lib/analytics.ts`.

Optional compatibility, documented but **not implemented**: watched-call context could be passed
into the existing session route if a user independently chooses to log after a watched call. Plan
20.1-06 Task 1 explicitly forbids adding that implementation here, and none was added.

**Guardrail for the rollout decision:** these four events are secondary diagnostics only. If they
move, that is context. They are never the primary retention outcome (BFR-11).

---

## Task 2 — Reproducible query definitions

Definitions only. Each states its denominator, exclusions, and maturity rule so it cannot be run
ambiguously later.

### Shared conventions

- **Exclusions (all queries):** test accounts, internal users, emulator/simulator sessions, and
  bot traffic. Bot exclusion is mandatory — see the workspace note on excluding bots from
  engagement metrics.
- **Cohort assignment:** `bfr-follow-holdout-v1` via `bfrHoldoutAssignment` — a deterministic hash
  persisted with the follow envelope and carried through anonymous→account merge. It is **never**
  recomputed from the account id, so an arm cannot flip at sign-in.
- **Maturity:** D1 needs ≥ 2 days elapsed; D7 needs ≥ 8 days. Cohorts below those thresholds are
  reported as "immature" and excluded from the decision, not shown as low.
- **Sample-size floor:** any figure with n < 30 is annotated inline with its n. No proportion is
  reported without its denominator.
- **Build identity (native rows):** every native query carries app version, build number, runtime
  version, EAS channel, and update id, so results are attributable to a known artifact.
- **Language:** no causal phrasing unless the holdout or a defensible staggered rollout supports
  it. "Associated with" otherwise.

### The eleven definitions

1. **Web follow funnel by page type and audience.** Denominator: viewers of a pilot page
   (`beach_water_temp`, `city_water_temp`) who saw the control (`beach_follow_started` exposure).
   Steps → `beach_follow_saved_local` → `follow_topic_changed` → `beach_follow_sync_started` →
   `beach_follow_sync_completed`. Split by `page_type` and by intent state. **Never merged with
   surf-qualified conversion** (BFR-01: broad utility and surf intent have separate denominators).
2. **My Coast returns.** `my_coast_viewed` and `my_coast_beach_opened` per follower, by days since
   first follow, split anonymous vs signed-in. Denominator: visitors with ≥ 1 saved follow.
3. **Surf-qualified exact handoff.** `exact_call_handoff_started` → `app_handoff_native_open` →
   `watched_call_context_resolved`, joined on the canonical lowercase-UUID `handoff_id`.
   Report **join coverage and context-resolution coverage as separate stages** — the iOS App Store
   path cannot deterministically recover browser context, so a gap between stages is a known
   platform limit, not a defect. Resolution split by classification
   (`exact | replaced | beach_only | invalid`).
4. **Home mode / recommendation changes by real cause.** `home_mode_restored`,
   `home_mode_expired`, `home_recommendation_changed` grouped by cause — including
   `startup_context_refined`, which distinguishes a settling cold start from a forecast change.
   Guardrail: a rise in `startup_context_refined` means the provisional-hero contract is being
   exercised, not that recommendations became unstable.
5. **Watch exposure → creation.** Denominator: `watched_call_exposed` on an eligible call
   (carries `audience_class` and `page_type`; `home_mode` only on Home). Numerator:
   `watched_call_created`. `watched_call_already_exists` is reported separately — it is
   idempotency working, not a failed creation.
6. **Meaningful-update lifecycle.** `watched_call_update_eligible` → `_suppressed` / `_delivered`
   → `_opened`, split by type (`still_on | call_changed | better_nearby`). **Suppression is a
   success metric.** A high suppressed:delivered ratio during stable forecasts means Quiver stayed
   quiet correctly. Update scarcity must not be read as failure when forecasts did not move —
   cross-reference forecast volatility before interpreting.
7. **Manual reopen.** `watched_call_manual_reopened`, whose source set **excludes**
   `notification` by contract, so manual return is structurally separable from notification-driven
   return. Report as its own rate, never summed with `_update_opened`.
8. **D1/D7 and multi-day use.** Cohorts: joined-from-handoff vs organic; watched vs
   eligible-but-unwatched. Eligible-but-unwatched is the honest comparator — comparing watchers to
   all users would measure self-selection. Holdout arm reported alongside. Maturity rules above.
9. **Notification guardrails.** Permission denial, channel disable, duplicate suppression, cap
   hits, delivery errors, and uninstall where available. Any rise here outweighs a rise in opens.
10. **Pilot page SEO/performance guardrails.** Canonical/schema unchanged, answer-first render
    without JS/auth/storage, and route performance versus the pre-pilot baseline for the pilot
    routes only. BFR-02 fails if broad utility regressed, regardless of follow numbers.
11. **Quick-log/session funnel — historical secondary diagnostic only.** The four baseline events.
    Reported for non-regression. **Never the primary retention outcome** (BFR-11).

---

## Task 3 — Approved production/device validation · **BLOCKED**

`checkpoint:human-verify`, `gate="blocking"`. Ten steps requiring a signed iPhone and approved
release actions; the plan's `resume_signal` is Steven typing `approved` with artifacts, or the
failed step and observed result. Cannot be satisfied by simulator evidence — Task 4 explicitly
rejects simulator-only universal-link proof.

**Owner:** Steven. **Prerequisite:** the release gates in the table above.

## Task 4 — Requirement disposition and rollout decision · **BLOCKED**

Requires mature data from Task 2's queries and artifacts from Task 3. Writing dispositions now
would mean inventing the evidence the plan exists to demand. `20.1-VERIFICATION.md` will be
created when there is something truthful to put in it.

**Known dispositions already forced, regardless of later data:**
- **BFR-08 (all-user Week Scout stability): not met.** The flag is unset in every configuration
  source, so stability is off in the shipped binary and every OTA. This is a configuration fact,
  not a measurement.
- **Exact-link signed-device proof: not captured.** Deferred with N-01B.
- **TD-03 boat E2E gate: deferred**, no reserved simulator lane.
