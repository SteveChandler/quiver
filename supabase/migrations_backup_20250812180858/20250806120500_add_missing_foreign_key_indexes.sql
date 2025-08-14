-- Add covering indexes for foreign keys flagged by Supabase linter
-- Lint: 0001_unindexed_foreign_keys

DO $$ BEGIN
  IF to_regclass('public.beaches') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_beaches_owner_id_fkey
    ON public.beaches(owner_id);
  ELSE
    RAISE NOTICE 'Skipping idx_beaches_owner_id_fkey: beaches not found';
  END IF;
END $$;

-- session_invitations.invitee_id
DO $$ BEGIN
  IF to_regclass('public.session_invitations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id_fkey
    ON public.session_invitations(invitee_id);
  END IF;
END $$;

-- session_invitations.inviter_id
DO $$ BEGIN
  IF to_regclass('public.session_invitations') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_session_invitations_inviter_id_fkey
    ON public.session_invitations(inviter_id);
  END IF;
END $$;

-- session_participants.user_id
DO $$ BEGIN
  IF to_regclass('public.session_participants') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_session_participants_user_id_fkey
    ON public.session_participants(user_id);
  END IF;
END $$;

