---
name: seo-audit
description: Audit or diagnose Quiver SEO, indexing, metadata, internal links, Core Web Vitals, content quality, or AEO citation readiness. Use for explicit SEO health checks and ranking/indexation investigations; use the narrower repository scripts instead for routine scheduled reporting.
---

# Quiver SEO Audit

Produce an evidence-backed, review-only audit. Do not publish content, mutate production data, send outreach, apply migrations, commit, or push unless the user explicitly requests that separate action.

## Context

Read only what the requested scope needs:

- `.claude/product-marketing-context.md` for positioning and audience
- `docs/seo/SEO_AGENT_WORKFLOW.md` for current commands and approval boundaries
- `docs/seo/seo-dashboard.json` for active queues, not as proof of runtime behavior
- `lib/seo/gsc-performance-protection.ts` and `lib/seo/gsc-performance-protection.v1.json` before recommending changes to protected pages
- Relevant route, metadata, sitemap, robots, schema, and test files

Treat dated reports and memory as leads. Verify claims against current code, current exports, or authoritative live sources.

## Efficient Workflow

1. Define the audit surface: technical SEO, indexation, on-page, content, AEO, or a named route/query.
2. Reuse existing exports and reports before fetching new data.
3. Run only the smallest deterministic command that answers the question:
   - `yarn seo:technical-audit` for crawl and technical checks
   - `yarn seo:gsc-refresh --input <export>` for supplied GSC data
   - `yarn seo:export:vercel` or `yarn seo:export:posthog` only when those signals are required
   - `yarn seo:recommend --input <artifact...>` to synthesize existing evidence
4. Check current route ownership and tests before proposing new pages, metadata, or schema.
5. Protect pages with proven search performance. Do not recommend destructive URL, canonical, robots, sitemap, or metadata changes without route-level evidence.
6. Distinguish observed facts, inferences, and unavailable evidence.

Do not run every SEO command by default. Avoid paid APIs, broad crawls, and external model calls unless they materially improve the requested audit.

## Quiver Guardrails

- The code source of truth outranks dashboards and historical reports.
- GSC is the indexing and query source of truth when a current export is available.
- Vercel and PostHog describe traffic and behavior; they do not prove ranking causality.
- Preserve coverage for supported coastal regions and canonical route families.
- Keep content factual, surfer-useful, and consistent with Quiver's zine design and product voice.
- Cite surf and ocean claims with current authoritative sources such as NOAA, NWS, NDBC, CDIP, `.gov`, or `.edu`.
- Never fabricate rankings, traffic, backlinks, citations, competitor claims, or performance measurements.

## Output

Lead with the highest-impact findings. For each finding include:

- Priority: Critical, High, Medium, or Low
- Evidence: file, command output, export, or authoritative URL
- Impact: affected route, query, or user flow
- Recommendation: smallest safe change
- Verification: exact check that would prove the fix

End with coverage gaps, actions requiring approval, and the next smallest useful check. If evidence is insufficient, say so instead of filling the gap with generic SEO advice.
