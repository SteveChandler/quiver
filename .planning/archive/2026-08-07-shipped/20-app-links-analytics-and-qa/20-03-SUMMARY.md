---
phase: 20-app-links-analytics-and-qa
plan: 20-03
status: completed
completed_at: 2026-06-02T16:13:06.000Z
---

# 20-03 Summary: Capture Before Baselines And Measurement Protocol

## Completed

- Added `docs/session-intelligence/phase-20-before-after-measurement.md`.
- Captured the latest complete GSC baseline for `2026-05-03` through
  `2026-05-30`, including CTR, average position, impressions, clicks, device
  split, top pages, and index coverage context.
- Captured the production-host PostHog before state for Phase 20 events,
  existing app CTA events, app deep-link conversion, and multi-page sessions.
- Captured Vercel Web Analytics traffic and bounce baseline for production.
- Captured route-performance baseline from production-host PostHog
  `$web_vitals` where samples existed.
- Documented route-performance blockers where Vercel/Speed Insights export was
  unavailable and specific sampled routes had no before samples.
- Added 3-day, 7-day, and 28-day after-check protocol with claim rules.

## Commands

```bash
/tmp/gsc-venv/bin/python3 scripts/gsc-stats.py
yarn seo:export:posthog --output docs/session-intelligence/phase-20-posthog-export.json
yarn seo:export:vercel --output docs/session-intelligence/phase-20-vercel-export.json
node ~/.codex/skills/vercel-web-analytics/scripts/pull-web-analytics.mjs --range 7d --markdown
rg -n "GSC|PostHog|Vercel|CTR|average position|impressions|multi-page|app CTA|deep-link conversion|bounce|route performance|before|after|date range|blocked|credential|3-day|7-day|28-day|follow-up|baseline" docs/session-intelligence/phase-20-before-after-measurement.md
```

All commands passed. The generated PostHog and Vercel JSON exports were removed
after summarization because raw route rows included an invite-token URL.

## Not Done

- No after-window claims were made.
- Native app-installed universal-link opens were not verified in this slice.
- Vercel Speed Insights route metrics were not exported; PostHog `$web_vitals`
  is the route-performance baseline until a Speed Insights export path is
  available.
