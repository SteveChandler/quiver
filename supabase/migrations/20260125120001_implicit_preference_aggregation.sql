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
  select
    we.user_id,

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
          b2.break_type,
          sum(we2.weight * we2.recency_factor) / nullif(sum(sum(we2.weight * we2.recency_factor)) over (), 0) as weight_pct
        from (
          select
            e.user_id,
            e.beach_id,
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
          where e.created_at > now() - interval '90 days'
            and e.user_id = we.user_id
            and e.beach_id is not null
        ) we2
        join public.beaches b2 on we2.beach_id = b2.id
        where b2.break_type is not null
        group by b2.break_type
        having sum(we2.weight * we2.recency_factor) > 0
      ) bt
    ),

    -- Location centroid lat: weighted average of beach latitudes
    round(
      sum(b.center_lat * we.weight * we.recency_factor) /
      nullif(sum(case when b.center_lat is not null then we.weight * we.recency_factor else 0 end), 0),
      6
    ),

    -- Location centroid lon: weighted average of beach longitudes
    round(
      sum(b.center_lng * we.weight * we.recency_factor) /
      nullif(sum(case when b.center_lng is not null then we.weight * we.recency_factor else 0 end), 0),
      6
    ),

    -- Top 5 engaged beaches: ordered by weighted engagement score
    array(
      select beach_id from (
        select
          we3.beach_id,
          sum(we3.weight * we3.recency_factor) as engagement
        from (
          select
            e.beach_id,
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
          where e.created_at > now() - interval '90 days'
            and e.user_id = we.user_id
            and e.beach_id is not null
        ) we3
        group by we3.beach_id
        having sum(we3.weight * we3.recency_factor) > 0
        order by engagement desc
        limit 5
      ) top_beaches
    ),

    -- Confidence: sigmoid based on total weighted event volume
    -- Formula: 1 / (1 + exp(-0.05 * (total_weight - 20)))
    -- Interpretation: 0.5 at 20 weighted events, asymptotes to 1.0
    round(
      (1.0 / (1.0 + exp(-0.05 * (sum(abs(we.weight)) - 20))))::numeric,
      2
    ),

    -- Event count: total events in window
    count(*)::int,

    -- Computation timestamps
    now(),
    min(we.created_at),
    max(we.created_at)

  from (
    -- Main event stream with weights and recency factors
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
    where e.created_at > now() - interval '90 days'
      and (target_user_id is null or e.user_id = target_user_id)
  ) we
  left join public.beaches b on we.beach_id = b.id
  group by we.user_id
  having count(*) >= 3  -- Minimum 3 events required for meaningful inference
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
  return processed_count;
end;
$$;

comment on function public.compute_implicit_preferences(uuid) is
  'Computes implicit preferences from user_events with weighted decay. Pass NULL for batch processing all users, or user_id for single-user update. Returns count of users processed. Requires minimum 3 events per user.';

commit;
