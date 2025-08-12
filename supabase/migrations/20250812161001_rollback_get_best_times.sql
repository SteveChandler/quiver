-- Rollback for get_best_times RPC

drop function if exists public.get_best_times(uuid, timestamptz, timestamptz, int);
