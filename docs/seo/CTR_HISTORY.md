# SEO CTR History

This log records CTR work that needs continuity across weekly reports, dashboard proposals, and runtime SEO surfaces.

## Sources Reviewed

- `Brand-Vault/seo-audit/2026-05-25/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-08/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-15/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-20/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-28/SEO-WEEKLY-REPORT.md`
- `Brand-Vault/seo-audit/2026-06-28/GSC-EXPORT.json`
- `Brand-Vault/seo-audit/2026-06-28/GSC-REFRESH.json`
- `docs/seo/seo-dashboard.json`

## 2026-06-29 Batch

Baseline window from the 2026-06-28 report: 2026-05-29 through 2026-06-25.

| Page | 28d clicks | 28d impressions | CTR | Avg position | Prior work reviewed | Runtime action |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `/best-time-to-surf/la-jolla` | 2 | 5,857 | 0.03% | 9.2 | Flagged repeatedly from 2026-05-25 through 2026-06-28; Phase 18 live handoff existed but copy stayed generic. | Added scoped metadata, answer copy, and a first-step handoff to `/surf-report/scripps-pier-today`. |
| `/best-time-to-surf/newport-beach` | 6 | 3,033 | 0.20% | 10.0 | 2026-06-15 and 2026-06-20 reports flagged weak CTR. Dashboard accepted `newport beach surf report` by assigning `/surf-report/newport-beach-today`, but runtime code did not include that page. | Added `/surf-report/newport-beach-today` and changed the best-time page to hand today's surf-report intent to that owner. |
| `/best-time-to-surf/malibu` | 1 | 1,252 | 0.08% | 8.3 | 2026-06-15, 2026-06-20, and 2026-06-28 reports flagged weak CTR. `/surf-report/malibu-today` already existed as the live owner. | Added scoped metadata, answer copy, and a first-step handoff to `/surf-report/malibu-today`. |

## Reconciliation Rule

Do not treat a dashboard proposal as covered until all four checks pass:

1. Runtime route exists in `lib/seo/funnel-pages.ts` or the relevant app route.
2. Unit tests name the route, title, metadata, and internal-link behavior.
3. Existing E2E coverage includes the route when it is part of a public SEO surface family.
4. The weekly report records the before/after GSC baseline and the intended rerun window.

For this batch, rerun against the same baseline at end of week and compare CTR and query ownership for La Jolla, Newport Beach, and Malibu before making broader template changes.

## Monitoring Cohort

The weekly GSC refresh reads `docs/seo/ctr-watchlist.json` and renders this cohort under `CTR Cohort Monitoring` as monitor-only evidence. It must not trigger another metadata or copy rewrite before the first fully post-change 28-day window ends on 2026-07-26. The hold is evaluated against the export's `dateRanges.last28d.end`, not the report generation timestamp, so GSC's three-day reporting lag cannot release a page early.

- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/newport-beach`
- `/best-time-to-surf/malibu`
- `/surf-report/newport-beach-today` (9 impressions in the latest mixed window)
- `/surf-report/malibu-today` (4 impressions in the latest mixed window)

## 2026-08-23 La Jolla Checkpoint

The mixed 28-day window initially obscured the result of the 2026-08-05
decision-first snippet change. An isolated 15-day comparison shows the
post-change window (2026-08-06 through 2026-08-20) at 4 clicks, 17,068
impressions, 0.0234% CTR, and average position 7.87. The equal-length
pre-change window (2026-07-22 through 2026-08-05) produced 5 clicks, 8,224
impressions, 0.0608% CTR, and average position 8.23.

CTR fell 61.5% even as average position improved. GSC query rows are dominated
by `la jolla surf report today`, `la jolla shores surf report today`, and close
variants, so the generic `surf window` title did not match the visible demand.
The next scoped test uses `La Jolla Surf Report Today: Tide, Wind & Swell` while
preserving the seasonal H1 and content contract. Measure the first complete
post-deployment 15-day window against this 0.0234% baseline before another edit.
