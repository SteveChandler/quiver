Run all Quiver monitoring dashboards in parallel and present a unified status report.

## Execution Strategy

Background subagents cannot get bash permissions from the user, so split work by tool type:

### Step 1: Run bash-dependent scripts in parallel (main session)

Launch these 4 bash commands **in parallel** using `run_in_background: true`:

1. **ML Pipeline**: `npx tsx scripts/ml-stats.ts 2>/dev/null` (timeout: 120s)
2. **Camera Health**: `npx tsx scripts/validate-cameras.ts --json 2>/dev/null` (timeout: 300s)
3. **Vercel Analytics**: Read token from `~/Library/Application Support/com.vercel.cli/auth.json`, then run 6 curl commands against `https://vercel.com/api/web-analytics` with project `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx` (overview, timeseries, path, referrer, country, device_type — last 7 days)
4. **GSC Stats**: `test -f /tmp/gsc-venv/bin/python3 || (python3 -m venv /tmp/gsc-venv && /tmp/gsc-venv/bin/pip install -q google-auth google-api-python-client) && /tmp/gsc-venv/bin/python3 /Users/stevenchandler/Desktop/quiver/scripts/gsc-stats.py` (timeout: 60s)

### Step 2: Run Supabase queries via subagent (in parallel with Step 1)

Dispatch **one background subagent** (`subagent_type: "general-purpose"`, `model: "haiku"`) for **App Metrics** — it runs 14 SQL queries via the Supabase MCP `execute_sql` tool against project `vawdnbbgawichorsjiwe`. Include the full app-stats skill content as the prompt. MCP tools don't need bash permissions so this works in background agents.

### Step 2b: Run growth metrics via subagent (in parallel with Steps 1 and 2)

Dispatch **one additional background subagent** (`subagent_type: "general-purpose"`, `model: "haiku"`) for **Growth Metrics** — it runs the 10 SQL queries defined in the `growth-metrics` skill via the Supabase MCP `execute_sql` tool against project `vawdnbbgawichorsjiwe`.

### Step 3: Collect and format

After all complete, parse each result using the formatting rules from the individual skills (`ml-stats`, `app-stats`, `vercel-analytics`, `cam-health`). GSC output is already markdown-formatted.

## Presenting Results

Present a **unified report** with this structure:

```
# Quiver Dashboard — {date}

## Summary

| System | Status | Key Metric |
|--------|--------|------------|
| ML Pipeline | {OK/WARNING} | Match rate: {n}%, MAE: {n}m |
| App | {OK/WARNING} | {new_users_24h} signups, {sessions_7d} sessions (7d) |
| Traffic | {OK/WARNING} | {total_views} views, {unique_visitors} visitors (7d) |
| Cameras | {OK/WARNING} | {live}/{total} live ({pct}%) |
| Forecasts | {OK/WARNING} | Avg age: {n}h, {critical} critical |
| SEO | {OK/WARNING} | {clicks} clicks, {impressions} impressions (28d) |
| Growth | {OK/WARNING} | WASL: {n}, D7 retention: {n}%, stickiness: {n}% |

## Anomalies

{Collect ALL anomaly flags from all 5 dashboards into a single list, prefixed by system name}

---

{Then include each full dashboard section below, separated by ---}
```

Mark a system as WARNING if it produced any anomaly flags, OK otherwise.

## Anomaly Rules

Reference the individual skills for full anomaly definitions:
- **ML**: match_rate <15%, improvement <5%, pending >24h, model failures, deployment issues
- **App**: zero signups, zero sessions, stale data sources, event tracking gaps, fallback spikes
- **Forecasts**: avg age >16h, critical stale >35 beaches, coverage <90%
- **Vercel**: low traffic days (<5 views), bounce >80%, no referral traffic
- **Cameras**: health <80%, provider 100% dead, error rate >10%, HDOnTap failures
- **GSC**: high-impression zero-click pages, low CTR at good positions, index coverage gaps
- **Growth**: D7 retention <10%, stickiness <20%, share rate <5%, WASL <5, onboarding <50%

## Error Handling

If any script fails or times out, still present results from the ones that succeeded. Note the failure in the Summary table as "ERROR" with a brief reason.
