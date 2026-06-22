# Quiver Gamification (Canonical)

Authoritative reference for Quiver's gamification system: current status, condensed spec, schema, integration points, testing, and next steps.

---

## Status

- State: Production Ready (core XP, badges, UI live)
- Branch: `gamification`
- Migration: `supabase/migrations/20250828000000_create_gamification_system.sql` (tables + 23 badges)
- Toaster: App-wide via `app/layout.tsx`

---

## Spec Summary

- Levels: 9 tiers (Kook -> Quiver King/Queen) based on total XP thresholds.
- XP Actions:
  - plan_session 50, add_board 30, tag_board_to_session 20, post_beach_intel 50, review_intel 25,
    tag_friends_in_session 20, invite_friend 100, post_surf_photos 15, get_like_upvote 10,
    write_reflection 25, add_surf_tags 20, record_temperature 10, submit_crowd_parking 10.
- Badges: 23 seeded across categories
  - global (11): first_ride, quiver_builder, wave_whisperer, session_captain, crowd_control, locals_tip,
    the_recruiter, tag_team, sunrise_chaser, dawn_patrol_legend, storm_chaser
  - journal (6): first_entry, consistency_king_queen, board_logger, water_watcher, wave_rater, seasoned_tracker
  - quiver (6): quiver_starter, board_collector, tech_spec_pro, ride_logger, twin_fin_fan, quiver_king_queen

---

## Schema

- Tables: `user_xp`, `badge_definitions`, `user_badges`, `xp_events`
- RLS: enabled on all; selective public read on `badge_definitions`
- Trigger: `update_user_xp_updated_at`
- Seed: 23 badges inserted idempotently
- File: `supabase/migrations/20250828000000_create_gamification_system.sql`

---

## Integration Points (Code Map)

- Core logic: `lib/gamification-actions.ts`
  - Actions + thresholds, XP tracking, badge evaluation, author crediting (service-role)
- Hooks: `hooks/use-gamification.ts` (+ session/quiver/intel/social helpers)
- UI:
  - Gamification section: `components/profile/gamification-section.tsx`
  - XP card + badges: `components/gamification/user-xp-card.tsx`, `components/gamification/badge-gallery.tsx`
  - App toaster mount: `app/layout.tsx` -> `components/ui/toaster`
- Server actions wiring:
  - Sessions: `actions/session-actions.ts` (plan/log, tag board, reflection, temp, media)
  - Boards: `actions/board-actions.ts` (create board)
  - Intel: `actions/intel-actions.ts` (post, confirm; author XP on confirmations)
  - Likes: `actions/like-actions.ts` (author XP on likes)

---

## Testing

- E2E: Playwright, base URL `http://localhost:3002`
  - Files: `e2e/gamification-integration.spec.ts`, `e2e/gamification-verification.spec.ts`
  - Config: `playwright.config.ts` (webServer on port 3002; `BASE_URL` override supported)
- Unit/Integration (Jest):
  - `__tests__/gamification/gamification-actions.test.ts`
  - `__tests__/components/gamification/xp-toast-integration.test.tsx`
  - `__tests__/actions/intel-actions-xp.test.ts`
- Run:
  - Dev: `PORT=3002 npm run dev`
  - E2E: `BASE_URL=http://localhost:3002 npx playwright test`
  - Focus: `npx playwright test gamification*`

---

## Deployment Checklist

- Apply migrations: `npx supabase db reset` or `npx supabase migration up`
- Verify tables exist: `user_xp`, `badge_definitions`, `user_badges`, `xp_events`
- Confirm badges seeded: 23 rows in `badge_definitions`
- Smoke test XP toasts (create session, add board, etc.)

---

## Next Steps (To Complete)

1) Badge unlock E2E scenarios
   - Add end-to-end tests that perform actions and assert unlock toasts and profile badge presence
   - Cover at least: `first_ride`, `quiver_starter`, `locals_tip` (via confirmation), `sunrise_chaser`

