---
phase: 22
slug: demand-driven-bot-engagement-and-morning-intel-orchestration
status: complete
created: 2026-08-03
---

# Phase 22 Research

## Goal

Shift bot activity from volume-driven, home-region posting to demand-driven engagement that follows clean web beach interest, uses Morning Intel Bot as a concise editorial orchestrator, preserves Quiver Surf Forecast as the structured forecast publisher, and measures usefulness, trust, and downstream session intent.

## Existing system

- `app/api/cron/npc-activity/route.ts` runs hourly, caps each run at 10 posts, selects eligible mock NPCs by posting window/activity, uses weighted content types (`70%` intel, `20%` session note, `10%` review), and writes directly to `intel_posts` or `beach_reviews`.
- `lib/npc/npc-selection.ts` filters `profiles.is_mock = true`, excludes system accounts/forecasters, and currently delegates beach selection to region slug lists.
- `lib/npc/beach-selection.ts` implements the current home/secondary/adventure selection. The phase decision is to remove this as an allocation rule: home region remains available for personality/context, but target selection must be globally demand-ranked.
- `lib/npc/template-hydration.ts` uses `enhanced_forecasts`, then hydrates personality templates. It currently synthesizes crowd language randomly; this is not evidence of an eyewitness observation and must not be presented as one.
- `app/api/cron/morning-forecast-bot/route.ts` publishes three regional `intel_posts` for the `Quiver Surf Forecast` system account. It should remain the structured forecast path rather than becoming the Morning Intel orchestrator.
- `scripts/morningIntel.ts` is a legacy service-role script that generates one Ocean Beach post, dedupes by bot/beach/tag/date, stores structured `surf_conditions`, and already uses the shared Morning Intel scoring utilities. It is the closest existing analog for deterministic morning editorial content, but its hard-coded single spot must not become the new targeting model.
- `vercel.json` schedules the forecast bot at `30 13 * * *` UTC and NPC activity at `0 0-4,13-23 * * *`; any new orchestrator schedule must preserve the existing forecast cron and be explicit about UTC/PT conversion.

## Observed production gap supplied for this phase

The last 30 complete Pacific-time days contained 1,931 bot `intel_posts` and 198 bot `beach_reviews` (2,129 total, about 71/day), from 25 posting bots. Morning Intel Bot had no activity. Clean `beach_view` events, excluding flagged/mock/test/system signal and requiring a valid `beach_id`, contained 3,203 views across 330 beaches. Only two of the top ten visited beaches had bot content. Examples of oversupply were Ocean Beach (501 posts/57 reviews vs 17 clean views), Scripps (95/9 vs 18), Cardiff Reef (72/4 vs 23), Swami's (64/4 vs 31), and Pacific Beach (63/6 vs 19). Bot posts had zero `intel_votes` and zero `intel_post_confirmations` in the period.

These figures support a demand-gap rank with a supply penalty and a quality/feedback gate. They do not justify increasing total output.

## Recommended technical shape

1. Build a server-only demand signal reader that aggregates clean `user_events` (`beach_view` and downstream intent events) by beach over rolling windows, joins active bot supply from `intel_posts`/`beach_reviews`, and adds freshness/staleness and feedback terms. Keep the cleaning rules centralized and exclude `bot_flagged`, `profiles.is_mock`, `profiles.is_system_account`, and known test identities as the existing reporting did.
2. Normalize those inputs into a deterministic ranked target list. Use roughly 85–90% of selected targets from the highest demand gaps and 10–15% from exploration. Do not partition the ranked list by NPC home region. Use home region/personality only when choosing voice, compatible content, and a local-context label.
3. Persist an auditable run/assignment record or an equivalent structured server log so every selection records score inputs, freshness, source window, bot, content type, and suppression reason. Reuse existing `dedupe_hash`/active-post fields where possible; do not add a new schema table unless the audit trail cannot be made durable with existing primitives.
4. Replace random review generation with a hard ceiling or disable bot reviews in the first rollout. Reviews claim lived experience and create durable reputational data; template-driven condition intel is safer when it carries source, generated-at, expires-at, and confidence metadata.
5. Add material-change and per-beach caps before insertion. A new post should require a changed forecast/condition fingerprint, a stale or missing supply state, or a verified editorial reason. A duplicate should be skipped rather than rewritten as fresh activity.
6. Create a Morning Intel orchestrator as a separate route/service. It should select 3–5 high-intent or stale gaps, create a short attributed editorial briefing per selected beach, and optionally request a bounded local NPC follow-up only when the follow-up adds a distinct useful dimension. It should resolve `Morning Intel Bot` by stable profile identity, not by the Quiver Surf Forecast profile.
7. Keep `Quiver Surf Forecast` responsible for the existing structured regional forecast posts. Do not merge the two identities or make the structured forecast route depend on user-demand analytics.

