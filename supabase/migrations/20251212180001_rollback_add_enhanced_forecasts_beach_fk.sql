-- Rollback for 20251212180000_add_enhanced_forecasts_beach_fk.sql
-- Note: Orphan cleanup deletions are not restored by this rollback.

begin;

alter table public.enhanced_forecasts
  drop constraint if exists enhanced_forecasts_beach_id_fkey;

commit;


