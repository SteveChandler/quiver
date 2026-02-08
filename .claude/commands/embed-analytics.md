Query embed widget impression analytics from Supabase and present a formatted dashboard.

Run these 4 SQL queries **in parallel** against project `vawdnbbgawichorsjiwe` using `execute_sql`:

### Query 1: Overview (7d)
```sql
SELECT
  COUNT(*) AS total_impressions,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS impressions_24h,
  COUNT(DISTINCT beach_slug) AS unique_beaches,
  COUNT(DISTINCT referrer_domain) FILTER (WHERE referrer_domain IS NOT NULL) AS unique_referrers,
  COUNT(*) FILTER (WHERE referrer_domain IS NULL) AS direct_visits,
  COUNT(*) FILTER (WHERE widget_type = 'tides') AS tides_impressions,
  COUNT(*) FILTER (WHERE widget_type = 'conditions') AS conditions_impressions
FROM embed_impressions
WHERE created_at >= NOW() - INTERVAL '7 days';
```

### Query 2: Top Referrers (7d)
```sql
SELECT
  COALESCE(referrer_domain, '(direct / email)') AS referrer,
  COUNT(*) AS impressions,
  COUNT(DISTINCT beach_slug) AS unique_beaches
FROM embed_impressions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY referrer_domain
ORDER BY impressions DESC
LIMIT 10;
```

### Query 3: Top Beaches (7d)
```sql
SELECT
  beach_slug,
  COUNT(*) AS impressions,
  COUNT(*) FILTER (WHERE widget_type = 'tides') AS tides,
  COUNT(*) FILTER (WHERE widget_type = 'conditions') AS conditions,
  COUNT(DISTINCT referrer_domain) FILTER (WHERE referrer_domain IS NOT NULL) AS unique_referrers
FROM embed_impressions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY beach_slug
ORDER BY impressions DESC
LIMIT 10;
```

### Query 4: Daily Trend (7d)
```sql
SELECT
  DATE(created_at) AS day,
  COUNT(*) AS impressions,
  COUNT(*) FILTER (WHERE widget_type = 'tides') AS tides,
  COUNT(*) FILTER (WHERE widget_type = 'conditions') AS conditions,
  COUNT(*) FILTER (WHERE referrer_domain IS NULL) AS direct,
  COUNT(*) FILTER (WHERE referrer_domain IS NOT NULL) AS embedded
FROM embed_impressions
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY day DESC;
```

## Output Format

Present results as a markdown dashboard:

```
## Embed Widget Analytics (7d)

### Overview
| Metric | Value |
|--------|-------|
| Total Impressions | {total_impressions} |
| Impressions (24h) | {impressions_24h} |
| Tides Widget | {tides_impressions} |
| Conditions Widget | {conditions_impressions} |
| Unique Beaches | {unique_beaches} |
| Unique Referrers | {unique_referrers} |
| Direct / Email Visits | {direct_visits} |

### Top Referrers
| Referrer | Impressions | Unique Beaches |
|----------|-------------|----------------|
| {referrer} | {impressions} | {unique_beaches} |
| ... | ... | ... |

### Top Beaches
| Beach Slug | Impressions | Tides | Conditions | Referrers |
|------------|-------------|-------|------------|-----------|
| {beach_slug} | {impressions} | {tides} | {conditions} | {unique_referrers} |
| ... | ... | ... | ... | ... |

### Daily Trend
| Date | Total | Tides | Conditions | Direct | Embedded |
|------|-------|-------|------------|--------|----------|
| {day} | {impressions} | {tides} | {conditions} | {direct} | {embedded} |
| ... | ... | ... | ... | ... | ... |
```

## Interpretation Guide

After the dashboard, add these notes:

- **Direct / email visits** (referrer_domain IS NULL): These are likely clicks from the outreach emails we sent to SD surf shops, since there's no Referer header when clicking an email link.
- **Embedded visits** (referrer_domain IS NOT NULL): These indicate a surf shop actually embedded our widget on their site. This is the conversion we're looking for.
- **Key signal**: If a `referrer_domain` appears that matches one of our 12 outreach targets, that shop has embedded our widget.

## Anomaly Flags

Flag any of these conditions:
- **Zero impressions in 7d** — "No embed impressions recorded — verify the API route is deployed and widgets are firing the beacon"
- **All direct, zero embedded** — "All visits are direct (email clicks) — no shops have embedded the widget yet"
- **Single beach dominates** (>80% of impressions) — "Widget views concentrated on {beach_slug} — consider diversifying outreach"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
