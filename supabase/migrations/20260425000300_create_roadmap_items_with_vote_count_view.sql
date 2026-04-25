-- supabase/migrations/20260425000300_create_roadmap_items_with_vote_count_view.sql
--
-- Read view that joins roadmap_items with an aggregated count of
-- roadmap_votes. Do NOT denormalize vote_count onto roadmap_items — it
-- will drift. The view is cheap at this scale (≤100 items in UC, rare
-- vote volume) and correctness > micro-optimization.

BEGIN;

CREATE VIEW public.roadmap_items_with_vote_count
WITH (security_invoker = true)
AS
SELECT
  i.id,
  i.title,
  i.description,
  i.category,
  i.status,
  i.eta_label,
  i.founder_reply,
  i.shipped_at,
  i.created_at,
  i.updated_at,
  COALESCE(v.vote_count, 0)::integer AS vote_count
FROM public.roadmap_items i
LEFT JOIN (
  SELECT item_id, COUNT(*) AS vote_count
  FROM public.roadmap_votes
  GROUP BY item_id
) v ON v.item_id = i.id;

GRANT SELECT ON public.roadmap_items_with_vote_count TO anon, authenticated;

COMMIT;
