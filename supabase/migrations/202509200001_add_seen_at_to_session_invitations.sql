-- Add seen_at column to session invitations to track read state

begin;

alter table public.session_invitations
  add column if not exists seen_at timestamptz;

create index if not exists idx_session_invitations_seen_at_null
  on public.session_invitations (seen_at)
  where seen_at is null;

commit;
