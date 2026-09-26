# Regional surf seasons: measurement

Pages: `/best-time-to-surf/newport-beach`, `/best-time-to-surf/cocoa-beach` (Honolulu is a data repair, not measured).
Status: shipped_unvalidated until the +8 week reading.

## Funnel

page view (Google/Bing referral) → live forecast opened from the page → alert started or created → return visit within 14 days.

Quiver has no "beach saved" event in the taxonomy, so the save step is measured through alerts only.

## Bot check

`bot_flagged` is not a property in this PostHog project (checked 2026-09-25), so it is not sent
to PostHog and the North Charleston exclusion is the bot filter.

## Referred visitors (30 days before deploy, then +4 and +8 weeks)

```sql
SELECT properties.$pathname AS path, count(DISTINCT person_id) AS visitors
FROM events
WHERE event = 'page_view'
  AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
  AND (properties.$referring_domain ILIKE '%google.%' OR properties.$referring_domain ILIKE '%bing.com%')
  AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
  AND timestamp >= {start} AND timestamp < {end}
GROUP BY path
```

## Next steps from those visitors

```sql
WITH landed AS (
  SELECT DISTINCT person_id, min(timestamp) AS landed_at
  FROM events
  WHERE event = 'page_view'
    AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
    AND (properties.$referring_domain ILIKE '%google.%' OR properties.$referring_domain ILIKE '%bing.com%')
    AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
    AND timestamp >= {start} AND timestamp < {end}
  GROUP BY person_id
)
SELECT
  countIf(e.event = 'beach_view') AS forecast_opened,
  countIf(e.event IN ('save_alert_clicked', 'anon_alert_capture_submit', 'alert_rule_created')) AS alert_steps,
  count(DISTINCT if(e.event = 'page_view' AND e.timestamp > landed.landed_at + INTERVAL 1 DAY
    AND e.timestamp < landed.landed_at + INTERVAL 14 DAY, e.person_id, NULL)) AS returned_within_14d
FROM events e
JOIN landed ON e.person_id = landed.person_id
WHERE e.timestamp >= landed.landed_at AND e.timestamp < landed.landed_at + INTERVAL 14 DAY
```

## Baseline

| Window | Page | Referred visitors | Forecast opened | Alert steps | Returned ≤14 d |
|---|---|---|---|---|---|
| 30 days before deploy | newport-beach | 13 | 0 | 0 | 1 |
| 30 days before deploy | cocoa-beach | 17 | 5 | 0 | 2 |

Event used: `page_view` (Quiver's custom pageview event; `$pageview` is not what Quiver sends).
Date range: 2026-08-26T00:00 UTC – 2026-09-25T00:00 UTC (30 days before 2026-09-25). Queries run: 2026-09-25.

Counts are small (the 2026-09-25 research saw 13–17 referred visitors per page per month). Report raw counts; do not claim significance.

## Readings

- +4 weeks after the production deploy: (date)
- +8 weeks: (date)
