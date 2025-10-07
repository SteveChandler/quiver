-- Create helper function to update beach coordinates geography field
-- This is used by the update-beaches-from-json script

begin;

-- Drop function if exists
drop function if exists public.update_beach_coordinates(uuid, double precision, double precision);

-- Create function to update coordinates from lat/lon
create or replace function public.update_beach_coordinates(
  p_beach_id uuid,
  p_longitude double precision,
  p_latitude double precision
)
returns void
language plpgsql
security definer
as $$
begin
  update public.beaches
  set coordinates = ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
  where id = p_beach_id;
end;
$$;

-- Grant execute to authenticated users and service role
grant execute on function public.update_beach_coordinates(uuid, double precision, double precision) 
  to authenticated, service_role;

comment on function public.update_beach_coordinates is 
  'Updates beach coordinates geography field from lat/lon values. Used by data import scripts.';

commit;
