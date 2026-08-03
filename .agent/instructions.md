# Quiver AI Model Instructions

This file is a compatibility entry point for AI coding environments. The canonical repository guidance is in [`../AGENTS.md`](../AGENTS.md), with product and design context in [`../CLAUDE.md`](../CLAUDE.md).

## Working Style

- Work directly unless optional delegation is genuinely useful and supported by the current runtime.
- Do not require a named agent, orchestrator, MCP server, skill, or model-specific command.
- Inspect the affected code and nearest relevant `ARCHITECTURE.md`, make focused changes, run proportionate checks, and review the final diff.
- Preserve existing user changes and do not commit unless asked.
- Never expose secrets or mutate production data without the repository's approval protocol.

## Model Choice

- Use the least expensive model that can complete the task reliably, unless the user requests a specific model.
- Reserve stronger models for high-risk or genuinely difficult reasoning; downgrade after that reasoning is complete.
- Avoid duplicated agent work and repeated context. Prefer local search, scripts, and deterministic checks.

## Quiver Essentials

- Web: Next.js 16, React 19, TypeScript, Tailwind, Radix UI, Supabase, Jest, and Playwright.
- Native: separate Expo/React Native repository at `../quiver-native`; mobile-consumed API contracts must remain additive.
- Use `useDataFetcher` for the established client-fetching pattern, `withAuthenticatedAction` for protected server actions, and `withAuth` for authenticated API routes.
- Beach coordinates are `lat`/`lon`; `beach.latitude` and new `lng` fields are invalid.
- Use `forecast_at`, not `forecast_date` plus `forecast_time`.
- Keep authenticated users out of pre-auth analytics funnels and independently auth-guard anonymous CTAs.
- Follow `docs/MIGRATION_SAFETY.md` for migrations and production database work.

## Key Locations

- `docs/ARCHITECTURE.md` — architecture index
- `docs/README.md` — documentation index
- `app/` — App Router pages and API routes
- `components/` — shared UI
- `lib/` — business logic and services
- `__tests__/` — Jest tests
- `e2e/` — Playwright tests
