-- Remove legacy view no longer used by the application
-- Safe to run repeatedly

begin;

drop view if exists public.current_enhanced_forecasts;

commit;


