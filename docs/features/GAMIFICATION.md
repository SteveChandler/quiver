# Quiver Gamification (Canonical)

Authoritative reference for Quiver’s gamification system: current status, condensed spec, schema, integration points, testing, and next steps.

---

## Status

- State: Production Ready (core XP, badges, UI live)
- Branch: `gamification`
- Migration: `supabase/migrations/20250828000000_create_gamification_system.sql` (tables + 23 badges)
- Toaster: App-wide via `app/layout.tsx`

---

## Spec Summary

- Levels: 9 tiers (Kook → Quiver King/Queen) based on total XP thresholds.
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
  - Toasts + confetti (SSR-safe): `components/gamification/xp-toast-system.tsx`
  - App toaster mount: `app/layout.tsx` -> `components/ui/toaster`
- Server actions wiring:
  - Sessions: `actions/session-actions.ts` (plan/log, tag board, reflection, temp, media)
  - Boards: `actions/board-actions.ts` (create board)
  - Intel: `actions/intel-actions.ts` (post, confirm; author XP on confirmations)
  - Likes: `actions/like-actions.ts` (author XP on likes)
  - Invites: `app/api/session-planner/invitations/route.ts` (invite XP on send)

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

1) Session participants on accept
   - Where: `app/api/session-planner/invitations/route.ts` (PATCH)
   - Action: When invitation is accepted, insert into `session_participants (session_id, user_id)` if absent
   - Accept: Profile’s team badges get accurate counts; duplicate-safe; revalidate affected pages

2) Badge unlock E2E scenarios
   - Add end-to-end tests that perform actions and assert unlock toasts and profile badge presence
   - Cover at least: `first_ride`, `quiver_starter`, `locals_tip` (via confirmation), `sunrise_chaser`

3) Streaks and dawn patrol visualization
   - Enhance profile UI to surface `consecutive_days` and early-session counts from `getUserStatsForBadges`
   - Accept: User sees streak length and progress toward dawn patrol badges

4) Leaderboard (optional MVP)
   - Simple weekly/monthly XP ranking view
   - Accept: Query `xp_events` within window; list top N with avatars

5) Performance polish
   - Memoize heavy selectors, consider caching gamification status per session
   - Accept: No noticeable lag on profile; minimal Supabase roundtrips

6) Optional API: `/api/gamification/badges`
   - Return `badge_definitions` (+ user’s unlocked if authed)
   - Enables simpler clients and E2E checks

---

## Resolved Items (from previous critical fixes)

- Server action $$id errors: avoided double-bind; consistent `withAuthenticatedAction` usage
- Confetti SSR: dynamic import in `xp-toast-system.tsx`, window-guarded
- Playwright port: set to 3002 with `BASE_URL` override
- Profile beach column: migrations add/rename; API returns `home_beach_id` and `default_beach_id` for compatibility

---

## NPC Daily Activity System

**Purpose:** Automated community content generation to keep production environment engaging

**Status:** Production-ready with GitHub Actions automation

### Overview

The NPC Daily Activity Seeder creates realistic community content daily by selecting 3-5 mock users (NPCs) to generate sessions, intel posts, and beach reviews with personality-driven content.

### Execution

**Manual:**
```bash
# Development
CONFIRM_TARGET=DEV npm run npc:daily

# Production (requires confirmation)
CONFIRM_TARGET=PROD CONFIRM_PROD=YES npm run npc:daily
```

**Automated:** Runs daily at 9am PT (17:00 UTC) via `.github/workflows/npc-daily.yml`

### Content Generation

**Daily Volume:**
- 3-5 sessions (1 per selected NPC)
- 3-5 intel posts (various tags: conditions, parking, crowd, access)
- 3-5 beach reviews (3-5 star ratings across 5 categories)
- **Total:** 9-15 pieces of content daily

**Personality Types:**
- **Rookie:** Enthusiastic, learning-focused, high ratings (4-5 stars)
- **Local:** Knowledgeable, tips-focused, balanced ratings (3-5 stars)
- **Traveler:** Comparative, spot comparisons, balanced (3-5 stars)
- **Photographer:** Aesthetic, visual conditions, high ratings (4-5 stars)
- **Tactical:** Analytical, precise reports, consistent (4 stars)
- **Competitor:** Performance-focused, training emphasis, critical (3-4 stars)

**Content Features:**
- Sessions: Backdated within last 24h, 45-180 min duration, personality-specific notes
- Intel: Realistic coordinates with offsets, surf conditions JSON for conditions posts
- Reviews: Backdated within last 3 days, personality-driven titles and content

### Safety Features

1. **Environment Validation:** Requires `CONFIRM_TARGET=DEV/PROD` and `CONFIRM_PROD=YES` for production
2. **Mock User Protection:** Only operates on users with `is_mock=true`
3. **Error Handling:** Comprehensive try/catch with detailed logging

### Monitoring

**Verification Queries:** `scripts/verify-npc-activity.sql`

**Key Metrics:**
- Daily content creation (sessions, intel, reviews)
- NPC activity distribution
- Content quality (ratings, tags)
- Beach coverage

**Quick Check:**
```bash
npm run check-mock-users
gh run list --workflow="Daily NPC Activity Seeder"
```

### Database Requirements

**Tables:** `profiles` (with `is_mock` column), `sessions`, `intel_posts`, `beach_reviews`, `beaches`

**Permissions:** Service role with INSERT on content tables, SELECT on profiles/beaches, RLS bypass

### Expected Output

**Weekly Trends:**
- Consistent daily activity Monday-Sunday
- Varied content distribution across beaches
- Natural personality-based content variety

**Success Metrics:**
- ✅ 9-15 pieces of content created daily
- ✅ Different writing styles and focuses
- ✅ Content spread across multiple beaches
- ✅ NPCs maintaining 3-5 star positive ratings
- ✅ Clean GitHub Actions runs with no failures

### Files

- **Seeder:** `scripts/npc-daily-activity.ts`
- **Workflow:** `.github/workflows/npc-daily.yml`
- **Verification:** `scripts/verify-npc-activity.sql`

---

## References

- Spec: `docs/quiver-gamification-spec.md` (source detail)
- Status: `docs/gamification-system-status.md`
- Social Sharing: `docs/features/SOCIAL_SHARING.md`
- Branch Review: `docs/gamification-branch-status-review.md`

