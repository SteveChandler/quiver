-- Add a hash column we can use to detect duplicate intel submissions
alter table public.intel_posts
  add column if not exists dedupe_hash text;

comment on column public.intel_posts.dedupe_hash is
  'Deterministic hash of user, beach, location, and normalized intel content for deduplication.';

-- Enforce per-day uniqueness for identical intel content per user when the hash is present.
create unique index if not exists intel_posts_daily_dedupe_idx
  on public.intel_posts (
    user_id,
    dedupe_hash,
    ((created_at at time zone 'UTC')::date)
  )
  where dedupe_hash is not null;
