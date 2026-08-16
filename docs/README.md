# Documentation Index

This is the first stop for AI coding sessions and human contributors. Prefer the files below before opening older plans, reports, or archived implementation history.

## Use These First

- [`../AGENTS.md`](../AGENTS.md) - repo-wide model-neutral instructions, testing gates, migration safety, and current project gotchas.
- [`../CLAUDE.md`](../CLAUDE.md) - shared context for Claude, SOL, Fable, Codex, and other coding models.
- [`ARCHITECTURE.md`](ARCHITECTURE.md) - top-level architecture index and directory map.
- [`MIGRATION_SAFETY.md`](MIGRATION_SAFETY.md) - required process before database migrations or production mutations.
- [`ROUTING_PATTERNS.md`](ROUTING_PATTERNS.md) - canonical route and coverage behavior.
- [`COORDINATE_CONVENTIONS.md`](COORDINATE_CONVENTIONS.md) - coordinate naming rules and mapping pitfalls.
- [`../package.json`](../package.json) - authoritative scripts and dependency versions.
- [`../e2e/README.md`](../e2e/README.md) - Playwright conventions when browser coverage is relevant.

## Long-Running Goal / Spec Trackers

- [`../.planning/STATE.md`](../.planning/STATE.md) - current go-live campaign state; update after durable phase/slice progress.
- [`../.planning/ROADMAP.md`](../.planning/ROADMAP.md) - active go-live roadmap summary; use archive only for completed phase detail.
- [`../.planning/REQUIREMENTS.md`](../.planning/REQUIREMENTS.md) - current active requirements; completed launch requirements are archived.
- [`../.planning/PROJECT.md`](../.planning/PROJECT.md) - current campaign purpose, constraints, approval gates, and decisions.
- [`refactor-roadmap.md`](refactor-roadmap.md) - active controlled refactor tracker; update after each slice.
- [`../TODO.md`](../TODO.md) - small active follow-ups that do not yet deserve a phase plan.
- [`qa/calibration-test-plan.md`](qa/calibration-test-plan.md) - calibration honesty test tracker; update only when calibration work changes.
- [`seo/outreach-tracker.md`](seo/outreach-tracker.md) - SEO/outreach tracker; update when outreach state changes.

## Active Reference Docs

- [`API_MIDDLEWARE.md`](API_MIDDLEWARE.md) and [`API_MIDDLEWARE_REFERENCE.md`](API_MIDDLEWARE_REFERENCE.md) - API wrapper patterns and reference.
- [`SUPABASE_GUIDE.md`](SUPABASE_GUIDE.md) - database tables, access patterns, and Supabase usage.
- [`setup/SUPABASE_SETUP.md`](setup/SUPABASE_SETUP.md) - local snapshot bootstrap and Supabase setup.
- [`community-photos-runbook.md`](community-photos-runbook.md) and [`session-video-ugc-runbook.md`](session-video-ugc-runbook.md) - UGC media rollout, storage, moderation, and retention contracts.
- [`TEST_ARCHITECTURE.md`](TEST_ARCHITECTURE.md), [`guides/TESTING_GUIDE.md`](guides/TESTING_GUIDE.md), and [`quick-start/RUNNING_TESTS.md`](quick-start/RUNNING_TESTS.md) - local test strategy and commands.
- [`GIT_WORKFLOW.md`](GIT_WORKFLOW.md) - branch, main/prod, and release workflow.
- [`STYLE_GUIDE.md`](STYLE_GUIDE.md), [`BRAND_GUIDE.md`](BRAND_GUIDE.md), and [`DESIGN_PRINCIPLES.md`](DESIGN_PRINCIPLES.md) - product design and brand standards.
- [`DATA_FETCHING_GUIDE.md`](DATA_FETCHING_GUIDE.md) and [`DATA_FLOWS.md`](DATA_FLOWS.md) - data access and flow references.
- [`SCORING_LOGIC.md`](SCORING_LOGIC.md) - surf scoring behavior.
- [`COVERAGE_AREAS.md`](COVERAGE_AREAS.md) - human-readable coverage notes; code source of truth remains `lib/constants/coverage-areas.ts`.
- [`features/`](features/) - active feature references.
- [`api/`](api/) - API and server-action references.
- [`setup/`](setup/) - local/service setup references.
- [`security/`](security/) - security checklists and security-specific guidance.
- [`diagrams/README.md`](diagrams/README.md) - diagram index.

