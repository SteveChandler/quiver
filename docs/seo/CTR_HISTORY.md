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

## 2026-09-02 `/learn` Batch

Source: the 2026-09-02 AEO citation audit's capture points, reconciled live
against GSC (page totals match `Brand-Vault/seo-audit/2026-08-31/GSC-EXPORT.json`
exactly; the page×query view is much smaller because Google anonymizes long-tail
queries, not because the totals are wrong). Baseline window: 2026-08-01 through
2026-08-28. Daily series for the two high-volume pages is flat (~20 and ~11
impressions/day across 45 days), so these are steady demand, not a spike.

The 2026-05-31 click-oriented pass rewrote three of these pages and had a full
three-month window; they stayed at 0–0.34% CTR. This batch is the second attempt
on those, and it changes the approach: match the phrasing GSC actually shows
rather than the phrasing we chose.

| Page | 28d imp | 28d clicks | CTR | Pos | What changed | Why |
| --- | ---: | ---: | ---: | ---: | --- | --- |
| `/learn/is-it-safe-to-surf-after-rain` | 592 | 2 | 0.34% | 9.7 | Title now covers "in the rain" and "after it rains"; description ≤155; new `surfing-while-raining` section. | 16-month named queries: "in the rain" 114 imp vs "after rain" 49 imp. Page had no during-rain content, so the title could not honestly cover the larger phrasing without it. Google was already rewriting our title to "After It Rains". |
| `/learn/how-are-waves-measured` | 311 | 0 | 0.00% | 7.5 | Title leads with "How Big Is 3 ft Surf?"; description cut from 306 to 150 chars. | Description was truncated mid-sentence in every SERP. Only 1.3% of impressions come from named queries; the named ones are all Hawaiian-scale-vs-face-height. |
| `/learn/how-are-ocean-waves-formed` | 625 | 0 | 0.00% | 41.0 | Title leads with "What Causes Ocean Waves?"; description cut from 366 to 154 chars. | Named queries are "what causes/creates waves in the ocean" (~120 imp) over "how are waves formed" (~48). **Position 41 is a ranking problem; the title alone will not move it to page one.** Measure position, not CTR. |
| `/learn/best-time-of-day-to-surf` | 97 | 0 | 0.00% | 10.0 | "Dawn Patrol vs Glass-Off" → "Why Morning Usually Wins". | Second attempt. Zero named queries; SERP winners answer in the title in plain language, ours used jargon. |
| `/learn/groundswell-vs-wind-swell` | 30 | 0 | 0.00% | 9.4 | Query wording first ("Wind Swell vs Groundswell"), period hook. | Second attempt. Only named query is `wind swell vs ground swell` at 15.8. |
| `/learn/beginner-breaks-santa-cruz` | 26 | 1 | 3.85% | 8.5 | Names the spots in the title; description cut from 303 to 151 chars. | Impressions jumped to 113 in the window ending 08-30. Named queries already matched the old title, so the change is the truncated description and the spot names. |
| `/learn/how-long-to-learn-to-surf` | 16 | 0 | 0.00% | 9.8 | "By Milestone" hook; description cut from 283 to 148 chars. | Old description gave the entire timeline in the snippet — nothing left to click for. |

Left alone, deliberately:

- `/learn/how-does-water-temperature-affect-surfing` — 40 imp, 1 click, 6.8 (58/1 in the newer window). 1.7–2.5% is normal for that position; rewriting a working page with no evidence of a problem is how the La Jolla test lost 61.5%.
- `/learn/how-quiver-calibrates-your-beach` — 6 impressions; nothing to measure. Its `machine learning surf forecast` keyword was removed because Quiver ships no live ML forecast.

### Measurement

- Measurable: `is-it-safe-to-surf-after-rain` (CTR), `how-are-waves-measured` (CTR), `how-are-ocean-waves-formed` (position). The other four are under 100 impressions/28d and cannot show a significant move; do not read a change on them as a result.
- Hold: first complete 28-day GSC window after the deploy, evaluated against `dateRanges.last28d.end`. Watchlist entries set `monitorUntil` 2026-10-10; extend it if the deploy lands after 2026-09-08.
- Compare against the 08-01→08-28 baselines above, not against the export current at the time of reading.
- A CTR gain on `is-it-safe` with a position loss on the old "after rain" queries is a mixed result, not a win; check query ownership, not just the page total.

## 2026-09-09 Water-temp, La Jolla, and Cam Corrections

Source: `docs/seo/reports/aeo-citation-tracking/2026-09-09.md`, plus a
read-only SERP inspection on 2026-09-09. The 2026-09-02 water-temp benchmark
was not a reusable entity-matching effect.

| Group | Pages | Impressions | Clicks | CTR | Avg position |
| --- | ---: | ---: | ---: | ---: | ---: |
| Page names the same place the query names | 22 | 17,898 | 275 | 1.54% | 6.5 |
| Page names a different beach than the query | 112 | 25,076 | 186 | 0.74% | 7.9 |
| Entity-matched, excluding Kill Devil Hills | 21 | 15,372 | 90 | 0.59% | — |

The page-level gap is 2.1x, not 8.1x. Removing Kill Devil Hills reverses the
result: entity-matched pages convert worse than mismatched pages. The 12.78%
benchmark was Kill Devil Hills alone, so the 2026-09-02 action to add
entity-matched titles on Santa Monica, Santa Cruz, Encinitas, Ogunquit, and
Ocean City NJ is **withdrawn**. Do not spend a title rewrite on this mechanism.

### Kill Devil Hills investigation

Among water-temp pages at position ≤ 6.0 with ≥ 300 impressions:

| Page | Impressions | Clicks | CTR | Position |
| --- | ---: | ---: | ---: | ---: |
| `/nc/kill-devil-hills/…/water-temp` | 2,526 | 185 | 7.32% | 4.8 |
| `/water-temp/sea-isle-city` | 2,727 | 63 | 2.31% | 4.7 |
| `/ny/shirley/smith-point-county-park…/water-temp` | 529 | 9 | 1.70% | 4.8 |
| `/water-temp/santa-cruz` | 6,395 | 80 | 1.25% | 5.0 |
| `/me/ogunquit/ogunquit-beach-ogunquit-me/water-temp` | 4,264 | 39 | 0.91% | 5.5 |

The read-only SERP check found no obvious naming mechanism to transfer:
Kill Devil Hills and Ogunquit both return beach-level water-temperature
results with the city and state in the rendered page, while Sea Isle City also
has a city-level water-temperature result covering its two beach pages. The
next useful investigation is query-level GSC comparison and SERP intent, not a
bulk title edit.

### La Jolla report owner

`/surf-report/la-jolla-today` already exists in `lib/seo/funnel-pages.ts` as
the indexable owner for the `la jolla surf report today` demand. Keep this as a
one-page test: size expectations against `/surf-report/malibu-today` at 0.34%
(630 impressions across the comparison family), not a broader family norm.
The 2026-08-05 La Jolla title test lost 61.5% CTR. Measure the first complete
28-day post-deployment window and do not scale to Santa Cruz, Cocoa Beach, or
Pacifica before that read.

### Cam route consolidation

Regional cam pages now use `/surf-cams/*` as the canonical family. `/cams/*`
is a permanent legacy redirect to the matching `/surf-cams/*` route; `/cams`
remains the hub. This is route consolidation only and adds no regional content.
