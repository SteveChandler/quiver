---
phase: 22
slug: demand-driven-bot-engagement-and-morning-intel-orchestration
status: complete
created: 2026-08-03
---

# Phase 22 Pattern Map

| Planned surface | Closest analog | Pattern to preserve | Main risk |
|---|---|---|---|
| Demand signal/ranking service | `lib/recommendations/` pure scoring helpers; `scripts/session-acquisition-funnel-report.ts` reporting queries | Typed inputs/outputs, deterministic tie-breaks, server-only Supabase reads | Polluting demand with bot/mock/system traffic or applying home-region quotas |
| NPC target selection | `lib/npc/npc-selection.ts`, `lib/npc/beach-selection.ts` | Keep `NPCProfile`/`BeachRecord` boundaries and personality/window filtering | Hidden 50/35/15 regional allocation surviving under a new name |
| NPC publishing guardrails | `app/api/cron/npc-activity/route.ts`, `lib/npc/template-hydration.ts`, `lib/utils/intel-dedupe.ts` | `validateCronRequest`, `withObservedCron`, service-role writes, `dedupe_hash`, expiry | Fake eyewitness claims, duplicate posts, review overproduction |
| Morning Intel orchestration | `app/api/cron/morning-forecast-bot/route.ts`, `scripts/morningIntel.ts` | Separate system identity, concise `intel_posts`, structured `surf_conditions`, deterministic dedupe | Accidentally replacing Quiver Surf Forecast or retaining hard-coded Ocean Beach targeting |
| Event measurement | `lib/analytics/event-taxonomy.ts`, `app/api/events/route.ts`, existing intel action tests | Audit allowlists before adding event names; preserve anonymous/auth guards | New events silently rejected by DB check or double-counting bot activity |
| Schema/audit | `supabase/migrations/20250817120001_create_intel_and_reviews_tables.sql`, `supabase/migrations/20260313210000_fix_p0_bot_flagged_and_auth_events.sql` | Transactional migration, RLS/security-invoker conventions, indexes for time/beach lookup | Storing sensitive event detail or assuming a type refresh is a live DB migration |
| Verification | `__tests__/app/api/cron/npc-activity.test.ts`, `__tests__/app/api/cron/morning-forecast-bot.test.ts`, `__tests__/lib/utils/morning-intel-recommendation.test.ts` | Mock Supabase chains, assert exact inserts/statuses, test pure deterministic helpers separately | Tests that only prove a cron returns 200 without proving target distribution or identity separation |

## File-level guidance

- Read `app/api/cron/npc-activity/route.ts` and its focused test before changing the publisher. Preserve response summary fields and add selection/suppression counters additively.
- Read `lib/npc/npc-selection.ts` and `lib/npc/beach-selection.ts` before changing target selection. The old home/secondary/adventure function is the behavior being removed, so tests must assert it is no longer an allocation constraint.
- Read `app/api/cron/morning-forecast-bot/route.ts` and its test before adding the Morning Intel route. The existing profile lookup, response wrappers, cron observability, and per-region error isolation are reusable, but the route must query `Morning Intel Bot` and a demand-ranked beach list.
- Read `scripts/morningIntel.ts` before extracting editorial formatting/dedupe. It contains existing source/freshness payload conventions and should be reused without importing a CLI-only execution path into a cron route.
- Read `lib/utils/intel-dedupe.ts`, `lib/analytics/event-taxonomy.ts`, `app/api/events/route.ts`, and the event allowlist tests before adding fingerprints or analytics.
- Read `supabase/ARCHITECTURE.md`, the nearest migration architecture guidance, and `AGENTS.md` before any migration. Production push remains a separate approval-gated action.

## PATTERNS COMPLETE
