# Phase 3 — Activation Funnel: Fix the Leaky Bucket

**Date:** 2026-04-22
**Status:** Draft — pending user review before writing-plans.

> **2026-05-03 update:** the `home_beach_forecast_viewed` event referenced
> throughout this spec was renamed to `home_hero_forecast_viewed` (the event
> always fired for the home-screen *hero* — top discovery rec — not the user's
> home beach). See migration `20260503234500_add_home_hero_forecast_viewed_event.sql`.
> Legacy name remains in the CHECK allowlist for historical queries; the
> activation funnel queries in `docs/onboarding-funnel.sql` match either name.

## Problem

Quiver is pre-PMF with **49 signups, 0 retention, 0 session logs** (per `project_quiver_pmf_status_apr2026.md`). Phase 2's personal match score requires ≥5 rated sessions to unlock, so it's literally invisible to every current user until they log their first session. The `project_invisible_cohort_is_retention_not_adblock.md` memory confirms 94% of zero-event signups are retention failures, not tracking. The monetization research (`/Users/stevenchandler/.claude/plans/when-can-we-start-cozy-tower-agent-a9874e89d523ad631.md`) concluded: **retention is the bottleneck, not pricing**.

Pointing more traffic at the app, polishing score labels, or opening the paid tier all presuppose an activation funnel that works. Today it doesn't — signups convert at 0.70% CTR from anonymous mobile (below the 1% red-alert floor), and of the 49 signups we *do* get, none log a session.

Phase 3 closes the leak at **both ends of the funnel**:
1. **Web:** more anonymous visitors convert to signups
2. **Native:** more signups reach the first forecast view (D0 activation)

## Success Criteria

Phase 3 ships when all of the following are measurably true, measured over a 14-day window post-ship:

| Metric | Today | Phase 3 target |
|---|---|---|
| `/beaches/usa/ca` signup CTA CTR (Android mobile) | <1% (1 click / 588 sessions, 7d) | ≥3% |
| `signup_form_submitted → signup_started` conversion | ~8% (4 / 49) | ≥80% |
| D0 activation rate (signup → `home_beach_forecast_viewed` same day) | unknown (no event fires today) | ≥40% |
| PayoffStep cold-restart loop-back bug | 100% reproducible in manual test | 0 |
| Step-level onboarding drop-off visibility | 0 events for home_beach/level/payoff steps | Full funnel in `user_events` |

Phase 3 does **not** ship on the retention curve (M2 lift). That's Phase 4 territory — needs the activation events we're instrumenting here before we can even measure it.

## Architecture

Two sub-workstreams that can run in parallel, converging on shared instrumentation:

### Workstream A — Web Conversion (5 fixes, ranked by leverage)

Delegates to the existing plan at `/Users/stevenchandler/.claude/plans/compressed-dreaming-cook.md`. Specifically:

- **F1 (highest leverage)** — Drop `<StickySignupBar>` + `<InlineSignupCta>` into `quiver/app/beaches/usa/[state]/page.tsx`. 44% of anonymous traffic lands here with one sub-48dp navbar button as the only conversion surface. Components are battle-tested on 20+ sister SEO routes. Copy branches on `beachCount ≥ 20` for concrete state-specific variants.
- **F2** — Tap-target bump: override `className="min-h-[48px]"` on the StickySignupBar primary button at the one new call site. Don't change the component itself (affects 20+ existing callers).
- **F3** — Fix the `signup_form_submitted (49) → signup_started (4)` chasm. Audit call sites of both events; confirm `signup_started` fires immediately before `supabase.auth.signUp()`. Suspicion: `signup_form_submitted` fires on blur/validation, `signup_started` has one call site wired only to the legacy form path, so 92% of "submissions" never call signUp.
- **F4** — MatchScoreTeaser copy tightening (142 Android views, 0 clicks). Not a handler/visibility bug — a copy/value-prop bug. Replace generic "3ft swell hits Thursday" with concrete "This is your call for [user_home_beach] tomorrow" once home_beach is known; generic fallback for anonymous.
- **F5** — Deduplicate the 9 phantom `auth_modal_opened:signup` events fired by `/auth/sign-in` on redirect landings (`navbar autoOpenLogin` + page auto-open double-count). Source attribution fix only — no behavior change.

**NOT in Workstream A:** any new route, any new conversion surface beyond the state hub, any redesign of MatchScoreTeaser beyond copy, any A/B test harness (premature at this volume).

### Workstream B — Native Onboarding CRO (3 changes)

Delegates to the existing plan at `/Users/stevenchandler/.claude/plans/plan-out-1-2-3-we-glimmering-mitten.md`. Specifically:

