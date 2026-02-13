Check the health of all camera feeds in the Quiver database and present a formatted dashboard.

## How to Run

Execute the camera health validation script with JSON output:

```bash
npx tsx scripts/validate-cameras.ts --json
```

The script:
- Loads credentials from `.env.local`
- Uses service role key to bypass RLS
- Queries all camera URLs from `beach_sources` (joined with `beaches` for name/city/state)
- Deduplicates URLs so each unique camera is validated once
- Validates each URL with type-specific checks (HDOnTap embed page, YouTube oEmbed, Surfline HLS manifest, generic HEAD requests, etc.)
- Runs with concurrency of 5, 10-second timeout per URL
- Outputs structured JSON to stdout when `--json` flag is used

**Timeout:** The script may take 1-3 minutes depending on how many cameras exist and how many time out. Use a 5-minute timeout for the bash command.

## Parsing the Output

The script outputs a single JSON object to stdout with this structure:

```json
{
  "timestamp": "2026-02-13T04:24:14.287Z",
  "total": 78,
  "live": 70,
  "dead": 5,
  "error": 3,
  "byType": {
    "hdontap": { "live": 20, "dead": 3, "error": 0 },
    "youtube": { "live": 12, "dead": 0, "error": 0 },
    "surfline_hls": { "live": 8, "dead": 0, "error": 1 },
    "surfchex_hls": { "live": 5, "dead": 0, "error": 0 },
    "streamlock_hls": { "live": 2, "dead": 1, "error": 0 },
    "surfoutlook": { "live": 0, "dead": 1, "error": 0 },
    "generic_hls": { "live": 3, "dead": 0, "error": 1 },
    "direct_video": { "live": 1, "dead": 0, "error": 0 },
    "generic_iframe": { "live": 19, "dead": 0, "error": 1 }
  },
  "cameras": [
    {
      "beach": "Pacific Beach",
      "city": "San Diego",
      "state": "CA",
      "type": "hdontap",
      "status": "LIVE",
      "durationMs": 342,
      "url": "https://hdontap.com/stream/..."
    }
  ],
  "deadCameras": [
    {
      "beach": "Steamer Lane",
      "city": "Santa Cruz",
      "state": "CA",
      "type": "surfoutlook",
      "url": "https://...",
      "detail": "HTTP 404"
    }
  ],
  "errors": [
    {
      "beach": "Short Sands",
      "city": "Arch Cape",
      "state": "OR",
      "type": "generic_iframe",
      "url": "https://...",
      "detail": "Timeout (10s)"
    }
  ]
}
```

### Field Reference

| Field | Description |
|-------|-------------|
| `timestamp` | ISO 8601 time when the validation ran |
| `total` | Total number of camera entries (including duplicates across beaches) |
| `live` / `dead` / `error` | Aggregate counts by status |
| `byType` | Breakdown of live/dead/error counts per camera type |
| `cameras` | Full list of all camera results with status and timing |
| `deadCameras` | Filtered list of cameras with status DEAD (sorted by beach name) |
| `errors` | Filtered list of cameras with status ERROR (sorted by beach name) |

### Camera Types

| Type | Validation Method |
|------|-------------------|
| `hdontap` | Fetches embed page, searches for HLS manifest URL |
| `youtube` | Checks YouTube oEmbed API |
| `surfline_hls` | Fetches HLS manifest with Surfline referer header |
| `surfchex_hls` | Fetches HLS manifest |
| `streamlock_hls` | Fetches HLS manifest |
| `surfoutlook` | HEAD request |
| `generic_hls` | Fetches and checks for `#EXTM3U` in response |
| `direct_video` | HEAD request, checks `Content-Type: video/*` |
| `generic_iframe` | HEAD request, checks X-Frame-Options |

## Presentation Format

Parse the JSON and present the results as a dashboard.

### Camera Health Dashboard

**Overall Health: {live}/{total} cameras live ({percentage}%)**

where `percentage = Math.round((live / total) * 100)`

| Status | Count |
|--------|-------|
| LIVE   | {live} |
| DEAD   | {dead} |
| ERROR  | {error} |

### By Type

Build a table from the `byType` object. Include a Total column (live + dead + error for that type). Only show types that have at least one camera.

| Type | Live | Dead | Error | Total |
|------|------|------|-------|-------|
| hdontap | {live} | {dead} | {error} | {total} |
| youtube | ... | ... | ... | ... |
| ... | ... | ... | ... | ... |

### Dead Cameras (Action Required)

For each entry in the `deadCameras` array, list:
- Beach name, city, state
- Camera type
- URL
- Detail (reason it was marked dead, e.g., "HTTP 404", "No HLS URL found in page")
- Suggested action: one of these based on context:
  - "Find replacement URL" (if the provider still exists but URL changed)
  - "Remove from database" (if the provider is defunct, e.g., surfoutlook)
  - "Investigate and retry" (if the failure reason is ambiguous)

### Errors (Investigate)

For each entry in the `errors` array, list:
- Beach name, city, state
- Camera type
- Error detail
- Suggested action:
  - "Timeout (10s)" errors: "May be temporary - retry later or increase timeout"
  - Network/DNS errors: "Check if domain is still active"
  - Other: "Investigate manually"

### Risk Assessment

Based on the results, compute and present:

1. **Provider Concentration**: For each type in `byType`, calculate what percentage of total cameras it represents. Flag any provider that accounts for more than 40% of all cameras as a concentration risk.

2. **Provider Reliability**: For each type, calculate `dead / (live + dead + error)` as a failure rate. Flag any provider with failure rate above 20%.

3. **Overall Health Grade**:
   - 95%+ live: "Excellent"
   - 85-94% live: "Good"
   - 70-84% live: "Fair - attention needed"
   - Below 70%: "Poor - immediate action required"

4. **Recommended Actions** (prioritized by impact):
   - List dead cameras that affect popular beaches first
   - Group dead cameras by type if a provider has multiple failures
   - Suggest bulk actions where applicable (e.g., "All surfoutlook cameras are dead - consider removing provider entirely")

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **Health below 80%** (live/total < 0.80) -- "Camera health is below 80% - multiple feeds need attention"
- **Any provider 100% dead** (a type where live=0 and dead>0) -- "{type} provider is completely down ({dead} cameras)"
- **Error rate above 10%** (error/total > 0.10) -- "High error rate ({error}/{total}) - possible network or infrastructure issue"
- **HDOnTap failures** (hdontap dead > 0) -- "HDOnTap cameras failing - this is the primary provider, investigate immediately"
- **More than 10 dead cameras** (dead > 10) -- "Large number of dead cameras ({dead}) - may indicate a systemic issue"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."
