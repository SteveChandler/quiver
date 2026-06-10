-- Session fit signal readiness queries.
-- Read-only. Avoids raw user/session identifiers and groups by safe enums,
-- dates, sources, and aggregate counts.
--
-- Use these to monitor the Layer 2 scoring rollout. The scoring RPC is
-- backward-compatible when no v1 skill_fit / board_fit rows exist; this query
-- shows when there is enough signal for held-out score evaluation.
--
-- Recommended setup:
-- \set start_at '''2026-06-01T00:00:00Z'''
-- \set end_at '''2026-07-01T00:00:00Z'''

-- 1. Persisted v1 fit signal by day/source/value.
with fit_sessions as (
  select
    date_trunc('day', s.created_at)::date as logged_day,
    coalesce(nullif(s.source, ''), 'unknown') as source,
    s.session_decomposition->>'skill_fit' as skill_fit,
    s.session_decomposition->>'board_fit' as board_fit,
    s.rating,
    s.board_id is not null as has_board,
    sfs.forecast_snapshot is not null as has_forecast_snapshot,
    md5(s.user_id::text) as actor_key
  from public.sessions s
  left join public.session_forecast_snapshots sfs
    on sfs.session_id = s.id
  where s.created_at >= :start_at::timestamptz
    and s.created_at < :end_at::timestamptz
    and s.deleted_at is null
    and s.session_decomposition is not null
    and s.session_decomposition->>'version' = '1'
    and (
      s.session_decomposition->>'skill_fit' in ('under', 'dialed', 'over_my_head')
      or s.session_decomposition->>'board_fit' in ('too_small', 'right', 'too_much_board', 'wrong_type', 'na')
    )
)
select
  logged_day,
  source,
  skill_fit,
  board_fit,
  has_board,
  has_forecast_snapshot,
  count(*) as sessions,
  count(distinct actor_key) as users,
  count(*) filter (where rating is not null) as rated_sessions,
  round(avg(rating)::numeric, 2) filter (where rating is not null) as avg_rating
from fit_sessions
group by 1, 2, 3, 4, 5, 6
order by logged_day desc, sessions desc;

-- 2. Layer 2 scorer-readiness rollup.
with fit_sessions as (
  select
    md5(s.user_id::text) as actor_key,
    s.session_decomposition->>'skill_fit' as skill_fit,
    s.session_decomposition->>'board_fit' as board_fit,
    s.rating,
    sfs.forecast_snapshot is not null as has_forecast_snapshot
  from public.sessions s
  left join public.session_forecast_snapshots sfs
    on sfs.session_id = s.id
  where s.created_at >= :start_at::timestamptz
    and s.created_at < :end_at::timestamptz
    and s.deleted_at is null
    and s.status = 'completed'
    and s.session_decomposition->>'version' = '1'
)
select
  count(*) as users_with_any_v1_fit_signal,
  sum(skill_fit_sessions) as skill_fit_sessions,
  sum(board_fit_sessions) as board_fit_sessions,
  sum(rated_snapshot_sessions) as rated_snapshot_fit_sessions,
  count(*) filter (where rated_snapshot_sessions >= 5) as users_with_5_fit_rated_snapshots,
  count(*) filter (where skill_fit_sessions >= 5) as users_with_5_skill_fit_sessions,
  count(*) filter (where board_fit_sessions >= 5) as users_with_5_board_fit_sessions
from (
  select
    actor_key,
    count(*) filter (where skill_fit in ('under', 'dialed', 'over_my_head')) as skill_fit_sessions,
    count(*) filter (where board_fit in ('too_small', 'right', 'too_much_board', 'wrong_type', 'na')) as board_fit_sessions,
    count(*) filter (where rating is not null and has_forecast_snapshot) as rated_snapshot_sessions
  from fit_sessions
  group by actor_key
) by_user;

-- 3. Telemetry/storage cross-check for the same window.
select
  e.event_type,
  metadata->>'tag' as tag,
  metadata->>'skill_fit' as skill_fit,
  metadata->>'board_fit' as board_fit,
  metadata->>'source' as source,
  count(*) as events,
  count(distinct md5(coalesce(e.user_id::text, e.session_id::text))) as actors
from public.user_events e
where e.created_at >= :start_at::timestamptz
  and e.created_at < :end_at::timestamptz
  and e.event_type in (
    'session_decomposition_selected',
    'session_board_fit_feedback_selected'
  )
group by 1, 2, 3, 4, 5
order by events desc;
