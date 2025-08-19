-- Create activity function and table if missing

begin;

-- Create user_activities table if it doesn't exist
create table if not exists public.user_activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  activity_type varchar(50) not null,
  entity_type varchar(50) not null,
  entity_id uuid not null,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- Create indexes for better performance
create index if not exists idx_user_activities_user_id_created_at 
  on public.user_activities(user_id, created_at desc);
create index if not exists idx_user_activities_type_created_at 
  on public.user_activities(activity_type, created_at desc);
create index if not exists idx_user_activities_entity 
  on public.user_activities(entity_type, entity_id);
create index if not exists idx_user_activities_created_at 
  on public.user_activities(created_at desc);

-- Enable RLS
alter table public.user_activities enable row level security;

-- RLS Policies
do $$ begin
  if not exists (
    select 1 from pg_policies where policyname = 'user_activities_select_all'
  ) then
    create policy user_activities_select_all on public.user_activities
      for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where policyname = 'user_activities_insert_own'
  ) then
    create policy user_activities_insert_own on public.user_activities
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

-- Create the activity function
create or replace function public.create_activity(
  p_user_id uuid,
  p_activity_type varchar(50),
  p_entity_type varchar(50),
  p_entity_id uuid,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
as $$
declare
  activity_id uuid;
begin
  insert into public.user_activities (user_id, activity_type, entity_type, entity_id, metadata)
  values (p_user_id, p_activity_type, p_entity_type, p_entity_id, p_metadata)
  returning id into activity_id;
  
  return activity_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.create_activity to authenticated;

commit;