-- Allow learn article figure embeds to reuse the embed impression table.

BEGIN;

ALTER TABLE public.embed_impressions
  DROP CONSTRAINT IF EXISTS embed_impressions_widget_type_check;

ALTER TABLE public.embed_impressions
  ADD CONSTRAINT embed_impressions_widget_type_check
  CHECK (widget_type IN ('tides', 'conditions', 'surf-terminal', 'ticker', 'learn-figure'));

COMMIT;
