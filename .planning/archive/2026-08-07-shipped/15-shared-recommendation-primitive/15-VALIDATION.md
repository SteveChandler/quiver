---
phase: 15
slug: shared-recommendation-primitive
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-06-01
---

# Phase 15 - Validation Strategy

## Test Infrastructure

| Property | Value |
|----------|-------|
| Framework | Jest 29, TypeScript, scoped ESLint, `rg` source guards |
| Config files | `jest.config.js`, `eslint.config.mjs`, `tsconfig.json` |
| Quick run command | `yarn test:unit <targeted-tests> --runInBand` |
| Full local gate | targeted Jest, scoped ESLint, `yarn typecheck`, source guards |
| Estimated runtime | Targeted tests under 2 minutes; typecheck varies by repo state |

## Sampling Rate

- After every implementation plan: run the targeted Jest file for the touched
  helper or selector.
- After selector changes: run the existing
  `__tests__/lib/services/discovery/window-selector.test.ts` compatibility
  suite.
- After final helper/link integration: run all Phase 15 targeted Jest tests,
  scoped ESLint, `yarn typecheck`, and source guards.
- No E2E is required unless an executor adds UI, routing, metadata, schema, or
  browser behavior despite the Phase 15 boundary.

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 15-01-01 | 15-01 | 1 | SI-02 | T-15-01 | Shared model vocabulary is explicit and typed before helper logic depends on it. | Jest / typecheck | `yarn test:unit __tests__/types/session-intelligence.test.ts --runInBand` | planned | planned |
| 15-02-01 | 15-02 | 2 | SI-02 | T-15-02 | Top-window selection reuses deterministic v1 scoring and preserves `selectBestWindow`. | Jest | `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts --runInBand` | yes | planned |
| 15-02-02 | 15-02 | 2 | SI-02 | T-15-03 | Selector horizon-hours filtering and injected `now` behavior are deterministic. | Jest | `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts --runInBand` | yes | planned |
| 15-03-01 | 15-03 | 3 | SI-02 | T-15-04 | Beach and region helpers return top 3 ranked recommendations or an explicit empty state. | Jest | `yarn test:unit __tests__/lib/recommendations/surf-window-recommendations.test.ts --runInBand` | planned | planned |
| 15-03-03 | 15-03 | 3 | SI-02 | T-15-04 | 14-day vs 7-day horizon behavior is deterministic over supplied rows. | Jest | `yarn test:unit __tests__/lib/recommendations/surf-window-recommendations.test.ts --runInBand` | planned | planned |
| 15-03-02 | 15-03 | 3 | SI-02, SI-07 | T-15-05 | Sparse rows, low confidence, and no recommendation cases do not throw or overstate certainty. | Jest | `yarn test:unit __tests__/lib/recommendations/surf-window-recommendations.test.ts --runInBand` | planned | planned |
| 15-04-01 | 15-04 | 4 | SI-07 | T-15-06 | Missing tide, buoy, cam, and user-report data are not displayed as available sources. | Jest | `yarn test:unit __tests__/lib/recommendations/surf-window-links.test.ts --runInBand` | planned | planned |
| 15-04-02 | 15-04 | 4 | SI-07 | T-15-07 | App-compatible link, universal link, and canonical web URL are generated without canonical churn. | Jest / source guard | `git diff -- app/layout.tsx lib/constants/seo.ts` | yes | planned |

## Wave 0 Requirements

Existing infrastructure covers Phase 15 requirements:

- Jest is configured in `jest.config.js`.
- TypeScript is configured in `tsconfig.json`.
- Scoped ESLint is available through
  `npx eslint --max-warnings=0 <files>`.
- Source guards are available through `rg`.
- No Playwright/browser infrastructure is needed for this no-UI phase.

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Native app exact window routing | SI-07 | Phase 15 only creates data/link strings; native app routing is Phase 20 scope. | Record generated `/beach/{slug}?window=...` as app-compatible web path. Do not claim native exact-window routing until Phase 20 validates it. |
| Production forecast horizon availability | SI-02 | Phase 15 consumes supplied rows and does not change production queries. | Later integration phases must verify whether each surface supplies 7-day or 14-day rows before rendering the helper output. |

## Final Phase 15 Gate

Run these before marking Phase 15 implementation complete:

```bash
yarn test:unit __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts --runInBand
npx eslint --max-warnings=0 types/session-intelligence.ts lib/services/discovery/window-selector/types.ts lib/services/discovery/window-selector/window-selector-core.ts lib/services/discovery/window-selector/window-scorer.ts lib/services/discovery/window-selector/index.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/surf-window-source-flags.ts lib/recommendations/surf-window-links.ts __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts
yarn typecheck
! rg -n "createSupabase|\\.from\\(|OpenAI|Claude|LLM|fetch\\(" types/session-intelligence.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/surf-window-source-flags.ts lib/recommendations/surf-window-links.ts
git diff -- app/layout.tsx lib/constants/seo.ts
```

The negated `rg` command should produce no matches. The expected design has no
new ML, no paid API, and no database fetches in the shared helper.

## Validation Sign-Off Criteria

- `nyquist_compliant: true` is set in frontmatter.
- Each plan has at least one automated verification command.
- Targeted tests cover normal scoring, no tide data, no buoy data, sparse rows,
  only 7-day horizon, 14-day horizon, low confidence, no recommendation, source
  flags, and link generation.
- No production mutations, deploys, schema changes, package installs, outbound
  sends, payment changes, or entitlement changes are part of this phase.
- No E2E is required unless the implementation changes browser behavior.
