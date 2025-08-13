begin;

create table if not exists public.spot_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  spot_id uuid not null references public.beaches(id) on delete cascade,
  rec_id uuid null,
  accurate boolean not null,
  reasons text[] null,
  note text null check (char_length(note) <= 280),
  created_at timestamptz not null default now()
);

alter table public.spot_feedback enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where policyname = 'spot_feedback_insert_own'
  ) then
    create policy spot_feedback_insert_own on public.spot_feedback
      for insert with check (auth.uid() = user_id);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where policyname = 'spot_feedback_select_own'
  ) then
    create policy spot_feedback_select_own on public.spot_feedback
      for select using (auth.uid() = user_id);
  end if;
end $$;

commit;


