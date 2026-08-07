---
phase: 14
slug: session-intelligence-addendum
status: passed
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 14 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Jest 29, Playwright registration checks, ESLint flat config, `rg` source guards |
| Config files | `jest.config.js`, `playwright.config.ts`, `eslint.config.mjs`, `tsconfig.json` |
| Quick run command | `rg -n <required-string-pattern> <docs>` |
| Full gate command | `npx playwright test --list <targeted-specs>` plus scoped ESLint/source guards |
| Estimated runtime | Source guards under 10 seconds; Playwright list under 1 minute |

## Sampling Rate

- After every docs/inventory task: run the required `rg` source guard for that
  task's acceptance criteria.
- After route/test inventory is documented: run Playwright `--list` for the
  referenced E2E specs to catch syntax/registration drift.
- Before phase closeout: all inventory, structured-data, canonical, and
  app-link/analytics guards must be green, or failures must be recorded as
  unresolved blockers.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 14-01-01 | 14-01 | 1 | SI-01, SI-07 | T-14-01 | Guardrails prevent unsupported claims, canonical churn, and new ML scope creep. | source guard | `rg -n "Ahrefs|fixed crawl cap|GSC|Vercel|PostHog|canonical URLs are unchanged|new ML model|unsupported data-source claims" docs/session-intelligence/phase-14-template-inventory.md` | yes | passed |
| 14-01-02 | 14-01 | 1 | SI-01 | T-14-02 | Eligible templates are named with route/component entry points. | source guard | `rg -n "app/\\[intent\\]/\\[city\\]/page.tsx|app/\\[intent\\]/\\[city\\]/\\[beachSlug\\]/page.tsx|app/forecast/page.tsx|app/forecast-accuracy/page.tsx|app/best-time-to-surf/\\[city\\]/page.tsx" docs/session-intelligence/phase-14-template-inventory.md` | yes | passed |
| 14-02-01 | 14-02 | 2 | SI-01 | T-14-03 | Data availability is documented per template before recommendation UI can claim sources. | source guard | `rg -n "forecast horizon|tide|water-temp|buoy|cam|user reports|local spot intel|CTA|deep-link" docs/session-intelligence/phase-14-template-inventory.md` | yes | passed |
| 14-03-01 | 14-03 | 3 | SI-07 | T-14-04 | Structured-data sampling targets include tide, water-temp, US spot, and non-US/Baja spot pages. | source guard | `rg -n "TideDatasetSchema|WaterTempDatasetSchema|BeachPageStructuredData|WebPageSchema|ItemListSchema|non-US|Baja" docs/session-intelligence/phase-14-template-inventory.md` | yes | passed |
| 14-03-02 | 14-03 | 3 | SI-07 | T-14-05 | Slow template risks are profiled or explicitly avoided before heavier UI. | source guard | `rg -n "for-surf-schools|tide page|water-temp page|render time|forecast fetch|tide fetch|water-temp fetch|recommendation runtime" docs/session-intelligence/phase-14-template-inventory.md` | yes | passed |
| 14-04-01 | 14-04 | 4 | SI-07 | T-14-06 | Existing app-link and analytics contracts are inventoried before new deep links/events are planned. | source guard / E2E list | `npx playwright test --list e2e/push-deeplink-routing.spec.ts e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts` | yes | passed |

## Wave 0 Requirements

Existing infrastructure covers Phase 14 requirements:

- Jest is configured in `jest.config.js`.
- Playwright is configured in `playwright.config.ts`.
- Scoped ESLint is available through `npx eslint --max-warnings=0 <files>`.
- Source guards are available through `rg`.

No package install, migration, or production DB setup is required for Phase 14
planning work.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Structured Data Rich Results inspection | SI-07 | Google's Rich Results Test is external and not part of local CI. | Use the documented sample URLs after deployment or a reachable preview; record pass/fail and do not edit shared schemas one URL at a time. |
| Ahrefs/GSC/Vercel/PostHog confirmation | SI-01 | External tools and sampled crawl data are not available through local tests. | Treat Ahrefs as sampled; confirm any finding against at least one listed source before later implementation. |

## Validation Sign-Off

- All plans include automated verification commands or explicit manual-only
  rationale.
