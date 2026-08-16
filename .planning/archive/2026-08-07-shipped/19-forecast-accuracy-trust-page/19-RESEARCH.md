# Phase 19: Forecast Accuracy Trust Page - Research

**Researched:** 2026-06-02
**Domain:** Next.js App Router trust page, Supabase ML accuracy metrics, public SEO proof surface
**Confidence:** HIGH

<user_constraints>
## User Constraints

### Locked Decisions
- `/forecast-accuracy` must never appear empty.
- Do not claim Quiver is more accurate unless live, validated metrics support that claim.
- If metrics are not ready, render graceful building/in-progress rows.
- Show beach, Quiver MAE, NOAA baseline MAE, improvement percentage, validated-pair count, last updated, and confidence when live metrics exist.
- Confidence/source language must match the Session Intelligence recommendation UI: `High`, `Medium`, `Low`, `Model only`, and `sparse data`.
- Use Brand-Vault styling and mirrored sticker-sheet assets from `public/images/quiver-stickers` where Phase 19 adds or revises visual treatment.
- No new ML model, production mutation, deploy, alias promotion, outbound send, payment, or entitlement change without explicit approval.

### the agent's Discretion
- Exact report view-model shape, provided it is typed, tested, and derived from existing accuracy tables.
- Exact component extraction boundaries inside `components/forecast-accuracy/`.
- Whether to reuse `SourceConfidenceBadge` directly or mirror its wording/tone in an accuracy-specific badge.

### Deferred Ideas
- Dedicated backlink/outreach execution from `docs/seo/DOMAIN_AUTHORITY_PLAYBOOK.md`.
- Native app-link route expansion, which remains Phase 20 scope.
- Schema/database migrations unless execution proves existing sources cannot satisfy the page.
</user_constraints>

<architectural_responsibility_map>
## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
| --- | --- | --- | --- |
| Accuracy metric reads | Server Actions | Supabase | Existing page reads `beach_ml_performance_baseline` and `ml_predictions_log` through service-role actions. |
| Claim and fallback policy | Server Actions | UI Components | Claim gating should happen before rendering so components receive honest display states. |
| Public trust page rendering | App Router page | Forecast-accuracy components | `/forecast-accuracy` is an SEO-facing server page with client chart/table islands. |
| Confidence/source wording | Forecast-accuracy components | Session Intelligence UI | The visible wording must match `SourceConfidenceBadge` semantics without importing unrelated surf-window behavior into data access. |
| Browser validation | Playwright guest E2E | In-app browser | This is a public page; guest mobile/desktop checks prove it is visible, non-empty, and not horizontally broken. |
</architectural_responsibility_map>

<research_summary>
## Summary

The current `/forecast-accuracy` page already exists and has useful component scaffolding, but it treats the data-present and building states as separate page shapes. The hero and chart sections claim "better than NOAA" only when `hasEnoughData` is true, yet the metadata, FAQ, and methodology still contain broad phrasing such as "100+ beaches" and "Quiver reduces wave height error" that can be misleading when the live sample is empty, sparse, stale, or negative.

The existing data sources are enough for Phase 19:
- `beach_ml_performance_baseline` exposes per-beach rolling 14-day metrics, predictions matched, last prediction time, raw MAE, corrected MAE, and improvement percentage.
- `ml_predictions_log` exposes daily raw/corrected errors for time-series summaries.
- Generated database types include both sources, so no schema generation or migration is required for a first pass.

The safest execution path is to add a typed accuracy report view model in `actions/ml/forecast-accuracy-actions.ts`, with a central `canClaimImprovement`/status policy. UI then renders from that report: data-backed rows when available and "building" rows otherwise. This avoids broad rewrites and lets tests prove the page never silently falls back to an empty surface or unsupported accuracy language.

**Primary recommendation:** ship Phase 19 as four plans: report/claim policy, visible trust-page UI, methodology/SEO copy cleanup, and final guest E2E QA.
</research_summary>

<standard_stack>
## Standard Stack

