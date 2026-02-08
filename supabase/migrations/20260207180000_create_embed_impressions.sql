-- Embed impression tracking for outreach analytics
-- Tracks widget loads from email preview links and embedded widgets

create table public.embed_impressions (
  id uuid primary key default gen_random_uuid(),
  widget_type text not null check (widget_type in ('tides', 'conditions')),
  beach_slug text not null,
  referrer_domain text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '180 days')
);

-- Indexes
create index idx_embed_impressions_created_at on public.embed_impressions (created_at desc);
create index idx_embed_impressions_beach_slug on public.embed_impressions (beach_slug, created_at desc);
create index idx_embed_impressions_referrer on public.embed_impressions (referrer_domain) where referrer_domain is not null;
create index idx_embed_impressions_expires on public.embed_impressions (expires_at);

-- RLS: enabled, read-only public select, inserts via service role only
alter table public.embed_impressions enable row level security;

create policy "Allow public read access"
  on public.embed_impressions
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies for anon/authenticated
-- Service role bypasses RLS for writes
