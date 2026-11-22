-- Dry run against an approved read-only connection or restored snapshot.
-- psql -X -v archive_report="${QUIVER_SWELL_WATCH_ARCHIVE_REPORT:-0}" -f scripts/report-swell-watch-closed-epoch-components.sql
-- Each revision_id identifies all of its component rows. Bytes estimate the row
-- values only, excluding indexes and table overhead. Reconcile before any archive.

\set ON_ERROR_STOP on
\if :{?archive_report}
\else
  \set archive_report false
\endif
\if :archive_report
BEGIN READ ONLY;
SET LOCAL statement_timeout = '60s';

WITH latest_authority AS (
  SELECT epoch, state, expires_at
  FROM public.swell_watch_study_authorities
  WHERE not_before <= now()
  ORDER BY epoch DESC LIMIT 1
), closed_authorities AS (
  SELECT authority.epoch
  FROM public.swell_watch_study_authorities authority
  CROSS JOIN latest_authority latest
  WHERE authority.state = 'active'
    AND (authority.expires_at <= now() OR authority.epoch < latest.epoch)
    -- An extension can still read acceptances from earlier epochs in its cycle.
    AND (
      latest.state = 'revoked' OR latest.expires_at <= now()
      OR authority.epoch < coalesce(public.swell_watch_study_cycle_start(latest.epoch), 1)
    )
), closed_revision_sets AS (
  SELECT acceptance.revision_set_id, acceptance.authority_epoch
  FROM public.swell_watch_study_acceptances acceptance
  JOIN closed_authorities ON closed_authorities.epoch = acceptance.authority_epoch
), eligible_revisions AS (
  SELECT member.revision_id, array_agg(DISTINCT closed_set.authority_epoch ORDER BY closed_set.authority_epoch) AS closed_epochs
  FROM public.swell_watch_provider_run_revision_set_members member
  JOIN closed_revision_sets closed_set USING (revision_set_id)
  -- A revision reused by any open or unclassified set stays out of the report.
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.swell_watch_provider_run_revision_set_members other_member
    LEFT JOIN closed_revision_sets other_closed_set USING (revision_set_id)
    WHERE other_member.revision_id = member.revision_id
      AND other_closed_set.revision_set_id IS NULL
  )
  GROUP BY member.revision_id
)
SELECT eligible.closed_epochs, eligible.revision_id, count(*) AS component_count,
       sum(pg_column_size(component)) AS estimated_component_bytes
FROM eligible_revisions eligible
JOIN public.swell_watch_provider_run_revision_components component USING (revision_id)
GROUP BY eligible.closed_epochs, eligible.revision_id
ORDER BY eligible.closed_epochs, eligible.revision_id;

ROLLBACK;
\else
  \echo 'Dry run disabled. Set QUIVER_SWELL_WATCH_ARCHIVE_REPORT=1 in the invocation above.'
\endif
