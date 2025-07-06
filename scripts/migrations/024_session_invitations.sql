-- Session Invitations System Migration
-- Run this in Supabase SQL Editor

-- Create session_invitations table
CREATE TABLE IF NOT EXISTS session_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(session_id, inviter_id, invitee_id),
  UNIQUE(session_id, inviter_id, invitee_email),
  CHECK ((invitee_id IS NOT NULL) OR (invitee_email IS NOT NULL))
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_session_invitations_session_id ON session_invitations(session_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_inviter_id ON session_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_id ON session_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_session_invitations_invitee_email ON session_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS idx_session_invitations_status ON session_invitations(status);
CREATE INDEX IF NOT EXISTS idx_session_invitations_created_at ON session_invitations(created_at DESC);

-- Enable RLS on session_invitations
ALTER TABLE session_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_invitations

-- Users can view invitations they sent
CREATE POLICY "Users can view invitations they sent" ON session_invitations
    FOR SELECT USING (auth.uid() = inviter_id);

-- Users can view invitations they received (by user_id or email)
CREATE POLICY "Users can view invitations they received" ON session_invitations
    FOR SELECT USING (
        auth.uid() = invitee_id OR 
        invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Users can create invitations for their own sessions
CREATE POLICY "Users can create invitations for their sessions" ON session_invitations
    FOR INSERT WITH CHECK (
        auth.uid() = inviter_id AND
        EXISTS (
            SELECT 1 FROM sessions 
            WHERE id = session_id AND user_id = auth.uid()
        )
    );

-- Users can update invitations they received (to accept/decline)
CREATE POLICY "Users can respond to invitations they received" ON session_invitations
    FOR UPDATE USING (
        auth.uid() = invitee_id OR 
        invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    ) WITH CHECK (
        auth.uid() = invitee_id OR 
        invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );

-- Users can delete invitations they sent
CREATE POLICY "Users can delete invitations they sent" ON session_invitations
    FOR DELETE USING (auth.uid() = inviter_id);

-- Add session participants table for tracking who's joining sessions
CREATE TABLE IF NOT EXISTS session_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT,
  UNIQUE(session_id, user_id)
);

-- Create indexes for session_participants
CREATE INDEX IF NOT EXISTS idx_session_participants_session_id ON session_participants(session_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_user_id ON session_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_session_participants_status ON session_participants(status);

-- Enable RLS on session_participants
ALTER TABLE session_participants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for session_participants

-- Users can view participants of sessions they're involved in
CREATE POLICY "Users can view session participants" ON session_participants
    FOR SELECT USING (
        -- Session owner
        EXISTS (SELECT 1 FROM sessions WHERE id = session_id AND user_id = auth.uid()) OR
        -- Participant themselves
        user_id = auth.uid() OR
        -- Other participants of the same session
        EXISTS (SELECT 1 FROM session_participants sp WHERE sp.session_id = session_participants.session_id AND sp.user_id = auth.uid())
    );

-- Users can join sessions they're invited to
CREATE POLICY "Users can join sessions" ON session_participants
    FOR INSERT WITH CHECK (
        auth.uid() = user_id AND (
            -- Session is public (no restriction yet) OR
            -- User was invited
            EXISTS (
                SELECT 1 FROM session_invitations 
                WHERE session_id = session_participants.session_id 
                AND (invitee_id = auth.uid() OR invitee_email = (SELECT email FROM auth.users WHERE id = auth.uid()))
                AND status = 'accepted'
            ) OR
            -- Session owner can always join their own session
            EXISTS (SELECT 1 FROM sessions WHERE id = session_id AND user_id = auth.uid())
        )
    );

-- Users can update their own participation status
CREATE POLICY "Users can update their participation" ON session_participants
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Users can remove themselves from sessions
CREATE POLICY "Users can remove themselves from sessions" ON session_participants
    FOR DELETE USING (auth.uid() = user_id);

-- Session owners can remove participants
CREATE POLICY "Session owners can remove participants" ON session_participants
    FOR DELETE USING (
        EXISTS (SELECT 1 FROM sessions WHERE id = session_id AND user_id = auth.uid())
    );

-- Function to automatically add session owner as participant when session is created
CREATE OR REPLACE FUNCTION add_session_owner_as_participant()
RETURNS TRIGGER AS $$
BEGIN
  -- Only add for planned sessions
  IF NEW.status = 'planned' THEN
    INSERT INTO session_participants (session_id, user_id, status, joined_at)
    VALUES (NEW.id, NEW.user_id, 'going', NEW.created_at)
    ON CONFLICT (session_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-add session owner as participant
DROP TRIGGER IF EXISTS add_session_owner_participant ON sessions;
CREATE TRIGGER add_session_owner_participant
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION add_session_owner_as_participant();

-- Function to auto-add user as participant when they accept an invitation
CREATE OR REPLACE FUNCTION handle_invitation_acceptance()
RETURNS TRIGGER AS $$
BEGIN
  -- If invitation was accepted, add user to session participants
  IF NEW.status = 'accepted' AND OLD.status = 'pending' AND NEW.invitee_id IS NOT NULL THEN
    INSERT INTO session_participants (session_id, user_id, status, joined_at)
    VALUES (NEW.session_id, NEW.invitee_id, 'going', NOW())
    ON CONFLICT (session_id, user_id) DO UPDATE SET
      status = 'going',
      joined_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for invitation acceptance
DROP TRIGGER IF EXISTS handle_invitation_acceptance ON session_invitations;
CREATE TRIGGER handle_invitation_acceptance
  AFTER UPDATE ON session_invitations
  FOR EACH ROW
  EXECUTE FUNCTION handle_invitation_acceptance();

-- Add helpful comments
COMMENT ON TABLE session_invitations IS 'Stores invitations sent for surf sessions';
COMMENT ON TABLE session_participants IS 'Tracks who is participating in planned surf sessions';
COMMENT ON FUNCTION add_session_owner_as_participant IS 'Automatically adds session creator as participant';
COMMENT ON FUNCTION handle_invitation_acceptance IS 'Automatically adds users to participants when they accept invitations'; 