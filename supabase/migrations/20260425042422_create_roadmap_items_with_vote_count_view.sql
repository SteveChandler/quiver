-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

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
