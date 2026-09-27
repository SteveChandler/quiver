# Beach page redesign — pre-release baseline

Recorded 2026-09-27, before release. The success measure compares the 28 days before release with the 28 days after. If release is more than a week after 2026-09-27, re-run the same queries for the 28 days that end on the release date.

## Scope

- **Pages:** the redesign changes the main beach page, `/[state]/[city]/[beach]` (regex `^/[a-z]{2}/[^/]+/[^/]+/?$`). The water-temp and tides subpages are unchanged; they are recorded as a control.
- **Human traffic only:** PostHog filters use `$virt_is_bot != true` and hosts `www.quiversurf.app` or `quiversurf.app`.

## PostHog

- **Window:** 2026-08-30 00:00 to 2026-09-27 00:00 UTC (28 days).
- **Query:** read-only `execute-sql`.

| Measure | Value |
|---|---|
| `page_view` visitors (unique persons) | 4,589 |
| `page_view` events | 5,409 |
| `scroll_depth` ≥ 50% (visitors / events) | 397 / 628 |
| `scroll_depth` ≥ 75% (visitors / events) | 219 / 340 |
| `scroll_depth` 100% (visitors / events) | 22 / 27 |
| `app_handoff_link_opened` on beach pages | 0 (2 site-wide, none from a beach landing page) |
| `native_install_attribution_joined` on beach pages | 0 |

Scroll milestones fire at 25/50/75/100. Visitors reaching ≥ 50% were 397 / 4,589 = 8.7%.

Query shape:

```sql
SELECT uniqIf(person_id, event = 'page_view'), countIf(event = 'page_view'), …
FROM events
WHERE timestamp >= '2026-08-30' AND timestamp < '2026-09-27'
  AND event IN ('page_view','scroll_depth','app_handoff_link_opened','native_install_attribution_joined')
  AND coalesce(properties.$virt_is_bot, false) != true
  AND properties.$host IN ('www.quiversurf.app','quiversurf.app')
  AND match(coalesce(properties.$pathname, properties.pathname, ''), '^/[a-z]{2}/[^/]+/[^/]+/?$')
```

## Search Console

- **Window:** 2026-08-28 to 2026-09-24, the latest 28 days available (GSC lags about 3 days).
- **Query:** page regex on `https://www.quiversurf.app`; totals by date, so they include anonymized queries.

| Pages | Clicks | Impressions | CTR | Avg position |
|---|---|---|---|---|
| Main beach pages (baseline) | 143 | 26,825 | 0.53% | 8.6 |
| Water-temp + tides subpages (control) | 442 | 57,647 | 0.77% | 7.3 |
| Main beach pages, previous 28 days (2026-07-31..08-27) | 76 | 11,818 | 0.64% | 8.7 |
| Subpages, previous 28 days | 503 | 49,225 | 1.02% | 7.4 |

Script: `scratchpad/gsc_baseline.py`, pattern from `scripts/gsc-stats.py`.

## Reading it after release

- **Rollback trigger:** main beach-page clicks fall more than 20% (below about 114 per 28 days) and the subpage control does not fall with them. A drop in both points to seasonality or an algorithm change, not the redesign.
- **Volume is small.** 143 clicks per 28 days means a 20% move is about 29 clicks. Judge on the full 28-day window, not week over week.
- **Impressions are rising.** Main-page impressions more than doubled from the previous window, so compare CTR and position as well as clicks.
- **Success signals** (spec): more visitors scrolling past 50% and more Watch/app-handoff opens from beach pages. Both start near zero for handoffs; the old page had no Watch.
