-- Backfilled from remote supabase_migrations.schema_migrations on 2026-05-11.

DO $outer$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_extension
        WHERE extname = 'pg_cron'
    ) THEN
        PERFORM cron.schedule(
            'wq-samples-cleanup',
            '0 3 1 * *',
            $cron$DELETE FROM public.wq_samples WHERE sample_date < CURRENT_DATE - INTERVAL '1 year'$cron$
        );
    END IF;
END;
$outer$;
