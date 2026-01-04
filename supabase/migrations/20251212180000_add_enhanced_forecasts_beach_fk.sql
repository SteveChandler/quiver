-- Enforce enhanced_forecasts.beach_id -> beaches.id referential integrity.
--
-- Problem:
-- - Some older environments created public.enhanced_forecasts before the FK existed.
-- - The canonical migration uses CREATE TABLE IF NOT EXISTS, so the FK is not applied retroactively.
-- - Orphan rows can then exist and leak into monitoring/coverage views.
--
-- Solution:
-- 1) Backup + delete orphaned enhanced_forecasts rows (those with non-existent beach_id).
-- 2) Add the FK constraint if missing, and validate it (or validate an existing, unvalidated FK).

begin;

-- -----------------------------------------------------------------------------
-- Step 1: Ensure an audit table exists (used by other cleanup migrations too)
-- -----------------------------------------------------------------------------
create table if not exists public.data_cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  cleanup_date timestamptz not null default now(),
  table_name text not null,
  records_affected integer not null,
  cleanup_reason text not null,
  backup_data jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Step 2: Backup orphan rows (minimal fields) + delete them
-- -----------------------------------------------------------------------------
create temp table orphaned_enhanced_forecasts_backup as
select
  ef.id,
  ef.beach_id,
  ef.forecast_date,
  ef.forecast_time,
  ef.updated_at,
  ef.data_source,
  now() as cleanup_deleted_at,
  'orphaned_cleanup_20251212' as deletion_reason
from public.enhanced_forecasts ef
where not exists (
  select 1
  from public.beaches b
  where b.id = ef.beach_id
);

do $$
declare
  orphaned_count integer;
  unique_beach_count integer;
begin
  select count(*) into orphaned_count from orphaned_enhanced_forecasts_backup;
  select count(distinct beach_id) into unique_beach_count from orphaned_enhanced_forecasts_backup;

  raise notice 'Found % orphaned enhanced_forecasts rows referencing % non-existent beaches',
    orphaned_count, unique_beach_count;
end $$;

delete from public.enhanced_forecasts ef
using orphaned_enhanced_forecasts_backup ob
where ef.id = ob.id;

do $$
declare
  deleted_count integer;
begin
  get diagnostics deleted_count = row_count;
  raise notice 'Deleted % orphaned enhanced_forecasts rows', deleted_count;
end $$;

-- Record summary (kept intentionally small to avoid large json blobs)
do $$
declare
  orphaned_count integer;
begin
  select count(*) into orphaned_count from orphaned_enhanced_forecasts_backup;

  if orphaned_count > 0 then
    insert into public.data_cleanup_audit (
      table_name,
      records_affected,
      cleanup_reason,
      backup_data
    )
    select
      'enhanced_forecasts' as table_name,
      count(*)::integer as records_affected,
      'Removed orphaned enhanced_forecasts referencing non-existent beaches before enforcing FK' as cleanup_reason,
      jsonb_build_object(
        'deleted_at', now(),
        'reason', 'orphaned enhanced_forecasts cleanup',
        'rows', jsonb_agg(
          jsonb_build_object(
            'id', id,
            'beach_id', beach_id,
            'forecast_date', forecast_date,
            'forecast_time', forecast_time,
            'updated_at', updated_at,
            'data_source', data_source
          )
        )
      ) as backup_data
    from orphaned_enhanced_forecasts_backup;
  else
    raise notice 'No orphaned enhanced_forecasts rows found; skipping audit insert';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Step 3: Add FK if missing, then validate it (or validate existing FK)
-- -----------------------------------------------------------------------------
do $$
declare
  fk_name text;
begin
  -- Look for any FK on enhanced_forecasts(beach_id) referencing beaches(id)
  select c.conname into fk_name
  from pg_constraint c
  join pg_class rel on rel.oid = c.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'enhanced_forecasts'
    and c.contype = 'f'
    and c.confrelid = 'public.beaches'::regclass
    and exists (
      select 1
      from unnest(c.conkey) as k(attnum)
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
      where a.attname = 'beach_id'
    )
  limit 1;

  if fk_name is null then
    execute $sql$
      alter table public.enhanced_forecasts
        add constraint enhanced_forecasts_beach_id_fkey
        foreign key (beach_id) references public.beaches(id)
        on delete cascade
        not valid
    $sql$;
    fk_name := 'enhanced_forecasts_beach_id_fkey';
  end if;

  -- Validate if needed
  if exists (
    select 1
    from pg_constraint c2
    where c2.conrelid = 'public.enhanced_forecasts'::regclass
      and c2.conname = fk_name
      and c2.contype = 'f'
      and c2.convalidated = false
  ) then
    execute format('alter table public.enhanced_forecasts validate constraint %I', fk_name);
  end if;
end $$;

commit;











