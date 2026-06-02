# Phase 18 SEO Rollout Guardrails

Owner: Quiver Web
Created: 2026-06-02
Update trigger: Before adding Session Intelligence to any SEO-facing template
outside the Phase 18 allowlist.

## Purpose

Phase 18 adds surfer decision value to selected intent, utility, best-time, and
spot pages. It is not a broad SEO rewrite. This document records the rollout
allowlist, public-answer policy, source-claim limits, and measurement evidence
needed before claiming that the rollout improved search behavior.

## Evidence Gate

Phase 18 is allowed to start because Phase 17 produced a limited pilot on spot,
regional forecast, and authenticated homepage surfaces.

Phase 17 focused checks passed:

- Guest responsive pilot coverage across 360, 390, 412, 768, and 1280 widths.
- Guest Session Intelligence component and spot pilot Playwright coverage.
- Focused authenticated homepage module coverage.
- Focused authenticated forecast-hub best-windows coverage.
- Unit coverage for adapters, spot pilot, regional pilot, homepage module, and
  forecast-hub summary integration.

Phase 17 local caveat:

- The full auth bundle
  `npx playwright test e2e/forecast-hub.spec.ts e2e/home.spec.ts --project=auth`
  remained locally unstable under 3 workers because broad page loads and
  forecast fetches timed out under parallel load. Focused Phase 17 assertions
  passed. Treat this as a local suite-stability caveat, not evidence that the
  Phase 17 pilot failed.

## Phase 18 Allowlist

Water-temp city pages:

- `/water-temp/huntington-beach`
- `/water-temp/santa-cruz`
- `/water-temp/santa-monica`
- `/water-temp/kailua-kona`

Water-temp beach utility pages:

- `/ca/del-mar/del-mar/water-temp`
- `/nj/long-branch/long-branch-long-branch-nj/water-temp`

Best-time city pages:

- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/westport`
- `/best-time-to-surf/cocoa-beach`

Spot enrichment:

- `/ca/malibu/malibu-surfrider-first-point-malibu-ca`
- `/ca/san-diego/blacks` remains an explicitly allowed Phase 17 pilot spot.

## Public Answer Rules

- Basic useful answers must remain visible without sign-in.
- Generic intent and beginner pages must not blur the basic surf-window or
  session-planning answer.
- Alerts, saved windows, personalization, and account-specific preferences may
  remain gated.
- Public modules must preserve existing app CTAs and should not fire pre-auth
  funnel events for authenticated users.

## Water-Temp Rules

Water-temp pages are handoff-only in Phase 18.

Allowed:

- Wetsuit and gear decision copy.
- Links to live city spots, tide pages, best-time pages, forecast pages, and
  exact beach pages.
- Contextual copy that says water temperature is one input into the surf call.

Not allowed:

- Retargeting the H1/title/meta copy as a surf-report page.
- Rendering full `BestSurfWindows` cards as the primary page module.
- Claiming live surf-report source support unless the page fetches that data.

## Source Claim Rules

- Do not display buoy, cam, tide, user-report, or local-intel claims unless the
  page fetches and passes that source.
- Handoff-only surfaces should avoid source-confidence badges entirely.
- Full surf-window surfaces must continue using the shared source helpers from
  `lib/recommendations/surf-window-source-flags.ts`.
- Missing optional data must create notes or watchouts, not false positive
  source labels.

## Canonical And Schema Rules

- Do not change canonical URLs.
- Do not add duplicate thin pages.
- Do not change water-temp pages into surf-report pages.
- Do not cannibalize `/surf-report/malibu-today` when enriching Malibu
  Surfrider First Point.
- Sampled pages must retain JSON-LD script presence and existing schema intent.

## Measurement Fields

Before and after comparisons must include exact date windows and route lists.

GSC fields:

- CTR.
- Average position.
- Impressions.
- Clicks.

Behavior fields from PostHog or existing analytics:

- Entrances on allowlisted pages.
- Multi-page continuation rate.
- Clicks to spot, tide, water-temp, forecast, best-time, and app/window links.
- Exit rate from allowlisted pages where available.

Cannibalization checks:

- Compare `/ca/malibu/malibu-surfrider-first-point-malibu-ca` with
  `/surf-report/malibu-today`.
- Check whether sister pages lose impressions or clicks after rollout.
- Do not claim SEO lift until dated before/after data supports it.