2) Streaks and dawn patrol visualization
   - Enhance profile UI to surface `consecutive_days` and early-session counts from `getUserStatsForBadges`
   - Accept: User sees streak length and progress toward dawn patrol badges

3) Leaderboard (optional MVP)
   - Simple weekly/monthly XP ranking view
   - Accept: Query `xp_events` within window; list top N with avatars

4) Performance polish
   - Memoize heavy selectors, consider caching gamification status per session
   - Accept: No noticeable lag on profile; minimal Supabase roundtrips

5) Optional API: `/api/gamification/badges`
   - Return `badge_definitions` (+ user's unlocked if authed)
   - Enables simpler clients and E2E checks

---

## Resolved Items (from previous critical fixes)

- Server action $$id errors: avoided double-bind; consistent `withAuthenticatedAction` usage
- Toast SSR: global toaster stays mounted from `app/layout.tsx`
- Playwright port: set to 3002 with `BASE_URL` override
- Profile beach column: migrations add/rename; API returns `home_beach_id` and `default_beach_id` for compatibility

---

## NPC Daily Activity System

**Purpose:** Automated community content generation to keep production environment engaging

**Status:** Production-ready with enhanced realism (January 2026 update)

**Full Documentation:** See [NPC_INTEL_BOTS.md](NPC_INTEL_BOTS.md) for comprehensive details.

### Overview

The NPC system creates realistic community content using 25 distinct profiles with:

- **Natural identities** - Real-sounding names (Marcus Chen, Sofia Reyes, etc.)
- **Personality types** - rookie, local, traveler, photographer, tactical, competitor, forecaster
- **Regional focus** - Each NPC is assigned to a California coast region
- **Behavioral realism** - Posts during personality-appropriate time windows
- **Real forecast integration** - Content reflects actual surf/weather conditions

### Quick Reference

**Scripts:**
```bash
# Migrate NPC profiles to new configuration
CONFIRM_TARGET=DEV yarn npc:migrate

# Post morning regional forecasts
yarn npc:forecast

# Check template health
yarn npc:health

# Run daily activity (existing)
CONFIRM_TARGET=DEV yarn npc:daily
```

**Key Files:**
- `config/npc-roster.ts` - 25 NPC profile definitions
- `config/regions.ts` - California region mappings
- `lib/npc/` - Utility libraries (template hydration, beach selection, posting windows)
- `scripts/morning-forecast.ts` - Daily regional forecast posts

### Content Generation

**Daily Volume:**
- 9-15 pieces of content daily
- 3 regional forecasts from "Quiver Surf Forecast" system account
- Sessions, intel posts, and beach reviews from NPCs

**Personality-Based Posting Windows:**

| Personality | Primary Window | Secondary Window |
|-------------|----------------|------------------|
| local | 5-8am | 4-7pm |
| rookie | 9am-12pm | 2-5pm |
| photographer | 5-7am | 5-8pm |
| competitor | 6-9am | 3-6pm |
| forecaster | 5-6am | - |

### Database Additions (January 2026)

**profiles table:**
- `home_region`, `home_beach_ids`, `secondary_beaches`
- `posting_window`, `activity_level`, `personality_type`
- `is_system_account`

**npc_content_templates table:**
- AI-generated templates with `{{variables}}`
- Staleness tracking via `use_count` and `last_used_at`

### Safety Features

1. **Environment Validation:** Requires `CONFIRM_TARGET=DEV/PROD`
2. **Production Guard:** Requires `CONFIRM_PROD=YES` for production
3. **Mock User Protection:** Only operates on users with `is_mock=true`

---

## References

- NPC System: `docs/features/NPC_INTEL_BOTS.md` (comprehensive NPC documentation)
- Design: `docs/plans/2026-01-13-realistic-intel-bots-design.md` (original design)
- Spec: `docs/quiver-gamification-spec.md` (source detail)
- Status: `docs/gamification-system-status.md`
- Social Sharing: `docs/features/SOCIAL_SHARING.md`
- Branch Review: `docs/gamification-branch-status-review.md`
