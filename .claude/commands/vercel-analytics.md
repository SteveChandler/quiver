Query Vercel Web Analytics for the Quiver production site and present a formatted dashboard.

**Configuration:**
- Project ID: `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`
- Auth token location: `~/Library/Application Support/com.vercel.cli/auth.json` (read the `token` field)
- Base URL: `https://vercel.com/api/web-analytics`
- Environment: `production`

**Important:** Vercel Web Analytics is client-side only. Embed routes (`/embed/*`) are NOT tracked because the Analytics JS is excluded from those pages. For embed tracking, use the app-stats dashboard or check server logs.

Run these 6 curl commands **in parallel** using the Vercel API. Set the date range to the **last 7 days** (use `$(date -v-7d +%Y-%m-%dT00:00:00)` for `from` and `$(date +%Y-%m-%dT23:59:59)` for `to`).

Read the auth token first:
```bash
VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
PROJECT_ID="prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx"
FROM=$(date -v-7d +%Y-%m-%dT00:00:00)
TO=$(date +%Y-%m-%dT23:59:59)
BASE="https://vercel.com/api/web-analytics"
```

### Query 1: Traffic Overview (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/overview?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO"
```
Returns: `total` (page views), `devices` (unique visitors), `bounceRate`

### Query 2: Daily Traffic Timeseries (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO"
```
Returns: daily breakdown with `total`, `devices`, `bounceRate` per day

### Query 3: Top Pages (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&groupBy=path&limit=20"
```
Sum the `total` field across all daily entries per path. Sort descending by total views.

### Query 4: Top Referrers (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&groupBy=referrer&limit=20"
```
Sum the `total` field across all daily entries per referrer. Empty string = direct traffic.

### Query 5: Traffic by Country (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&groupBy=country&limit=15"
```

### Query 6: Traffic by Device Type (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&groupBy=device_type"
```

## Parsing the Response

All `timeseries` responses with `groupBy` return:
```json
{
  "data": {
    "groups": {
      "group_name": [
        { "key": "2026-02-01", "total": 10, "devices": 5, "bounceRate": 60 },
        ...
      ]
    }
  }
}
```

To get totals per group, sum the `total` field across all daily entries.

## Output Format

Present results as a markdown dashboard:

```
## Vercel Analytics Dashboard (7d)

### Overview
| Metric | Value |
|--------|-------|
| Total Page Views | {total} |
| Unique Visitors | {devices} |
| Bounce Rate | {bounceRate}% |

### Daily Traffic
| Date | Views | Visitors | Bounce Rate |
|------|-------|----------|-------------|
| {date} | {total} | {devices} | {bounceRate}% |
| ... | ... | ... | ... |

### Top Pages
| Page | Views |
|------|-------|
| {path} | {total} |
| ... | ... |

### Top Referrers
| Referrer | Views |
|----------|-------|
| (direct) | {total} |
| {referrer} | {total} |
| ... | ... |

### Traffic by Country
| Country | Views |
|---------|-------|
| {country} | {total} |
| ... | ... |

### Traffic by Device
| Device | Views |
|--------|-------|
| {device_type} | {total} |
| ... | ... |
```

## Supported Dimensions

Available `groupBy` values: `path`, `referrer`, `country`, `os_name`, `device_type`, `client_name`, `hostname`, `route`, `utm`, `ref`, `query_params`, `event_name`, `event_data`, `flags`

## Filtering by Path

To check a specific page, add a `filter` parameter:
```bash
FILTER=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'path':{'operator':'eq','values':['/ca/san-diego/blacks']}})))")
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&filter=$FILTER"
```
Only the `eq` operator is supported for path filtering.

## Anomaly Flags

After the dashboard, flag any of these:
- **Low traffic day** (any day with <5 views) — "{date} had only {n} page views"
- **High bounce rate** (>80% overall) — "Bounce rate is {n}% — investigate landing pages"
- **No referral traffic** (only direct) — "No search/referral traffic detected"
- **Embed tracking gap** — "Reminder: /embed/* routes are NOT tracked by Vercel Analytics (JS excluded). To track embed widget usage, build server-side impression logging."

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
