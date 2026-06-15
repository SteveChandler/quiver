# Owned Attribution Funnel Reporting

**Status:** read-only runbook
**Scope:** unified owned web attribution, App Store campaign aggregate, native auth, and activation funnel

Use this report for the owned iOS acquisition funnel:

`web iOS CTA view/click -> App Store campaign aggregate -> native first open -> anonymous event link -> auth/signup -> onboarding -> home activation`

Do not mutate production data from this runbook. Do not select emails, names, raw tokens, or other PII.

## Inputs

- `public.user_events`: web CTA, native first-open, auth, onboarding, and activation events.
- `public.profiles`: real-user exclusion fields: `is_mock`, `is_system_account`, `analytics_is_real_user`.
- Vercel logs: structured `/api/events/link` log event `events_link_attempt`.
- App Store Connect: campaign-link aggregate first-time downloads by campaign token `ct`.

Anonymous web/native events with no profile yet are anonymous rows. Group them by `session_id`; apply the real-user exclusion after `link_anonymous_events` attaches a `user_id` where possible.

Every query below labels:

- `attribution_confidence`: confidence of the row source.
- `attribution_scope`: layer of the funnel represented by the row.

Recommended psql setup:

```sql
\set start_at '''2026-06-01T00:00:00Z'''
\set end_at '''2026-06-15T00:00:00Z'''
```

In the Supabase SQL editor, replace `:start_at` and `:end_at` with quoted timestamptz literals.

## Full Funnel

Paste App Store Connect campaign totals into the `app_store_campaign_downloads` CTE after export. Keep it aggregate only.

```sql
with profile_flags as (
  select
    id as user_id,
    coalesce(is_mock, false) as is_mock,
    coalesce(is_system_account, false) as is_system_account,
    coalesce(analytics_is_real_user, true) as analytics_is_real_user
  from public.profiles
),
eligible_events as (
  select e.*
  from public.user_events e
  left join profile_flags p on p.user_id = e.user_id
  where e.created_at >= :start_at::timestamptz
    and e.created_at < :end_at::timestamptz
    and (
      e.user_id is null
      or (
        p.is_mock = false
        and p.is_system_account = false
        and p.analytics_is_real_user = true
      )
    )
),
web_ios_cta as (
  select
    e.event_type,
    coalesce(e.metadata->>'utm_source', 'unknown') as utm_source,
    coalesce(e.metadata->>'utm_medium', 'unknown') as utm_medium,
    coalesce(e.metadata->>'utm_campaign', 'unknown') as utm_campaign,
    coalesce(e.metadata->>'app_store_campaign_token', e.metadata->>'ct', 'unknown') as ct,
    count(*) as events,
    count(distinct coalesce(e.user_id::text, e.session_id::text)) as actors
  from eligible_events e
  where e.event_type in ('cta_impression', 'cta_click')
    and e.metadata->>'cta_family' = 'ios_app'
  group by 1, 2, 3, 4, 5
),
app_store_campaign_downloads as (
  -- Replace these literals with App Store Connect first-time downloads by ct.
  -- ASC is aggregate, delayed, and thresholded; keep this layer separate.
  select *
  from (values
    ('web'::text, 0::integer),
    ('web_share'::text, 0::integer),
    ('web_email'::text, 0::integer),
    ('ig_organic'::text, 0::integer),
    ('ig_paid'::text, 0::integer),
    ('web_safari_banner'::text, 0::integer),
    ('other'::text, 0::integer)
  ) as v(ct, first_time_downloads)
),
native_first_open as (
  select
    coalesce(e.metadata->>'app_store_campaign_token', e.metadata->>'ct', 'unknown') as ct,
    count(*) as events,
    count(distinct e.session_id::text) as actors
  from eligible_events e
  where e.event_type = 'native_app_first_open'
  group by 1
),
auth_activation as (
  select
    e.event_type,
    coalesce(e.metadata->>'app_store_campaign_token', e.metadata->>'ct', 'unknown') as ct,
    count(*) as events,
    count(distinct coalesce(e.user_id::text, e.session_id::text)) as actors
  from eligible_events e
  where e.event_type in (
    'signed_in',
    'signup_success',
    'onboarding_completed',
    'home_viewed'
  )
  group by 1, 2
)
select
  'web_ios_cta' as attribution_scope,
  'web_confirmed' as attribution_confidence,
  event_type as funnel_step,
  utm_source,
  utm_medium,
  utm_campaign,
  ct,
  events,
  actors
from web_ios_cta
union all
select
  'app_store_campaign_aggregate' as attribution_scope,
  'app_store_campaign_aggregate' as attribution_confidence,
  'first_time_downloads' as funnel_step,
  null as utm_source,
  null as utm_medium,
  null as utm_campaign,
  ct,
  first_time_downloads as events,
  null::bigint as actors
from app_store_campaign_downloads
union all
select
  'native_first_open' as attribution_scope,
  'native_confirmed' as attribution_confidence,
  'native_app_first_open' as funnel_step,
  null as utm_source,
  null as utm_medium,
  null as utm_campaign,
  ct,
  events,
  actors
from native_first_open
union all
select
  'auth_activation' as attribution_scope,
  case
    when event_type in ('signed_in', 'signup_success') then 'native_confirmed'
    else 'inferred'
  end as attribution_confidence,
  event_type as funnel_step,
  null as utm_source,
  null as utm_medium,
  null as utm_campaign,
  ct,
  events,
  actors
from auth_activation
order by attribution_scope, funnel_step, events desc;
```

