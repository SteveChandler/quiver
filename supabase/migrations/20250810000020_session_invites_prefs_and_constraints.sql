-- Session Invites: prefs, idempotency, and per-invitee uniqueness
-- Safe, idempotent migration

begin;

-- 1) session_invitations: drop inviter-based uniques if present
do $$
begin
  -- Common auto-generated names from previous unique constraints
  if exists (
    select 1 from pg_constraint
    where conname = 'session_invitations_session_id_inviter_id_invitee_id_key'
  ) then
    alter table public.session_invitations
      drop constraint session_invitations_session_id_inviter_id_invitee_id_key;
  end if;

  if exists (
    select 1 from pg_constraint
    where conname = 'session_invitations_session_id_inviter_id_invitee_email_key'
  ) then
    alter table public.session_invitations
      drop constraint session_invitations_session_id_inviter_id_invitee_email_key;
  end if;
exception when others then
  -- ignore if table/constraints don't exist yet
  null;
end $$;

-- 2) Ensure status allows 'revoked'
do $$
begin
  -- drop prior check if it exists
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.session_invitations'::regclass
      and conname = 'session_invitations_status_check'
  ) then
    alter table public.session_invitations
      drop constraint session_invitations_status_check;
  end if;
exception when others then
  null;
end $$;

alter table if exists public.session_invitations
  add constraint session_invitations_status_check
  check (status in ('pending','accepted','declined','revoked'));

-- 3) Add idempotency_key (nullable) with unique index
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'session_invitations'
      and column_name = 'idempotency_key'
  ) then
    alter table public.session_invitations add column idempotency_key text;
  end if;
exception when others then null; end $$;

create unique index if not exists idx_session_invitations_idempotency_key
  on public.session_invitations (idempotency_key)
  where idempotency_key is not null;

-- 4) Add per-invitee unique constraints
do $$
begin
  -- Using constraints so they are enforced regardless of nulls; Postgres treats nulls as distinct
  if not exists (
    select 1 from pg_constraint
    where conname = 'session_invitations_unique_session_invitee_id'
  ) then
    alter table public.session_invitations
      add constraint session_invitations_unique_session_invitee_id
      unique (session_id, invitee_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'session_invitations_unique_session_invitee_email'
  ) then
    alter table public.session_invitations
      add constraint session_invitations_unique_session_invitee_email
      unique (session_id, invitee_email);
  end if;
exception when others then null; end $$;

-- 5) Profile preferences: in-app/email/digest for invites
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'email_session_invites'
  ) then
    alter table public.profiles add column email_session_invites boolean not null default true;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'inapp_session_invites'
  ) then
    alter table public.profiles add column inapp_session_invites boolean not null default true;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'digest_session_invites'
  ) then
    alter table public.profiles add column digest_session_invites boolean not null default false;
  end if;
exception when others then null; end $$;

commit;


