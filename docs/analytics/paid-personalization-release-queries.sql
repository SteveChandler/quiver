-- Paid personalization release evidence queries.
-- Run read-only against Supabase. These queries avoid PII and group by safe
-- enums, IDs, booleans, numeric bands, and dates.

-- 1. Conversion funnel by source surface.
select
  event_type,
  metadata->>'source' as source,
  metadata->>'cadence' as cadence,
  count(*) as events,
  count(distinct user_id) as users
from public.user_events
where event_type in (
  'paywall_opened',
  'paywall_dismissed',
  'paywall_purchase_started',
  'paywall_purchase_success',
  'paywall_purchase_failed',
  'onboarding_trial_started'
)
  and created_at >= now() - interval '14 days'
group by 1, 2, 3
order by 1, 2, 3;

-- 2. Match trust and performance by surface.
select
  event_type,
  metadata->>'surface' as surface,
  metadata->>'score_band' as score_band,
  metadata->>'confidence_band' as confidence_band,
  metadata->>'reason_type' as reason_type,
  metadata->>'quality_band' as quality_band,
  metadata->>'latency_band' as latency_band,
  count(*) as events,
  count(distinct user_id) as users,
  percentile_cont(0.95) within group (
    order by nullif(metadata->>'latency_ms', '')::numeric
  ) filter (where metadata ? 'latency_ms') as p95_latency_ms
from public.user_events
where event_type in (
  'match_card_rendered',
  'match_strip_tap',
  'for_you_tap',
  'unlock_toast_shown',
  'session_decomposition_selected'
)
  and created_at >= now() - interval '14 days'
group by 1, 2, 3, 4, 5, 6, 7
order by events desc;

-- 3. Alert lifecycle, opens, and configuration quality.
select
  metadata->>'action' as action,
  metadata->>'alert_type' as alert_type,
  metadata->>'surface' as surface,
  metadata->>'delivery_push' as delivery_push,
  metadata->>'delivery_email' as delivery_email,
  metadata->>'max_frequency_per_week' as max_frequency_per_week,
  count(*) as events,
  count(distinct user_id) as users
from public.user_events
where event_type = 'match_alert_toggle'
  and metadata->>'action' in ('created', 'updated', 'enabled', 'disabled', 'deleted', 'opened')
  and created_at >= now() - interval '14 days'
group by 1, 2, 3, 4, 5, 6
order by events desc;

-- 4. Alert delivery reliability and low-noise controls.
select
  channel,
  status,
  count(*) as attempts,
  count(distinct user_id) as users,
  count(distinct rule_id) as rules
from public.alert_delivery_attempts
where attempted_at >= now() - interval '14 days'
group by 1, 2
order by attempts desc;

-- 5. Post-alert action within 24h of an alert tap.
with opens as (
  select
    user_id,
    created_at as opened_at,
    metadata->>'beach_id' as beach_id
  from public.user_events
  where event_type = 'match_alert_toggle'
    and metadata->>'action' = 'opened'
    and created_at >= now() - interval '14 days'
),
actions as (
  select
    user_id,
    created_at,
    event_type,
    beach_id
  from public.user_events
  where event_type in ('session_log_submit', 'session_log_rating_set', 'beach_view')
    and created_at >= now() - interval '14 days'
)
select
  a.event_type,
  count(*) as downstream_events,
  count(distinct a.user_id) as users
from opens o
join actions a
  on a.user_id = o.user_id
 and a.created_at > o.opened_at
 and a.created_at <= o.opened_at + interval '24 hours'
 and (o.beach_id is null or a.beach_id = o.beach_id)
group by 1
order by downstream_events desc;

-- 6. Notification event pipeline outcomes for forecast and similarity alerts.
select
  ne.type,
  ne.status,
  nda.channel,
  nda.status as channel_status,
  count(*) as rows
from public.notification_events ne
left join public.notification_delivery_attempts nda
  on nda.notification_event_id = ne.id
where ne.type in ('forecast_alert', 'similarity_match')
  and ne.created_at >= now() - interval '14 days'
group by 1, 2, 3, 4
order by rows desc;
