-- Add covering indexes for foreign keys flagged by Supabase linter
-- Lint: 0001_unindexed_foreign_keys

-- beaches.owner_id (owner profile of custom/private beaches)
CREATE INDEX IF NOT EXISTS idx_beaches_owner_id_fkey
ON public.beaches(owner_id);

-- session_invitations.invitee_id
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id_fkey
ON public.session_invitations(invitee_id);

-- session_invitations.inviter_id
CREATE INDEX IF NOT EXISTS idx_session_invitations_inviter_id_fkey
ON public.session_invitations(inviter_id);

-- session_participants.user_id
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id_fkey
ON public.session_participants(user_id);

