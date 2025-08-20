-- Add missing favorite_spot column to profiles table

begin;

-- Add favorite_spot column if it doesn't exist
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'favorite_spot'
  ) then
    alter table public.profiles add column favorite_spot text;
  end if;
end $$;

-- Add favorite_spot_id column if it doesn't exist (for foreign key relationship)
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' 
    and table_name = 'profiles' 
    and column_name = 'favorite_spot_id'
  ) then
    alter table public.profiles add column favorite_spot_id uuid references public.beaches(id);
  end if;
end $$;

-- Create index for better performance
create index if not exists idx_profiles_favorite_spot_id on public.profiles(favorite_spot_id);

commit;
