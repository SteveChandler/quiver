-- Create a convenience view joining profiles to beaches for home beach name
create or replace view public.profiles_with_home_beach as
select
  p.*,
  b.name as home_beach_name
from public.profiles p
left join public.beaches b on b.id = p.home_beach_id;


