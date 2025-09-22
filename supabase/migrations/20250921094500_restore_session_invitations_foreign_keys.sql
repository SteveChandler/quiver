-- Reinstate foreign key constraints for session_invitations

begin;

-- Ensure supporting indexes exist for FK lookups
create index if not exists idx_session_invitations_session_id
  on public.session_invitations (session_id);

create index if not exists idx_session_invitations_inviter_id
  on public.session_invitations (inviter_id);

create index if not exists idx_session_invitations_invitee_id
  on public.session_invitations (invitee_id);

-- Restore session_id -> sessions(id)
alter table public.session_invitations
  drop constraint if exists session_invitations_session_id_fkey;

alter table public.session_invitations
  add constraint session_invitations_session_id_fkey
  foreign key (session_id)
  references public.sessions (id)
  on delete cascade
  not valid;

alter table public.session_invitations
  validate constraint session_invitations_session_id_fkey;

-- Restore inviter_id -> profiles(id)
alter table public.session_invitations
  drop constraint if exists session_invitations_inviter_id_fkey;

alter table public.session_invitations
  add constraint session_invitations_inviter_id_fkey
  foreign key (inviter_id)
  references public.profiles (id)
  on delete cascade
  not valid;

alter table public.session_invitations
  validate constraint session_invitations_inviter_id_fkey;

-- Restore invitee_id -> profiles(id)
alter table public.session_invitations
  drop constraint if exists session_invitations_invitee_id_fkey;

alter table public.session_invitations
  add constraint session_invitations_invitee_id_fkey
  foreign key (invitee_id)
  references public.profiles (id)
  on delete set null
  not valid;

alter table public.session_invitations
  validate constraint session_invitations_invitee_id_fkey;

commit;
