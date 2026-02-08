-- Daily cleanup of expired embed impressions (runs at 3am UTC)
select cron.schedule(
  'cleanup_embed_impressions',
  '0 3 * * *',
  $$DELETE FROM public.embed_impressions WHERE expires_at < now()$$
);
