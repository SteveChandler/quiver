-- Keep session_forecast_snapshots.actual_conditions in sync with post-completion
-- session rating/condition edits.
--
-- The snapshot row is created when a session becomes completed, but rating can
-- be filled in later. The preference-learning cron reads
-- session_forecast_snapshots.actual_conditions->>'rating', so stale snapshot
-- JSON makes already-rated sessions invisible to learning.

begin;

create or replace function public.create_session_forecast_snapshot()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  forecast_data jsonb;
  conditions_data jsonb;
  forecast_vs_actual_data jsonb := '{}'::jsonb;
  snapshot_exists boolean;
  forecast_wave_height numeric;
  forecast_wind_speed numeric;
  forecast_tide_height numeric;
begin
  if new.status is distinct from 'completed' then
    return new;
  end if;

  conditions_data := jsonb_build_object(
    'wave_quality', new.wave_quality,
    'water_temp', new.water_temp,
    'crowd_level', new.crowd_level,
    'parking_ease', new.parking_ease,
    'rating', new.rating,
    'notes', new.notes,
    'duration_minutes', new.duration_minutes,
    'arrival_time', new.arrival_time,
    'wave_height_ft', new.wave_height_ft,
    'wind_speed_mph', new.wind_speed_mph,
    'wind_direction', new.wind_direction,
    'forecast_accuracy', new.forecast_accuracy,
    'tide_height_ft', new.tide_height_ft,
    'tide_status', new.tide_status
  );

  -- Completed sessions can be edited after the snapshot was created. In that
  -- case, preserve the forecast captured at completion time and refresh only
  -- the observed/actual side of the snapshot.
  if tg_op = 'UPDATE' then
    if old.status = 'completed' then
      select sfs.forecast_snapshot
      into forecast_data
      from public.session_forecast_snapshots sfs
      where sfs.session_id = new.id;

      if forecast_data is not null then
        -- Wave height diff (forecast is often string-like, actual is numeric).
        if forecast_data->>'wave_height' is not null and new.wave_height_ft is not null then
          begin
            forecast_wave_height := (forecast_data->>'wave_height')::numeric;
            if forecast_wave_height is distinct from new.wave_height_ft then
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wave_height_ft', jsonb_build_object(
                  'forecast', forecast_wave_height,
                  'actual', new.wave_height_ft,
                  'diff', new.wave_height_ft - forecast_wave_height
                )
              );
            end if;
          exception
            when others then
              null;
          end;
        end if;

        if forecast_data->>'wind_speed_mph' is not null and new.wind_speed_mph is not null then
          begin
            forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
            if forecast_wind_speed is distinct from new.wind_speed_mph then
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'wind_speed_mph', jsonb_build_object(
                  'forecast', forecast_wind_speed,
                  'actual', new.wind_speed_mph,
                  'diff', new.wind_speed_mph - forecast_wind_speed
                )
              );
            end if;
          exception
            when others then
              null;
          end;
        end if;

        if forecast_data->>'wind_direction' is not null and new.wind_direction is not null then
          if forecast_data->>'wind_direction' <> new.wind_direction then
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'wind_direction', jsonb_build_object(
                'forecast', forecast_data->>'wind_direction',
                'actual', new.wind_direction
              )
            );
          end if;
        end if;

        if forecast_data->>'tide_height' is not null and new.tide_height_ft is not null then
          begin
            forecast_tide_height := (forecast_data->>'tide_height')::numeric;
            if forecast_tide_height is distinct from new.tide_height_ft then
              forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
                'tide_height_ft', jsonb_build_object(
                  'forecast', forecast_tide_height,
                  'actual', new.tide_height_ft,
                  'diff', new.tide_height_ft - forecast_tide_height
                )
              );
            end if;
          exception
            when others then
              null;
          end;
        end if;

        if forecast_data->>'tide_status' is not null and new.tide_status is not null then
          if forecast_data->>'tide_status' <> new.tide_status then
            forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
              'tide_status', jsonb_build_object(
                'forecast', forecast_data->>'tide_status',
                'actual', new.tide_status
              )
            );
          end if;
        end if;

        update public.session_forecast_snapshots
        set
          actual_conditions = coalesce(actual_conditions, '{}'::jsonb) || conditions_data,
          forecast_vs_actual = forecast_vs_actual_data,
          session_date = new.arrival_time::date,
          updated_at = now()
        where session_id = new.id;

        return new;
      end if;
      -- If a completed session is edited but has no snapshot, fall through and
      -- try to create one with the current closest forecast.
    end if;
  end if;

  select exists(
    select 1
    from public.session_forecast_snapshots
    where session_id = new.id
  ) into snapshot_exists;

  if snapshot_exists then
    return new;
  end if;

  select to_jsonb(ef.*)
  into forecast_data
  from public.enhanced_forecasts ef
  where ef.beach_id::uuid = new.beach_id::uuid
    and ef.forecast_date = new.arrival_time::date
  order by abs(extract(epoch from (ef.forecast_time::time - new.arrival_time::time))) asc
  limit 1;

  if forecast_data is not null then
    forecast_vs_actual_data := '{}'::jsonb;

    if forecast_data->>'wave_height' is not null and new.wave_height_ft is not null then
      begin
        forecast_wave_height := (forecast_data->>'wave_height')::numeric;
        if forecast_wave_height is distinct from new.wave_height_ft then
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wave_height_ft', jsonb_build_object(
              'forecast', forecast_wave_height,
              'actual', new.wave_height_ft,
              'diff', new.wave_height_ft - forecast_wave_height
            )
          );
        end if;
      exception
        when others then
          null;
      end;
    end if;

    if forecast_data->>'wind_speed_mph' is not null and new.wind_speed_mph is not null then
      begin
        forecast_wind_speed := (forecast_data->>'wind_speed_mph')::numeric;
        if forecast_wind_speed is distinct from new.wind_speed_mph then
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'wind_speed_mph', jsonb_build_object(
              'forecast', forecast_wind_speed,
              'actual', new.wind_speed_mph,
              'diff', new.wind_speed_mph - forecast_wind_speed
            )
          );
        end if;
      exception
        when others then
          null;
      end;
    end if;

    if forecast_data->>'wind_direction' is not null and new.wind_direction is not null then
      if forecast_data->>'wind_direction' <> new.wind_direction then
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'wind_direction', jsonb_build_object(
            'forecast', forecast_data->>'wind_direction',
            'actual', new.wind_direction
          )
        );
      end if;
    end if;

    if forecast_data->>'tide_height' is not null and new.tide_height_ft is not null then
      begin
        forecast_tide_height := (forecast_data->>'tide_height')::numeric;
        if forecast_tide_height is distinct from new.tide_height_ft then
          forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
            'tide_height_ft', jsonb_build_object(
              'forecast', forecast_tide_height,
              'actual', new.tide_height_ft,
              'diff', new.tide_height_ft - forecast_tide_height
            )
          );
        end if;
      exception
        when others then
          null;
      end;
    end if;

    if forecast_data->>'tide_status' is not null and new.tide_status is not null then
      if forecast_data->>'tide_status' <> new.tide_status then
        forecast_vs_actual_data := forecast_vs_actual_data || jsonb_build_object(
          'tide_status', jsonb_build_object(
            'forecast', forecast_data->>'tide_status',
            'actual', new.tide_status
          )
        );
      end if;
    end if;

    begin
      insert into public.session_forecast_snapshots (
        session_id,
        user_id,
        beach_id,
        forecast_snapshot,
        actual_conditions,
        forecast_vs_actual,
        forecast_confidence_score,
        data_source,
        session_date
      ) values (
        new.id,
        new.user_id,
        new.beach_id::uuid,
        forecast_data,
        conditions_data,
        forecast_vs_actual_data,
        (forecast_data->>'confidence_score')::integer,
        forecast_data->>'data_source',
        new.arrival_time::date
      );
    exception
      when unique_violation then
        null;
      when others then
        raise warning 'Failed to create forecast snapshot for session %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists trigger_create_session_forecast_snapshot on public.sessions;

