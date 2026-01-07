---
name: Activation+Roadmap
overview: Ship an activation-focused home experience (first win + reminder hook + metrics) in 1–2 weeks, then extend into a 4–8 week roadmap covering verified spot guides, Go-Now alerts for favorites, tighter live-report expiry, privacy tiers, and map improvements.
todos:
  # ============================================
  # COMPLETED - Core Activation Sprint
  # ============================================
  - id: home-first-win-reorder
    content: Reorder authenticated home above-the-fold to show the first-win recommendation before Plan/Log CTAs, and tighten the copy to be specific + time-bound.
    status: completed
    notes: PersonalizedForecastCard now renders at top of ForecastTab; Plan/Log CTAs removed from above-fold (see index.tsx line 83 comment)

  - id: reminder-hook-cta
    content: Add a prominent 'Remind me if this window holds' CTA in the first-win card flow that enables the necessary profile notification flags and sets home beach when missing (web/PWA-first).
    status: completed
    notes: handleEnableReminder implemented in forecast-tab.tsx; showHomeBeachPrompt state handles missing home beach; remind-me-cta test ID exists
    dependencies:
      - home-first-win-reorder

  - id: activation-analytics
    content: Add analytics events for first-win impression and reminder/plan interactions; define activation success criteria and verify event firing.
    status: completed
    notes: Events implemented - first_win_impression, first_win_plan_clicked, first_win_reminder_enabled, first_win_reminder_declined
    dependencies:
      - home-first-win-reorder

  - id: tests-first-win
    content: Add/update unit/component tests and a minimal E2E smoke to cover first-win render + reminder enable flow.
    status: completed
    notes: e2e/home-activation.spec.ts created with 6+ test scenarios; useWebPushRegistration.test.ts exists
    dependencies:
      - reminder-hook-cta
      - activation-analytics

  - id: changelog-entry
    content: Update CHANGELOG.md under [Unreleased] summarizing the activation sprint changes and tests added.
    status: completed
    notes: Changes documented in CHANGELOG.md [Unreleased] section
    dependencies:
      - tests-first-win

  # ============================================
  # COMPLETED - Gap Fixes (2026-01-07)
  # ============================================
  - id: tomorrow-framing-ui
    content: Add conditional "Tomorrow looks better" or "Improving by tomorrow morning" messaging to PersonalizedForecastCard when the best window is not today in the user's timezone.
    status: completed
    notes: Added getWindowTiming() helper; shows "Tomorrow Looks Better" or "Best Wed 7-10am" with badges
    dependencies:
      - home-first-win-reorder

  - id: copy-time-bound-specificity
    content: Update PersonalizedForecastCard headline and summary to include specific window time (e.g., "Best surf at 7-10am" or "Great conditions this morning at {beachName}").
    status: completed
    notes: Headline now shows "Best Surf 7-10am" format with formatTimeRangeCompact() helper

  - id: native-push-reminder-flow
    content: Extend handleEnableReminder to detect native platform and use useNativePushRegistration for Capacitor apps (iOS/Android FCM registration).
    status: completed
    notes: Fixed bug - now uses isNativeApp() to route to requestNativePush() for Capacitor; includes platform-specific toasts
    dependencies:
      - reminder-hook-cta

  - id: reminder-error-recovery
    content: Add retry button when reminderState is 'error'; show contextual instructions when push permission is denied at browser level.
    status: completed
    notes: Added "denied" state with platform-specific instructions; retry buttons with analytics tracking
    dependencies:
      - reminder-hook-cta

  - id: force-profile-refresh-on-reminder
    content: After successful reminder enable, invalidate profile cache to ensure UI reflects updated notification flags immediately.
    status: completed
    notes: Added onProfileUpdate prop to ForecastTab; calls refreshProfile() after updateProfile() succeeds
    dependencies:
      - reminder-hook-cta

  # ============================================
  # COMPLETED - Testing & Metrics (2026-01-07)
  # ============================================
  - id: unit-tests-reminder-state
    content: Add unit tests for PersonalizedForecastCard reminder state machine (idle -> needs_home -> enabling -> enabled/error transitions).
    status: completed
    notes: Created personalized-forecast-card-reminder-state.test.tsx with 27 passing tests
    dependencies:
      - tests-first-win

  - id: unit-tests-enable-reminder
    content: Add unit tests for handleEnableReminder in forecast-tab.tsx covering web push success, web push denied, profile update failure scenarios.
    status: completed
    notes: Created forecast-tab-enable-reminder.test.tsx with 18 passing tests covering all platforms
    dependencies:
      - tests-first-win

  - id: verify-push-deeplink-routing
    content: Add integration test verifying that web push notification click routes correctly using data.url payload; verify service worker handles click event.
    status: completed
    notes: Created forecast-alerts-deeplink.test.ts (unit) + push-deeplink-routing.spec.ts (E2E); 31 total tests
    dependencies:
      - tests-first-win

  - id: activation-funnel-definition
    content: Document activation success criteria and create GA4 exploration/funnel with events first_win_impression -> (first_win_plan_clicked OR first_win_reminder_enabled); define target conversion rate.
    status: completed
    notes: Created docs/analytics/ACTIVATION_FUNNEL.md with GA4 setup instructions, metrics, and debugging guide
    dependencies:
      - activation-analytics

  # ============================================
  # REMAINING - Lower Priority
  # ============================================
  - id: activation-performance-audit
    content: Add Lighthouse CI assertions for home page LCP < 2.5s; verify first-win card renders above fold before discovery insights load.
    status: pending
    notes: First-win card defers insights by 500ms; no explicit LCP measurement

  - id: rls-delivery-read-policy
    content: Add RLS policy allowing authenticated users to SELECT their own forecast_alert_deliveries rows for transparency UI (e.g., "last alert sent at...").
    status: pending
    notes: Current RLS only allows service_role; users cannot see their own delivery history