- **Change 1 — Instrumentation.** Add `onboarding_step_viewed`, `onboarding_step_completed`, `onboarding_step_auto_skipped`, `home_beach_forecast_viewed` events. All fire via existing `trackEvent()` helper in `src/lib/analytics.ts`. `useRef`-guarded to avoid double-fire on strict-mode re-mount. Ship the corresponding funnel SQL in `quiver/docs/onboarding-funnel.sql` so the events are immediately actionable.
- **Change 2 — Delete the `isCompleted` Zustand flag.** The PayoffStep cold-restart race (`project_onboarding_payoff_step_bug`) is 100% reproducible. Target: make `profile.onboarding_completed_at` the only source of truth; optimistic `queryClient.setQueryData` after DB write in `LevelAndTimeStep`; drop the Zustand flag from `RootNavigator`. Respects the `project_native_root_navigator_gate` invariant (never render Onboarding when `profile === undefined`). Also respects `feedback_dont_optimistic_update_navigation_gate` (2026-04-19): optimistic cache update is not on the nav-gate key itself — it's on `profile` which is read by the nav-gate.
- **Change 3 — Replace PayoffStep promise copy with live forecast.** Use existing `useCurrentConditions(beachId)` hook. Prefetch warmed in `LevelAndTimeStep`. Numeric rendering (verbatim from `enhanced_forecasts`, no reformatting). Fallback to existing promise copy if home_beach was skipped or forecast is unavailable. CTA changes from "See today's forecast" → "Open forecast".

