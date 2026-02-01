Query Quiver application metrics from Supabase and present a formatted dashboard.

## How to Run

Execute the app stats script which queries production Supabase:

```bash
npx tsx scripts/app-stats.ts
```

The script:
- Loads credentials from `.env.production.local` (not `.env` which points to local dev)
- Uses service role key to bypass RLS
- Runs all queries in parallel for speed
- Outputs JSON to stdout

## Parsing the Output

The script outputs JSON in this format:

```json
{
  "users": { "totalUsers": N, "newUsers7d": N, "newUsers24h": N },
  "sessions": { "totalSessions": N, "sessions7d": N, "sessions24h": N, "activeSurfers7d": N, "avgRating": "X.XX", "avgDuration": N },
  "content": { "totalReviews": N, "reviews7d": N, "totalIntel": N, "intel7d": N, "totalBoards": N, "totalBeaches": N },
  "delivery": { "emails7d": N }
}
```

## Output Format

Present results as a markdown dashboard:

```
## App Dashboard (excluding test accounts)

### Users
| Metric | Value |
|--------|-------|
| Total Users | {totalUsers} |
| New (7d) | {newUsers7d} |
| New (24h) | {newUsers24h} |

### Sessions
| Metric | Value |
|--------|-------|
| Total Sessions | {totalSessions} |
| Sessions (7d) | {sessions7d} |
| Sessions (24h) | {sessions24h} |
| Active Surfers (7d) | {activeSurfers7d} |
| Avg Rating | {avgRating} |
| Avg Duration | {avgDuration} min |

### Content
| Metric | Value |
|--------|-------|
| Reviews (total / 7d) | {totalReviews} / {reviews7d} |
| Intel Posts (total / 7d) | {totalIntel} / {intel7d} |
| Boards | {totalBoards} |
| Beaches | {totalBeaches} |

### Delivery (7d)
| Metric | Value |
|--------|-------|
| Emails Sent | {emails7d} |
```

## Anomaly Flags

After the dashboard, flag any of these conditions:

- **No new users in 24h** (newUsers24h = 0) — "Zero signups in last 24h"
- **No sessions in 7d** (sessions7d = 0) — "No sessions logged in 7 days"

Display flags as a bulleted warnings list. If no anomalies, print "No anomalies detected."

## Troubleshooting

If you get errors:

1. **"Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"**
   - Ensure `.env.production.local` exists with both variables

2. **"Supabase URL points to local instance"**
   - The script detected a localhost URL; check `.env.production.local` has the production URL

3. **Connection errors**
   - Verify network connectivity to `vawdnbbgawichorsjiwe.supabase.co`
