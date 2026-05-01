-- Play Store closed-testing → production: block & report support.
--
-- Adds the data model required for the native UGC moderation surfaces:
--   - user_blocks: who has blocked whom (RLS-scoped to blocker_id = auth.uid())
--   - content_reports: polymorphic report rows for users / sessions / comments
--   - blocked_user_ids: convenience view used by API-side filters
--
-- Native v1 only exposes block/report on profiles + sessions; comments are
-- backend-ready (target_type='comment') but not surfaced in mobile UI.
--
-- Plan: ~/.claude/plans/let-s-do-this-plan-synthetic-valiant.md
-- Spec: quiver-native/docs/plans/play-store-block-report.md

BEGIN;

-- ─── user_blocks ────────────────────────────────────────────────────────────

CREATE TABLE public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

COMMENT ON TABLE public.user_blocks IS
  'Per-user blocklist. Blocker cannot see blocked user''s profile or sessions in any native or web read path. Block is silent — blocked user is not notified.';

CREATE INDEX user_blocks_blocked_id_idx ON public.user_blocks(blocked_id);

ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user can view own blocks"
  ON public.user_blocks
  FOR SELECT
  TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY "user can insert own blocks"
  ON public.user_blocks
  FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = auth.uid());

CREATE POLICY "user can delete own blocks"
  ON public.user_blocks
  FOR DELETE
  TO authenticated
  USING (blocker_id = auth.uid());

-- ─── content_reports enums ──────────────────────────────────────────────────

CREATE TYPE content_report_target AS ENUM ('user', 'session', 'comment');

CREATE TYPE content_report_reason AS ENUM (
  'spam',
  'harassment',
  'hate_speech',
  'sexual_content',
  'violence',
  'self_harm',
  'misinformation',
  'ip_violation',
  'other'
);

CREATE TYPE content_report_status AS ENUM (
  'pending',
  'reviewing',
  'actioned',
  'dismissed'
);

-- ─── content_reports ────────────────────────────────────────────────────────

CREATE TABLE public.content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_type content_report_target NOT NULL,
  target_id uuid NOT NULL,
  target_owner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reason content_report_reason NOT NULL,
  details text,
  status content_report_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  moderator_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  moderator_notes text
);

COMMENT ON TABLE public.content_reports IS
  'Polymorphic content reports. target_owner_id is resolved server-side at insert time so moderation queries do not need to re-resolve ownership against possibly-deleted source rows.';

CREATE INDEX content_reports_status_idx
  ON public.content_reports(status, created_at DESC);

CREATE INDEX content_reports_target_idx
  ON public.content_reports(target_type, target_id);

ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can see only their own reports. Moderators read via service role.
CREATE POLICY "reporter can view own reports"
  ON public.content_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

CREATE POLICY "authenticated can insert reports"
  ON public.content_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- ─── blocked_user_ids view ──────────────────────────────────────────────────
-- Used by API-side filtering. security_invoker=true so RLS evaluates against
-- the calling user, not the view owner.

CREATE OR REPLACE VIEW public.blocked_user_ids
  WITH (security_invoker = true) AS
SELECT blocked_id
FROM public.user_blocks
WHERE blocker_id = auth.uid();

COMMENT ON VIEW public.blocked_user_ids IS
  'Convenience view for API-layer filtering. Always returns the calling user''s blocklist due to security_invoker + auth.uid() in WHERE clause.';

COMMIT;
