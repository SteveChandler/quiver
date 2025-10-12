-- Add onboarding completion flag to profiles and RLS policy for user-updates

-- 1) Schema change: add onboarding_completed_at if missing
alter table public.profiles
  add column if not exists onboarding_completed_at timestamptz null;

-- 2) Ensure RLS is enabled (no-op if already enabled)
alter table public.profiles enable row level security;

-- 3) RLS policy: allow users to update only their own profile (id match)
drop policy if exists "user_can_update_own_onboarding" on public.profiles;
create policy "user_can_update_own_onboarding"
  on public.profiles
  for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: Assumes RLS is already enabled on public.profiles and select policy exists.

