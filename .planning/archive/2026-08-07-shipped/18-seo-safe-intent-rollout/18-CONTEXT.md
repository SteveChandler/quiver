# Phase 18: SEO-Safe Intent Rollout - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

Roll out Session Intelligence only after the pilot is validated. This phase
adds surfer decision value to existing intent pages without chasing keywords,
mass-changing metadata, creating duplicate thin pages, or changing canonical
URLs.
</domain>

<rollout_surfaces>
## Rollout Surfaces

- Longboard pages.
- Beginner pages.
- Dawn patrol pages.
- Sunset session pages.
- Tide-window pages.
- Less-crowded pages.
- City best-time pages.
- Selected water-temp pages.
- Selected tide pages.
- Selected high-impression spot pages.
</rollout_surfaces>

<allowlists>
## Starter Allowlists

Water-temp:

- `/water-temp/huntington-beach`
- `/water-temp/santa-cruz`
- `/water-temp/santa-monica`
- `/water-temp/kailua-kona`
- `/ca/del-mar/del-mar/water-temp`
- `/nj/long-branch/long-branch-long-branch-nj/water-temp`

Spot enrichment:

- `/ca/malibu/malibu-surfrider-first-point-malibu-ca`

Best-time intent split:

- `/best-time-to-surf/la-jolla`
- `/best-time-to-surf/westport`
- `/best-time-to-surf/cocoa-beach`
</allowlists>

<rules>
## Rules

- Use `BestSurfWindows` only where it directly satisfies page intent.
- Keep useful basic answers visible without sign-in.
- Gate alerts or personalization if needed, not the basic answer.
- Preserve each page's primary intent.
- Do not retarget water-temp pages as surf-report pages or stuff surf-report
  keywords into water-temp titles.
- Enrich templated pages with local conditions, spot behavior, best windows, and
  contextual links.
- Do not cannibalize `/surf-report/malibu-today` with Malibu spot enrichment.
</rules>

<validation>
## Default Validation

- Before/after GSC CTR, average position, impressions, and multi-page behavior
  where data is available.
- Targeted E2E for selected rollout templates.
- Schema and canonical checks on sampled pages.
- Internal-link checks for spot/tide/water-temp/forecast paths.
- Scoped ESLint and `yarn typecheck` for touched files.
</validation>

---

*Phase: 18-SEO-Safe Intent Rollout*
*Context gathered: 2026-06-01*
