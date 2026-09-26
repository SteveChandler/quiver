# Regional surf seasons: measurement

Pages: `/best-time-to-surf/newport-beach`, `/best-time-to-surf/cocoa-beach` (Honolulu is a data repair, not measured).
Status: shipped_unvalidated until the +8 week reading.

## Funnel

page view (Google/Bing referral) → live forecast opened from the page → alert started or created → return visit within 14 days.

Quiver has no "beach saved" event in the taxonomy, so the save step is measured through alerts only.

## Bot check

Run first. If it returns 0, `bot_flagged` is not sent to PostHog and the North Charleston exclusion is the only bot filter.

```sql
SELECT count() FROM events
WHERE properties.bot_flagged = true AND timestamp > now() - INTERVAL 30 DAY
```

## Referred visitors (30 days before deploy, then +4 and +8 weeks)

```sql
SELECT properties.$pathname AS path, count(DISTINCT person_id) AS visitors
FROM events
WHERE event = '$pageview'
  AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
  AND (properties.$referring_domain ILIKE '%google.%' OR properties.$referring_domain ILIKE '%bing.com%')
  AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
  AND coalesce(properties.bot_flagged, false) = false
  AND timestamp >= {start} AND timestamp < {end}
GROUP BY path
```

## Next steps from those visitors

```sql
WITH landed AS (
  SELECT DISTINCT person_id, min(timestamp) AS landed_at
  FROM events
  WHERE event = '$pageview'
    AND properties.$pathname IN ('/best-time-to-surf/newport-beach', '/best-time-to-surf/cocoa-beach')
    AND coalesce(properties.$geoip_city_name, '') != 'North Charleston'
    AND timestamp >= {start} AND timestamp < {end}
  GROUP BY person_id
)
SELECT
  countIf(e.event = 'beach_view') AS forecast_opened,
  countIf(e.event IN ('save_alert_clicked', 'anon_alert_capture_submit', 'alert_rule_created')) AS alert_steps,
  count(DISTINCT if(e.event = '$pageview' AND e.timestamp > landed.landed_at + INTERVAL 1 DAY
    AND e.timestamp < landed.landed_at + INTERVAL 14 DAY, e.person_id, NULL)) AS returned_within_14d
FROM events e
JOIN landed ON e.person_id = landed.person_id
WHERE e.timestamp >= landed.landed_at AND e.timestamp < landed.landed_at + INTERVAL 14 DAY
```

## Baseline

| Window | Page | Referred visitors | Forecast opened | Alert steps | Returned ≤14 d |
|---|---|---|---|---|---|
| 30 days before deploy | newport-beach | 0 | 0 | 0 | 0 |
| 30 days before deploy | cocoa-beach | 0 | 0 | 0 | 0 |

Counts are small (the 2026-09-25 research saw 13–17 referred visitors per page per month). Report raw counts; do not claim significance.

## Readings

- +4 weeks after the production deploy: (date)
- +8 weeks: (date)
