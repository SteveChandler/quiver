# Week Scout requests: how many, how long, how to watch them

Last reviewed: 2026-11-05.

## What changed in November 2026

| Change | Where | Live when |
|---|---|---|
| Ranking speedup | quiver#1312 | prod, Nov 4 18:31 PT release |
| Scores (coverage and session decision) last 1 hour, up from 15 min | quiver#1315 | next daily release after Nov 4 |
| Explore asks for its 10 days only while the tab is visible | quiver-native#672 (replaces #671) | next iOS/Android OTA |
| Timing log names who asked for what | this PR + quiver-native `x-quiver-update-id` header | server: next release; app: next OTA |

## Why

**Every launch sent two Week Scout requests.** Home asks for 7 days. Explore is mounted at launch
(`lazy: false`), so its 10-day request fired too, hidden, a few seconds later. Its deadline timer
then refetched on every resume. Only about half of sessions ever open Explore (79 of 162 sessions
that reached Home, Oct 22 – Nov 4, iOS), so half of those 10-day requests were never seen.

**A 10-day request costs about a third more than a 7-day one.** Read-only replay on main
(median of 6): 2.6 s vs 2.0 s total, 1.1 s vs 0.67 s CPU, 43 vs 27 database reads, 120 vs 83 KB gzipped.

**Scores expired after 15 minutes.** The app refetches at the earlier of `coverage.expiresAt` and
`sessionDecision.expiresAt`, so both moved to one hour together. A week planner can tolerate one
missed 30-minute forecast sync. Sessions are short (median 79 s, 1 in 225 over an hour), so this
saves only a few resumes; it is cheap, not a big win.

**Options we measured and rejected:**
- Home asks for 10 days and Explore reuses it: ~5% less work per launch, but Home's Best ~30% slower.
- Persist Week Scout across cold starts: 85 of 92 cold starts come after more than an hour away,
  past the TTL, so it would almost never hit.
- A separate days-8–10 request for Explore: merge work not worth it at current traffic.

## Prod results so far

`[WeekScoutTiming]` medians, 200 responses only:

| | Before #1312 (n=94) | After (n=15, first evening) |
|---|---|---|
| Warm total | 6.3 s | 4.0 s |
| Cold total | 7.5 s | 5.7 s |
| Ranking step | 5.6 s | 4.4 s |

The after sample is small and cold-heavy. Recheck with a full day.

## How to watch it

Every Week Scout request logs one line:

```
[WeekScoutTiming] {"status":200,"totalMs":4031,"dayCount":7,"platform":"ios","update":"<expo update id>","user":"4685bc9d","cold":false,"cpuMs":2920,...,"stages":[...]}
```

| Field | Meaning |
|---|---|
| `dayCount` | 7 = Home, 10 = Explore |
| `platform` | `x-quiver-platform` header (`ios`/`android`), null for web or old clients |
| `update` | `x-quiver-update-id`: the OTA the phone is running. Null on builds before the header OTA |
| `user` | first 8 hex of sha256(user id). Pairs one person's requests without logging the id |
| `cold`, `cpuMs`, `totalMs` | instance cold start, CPU, wall time |

Pull them with the Vercel MCP `get_runtime_logs` (project `prj_z7DDSIF65y1EbOfuDrZfYsx9Mmbx`,
environment production, query `WeekScoutTiming`) or `vercel logs`.

**It is working when:**
1. Requests with a non-null `update` (the fixed OTA) show a `dayCount: 10` only when the same
   `user` actually opened Explore: far fewer 10-day than 7-day requests, roughly half or less.
2. Old builds (`update: null`) still show 7 + 10 pairs a few seconds apart for the same `user`.
   That pair rate should fall as the OTA spreads (iOS usually 70–90% within 3 days).
3. The same `user` rarely repeats a request within an hour once #1315 is live.
4. Warm `totalMs` median stays near 4 s.

**It is broken when:** a fixed-build user sends a 10-day request without any Explore `$screen`
event in PostHog at that time, or same-user repeats within an hour on a fixed build.