## Existing measurement primitives

- `user_events` already contains `beach_view`, `local_intel_tab_viewed`, `intel_post_created`, `intel_post_confirmed`, and `plan_session_from_intel`; `lib/analytics/event-taxonomy.ts` and the database event allowlist must be checked before adding any event.
- `intel_post_confirmations`, intel votes, beach-review helpful counts, and session-log/plan events are available as quality or downstream-intent signals, but the current bot cohort has no confirmations/votes in the observed window. The implementation must distinguish zero feedback from missing instrumentation.
- `supabase/migrations/20260313210000_fix_p0_bot_flagged_and_auth_events.sql` establishes the `user_events.bot_flagged` field and historical bot filtering pattern. The demand query must use the current production field and not assume an old schema.
- Existing cron tests are `__tests__/app/api/cron/npc-activity.test.ts` and `__tests__/app/api/cron/morning-forecast-bot.test.ts`. Existing pure-logic coverage belongs near `__tests__/lib/npc/` or `__tests__/lib/utils/`.

## Risks and constraints

- Do not call generated forecast values eyewitness observations. Generated content must state that it is forecast/derived, include generation and expiry timestamps, and expose confidence/source context in the stored payload where the public renderer supports it.
- `npc-activity` currently uses a fixed `-8` offset and `Date.getDay()` for Pacific-time behavior. Any schedule or demand window must use the repository timezone helpers or an explicit UTC contract; do not copy the fixed-offset logic into new code.
- Cron routes use the service role. Keep demand queries and bot writes server-only, validate cron authentication, and preserve `withObservedCron`.
- Production migrations, schema push, cron activation, and deploy/alias changes are approval-gated. Plans should make the rollout dry-run/kill-switch path explicit.
- Do not hand-edit `types/database.generated.ts`; regenerate or use typed local shapes consistent with repository practice.

## Validation Architecture

- Pure scoring/selection functions: Jest unit tests for demand normalization, 85–90% demand vs 10–15% exploration, deterministic tie-breaking, caps, staleness, material-change suppression, and home-region-as-context-only behavior.
- Cron routes/services: focused Jest tests for auth rejection, missing system profiles, empty demand, idempotent reruns, per-beach cap enforcement, bounded Morning Intel selection, and separation of Morning Intel Bot from Quiver Surf Forecast.
- Database/migration: migration source assertions plus a read-only local/preview smoke query for indexes/RLS if a new audit table is introduced. No production push in the implementation phase without explicit approval.
- Measurement: a dry-run report must compare bot supply against clean demand for the same rolling windows and report target coverage, over-supply reduction, attribution completeness, helpful/confirmation rate, plan/session intent, and error/suppression counts.
- Release: run focused Jest, scoped ESLint, `yarn typecheck`, and a preview build when cron/config behavior changes; use one targeted Playwright smoke only if a public intel rendering or event contract changes.

## Research conclusion

The phase can be implemented as a bounded server-side ranking/orchestration layer on top of existing `user_events`, `intel_posts`, `beach_reviews`, forecast, dedupe, and event primitives. The highest-risk decisions are trust labeling, durable auditability, cron idempotency, and rollout controls—not adding more NPC personalities or increasing post volume.

## RESEARCH COMPLETE
