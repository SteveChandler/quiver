# NPC system cards — implementation report

Date: 2026-08-13

## Pause and reversal

Persona accounts and their existing history are untouched. The persona cron remains scheduled but returns a no-op unless:

```text
NPC_PERSONA_POSTING_ENABLED=true
```

The default is paused. This is the single documented switch for reversing the pause. The test covers both the default no-op and explicit re-enablement. The old regional morning-forecast route is separately disabled by default with `QUIVER_LEGACY_MORNING_FORECAST_ENABLED=true` and is no longer scheduled; it is not needed for persona reversal.

The replacement route is `/api/cron/system-cards`, enabled unless `QUIVER_SYSTEM_CARDS_ENABLED=false`. It runs in ten UTC slots per day. The existing forecaster system account is retained; cards are labeled `Quiver Forecast` in metadata and on the intel card UI. The database profile still has the historical display name `Quiver Surf Forecast`; renaming that persisted account is an owner/data decision and was not made here.

## Card generator

Cards are generated from the latest `enhanced_forecasts` row for the selected beach. The copy includes the forecast timestamp and only available measured/model fields: wave height, period, wind, tide, and water temperature. Missing facts are stated as unavailable; no fallback surf conditions are invented.

The six classes are:

- forecast summary
- wind read
- water temperature
- prompt
- correction request
- forecast-vs-observation prompt/comparison

The deterministic ten-card cadence allocates three response-shaped cards per ten, so a full seven-day/70-card run produces 21 prompt, correction, or comparison cards (30%). It avoids first-person language and stores `system_card`, `voice`, `content_class`, `semantic_claim`, `prompt`, `market_key`, `allocation_tier`, and `forecast_at` in `surf_conditions`.

Selection and quality controls:

- target 10 cards/day; route guard hard ceiling 12
- one beach per rolling 24 hours by default; a material-transition candidate can opt into a second card only with a different class
- seven-day cap is `ceil(70 * 10%) = 7` cards per beach, with no more than two on a day when a transition is explicitly supplied
- exact description hash is checked against all prior system-card sentences; same beach + class near-duplicates are blocked for 14 days; identical semantic claims are blocked for 7 days
- the canonical `selectBeach` primitive runs for every candidate, so water-quality-held beaches are rejected

## Traffic weighting and projected distribution

`/api/cron/refresh-beach-traffic-weights` materializes a 30-day snapshot from Supabase `user_events` (`beach_view`, `page_view`, and `forecast_check`). Direct beach events are counted directly; city/state and intent paths are expanded to matching beaches. Each row stores `views_30d`, a square-root demand weight, market key, tier, and computation time. The tiers are:

- proven: the beach itself has recent traffic
- adjacent: the beach has no direct traffic, but its market does
- exploration: the market has no recent traffic

The system-card selector enforces the 70/20/10 slot pattern, then uses the stored weight and rotation/caps within each tier. If the table is missing, queryable but empty, or has no valid rows, the route uses uniform candidate weights and continues posting. No PostHog runtime dependency was added.

The following is the projected seven-day sanity-check model for 70 cards. It is an allocation projection, not a hardcoded beach list: the refreshed rows determine the concrete beach IDs, while the caps prevent any one concrete beach from exceeding 7 cards.

| Projected beach/market slot | Tier | Cards / 7 days | Share |
| --- | --- | ---: | ---: |
| Kill Devil Hills / Outer Banks traffic-proven rotation | proven | 7 | 10% |
| San Diego traffic-proven rotation | proven | 7 | 10% |
| Santa Cruz traffic-proven rotation | proven | 7 | 10% |
| Newport Beach traffic-proven rotation | proven | 7 | 10% |
| Hawaii island/beach rotation | proven | 7 | 10% |
| Huntington Beach traffic-proven rotation | proven | 7 | 10% |
| Santa Monica traffic-proven rotation | proven | 7 | 10% |
| Adjacent Outer Banks / San Diego / Orange County beach rotation | adjacent | 7 | 10% |
| Second adjacent beach in an observed market | adjacent | 7 | 10% |
| Exploration beach rotation | exploration | 7 | 10% |
| **Total** |  | **70** | **100%** |

The supplied 30-day validation inputs remain the ranking reference: Kill Devil Hills NC `374/201`, San Diego `146/139`, Santa Cruz `129/94`, Newport Beach `111/110`, Hawaii `106/106`, Huntington Beach `92/90`, Santa Monica `76/55`, Santa Barbara `59/42`, Ogunquit `50/38`, and Sea Isle City `45/22`. Hawaii is treated as an aggregate market and must resolve to an actual island/beach row before selection.

## Real activity signals

`/api/beaches/[id]/view-count` now returns cached aggregate signals, with a five-minute cache:

- `watchers`: distinct real users with enabled `alert_rules` for the beach
- `recentChecks`: exact non-bot `user_events` rows for `beach_view`, `page_view`, or `forecast_check` in the last seven days
- `loggedSessions`: exact completed, non-deleted sessions in the last 30 days belonging to real, non-system profiles

Profiles with `is_mock=true` or `is_system_account=true` are excluded. Counts are never inflated, usernames are never returned, and each signal is suppressed independently below 5. The surface therefore says nothing for a small count instead of exposing “1 person watching.”

## Measurement

The implementation uses existing event types and conventions:

- prompt-card impressions: `cta_impression` with `cta_id=system_card_prompt`, `surface=system_card`, `card_id`, `content_class`, `market_key`, and `prompt=true`
- prompt interaction: existing `cta_click` with `cta=check_conditions` and `location=system_card_prompt`
- resulting real report: existing `intel_post_created` with `source=system_card_prompt`

Recommended weekly dashboard cuts:

```sql
-- Real intel posts per ISO week, excluding mock and system accounts
select date_trunc('week', ip.created_at) as week, count(*)
from intel_posts ip
join profiles p on p.id = ip.user_id
where coalesce(p.is_mock, false) = false
  and coalesce(p.is_system_account, false) = false
group by 1 order by 1;

-- Prompt impressions and prompt-sourced real reports
select date_trunc('week', created_at) as week,
       count(*) filter (where event_type = 'cta_impression'
         and metadata->>'cta_id' = 'system_card_prompt') as prompt_impressions,
       count(*) filter (where event_type = 'intel_post_created'
         and metadata->>'source' = 'system_card_prompt') as real_reports
from user_events
where event_type in ('cta_impression', 'intel_post_created')
group by 1 order by 1;

-- Market breakdown for prompt impressions
select metadata->>'market_key' as market_key, count(*)
from user_events
where event_type = 'cta_impression'
  and metadata->>'cta_id' = 'system_card_prompt'
group by 1 order by 2 desc;
```

The baseline comparison is real, non-mock intel posts per week/month against the measured zero real posts/month during the persona period. The system-card metadata also permits beach-level and market-level card volume, class mix, and conversion cuts without a new event taxonomy.

## Product calls and rollout risks

- Ten daily cards is the active pilot target; twelve is only a ceiling. The older twelve-slot research allocation is not the runtime schedule.
- The system voice is labeled `Quiver Forecast`; changing the persisted system profile name is intentionally left for owner approval.
- The traffic table migration is explicitly unapplied in `supabase/migrations/20260813150000_create_beach_traffic_weights.sql`. It must go through the production migration protocol before the refresh cron can materialize rows. Until then, the documented uniform fallback keeps system cards posting.
- The production route supports a material-transition exception, but the current card cron does not synthesize a transition from absent observation data. It remains at one card per beach until a measured/model transition is available, which is the safer behavior for this pilot.
- No migration was applied, no native code was touched, and the dead Bluesky channel was left untouched.