---

# Quiver activation sprint + roadmap

## Implementation Plan

### Scope

- **Near-term (1–2 weeks)**: Fix activation by making the **personal, time-bound recommendation** the first thing an authenticated user sees, and add a **single-tap reminder hook** (web/PWA-first) without pushing session logging early.
- **Mid-term (4–8 weeks)**: Build toward the "AllTrails for surf" pillars we discussed: richer spot guides, favorite-spot Go-Now alerts, faster-expiring live reports, privacy tiers + location generalization, and map-centric discovery upgrades (including firing filters and offline).

### Current assets we will reuse (already in code)

- **First-win engine**: `useSurfDiscovery` and API `GET /api/surf/discover` (ranking + best window + reasons).
- **Recommendation UI**: `PersonalizedForecastCard` and `BeachDiscoveryList` already show beach+window+why and have a "plan session" prefill path.
- **Reminder delivery**: forecast threshold alert push system and cron: `lib/services/forecast-alerts.ts` + `app/api/cron/forecast-alerts/route.ts`.
- **Home beach setter**: `components/home/HomeBeachBanner.tsx`.
- **Notification toggles exist**: `notif_push_enabled`, `notif_forecast_alerts`, etc. are already represented in profile UI (e.g. `components/profile/notifications-section.tsx`).

### Files

Activation sprint (completed):
- [x] [components/home-screen/index.tsx](components/home-screen/index.tsx) – Plan/Log CTAs removed from above-fold
- [x] [components/home-screen/forecast-tab.tsx](components/home-screen/forecast-tab.tsx) – handleEnableReminder + reminder state machine implemented
- [x] [components/home-screen/personalized-forecast-card.tsx](components/home-screen/personalized-forecast-card.tsx) – reminder CTA + home beach prompt added
- [x] [actions/profile-actions.ts](actions/profile-actions.ts) – updateProfile supports notif flags + home beach
- [x] [hooks/useWebPushRegistration.ts](hooks/useWebPushRegistration.ts) – web push registration hook
- [x] [e2e/home-activation.spec.ts](e2e/home-activation.spec.ts) – E2E tests for activation flow
- [x] [CHANGELOG.md](CHANGELOG.md) – documented under `[Unreleased]`

Gap fixes (pending):
- [ ] [components/home-screen/personalized-forecast-card.tsx](components/home-screen/personalized-forecast-card.tsx) – add tomorrow framing + time-specific copy
- [ ] [components/home-screen/forecast-tab.tsx](components/home-screen/forecast-tab.tsx) – add native push support + error recovery UI
- [ ] [lib/utils/timezone-utils.server.ts](lib/utils/timezone-utils.server.ts) – add isWindowToday() helper for tomorrow framing
- [ ] [supabase/migrations/](supabase/migrations/) – RLS policy for forecast_alert_deliveries user read access

Roadmap-related files (later phases):

- [ ] [lib/constants/intel.ts](lib/constants/intel.ts) + [actions/intel-actions.ts](actions/intel-actions.ts) – move "live report" expiry from 1 day toward hours for specific tags
- [ ] [components/map-view.tsx](components/map-view.tsx) + [hooks/use-beach-search.ts](hooks/use-beach-search.ts) + [components/map/interactive-map.tsx](components/map/interactive-map.tsx) – add/expand "currently firing" + advanced filters
- [ ] [lib/services/surf-discovery-service.ts](lib/services/surf-discovery-service.ts) – implement GPS discovery stub + add "ideal conditions" matching for favorites
- [ ] Supabase schema/migrations (TBD) – privacy tiers, region-level logging, and spot-guide structured fields (non-destructive, approval-required)

### Steps (Activation sprint: 1–2 weeks)

1. **Make the first win unavoidable** ✅ DONE

- In `HomeScreen`, move Plan/Log CTAs below the recommendation section (or reduce to a single secondary action), so the first visible content is "Here's when/where you should surf next."
- Update copy to be time-bound and specific (today/tomorrow window), and show the "why" summary inline.

2. **Add the reminder hook (web/PWA-first)** ✅ DONE

