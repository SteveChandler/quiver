-- Weekly web install handoff funnel. Read-only SELECTs for the shared Supabase DB.
-- Contract: components/app-store/ARCHITECTURE.md ("Install Tap Event Contract").
-- Route hits are not taps: clicks come from cta_click / invite_app_store_clicked / exact_call rows,
-- and a route hit only counts as a store redirect when its handoff_id matches a click.
-- Test on a one-day window first. Windows are UTC; for the Apple comparison, use
-- America/Los_Angeles day boundaries (confirm the App Store Connect report time zone first).

-- 1. Funnel. EDIT the two timestamps (Monday 00:00 UTC to next Monday).
WITH w AS (
  SELECT timestamptz '2026-10-05 00:00+00' AS wk_start,
         timestamptz '2026-10-12 00:00+00' AS wk_end
),
ev AS (
  SELECT ue.created_at, ue.event_type, ue.bot_flagged, ue.metadata,
         COALESCE(ue.session_id::text, ue.user_id::text) AS visitor_key,
         lower(NULLIF(ue.metadata->>'handoff_id', '')) AS handoff_id,
         CASE ue.metadata->'_device'->>'os'
           WHEN 'iOS' THEN 'ios' WHEN 'Android' THEN 'android' ELSE 'desktop'
         END AS device_platform
  FROM public.user_events ue, w
  WHERE ue.created_at >= w.wk_start - interval '1 day'
    AND ue.created_at <  w.wk_end   + interval '1 day'
    AND ue.event_type IN ('cta_impression','cta_click','invite_app_store_clicked',
                          'app_handoff_link_opened','app_handoff_view')
),
imp AS (   -- views: distinct visitors who saw an install CTA, non-bot
  SELECT COALESCE(metadata->>'surface','(none)')   AS surface,
         COALESCE(metadata->>'placement','(none)') AS placement,
         device_platform                            AS platform,
         count(DISTINCT visitor_key)                AS cta_visitors
  FROM ev, w
  WHERE event_type = 'cta_impression'
    AND metadata->>'cta_family' IN ('ios_app','app_handoff')
    AND bot_flagged IS NOT TRUE
    AND created_at >= w.wk_start AND created_at < w.wk_end
  GROUP BY 1,2,3
),
clk AS (   -- clicks: one row per handoff_id
  SELECT DISTINCT ON (handoff_id)
         handoff_id, created_at,
         COALESCE(metadata->>'surface','(none)')   AS surface,
         COALESCE(metadata->>'placement','(none)') AS placement,
         device_platform                            AS platform
  FROM ev, w
  WHERE handoff_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND bot_flagged IS NOT TRUE
    AND created_at >= w.wk_start AND created_at < w.wk_end
    AND ( (event_type = 'cta_click' AND metadata->>'cta_family' IN ('ios_app','app_handoff'))
       OR  event_type = 'invite_app_store_clicked'
       OR (event_type = 'app_handoff_link_opened' AND metadata->>'source' = 'exact_call') )
  ORDER BY handoff_id, created_at
),
hit AS (   -- server route hits (server rows carry metadata.host)
  SELECT DISTINCT ON (handoff_id)
         handoff_id, created_at,
         metadata->>'destination_type' AS dest
  FROM ev
  WHERE event_type = 'app_handoff_link_opened'
    AND metadata->>'host' IS NOT NULL
    AND bot_flagged IS NOT TRUE
    AND handoff_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ORDER BY handoff_id, created_at
),
nat AS (   -- native opens can lag the tap by days, so no week bound on the right
  SELECT DISTINCT lower(metadata->>'handoff_id') AS handoff_id
  FROM public.user_events, w
  WHERE event_type = 'app_handoff_native_open'
    AND created_at >= w.wk_start
    AND NULLIF(metadata->>'handoff_id','') IS NOT NULL
)
SELECT c.surface, c.placement, c.platform,
       max(i.cta_visitors)                                         AS cta_visitors,
       count(*)                                                    AS clicks,
       count(h.handoff_id) FILTER (WHERE h.dest = 'app_store')     AS store_redirects_click_confirmed,
       count(n.handoff_id)                                         AS native_opens_so_far