## Archived / Retired Docs

- [`archive/retired-2026-05-31/`](archive/retired-2026-05-31/) - retired March/Q1 strategy docs and completed implementation guides. Each file has a retirement header and replacement link.
- [`archive/history-2026-05-31/`](archive/history-2026-05-31/) - full pre-cleanup histories for compressed active trackers.
- [`../.planning/archive/2026-05-31-doc-cleanup/`](../.planning/archive/2026-05-31-doc-cleanup/) - full pre-cleanup `.planning` tracker histories.
- [`../.planning/archive/2026-08-07-shipped/MARKDOWN_INVENTORY.md`](../.planning/archive/2026-08-07-shipped/MARKDOWN_INVENTORY.md) - archived generated Markdown inventory snapshot.
- [`superpowers/plans/`](superpowers/plans/) and [`superpowers/specs/`](superpowers/specs/) - historical implementation plans/specs. Do not load by default; use only when investigating a specific completed slice.
- [`postmortems/`](postmortems/), [`investigations/`](investigations/), [`reports/`](reports/), [`analysis/`](analysis/), and [`market-intelligence/`](market-intelligence/) - historical context unless a task names one directly.
- [`../supabase/scratch/`](../supabase/scratch/) - migration scratch/history; use only when auditing a specific migration lineage.

## Needs Human Review

- [`reference/BUGS.md`](reference/BUGS.md) - may overlap with issue trackers and active TODOs.
- [`quiver_screen_state_planner.md`](quiver_screen_state_planner.md) - large planning artifact; unclear current owner.
- [`research/reddit_guidance.md`](research/reddit_guidance.md) - useful research, but long and dated.
- [`features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md`](features/PERSONALIZATION_FORECAST_IMPLEMENTATION.md) - very large implementation record; future cleanup should split current reference from history.
- [`architecture/ERROR_BOUNDARY_STRATEGY.md`](architecture/ERROR_BOUNDARY_STRATEGY.md) and [`architecture/ERROR_BOUNDARY_COMPONENTS.md`](architecture/ERROR_BOUNDARY_COMPONENTS.md) - large older specs; verify against current implementation before relying on details.

## Documentation Maintenance Rules

- New markdown files need a clear purpose, owner, and expected update trigger.
- Future AI-assisted tasks should update existing docs before creating duplicate planning docs.
- Long-running planning/spec files should be summarized after major milestones.
- Completed plans should be compressed into historical notes, with full history archived when needed.
- Delete superseded files once their durable history or replacement is confirmed; do not create local archive copies.
- When uncertain, classify a doc as `Unknown` or `Needs human review` instead of retiring it.
- Do not hand-edit generated references or scratch history unless the task is specifically about those files.
- Keep central indexes concise; link to detailed history instead of copying it into the index.

## Inventory Summary

Current tracked markdown snapshot after this cleanup:

- Active reference: framework docs, architecture docs, READMEs, setup guides, API/security/testing docs, and active feature references.
- Long-running tracker: `.planning/*`, `docs/refactor-roadmap.md`, `TODO.md`, `docs/qa/calibration-test-plan.md`, and outreach/SEO trackers.
- Historical/archive: dated plans/specs/reports, Supabase scratch notes, and retired PMF/acquisition docs.
- Unknown/needs human review: large older specs and research files listed above.

The generated Markdown inventory is archived with the shipped planning material; use `git ls-files '*.md'` for a current inventory.
