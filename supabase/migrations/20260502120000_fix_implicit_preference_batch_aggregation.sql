-- Fix implicit preference batch aggregation for the current user_events shape.
--
-- Production user_events now includes anonymous rows (user_id NULL) and many
-- analytics-only event types. The original batch function assumed every event
-- had a user_id and counted zero-weight analytics events toward the minimum
-- sample size. This version only learns from authenticated, opted-in users and
-- from event types that carry preference signal.

begin;

create or replace function public.compute_implicit_preferences(target_user_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  processed_count integer := 0;
begin
  raise notice 'compute_implicit_preferences: starting (target_user_id=%)', target_user_id;

  insert into public.user_implicit_preferences (
    user_id,
    inferred_wave_min_ft,
    inferred_wave_max_ft,
    break_type_weights,
    location_centroid_lat,
    location_centroid_lon,
    top_engaged_beach_ids,
    confidence,
    event_count,
    last_computed_at,
    computed_from,
    computed_to
  )
  with
    weighted_events as (
      select
        e.user_id,
        e.beach_id,
        e.event_type,
        e.created_at,
        case e.event_type
          when 'location_update' then 10.0
          when 'discovery_click' then 3.0
          when 'forecast_check' then 2.5
          when 'beach_view' then 0.5
          when 'discovery_skip' then -1.0
          else 0
        end as weight,
        greatest(0, 1.0 - extract(epoch from (now() - e.created_at)) / (90 * 86400)) as recency_factor
      from public.user_events e
      join public.profiles p
        on p.id = e.user_id
       and p.allow_implicit_tracking = true
      where e.user_id is not null
        and e.created_at > now() - interval '90 days'
        and e.event_type in (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
        and (target_user_id is null or e.user_id = target_user_id)
    ),

    user_metrics as (
      select
        we.user_id,
        count(*) as event_count,
        min(we.created_at) as computed_from,
        max(we.created_at) as computed_to,
        sum(abs(we.weight)) as total_abs_weight,
        array_agg(
          jsonb_build_object(
            'beach_id', we.beach_id,
            'center_lat', b.center_lat,
            'center_lng', b.center_lng,
            'break_type', b.break_type,
            'weighted_engagement', we.weight * we.recency_factor
          )
          order by (we.weight * we.recency_factor) desc
        ) filter (where we.beach_id is not null) as beach_data
      from weighted_events we
      left join public.beaches b on we.beach_id = b.id
      group by we.user_id
      having count(*) >= 3
    )

  select
    um.user_id,
    null::numeric(4,1),
    null::numeric(4,1),
    (
      select jsonb_object_agg(break_type, round(weight_pct::numeric, 2))
      from (
        select
          (beach_obj->>'break_type')::text as break_type,
          sum((beach_obj->>'weighted_engagement')::numeric) /
            nullif(sum(sum((beach_obj->>'weighted_engagement')::numeric)) over (), 0) as weight_pct
        from unnest(um.beach_data) as beach_obj
        where beach_obj->>'break_type' is not null
          and (beach_obj->>'weighted_engagement')::numeric > 0
        group by (beach_obj->>'break_type')::text
      ) bt
      where weight_pct > 0
    ),
    round(
      (
        select sum((beach_obj->>'center_lat')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(case when beach_obj->>'center_lat' is not null
                               then (beach_obj->>'weighted_engagement')::numeric
                               else 0 end), 0)
        from unnest(um.beach_data) as beach_obj
        where (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    round(
      (
        select sum((beach_obj->>'center_lng')::numeric * (beach_obj->>'weighted_engagement')::numeric) /
               nullif(sum(case when beach_obj->>'center_lng' is not null
                               then (beach_obj->>'weighted_engagement')::numeric
                               else 0 end), 0)
        from unnest(um.beach_data) as beach_obj
        where (beach_obj->>'weighted_engagement')::numeric > 0
      ),
      6
    ),
    (
      select array_agg((beach_obj->>'beach_id')::uuid order by (beach_obj->>'weighted_engagement')::numeric desc)
      from (
        select beach_obj, row_number() over (order by (beach_obj->>'weighted_engagement')::numeric desc) as rn
        from unnest(um.beach_data) as beach_obj
        where (beach_obj->>'weighted_engagement')::numeric > 0
      ) ranked
      where rn <= 5
    ),
    round(
      (1.0 / (1.0 + exp(-0.05 * (um.total_abs_weight - 20))))::numeric,
      2
    ),
    um.event_count::int,
    now(),
    um.computed_from,
    um.computed_to
  from user_metrics um
  on conflict (user_id) do update set
    inferred_wave_min_ft = excluded.inferred_wave_min_ft,
    inferred_wave_max_ft = excluded.inferred_wave_max_ft,
    break_type_weights = excluded.break_type_weights,
    location_centroid_lat = excluded.location_centroid_lat,
    location_centroid_lon = excluded.location_centroid_lon,
    top_engaged_beach_ids = excluded.top_engaged_beach_ids,
    confidence = excluded.confidence,
    event_count = excluded.event_count,
    last_computed_at = now(),
    computed_from = excluded.computed_from,
    computed_to = excluded.computed_to;

  get diagnostics processed_count = row_count;

  delete from public.user_implicit_preferences prefs
  where (target_user_id is null or prefs.user_id = target_user_id)
    and not exists (
      select 1
      from public.user_events e
      join public.profiles p
        on p.id = e.user_id
       and p.allow_implicit_tracking = true
      where e.user_id = prefs.user_id
        and e.created_at > now() - interval '90 days'
        and e.event_type in (
          'location_update',
          'discovery_click',
          'forecast_check',
          'beach_view',
          'discovery_skip'
        )
      group by e.user_id
      having count(*) >= 3
    );

  raise notice 'compute_implicit_preferences: completed (processed_count=%)', processed_count;

  return processed_count;
exception
  when others then
    raise notice 'compute_implicit_preferences: error - % (%)', sqlerrm, sqlstate;
    raise;
end;
$$;

comment on function public.compute_implicit_preferences(uuid) is
  'Computes implicit preferences from authenticated opted-in preference-signal user_events with weighted decay. Pass NULL for batch processing all users, or user_id for single-user update. Returns count of users processed. Requires minimum 3 signal events per user.';

commit;
