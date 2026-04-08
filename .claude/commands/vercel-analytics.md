Query Vercel Web Analytics for the Quiver production site and present a formatted dashboard.

**Configuration:**
- Project ID: `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`
- Auth token location: `~/Library/Application Support/com.vercel.cli/auth.json` (read the `token` field)
- Base URL: `https://vercel.com/api/web-analytics`
- Environment: `production`

**Important:** Vercel Web Analytics is client-side only. Embed routes (`/embed/*`) are NOT tracked because the Analytics JS is excluded from those pages. For embed tracking, use the app-stats dashboard or check server logs.

**Bot traffic exclusion:** An uptime monitor hits a fixed set of URLs at a steady cadence (~12-17 views/day each), inflating overall pageviews. The `BOT_PATHS` list below identifies these URLs so we can subtract them from the totals in post-processing. **Update `BOT_PATHS` if the monitor's target list changes.** Vercel's API only supports the `eq` filter operator, so exclusion has to happen client-side.

Run these 6 main curl commands **in parallel** with the 5 bot-path subtraction queries (Query 0 below). Set the date range to the **last 7 days** (use `$(date -v-7d +%Y-%m-%dT00:00:00)` for `from` and `$(date +%Y-%m-%dT23:59:59)` for `to`).

Read the auth token first:
```bash
VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
PROJECT_ID="prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx"
FROM=$(date -v-7d +%Y-%m-%dT00:00:00)
TO=$(date +%Y-%m-%dT23:59:59)
BASE="https://vercel.com/api/web-analytics"
# Bot URLs to subtract from totals (uptime monitor targets).
# Update this list if the monitor configuration changes.
BOT_PATHS=("/" "/map" "/features" "/ca/san-diego/blacks" "/ca/encinitas/swamis")
```

### Query 0: Bot Path Subtraction (run in parallel with the 6 main queries)

For each path in `BOT_PATHS`, fetch the per-path overview using the `eq` filter. Run these 5 queries **in parallel** with Queries 1-6:
```bash
# Repeat for each BOT_PATH — these 5 calls run alongside the main 6 in the same parallel batch.
FILTER=$(python3 -c "import urllib.parse,json,sys; print(urllib.parse.quote(json.dumps({'path':{'operator':'eq','values':[sys.argv[1]]}})))" "/")
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/overview?projectId=$PROJECT_ID&environment=production&from=$FROM&to=$TO&filter=$FILTER"
# ... repeat for /map, /features, /ca/san-diego/blacks, /ca/encinitas/swamis
```

Sum the `total` field across all 5 responses to get `bot_total`. Compute:
- `adjusted_total = raw_total - bot_total`
- `bot_share_pct = round(100 * bot_total / raw_total, 1)`

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

Present results as a markdown dashboard. **Always show both raw and bot-adjusted totals** in the Overview so the bot contamination is visible.

```
## Vercel Analytics Dashboard (7d)

### Overview
| Metric | Value |
|--------|-------|
| Raw Page Views | {raw_total} |
| Adjusted (humans) | {adjusted_total} |
| Bot Traffic (excluded) | {bot_total} across {len(BOT_PATHS)} URLs ({bot_share_pct}%) |
| Unique Visitors | {devices} |
| Bounce Rate | {bounceRate}% |

> Bot traffic is identified by a hardcoded list of URLs hit by an uptime monitor. The 5 URLs in `BOT_PATHS` are subtracted from the raw total. Visitors and bounce rate are NOT adjusted (Vercel API doesn't expose per-path device counts in `overview`).

### Daily Traffic
| Date | Views | Visitors | Bounce Rate |
|------|-------|----------|-------------|
| {date} | {total} | {devices} | {bounceRate}% |
| ... | ... | ... | ... |

### Top Pages
| Page | Views |
|------|-------|
| {path} 🤖 | {total} |
| {path} | {total} |
| ... | ... |

> Mark any path matching `BOT_PATHS` with a 🤖 emoji so bot rows are visually distinct from real human traffic.

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
