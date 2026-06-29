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
