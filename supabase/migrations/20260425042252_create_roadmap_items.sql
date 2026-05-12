-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

CREATE TYPE public.roadmap_status AS ENUM (
  'under_consideration',
  'in_progress',
  'shipped',
  'declined'
);

CREATE TYPE public.roadmap_category AS ENUM (
  'forecasts',
  'logging',
  'community',
  'notifications',
  'subscription',
  'other'
);

CREATE TABLE public.roadmap_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 60),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  category public.roadmap_category NOT NULL,
  status public.roadmap_status NOT NULL DEFAULT 'under_consideration',
  eta_label text CHECK (eta_label IS NULL OR char_length(eta_label) <= 40),
  founder_reply text CHECK (founder_reply IS NULL OR char_length(founder_reply) <= 1000),
  shipped_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX roadmap_items_status_idx ON public.roadmap_items (status);
CREATE INDEX roadmap_items_shipped_at_idx ON public.roadmap_items (shipped_at DESC)
  WHERE status = 'shipped';

ALTER TABLE public.roadmap_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY roadmap_items_public_read
  ON public.roadmap_items
  FOR SELECT
  USING (true);

CREATE TRIGGER set_roadmap_items_updated_at
  BEFORE UPDATE ON public.roadmap_items
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();
