-- Ensure profiles.home_beach_id exists, has FK to beaches(id), index, and RLS update-own policy
begin;

-- Add column if missing
do $$ begin
  if not exists (
    select 1 from information_schema.columns 
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'home_beach_id'
  ) then
    alter table public.profiles add column home_beach_id uuid;
  end if;
end $$;

-- Drop legacy FK if named differently and add correct FK
do $$ begin
  -- Drop any existing FK on home_beach_id to avoid duplicate constraint names
  if exists (
    select 1 from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.table_schema = 'public' and tc.table_name = 'profiles' and tc.constraint_type = 'FOREIGN KEY'
      and ccu.column_name = 'home_beach_id'
  ) then
    -- Best effort: try dropping known names
    begin
      alter table public.profiles drop constraint if exists profiles_home_beach_id_fkey;
    exception when others then
      -- ignore if not present
      null;
    end;
  end if;
  -- Add FK
  alter table public.profiles
    add constraint profiles_home_beach_id_fkey
    foreign key (home_beach_id) references public.beaches(id) on delete set null;
end $$;

-- Index for performance
create index if not exists idx_profiles_home_beach_id on public.profiles(home_beach_id);

-- RLS: ensure update-own policy exists (id = auth.uid())
do $$ begin
  -- Enable RLS if not already enabled
  perform 1 from pg_tables where schemaname = 'public' and tablename = 'profiles';
  execute 'alter table public.profiles enable row level security';

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'profiles' and policyname = 'profiles_update_own_home_beach'
  ) then
    create policy "profiles_update_own_home_beach"
    on public.profiles for update to authenticated
    using (id = auth.uid()) with check (id = auth.uid());
  end if;
end $$;

commit;


