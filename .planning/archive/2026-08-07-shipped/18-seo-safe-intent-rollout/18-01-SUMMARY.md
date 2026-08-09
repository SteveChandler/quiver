# 18-01 Summary: Rollout Guards And Eligibility Policy

Status: Complete

## Delivered

- Added `lib/recommendations/session-intelligence-rollout.ts` with a pure Phase 18 rollout policy.
- Added exact allowlists for selected water-temp city pages, water-temp beach utility pages, Malibu Surfrider, the Phase 17 Blacks pilot spot, and the three best-time city pages.
- Classified SEO-facing surfaces by full-window eligibility, handoff-only behavior, public-answer requirements, and source hints.
- Added `__tests__/lib/recommendations/session-intelligence-rollout.test.ts`.
- Added `docs/session-intelligence/phase-18-seo-rollout-guardrails.md` with Phase 17 evidence, Phase 18 allowlists, public-answer rules, source-claim limits, canonical/schema rules, and measurement fields.

## Verification

- `yarn test:unit __tests__/lib/recommendations/session-intelligence-rollout.test.ts --runInBand` passed.
- `rg -n "waterTempCityPaths|waterTempBeachPaths|spotPaths|bestTimeCityPaths|basicAnswerPublic|handoffOnly|BestSurfWindows" lib/recommendations/session-intelligence-rollout.ts` passed.
- `rg -n "Phase 17|allowlist|water-temp|public answer|canonical|source claim|GSC|PostHog|Malibu" docs/session-intelligence/phase-18-seo-rollout-guardrails.md` passed.
- `npx eslint --max-warnings=0 lib/recommendations/session-intelligence-rollout.ts __tests__/lib/recommendations/session-intelligence-rollout.test.ts` passed.

## Deviations

- Included `/ca/san-diego/blacks` in the spot allowlist so the Phase 17 pilot spot remains explicit rather than becoming an accidental broad rollout.

## Self-Check

PASSED