create trigger trigger_create_session_forecast_snapshot
  after insert or update of
    status,
    wave_quality,
    water_temp,
    crowd_level,
    parking_ease,
    rating,
    notes,
    duration_minutes,
    arrival_time,
    wave_height_ft,
    wind_speed_mph,
    wind_direction,
    forecast_accuracy,
    tide_height_ft,
    tide_status
  on public.sessions
  for each row
  when (new.status = 'completed')
  execute function public.create_session_forecast_snapshot();

do $$
declare
  backfilled_count integer;
begin
  with current_conditions as (
    select
      sfs.id as snapshot_id,
      jsonb_build_object(
        'wave_quality', s.wave_quality,
        'water_temp', s.water_temp,
        'crowd_level', s.crowd_level,
        'parking_ease', s.parking_ease,
        'rating', s.rating,
        'notes', s.notes,
        'duration_minutes', s.duration_minutes,
        'arrival_time', s.arrival_time,
        'wave_height_ft', s.wave_height_ft,
        'wind_speed_mph', s.wind_speed_mph,
        'wind_direction', s.wind_direction,
        'forecast_accuracy', s.forecast_accuracy,
        'tide_height_ft', s.tide_height_ft,
        'tide_status', s.tide_status
      ) as conditions_data
    from public.session_forecast_snapshots sfs
    join public.sessions s
      on s.id = sfs.session_id
    where s.status = 'completed'
  ),
  updated as (
    update public.session_forecast_snapshots sfs
    set
      actual_conditions = coalesce(sfs.actual_conditions, '{}'::jsonb) || cc.conditions_data,
      updated_at = now()
    from current_conditions cc
    where sfs.id = cc.snapshot_id
      and coalesce(sfs.actual_conditions, '{}'::jsonb) is distinct from
        coalesce(sfs.actual_conditions, '{}'::jsonb) || cc.conditions_data
    returning 1
  )
  select count(*) into backfilled_count from updated;

  raise notice 'Backfilled % session_forecast_snapshots actual_conditions rows from sessions', backfilled_count;
end $$;

comment on function public.create_session_forecast_snapshot() is
  'Creates session forecast snapshots and keeps actual_conditions synced when completed session ratings or observed condition fields are edited.';

commit;