## Link Success

`link_anonymous_events` success is measured through Vercel structured logs from `/api/events/link`:

- `event = 'events_link_attempt'`
- `outcome = 'success' | 'no-op' | 'error'`
- `events_updated`
- `duration_ms`

If the log drain lands in SQL, use this shape and group only by safe operational fields:

```sql
select
  'anonymous_link' as attribution_scope,
  case
    when outcome = 'success' then 'native_confirmed'
    when outcome = 'no-op' then 'unknown'
    else 'unknown'
  end as attribution_confidence,
  outcome,
  count(*) as attempts,
  sum(coalesce(events_updated, 0)) as linked_events,
  percentile_disc(0.95) within group (order by duration_ms) as p95_duration_ms
from vercel_log_events
where event = 'events_link_attempt'
  and created_at >= :start_at::timestamptz
  and created_at < :end_at::timestamptz
group by 1, 2, 3
order by attempts desc;
```

If logs are not in SQL, run the equivalent aggregation in the Vercel log drain destination. Do not join or export raw `session_id` or `user_id` in the readout.

## Session-Level QA

Use this to check whether anonymous rows are linking into later auth/activation rows. It groups by session only and does not expose user identifiers. Anonymous rows carry `session_id`; post-auth native rows are user-scoped, so the query bridges through the linked `user_id`.

```sql
with profile_flags as (
  select
    id as user_id,
    coalesce(is_mock, false) as is_mock,
    coalesce(is_system_account, false) as is_system_account,
    coalesce(analytics_is_real_user, true) as analytics_is_real_user
  from public.profiles
),
eligible_events as (
  select e.*
  from public.user_events e
  left join profile_flags p on p.user_id = e.user_id
  where e.created_at >= :start_at::timestamptz
    and e.created_at < :end_at::timestamptz
    and (
      e.user_id is null
      or (
        p.is_mock = false
        and p.is_system_account = false
        and p.analytics_is_real_user = true
      )
    )
),
anonymous_sessions as (
  select
    session_id,
    bool_or(event_type = 'cta_impression' and metadata->>'cta_family' = 'ios_app') as saw_ios_cta,
    bool_or(event_type = 'cta_click' and metadata->>'cta_family' = 'ios_app') as clicked_ios_cta,
    bool_or(event_type = 'native_app_first_open') as opened_native,
    min(user_id) filter (where user_id is not null) as linked_user_id,
    count(distinct user_id) filter (where user_id is not null) > 0 as linked_to_user
  from eligible_events
  where session_id is not null
  group by session_id
),
post_auth_user_events as (
  select
    user_id,
    bool_or(event_type = 'signed_in') as signed_in,
    bool_or(event_type = 'signup_success') as signup_success,
    bool_or(event_type = 'onboarding_completed') as onboarding_completed,
    bool_or(event_type = 'home_viewed') as home_viewed
  from eligible_events
  where user_id is not null
    and event_type in (
      'signed_in',
      'signup_success',
      'onboarding_completed',
      'home_viewed'
    )
  group by user_id
),
session_rollup as (
  select
    s.session_id,
    s.saw_ios_cta,
    s.clicked_ios_cta,
    s.opened_native,
    s.linked_to_user,
    coalesce(p.signed_in, false) as signed_in,
    coalesce(p.signup_success, false) as signup_success,
    coalesce(p.onboarding_completed, false) as onboarding_completed,
    coalesce(p.home_viewed, false) as home_viewed
  from anonymous_sessions s
  left join post_auth_user_events p on p.user_id = s.linked_user_id
)
select
  'session_rollup' as attribution_scope,
  case
    when linked_to_user then 'native_confirmed'
    else 'unknown'
  end as attribution_confidence,
  saw_ios_cta,
  clicked_ios_cta,
  opened_native,
  linked_to_user,
  signed_in,
  signup_success,
  onboarding_completed,
  home_viewed,
  count(*) as sessions
from session_rollup
group by 1, 2, 3, 4, 5, 6, 7, 8, 9, 10
order by sessions desc;
```

## Apple Caveats

- App Store Connect campaign reporting is an aggregate layer, not user-level attribution.
- Campaign rows are delayed by at least 24 hours.
- Campaign rows are thresholded at 5 or more first-time downloads per campaign window.
- Empty `ct` rows at current Quiver scale are not zero installs. They may mean the campaign did not clear Apple's threshold or has not appeared yet.
- Keep Apple aggregate rows separate from `native_app_first_open`; the native row is Quiver-owned and user/session scoped, while Apple is delayed aggregate reporting.

Current blocker: campaign-link code and Smart Banner `affiliate-data` cannot ship until the public App Store Connect provider token `pt` is supplied. Main verified current official Apple campaign-link help still says Smart App Banners can include provider and campaign tokens, and that campaigns appear only after 24 hours and 5 or more first-time downloads.

## Readout Checklist

1. Set the reporting window in UTC.
2. Run the full funnel query.
3. Add App Store Connect first-time downloads by `ct` only after the 24h delay and threshold caveats are checked.
4. Aggregate `events_link_attempt` from Vercel logs.
5. Run session-level QA to spot unlinked anonymous rows.
6. Report counts by `attribution_scope`, `attribution_confidence`, safe UTM fields, `ct`, and funnel step.
7. Call out anonymous rows separately when no linked profile exists yet.
