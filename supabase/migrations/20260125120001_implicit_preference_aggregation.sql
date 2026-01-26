-- Implicit Preference Aggregation Function
--
-- Description: Computes implicit preferences from user_events with weighted decay algorithm.
-- Processes behavioral signals over 90-day window and aggregates into inferred preferences.
--
-- Author: supabase-db-expert
-- Date: 2026-01-25
-- Issue: Implicit preference learning - aggregation layer
--
-- Event Weights (from design doc):
--   location_update: 10.0 (strongest signal - user physically traveled)
--   discovery_click:  3.0 (moderate interest - clicked to explore)
--   forecast_check:   2.5 (moderate interest - planning ahead)
--   beach_view:       0.5 (weak signal - passive browsing)
--   discovery_skip:  -1.0 (negative signal - explicit rejection)
--
-- Recency Decay: Linear decay over 90 days
--   recency_factor = max(0, 1.0 - days_ago / 90)
--
-- Confidence Score: Sigmoid function of weighted event volume
--   confidence = 1 / (1 + exp(-0.05 * (total_weight - 20)))
--   Reaches 0.5 at 20 weighted events, asymptotes to 1.0
--
-- Usage:
--   - compute_implicit_preferences(NULL) - Process all users (nightly batch job)
--   - compute_implicit_preferences(user_id) - Process single user (real-time update)
--
-- Returns: Count of users processed

begin;

-- ==============================================================================
-- FUNCTION: compute_implicit_preferences(target_user_id)
-- ==============================================================================

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

  -- Upsert computed preferences for each user with sufficient events
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
    -- CTE 1: Weighted events with recency factors (computed ONCE)
    -- This eliminates the DRY violation where weight calculation was duplicated 3 times
    weighted_events as (
      select
        e.user_id,
        e.beach_id,
        e.event_type,
        e.created_at,
        -- Single source of truth for event weights
        case e.event_type
          when 'location_update' then 10.0
          when 'discovery_click' then 3.0
          when 'forecast_check' then 2.5
          when 'beach_view' then 0.5
          when 'discovery_skip' then -1.0
          else 0
        end as weight,
        -- Recency decay: linear from 1.0 to 0 over 90 days
        greatest(0, 1.0 - extract(epoch from (now() - e.created_at)) / (90 * 86400)) as recency_factor
      from public.user_events e
      where e.created_at > now() - interval '90 days'
        and (target_user_id is null or e.user_id = target_user_id)
    ),

    -- CTE 2: Aggregated metrics per user (computed from weighted_events in single pass)
    -- This eliminates multiple table scans - all metrics computed in one pass
    user_metrics as (
      select
        we.user_id,

        -- Event counts and timestamps
        count(*) as event_count,
        min(we.created_at) as computed_from,
        max(we.created_at) as computed_to,

        -- Total absolute weight for confidence calculation
        sum(abs(we.weight)) as total_abs_weight,

        -- Weighted beach engagement (for centroids and top beaches)
        -- Only include beaches with known locations
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
      having count(*) >= 3  -- Minimum 3 events required for meaningful inference
    )

  select
    um.user_id,

    -- Inferred wave min: NULL for now (beaches table lacks typical_wave_min column)
    -- TODO: Update when typical_wave_min/max columns added to beaches table
    null::numeric(4,1),

    -- Inferred wave max: NULL for now (beaches table lacks typical_wave_max column)
    null::numeric(4,1),

    -- Break type weights: normalized distribution of engaged break types
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

    -- Location centroid lat: weighted average of beach latitudes
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

    -- Location centroid lon: weighted average of beach longitudes
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

    -- Top 5 engaged beaches: array_agg with ORDER BY guarantees ordering
    (
      select array_agg((beach_obj->>'beach_id')::uuid order by (beach_obj->>'weighted_engagement')::numeric desc)
      from (
        select beach_obj, row_number() over (order by (beach_obj->>'weighted_engagement')::numeric desc) as rn
        from unnest(um.beach_data) as beach_obj
        where (beach_obj->>'weighted_engagement')::numeric > 0
      ) ranked
      where rn <= 5
    ),

    -- Confidence: sigmoid based on total weighted event volume
    -- Formula: 1 / (1 + exp(-0.05 * (total_weight - 20)))
    -- Interpretation: 0.5 at 20 weighted events, asymptotes to 1.0
    round(
      (1.0 / (1.0 + exp(-0.05 * (um.total_abs_weight - 20))))::numeric,
      2
    ),

    -- Event count: total events in window
    um.event_count::int,

    -- Computation timestamps
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

  raise notice 'compute_implicit_preferences: completed (processed_count=%)', processed_count;

  return processed_count;
exception
  when others then
    raise notice 'compute_implicit_preferences: error - % (%)', sqlerrm, sqlstate;
    raise;
end;
$$;

comment on function public.compute_implicit_preferences(uuid) is
  'Computes implicit preferences from user_events with weighted decay. Pass NULL for batch processing all users, or user_id for single-user update. Returns count of users processed. Requires minimum 3 events per user.';

commit;