FROM clk c
LEFT JOIN imp i USING (surface, placement, platform)
LEFT JOIN hit h ON h.handoff_id = c.handoff_id
               AND h.created_at BETWEEN c.created_at - interval '5 minutes'
                                    AND c.created_at + interval '10 minutes'
LEFT JOIN nat n ON n.handoff_id = c.handoff_id
GROUP BY 1,2,3
ORDER BY clicks DESC;

-- 2. Route-hit quality (run next to the funnel; this is where bot share and the daily burst show up).
-- Rows before the classifier shipped have no traffic_class and read as 'legacy'.
SELECT date_trunc('day', created_at AT TIME ZONE 'UTC')::date AS day_utc,
       COALESCE(metadata->>'platform','?')                    AS platform,
       COALESCE(metadata->>'traffic_class','legacy')          AS traffic_class,
       COALESCE(metadata->>'handoff_id_source','legacy')      AS handoff_id_source,
       bot_flagged,
       count(*)                                                AS hits
FROM public.user_events
WHERE event_type = 'app_handoff_link_opened'
  AND metadata->>'host' IS NOT NULL
  AND created_at >= now() - interval '14 days'
GROUP BY 1,2,3,4,5
ORDER BY 1 DESC, hits DESC;

-- 3. Identify the daily burst from the stored signals (non-human classes only carry ua_sample).
SELECT date_trunc('minute', created_at) AS minute_utc,
       metadata->>'traffic_class'       AS traffic_class,
       metadata->>'ua_class'            AS ua_class,
       metadata->>'handoff_id_source'   AS handoff_id_source,
       left(metadata->>'ua_sample', 80) AS ua_sample,
       count(*)                         AS hits,
       count(DISTINCT metadata->>'source') AS distinct_sources
FROM public.user_events
WHERE event_type = 'app_handoff_link_opened'
  AND metadata->>'host' IS NOT NULL
  AND metadata->>'traffic_class' IS NOT NULL
  AND extract(hour FROM created_at AT TIME ZONE 'UTC') = 8
  AND created_at >= now() - interval '14 days'
GROUP BY 1,2,3,4,5
ORDER BY 1 DESC, hits DESC
LIMIT 200;

-- 4. Upper bound for iOS taps, to bracket the click-confirmed lower bound above:
-- iOS route hits that look human or came in by QR or email. Excludes link-preview metadata
-- (source = 'app_links') and the /app-store alias. Pre-classifier rows are lower-bound only.
SELECT date_trunc('week', created_at AT TIME ZONE 'UTC')::date AS week_utc,
       count(DISTINCT lower(metadata->>'handoff_id')) AS ios_taps_upper_bound
FROM public.user_events
WHERE event_type = 'app_handoff_link_opened'
  AND metadata->>'host' IS NOT NULL
  AND metadata->>'platform' = 'ios'
  AND bot_flagged IS NOT TRUE
  AND created_at >= now() - interval '28 days'
  AND ( metadata->>'traffic_class' = 'human_candidate'
     OR metadata->>'handoff_channel' IN ('qr','email') )
  AND COALESCE(metadata->>'source','') <> 'app_links'
  AND COALESCE(metadata->>'placement','') <> 'legacy_app_store_redirect'
GROUP BY 1
ORDER BY 1 DESC;

-- Apple comparison (manual, App Store Connect > App Analytics > Acquisition):
--   Compare 4-week sums, not days (Apple thresholds low counts).
--   One-sided check: our click-confirmed taps should be AT OR BELOW Apple "Web Referrer" product
--   page views. Smart App Banner taps on Safari reach Apple as web referrer but are invisible to us,
--   so Apple being higher is expected; report the gap rather than alarming on it. Ours above Apple
--   means a classification or join bug.
--   Record weekly: week, our lower bound, our upper bound, Apple web-referrer product page views,
--   Apple web-referrer first-time downloads.
