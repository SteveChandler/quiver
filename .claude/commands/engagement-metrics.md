Query Vercel Web Analytics for engagement metrics and Content Gravity feature CTR.

**Configuration:**
- Project ID: `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`
- Auth token location: `~/Library/Application Support/com.vercel.cli/auth.json` (read the `token` field)
- Base URL: `https://vercel.com/api/web-analytics`
- Environment: `production`

Read the auth token first:
```bash
VERCEL_TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
PROJECT_ID="prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx"
FROM_7D=$(date -v-7d +%Y-%m-%dT00:00:00)
FROM_14D=$(date -v-14d +%Y-%m-%dT00:00:00)
TO_7D=$(date -v-7d +%Y-%m-%dT23:59:59)
TO=$(date +%Y-%m-%dT23:59:59)
BASE="https://vercel.com/api/web-analytics"
```

Run these queries **in parallel** using the Bash tool:

### Query 1: Traffic Overview (This Week - 7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/overview?projectId=$PROJECT_ID&environment=production&from=$FROM_7D&to=$TO"
```
Returns: `total` (page views), `devices` (unique visitors), `bounceRate`

### Query 2: Traffic Overview (Previous Week - 7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/overview?projectId=$PROJECT_ID&environment=production&from=$FROM_14D&to=$TO_7D"
```
Compare with Query 1 for week-over-week change.

### Query 3: Daily Bounce Rate Trend (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM_7D&to=$TO"
```
Returns: daily breakdown with `total`, `devices`, `bounceRate` per day.

### Query 4: Beach Page Traffic (7d)
Use path filter for beach pages:
```bash
FILTER=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'path':{'operator':'eq','values':['/ca/san-diego/blacks']}})))")
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM_7D&to=$TO&filter=$FILTER"
```
Note: This is a sample. Check the top beach pages from `/vercel-analytics` if you want broader coverage.

### Query 5: Custom Events by Name (7d)
```bash
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM_7D&to=$TO&groupBy=event_name"
```
Look for these Content Gravity events:
- `nearby_beach_click` / `nearby_beaches_viewed`
- `best_conditions_click` / `best_conditions_viewed`
- `partial_gate_viewed` / `partial_gate_signup`

### Query 6: Top Clicked Nearby Beaches (7d)
```bash
FILTER=$(python3 -c "import urllib.parse,json; print(urllib.parse.quote(json.dumps({'event_name':{'operator':'eq','values':['nearby_beach_click']}})))")
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "$BASE/timeseries?projectId=$PROJECT_ID&environment=production&from=$FROM_7D&to=$TO&groupBy=event_data&filter=$FILTER"
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
## Engagement Metrics Dashboard (7d vs previous 7d)

### Overall Engagement
| Metric | This Week | Last Week | Change |
|--------|-----------|-----------|--------|
| Bounce Rate | X% | Y% | +/-Z% |
| Page Views | X | Y | +/-Z% |
| Unique Visitors | X | Y | +/-Z% |

### Daily Bounce Rate Trend
| Date | Bounce Rate | Page Views | Visitors |
|------|------------|------------|----------|
| {date} | {bounceRate}% | {total} | {devices} |
| ... | ... | ... | ... |

### Feature CTR (Content Gravity)
| Feature | Views | Clicks | CTR |
|---------|-------|--------|-----|
| Nearby Beaches | nearby_beaches_viewed | nearby_beach_click | clicks/views % |
| Best Conditions | best_conditions_viewed | best_conditions_click | clicks/views % |
| Partial Gate (Reviews) | partial_gate_viewed (reviews) | partial_gate_signup (reviews) | clicks/views % |
| Partial Gate (Sessions) | partial_gate_viewed (sessions) | partial_gate_signup (sessions) | clicks/views % |
| Partial Gate (Intel) | partial_gate_viewed (intel) | partial_gate_signup (intel) | clicks/views % |

If an event has zero occurrences, show "0" and note "(not yet tracked)" in CTR column.

### Anomaly Flags
Flag these conditions:
- Bounce rate INCREASING week-over-week (bad)
- Any feature CTR below 2% (underperforming)
- Zero engagement events across all features (tracking may be broken)
- Any feature with views but zero clicks (UX issue)

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
```

## Success Metrics Targets (for reference)

| Metric | Target |
|--------|--------|
| Bounce rate | -15% from baseline |
| Nearby beach CTR | >8% |
| Best conditions CTR | >10% |
| Partial gate signup rate | >3% |