- Sampling continuity: no 3 consecutive tasks lack an automated source guard.
- Wave 0 covers all missing infrastructure references.
- No watch-mode flags.
- Feedback latency is under 60 seconds for source guards.
- `nyquist_compliant: true` is set in frontmatter.
- Final validation completed at 2026-06-02T00:27:27Z.
- No production mutations, deploys, schema changes, package installs, outbound
  sends, payment changes, or entitlement changes were run.

## Final Phase 14 Command Evidence

| Command | Result | Evidence |
|---------|--------|----------|
| `rg -n 'Ahrefs is sampled\|fixed crawl cap\|GSC\|Vercel\|PostHog\|canonical URLs are unchanged\|new ML model\|unsupported data-source claims\|does not add recommendation UI' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched guardrail lines for Ahrefs sampling, fixed crawl cap, confirmation sources, canonical preservation, no recommendation UI, no new ML model, and unsupported data-source claims. |
| `rg -n 'anonymous homepage\|authenticated home screen\|spot page\|regional forecast hub\|city/region page\|state intent page\|generic city intent page\|dedicated tide city page\|dedicated water-temp city page\|dawn-patrol\|sunset\|beginner page\|longboard page\|least-crowded page\|best-time page\|beach tide subpage\|beach water-temp subpage\|forecast-accuracy\|/for-surf-schools' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched all eligible template inventory entries. |
| `rg -n 'Data Availability Matrix\|Forecast horizon\|Water temp\|Buoy/source confidence\|User reports/intel\|Local spot intel\|CTA/deep-link support\|today/tomorrow\|168\|seasonal' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched data matrix heading, columns, and horizon terms. |
| `rg -n 'Source-Claim Rules\|buoy \\+ model\|model \\+ tide\|model only\|sparse data\|cam\|user report\|must be omitted\|water-temp\|tide utility pages\|full surf report' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched source-claim rules and missing-source behavior. |
| `rg -n 'Structured Data Sampling Checklist\|one tide page\|one water-temp page\|one US spot page\|one non-US/Baja spot page\|TideDatasetSchema\|WaterTempDatasetSchema\|BeachPageStructuredData\|WebPageSchema\|ItemListSchema\|BreadcrumbStructuredData\|shared helpers rather than one URL' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched structured-data samples and schema helpers. |
| `rg -n 'App Link And Analytics Checklist\|/auth/\\*\|/sessions/\\*\|/beach/\\*\|/profile/\\*\|/map\\*\|/invite/\\*\|/settings\\*\|assetlinks\|IOS_APP_STORE_URL\|/beach/\\{beach_slug\\}\|quiver://invite\|bug-quarantine\|AASA' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched AASA paths, assetlinks, App Store fallback, deeplink format, invite scheme, and quarantine note. |
| `rg -n 'Analytics\|page_view\|beach_view\|forecast_interaction\|cta_click\|ios_app_cta_click\|share_started\|share_completed\|horizon_strip_day_selected\|VALID_EVENTS\|database check constraints\|TypeScript event unions\|signup_cta_view\|signup_cta_click\|auth_modal_opened' docs/session-intelligence/phase-14-template-inventory.md` | PASS | Matched analytics reuse events and allowlist/type/DB guardrails. |
| `git diff -- app/layout.tsx lib/constants/seo.ts` | PASS | No output; frozen SEO/root metadata files were not changed. |
| `npx playwright test --list e2e/push-deeplink-routing.spec.ts e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts e2e/guest-intent-state-city-routes.spec.ts` | PASS | Exit 0; listed 78 tests in 5 files. |
| `git diff --check -- .planning/STATE.md .planning/REQUIREMENTS.md .planning/ROADMAP.md docs/session-intelligence/phase-14-template-inventory.md .planning/phases/14-session-intelligence-addendum/14-01-SUMMARY.md .planning/phases/14-session-intelligence-addendum/14-02-SUMMARY.md .planning/phases/14-session-intelligence-addendum/14-03-SUMMARY.md .planning/phases/14-session-intelligence-addendum/14-04-SUMMARY.md .planning/phases/14-session-intelligence-addendum/14-VALIDATION.md .planning/phases/14-session-intelligence-addendum/14-VERIFICATION.md` | PASS | No whitespace errors. |

**Approval:** passed