| Library or Tool | Purpose | Why Standard |
| --- | --- | --- |
| Next.js App Router | Public route rendering and metadata | Existing route owner for `/forecast-accuracy`. |
| React 19 + TypeScript | Server/client components and typed props | Existing app stack. |
| Supabase service-role client | Read accuracy metrics from existing ML tables/views | Existing `forecast-accuracy-actions.ts` pattern. |
| Jest + Testing Library | Server-action policy and component regression tests | Existing unit stack. |
| Playwright guest project | Public browser validation | Existing E2E pattern for SEO-facing pages. |
| `QuiverSticker` | Brand-Vault sticker asset rendering | Existing web mirror for `public/images/quiver-stickers`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
| --- | --- | --- |
| New database view | Existing view + report view model | Avoids migration risk and production approval gates. |
| Full redesign | Preserve existing components with new report state | Keeps scope bounded to trust and fallback behavior. |
| Static fake beach rows | Honest building rows | Avoids inventing beach-level metrics when live data is missing. |
| New analytics events | Browser/page checks only | Phase 19 does not need event allowlist churn. |
</standard_stack>

<architecture_patterns>
## Architecture Patterns

### Existing Data Flow

`ForecastAccuracyPage` calls four server actions in parallel:
`getOverallAccuracyStats()`, `getRegionalAccuracy()`, `getTopBeaches()`, and `getDailyAccuracyTimeSeries()`.

### Target Data Flow

`ForecastAccuracyPage` calls a single report action:
`getForecastAccuracyReport()` -> typed summary, rows, chart data, source/confidence state, fallback rows, and claim eligibility -> components render the same page sections for data-present and data-building states.

### Source of Truth

| Source | Use |
| --- | --- |
| `beach_ml_performance_baseline` | Beach rows, raw/Quiver MAE, improvement percentage, matched-pair count, last prediction timestamp, rolling period. |
| `ml_predictions_log` | Daily error time series over the current 30-day sample. |
| Session Intelligence source wording | Visible confidence labels: high/medium/low, model only, sparse data. |
| `public/images/quiver-stickers` | Visual treatment for refreshed hero/status/methodology assets. |

### Anti-Patterns to Avoid

- Claiming "better than NOAA" when `correctedMae >= rawMae`, matched count is below threshold, or live metrics are missing.
- Treating a service-role/env failure as a blank page.
- Showing beach-level values for fake fallback rows.
- Hardcoding "100+ beaches" unless the report's live `beachCount` supports it.
- Adding Supabase mutations or schema changes to solve a display problem.
- Adding decorative SVGs where mirrored Brand-Vault sticker assets already exist.
</architecture_patterns>

<common_pitfalls>
## Common Pitfalls

### Positive-Lift Assumption
**What goes wrong:** The page formats a negative or zero `mae_improvement_pct` as an accuracy win.
**How to avoid:** Centralize claim gating and assert no "better" copy appears when lift is not positive.

### Sparse Data Hidden Behind Thresholds
**What goes wrong:** The page hides most sections when fewer than five beaches qualify, making the trust page look unfinished.
**How to avoid:** Render the same page skeleton with building rows, methodology, source notes, and last-update status.

### Metadata Drift
**What goes wrong:** On-page copy is guarded but metadata/FAQ still claims live data across broad beach counts.
**How to avoid:** Audit `generateMetadata()`, `WebPageSchema`, `AccuracyFaq`, and `MethodologySection` in the same phase.

### Source-Language Drift
**What goes wrong:** Accuracy badges use wording that conflicts with Session Intelligence confidence badges.
**How to avoid:** Reuse or mirror the `SourceConfidenceBadge` label semantics and test the resulting text.
</common_pitfalls>

<validation_strategy>
## Validation Strategy

- Jest server-action tests for metrics-present, no-client/no-data fallback, sparse rows, stale/missing last updated, and non-positive improvement.
- Component tests for data-backed rows, building rows, confidence/source labels, and absence of unbacked "better" claims.
- Guest Playwright test for `/forecast-accuracy` on mobile and desktop with error detection, no horizontal overflow, visible main content, and data-present-or-building state detection.
- Scoped ESLint for touched production/test files.
- `yarn typecheck` because this touches typed action/component contracts.
- Browser/manual check against the local page once implementation is complete.
</validation_strategy>

## RESEARCH COMPLETE