- Add a prominent CTA on the top recommendation card: "Remind me if this window holds."
- Implement as a single flow:
    - If `home_beach_id` is missing → offer "Set this as Home Beach" (reuse `HomeBeachBanner` logic) and then prompt reminder enable.
    - Enable `notif_push_enabled` + `notif_forecast_alerts` (and any required reminder toggle) via existing `updateProfile` action.
- Confirm deep-link payload behavior uses `data.url` fallback so web/PWA notification clicks route correctly (existing pattern referenced in `CHANGELOG.md`).

3. **Delay session logging (convert to "bonus" not "homework")** ✅ DONE

- Keep "Plan this" as the main secondary action (already supported via prefill params in discovery UI).
- De-emphasize "Log Session" above the fold.

4. **Add a reason to return tomorrow (without surfing)** ⚠️ NOT IMPLEMENTED

- Add lightweight "tomorrow" framing on the first-win card when next best window is not today (or when confidence is low today).
- Optionally add a small, non-blocking "improving tomorrow morning" callout computed from discovery windows.

5. **Track the right activation metrics** ✅ DONE

- Add analytics events:
    - `first_win_impression` when top recommendation is rendered.
    - `first_win_plan_clicked` for plan CTA.
    - `first_win_reminder_enabled` when the user opts into alerts.
    - `first_win_reminder_declined` when they dismiss.
- Define activation as: **impression + belief proxy** (e.g., click "plan" or enable reminder), not session logging.

### Gap Analysis Summary (2025-01-07)

**Core activation sprint is ~85% complete.** Major gaps identified:

| Category | Issue | Priority | Todo ID |
|----------|-------|----------|---------|
| Missing Feature | "Tomorrow looks better" messaging not implemented | HIGH | tomorrow-framing-ui |
| Missing Feature | Time-specific headline copy | MEDIUM | copy-time-bound-specificity |
| Potential Bug | Native app users (Capacitor) fail silently on reminder enable | HIGH | native-push-reminder-flow |
| UX Gap | No retry path or instructions for push permission failures | MEDIUM | reminder-error-recovery |
| Potential Bug | Profile cache stale after reminder enable | MEDIUM | force-profile-refresh-on-reminder |
| Test Gap | No unit tests for reminder state machine | LOW | unit-tests-reminder-state |
| Test Gap | No integration test for push deeplink routing | LOW | verify-push-deeplink-routing |
| Metrics Gap | GA4 funnel not configured | MEDIUM | activation-funnel-definition |
| Infrastructure | Users can't see their own alert delivery history | LOW | rls-delivery-read-policy |

### Roadmap (4–8 weeks)

#### Phase A: "Verified spot guides" depth

- Add structured spot-guide fields (ideal tide, swell, wind, hazards, access).
- Expand the existing summary view (`SpotOverview`) to be driven by those structured fields instead of placeholders.

**Technical Design Needed**:
- Database schema for structured fields (ideal_tide_range, ideal_swell_direction, hazards JSONB)
- Migration plan for existing beaches
- Admin UI for editing spot guide fields

#### Phase B: Favorite-spot Go-Now alerts (beyond home beach)

- Extend alert evaluation from "home beach only" to "favorites" and/or "top affinity beaches."
- Match against each beach's ideal parameters (not only learned user thresholds).

**Technical Design Needed**:
- Schema for user_beach_favorites (if not existing)
- Extension to forecast-alerts.ts to iterate favorites
- User threshold learning per-beach (currently global)

#### Phase C: True "live reports" (fast expiry)

- Reduce expiry for select intel tags from days → hours (e.g., 3 hours) and ensure cleanup is scheduled.
- Tighten the UX around "freshness" and confirmation count to reinforce trust.

**Technical Design Needed**:
- Intel tag categorization (which tags get 3h vs 24h expiry)
- Cron job modification for hourly cleanup
- "Freshness confidence" UI indicators

#### Phase D: Community + privacy balance

- Add a 3-tier visibility model (private / crew / public) for sessions.
- Add "generalized location logging" option (region-only) so users can avoid pinning to a specific break.

**Technical Design Needed**:
- Database migration for session visibility column
- RLS policy updates for crew-based visibility
- Region generalization logic (lat/lon -> region name)

#### Phase E: Map-centric discovery upgrades

- Add "currently firing" filter driven by forecast/discovery scoring.
- Implement GPS discovery stub (already called out in `docs/GAPS_AND_IMPLEMENTATION_PLAN.md`).
- Offline maps/tides: design + feasibility, then implement in mobile/PWA as separate effort.

**Technical Design Needed**:
- "Currently firing" filter logic (threshold definition)
- Offline maps/tiles caching strategy
- Mapbox integration for custom styling

### Testing

- **Unit/component tests**:
- Update/add tests for new home CTAs and reminder enable flow.
- Add tests that the first-win card renders stable "beach+window+why" for a mocked discovery response.
- **E2E smoke**: ✅ DONE (e2e/home-activation.spec.ts)
- Authenticated user lands on home → sees first-win card without clicking.
- Enable reminder → profile flags updated → forecast-alerts path is eligible.
- Verify push routing via `data.url` fallback (web/PWA).