**NOT in Workstream B:** removing OnboardingVideo (Change 0 — out of scope), collapsing Level/Time into HomeBeach (separate P1), share/invite hook (P2), Day-7 push nudge (Phase 4), founding-member email sequence (the 0-to-100 plan's Phase 3, which is post-3-paying-customers).

### Shared contract: `home_beach_forecast_viewed` is the D0 activation event

Both workstreams converge on this one event. It fires on native (from Workstream B Change 1). Web does not currently have a home-beach concept for anonymous visitors, so web's analog is `signup_success`.

**Event metadata contract — frozen for Phase 3:**

```
event_type: 'home_beach_forecast_viewed'
metadata: {
  beach_id: string (uuid),
  is_home_beach: boolean,   // heroBeachId === homeBeachId
  confidence_score: number | null  // 0-100, null if unavailable
}
```

The funnel SQL (`quiver/docs/onboarding-funnel.sql`) reads `metadata->>'is_home_beach'` as a tie-breaker to distinguish activation-by-home-beach vs. activation-by-any-hero. Any later metadata additions must be backwards-compatible (optional fields only).

Measuring activation end-to-end looks like:

```
web: page_view → signup_cta_click → signup_success
   → (handoff to native via deep link or email)
native: onboarding_step_viewed(home_beach) → … → onboarding_completed → home_beach_forecast_viewed
```

Any drop at any step in the chain is now visible in `user_events` per the funnel SQL.

## Sequencing

```
Week 1: Ship Workstream A F1 + F3 (highest-leverage). Ship Workstream B Change 1 (instrumentation only, behavior-neutral).
        → Measurement unlocked end-to-end.
Week 2: Ship Workstream B Changes 2 + 3 (race fix + live forecast).
        Ship Workstream A F2 + F4 + F5 (polish after the F1/F3 dust settles).
        → Activation loop lands end-to-end.
Week 3: Measure. Don't ship more. Let the funnel run for 14 days clean.
```

All native changes ship in one PR (overlapping files; atomic commits per change). Web F1 ships in its own PR since F3 depends on app/api code that's separate from the SEO route.

## Risk register

| Risk | Mitigation |
|---|---|
| Instrumentation lands but events don't fire (per `feedback_fire_and_forget_observability`) | Verify via tail query on `user_events` within 30 min of merge. Route failures to Sentry.captureException in prod per that memory. |
| Home-beach forecast prefetch misses cache → skeleton shows too long | Staletime 10 min on the prefetch query; fallback to promise copy on error. |
| `signup_started` fix reveals the real conversion is actually 4% not 92% | That's the point. If true, F3 is a measurement fix, not a conversion lift — Phase 4 picks up the actual copy/UX work. |
| PayoffStep race fix breaks signup → home flow for existing half-onboarded users | Manual regression pass from `reference_quiver_test_user` stcha0004 before merge, per `feedback_manual_verify_launch_flow`. |
| New `user_events` event_types rejected by the allowlist (per `reference_user_events_three_allowlists`) | Add all four new event types to VALID_EVENTS + ANONYMOUS_ALLOWED_EVENTS + PRE_AUTH_ONLY_EVENTS + the DB CHECK constraint + the TS union before shipping Change 1. This is a blocker, not a polish item. |

## Testing

- **Unit (native):** delete the `isCompleted`/`complete()` test in `__tests__/onboarding-store.test.ts`. No new unit tests — events are fire-and-forget, race fix is covered by manual regression.
- **Unit (web):** extend `signup-conversion-tracking` tests with the dedup fix for F5. Add tests for the `useConcreteCopy` branching in F1.
- **Manual (native):** the 7-path iOS sim regression listed in `plan-out-1-2-3-we-glimmering-mitten.md` lines 264–297. Includes the cold-restart race test, the skip path, and the auto-skip path.
- **Manual (web):** Playwright mobile viewport (412×915) tap-through on `/beaches/usa/ca` to confirm StickySignupBar and InlineSignupCta fire the event chain. Per `reference_playwright_base_url_and_projects` — BASE_URL against dev.quiversurf.app after dev push.
- **E2E:** No new Playwright beyond the mobile tap-through smoke. Funnel verification is SQL.

## Critical files

### Web
- `quiver/app/beaches/usa/[state]/page.tsx` — F1 JSX insertion, copy branching
- `quiver/components/ui/sticky-signup-bar.tsx` — no changes, reuse
- `quiver/components/seo/inline-signup-cta.tsx` — no changes, reuse
- `quiver/components/recommendations/match-score-teaser.tsx` — F4 copy
- `quiver/lib/analytics/signup-conversion-tracking.ts` — F5 dedup
- Event call sites for `signup_form_submitted` vs `signup_started` — F3 audit target (grep for call sites)

### Native
- `quiver-native/src/stores/onboarding-store.ts` — delete `isCompleted`
- `quiver-native/src/navigation/root-navigator.tsx` — drop `isOnboardingCompleted` selector
- `quiver-native/src/components/onboarding/steps/home-beach-step.tsx` — Change 1 events
- `quiver-native/src/components/onboarding/steps/level-and-time-step.tsx` — Change 1 events + optimistic setQueryData + prefetch warm
- `quiver-native/src/components/onboarding/steps/payoff-step.tsx` — Change 1 view event, Change 2 delete complete() call, Change 3 forecast card
- `quiver-native/src/screens/onboarding.tsx` — Change 1 auto-skip event
- `quiver-native/src/screens/home.tsx` — Change 1 home_beach_forecast_viewed event
- `quiver-native/__tests__/onboarding-store.test.ts` — remove the `isCompleted` test

### New
- `quiver/docs/onboarding-funnel.sql` — funnel SQL for step-level drop-off

## Skills to invoke

| Skill | Why |
|---|---|
| `superpowers:subagent-driven-development` | Dispatch workstream A and B in parallel — they touch disjoint repos and can ship independently. Use fresh subagents per task with spec + code reviews. |
| `superpowers:test-driven-development` | Change 2 race fix has clear test cases (7 manual paths); enforce TDD for the `onboarding_store.test.ts` update and the F5 dedup test. |
| `superpowers:verification-before-completion` | Instrumentation is easy to fake success on. Require tail query on `user_events` after merge. |
| `maestro-native` | Manual regression pass on the 7 iOS sim paths. |
| `vercel-deploy-verify` | After web PRs merge to main, confirm dev.quiversurf.app alias-promoted to the new build. |
| `parallel-workstream-integration` | Before dispatching A and B subagents in parallel, freeze the `home_beach_forecast_viewed` event contract so both sides agree on the metadata shape. |

## Documents to update

- `quiver/CHANGELOG.md` — Added/Changed entries under `[Unreleased]` per `quiver/CLAUDE.md` pre-merge checklist
- `quiver-native/CHANGELOG.md` — same
- `quiver-native/src/stores/onboarding-store.ts` — doc comment pointing to the race fix memory
- `quiver/lib/analytics/signup-conversion-tracking.ts` — doc comment on the dedup logic + F5 memory link
- Auto-memory: `project_phase3_activation_funnel_shipped.md` (new, post-ship) — dates, metrics delta, notable deviations

## Open questions (for user review before writing-plans)

1. **F3 scope.** The `signup_form_submitted → signup_started` chasm might resolve to just "instrumentation ordering bug, fix call sites." Or it might resolve to "92% of submissions genuinely fail somewhere and we need to UX-fix that." Investigate first, split F3 into F3a (instrumentation) and F3b (UX fix) if needed. Acceptable to defer F3b to Phase 4 if the root cause is real friction rather than measurement.
2. **Workstream A + B in parallel?** Both plans are independently reviewable; dispatching parallel subagents is viable. Main risk is the `home_beach_forecast_viewed` event metadata contract — if the native side changes the shape mid-flight, the funnel SQL breaks. Mitigation: freeze the metadata schema in this spec before dispatch. (Already done — see "Shared contract" above.)
3. **Success-criteria target for D0 activation (≥40%).** Pulled from `adapty.io` benchmark for freemium apps. Aggressive given current 0%. If 14-day data shows ≥15% we should probably ship Phase 4 rather than chase the full 40% — depends on whether the M2 retention curve starts lifting.
