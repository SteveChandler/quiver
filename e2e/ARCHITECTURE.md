# Quiver E2E Test Architecture

## Overview
- Playwright drives end-to-end coverage for critical journeys (guest flows, authenticated sessions, intel dashboards, etc.).
- Specs live alongside shared helpers under `e2e/`, mirroring product surface areas for quick discoverability.
- Tests run in two projects:
  - `guest`: unauthenticated journeys (`e2e/guest-*.spec.ts`)
  - `auth`: authenticated coverage using `e2e/.auth/state.json`

## Required Artifacts & Env
- `e2e/global-setup.ts` generates the signed-in storage state at `e2e/.auth/state.json`. Ensure `E2E_USER_EMAIL` and `E2E_USER_PASSWORD` (or the `TEST_USER_*` equivalents) are populated before running tests.
- When targeting protected deployments, supply `VERCEL_BYPASS_TOKEN` (or automation variants) so the setup script can set the bypass cookie.
- Cursor MCP agents pick up the storage state automatically through `PLAYWRIGHT_STORAGE_STATE=e2e/.auth/state.json`.

## Execution Patterns
- Local parity command: `npx playwright test`. Use `npm run test:e2e -- --project=guest` for scoped runs.
- Respect the timeouts defined in `playwright.config.ts` (120s per test). Avoid adding arbitrary `waitForTimeout` calls; prefer role-based locators and expect conditions.
- Mobile-first specs (`home-first-time-mobile.spec.ts`, etc.) use device emulation—keep breakpoints aligned with `styles/ARCHITECTURE.md`.
- Store any diagnostics under `e2e/.auth/` or `e2e/screenshots/` per existing conventions.

## MCP Usage Notes
- From Cursor, ask: “Run the guest smoke suite” or “Open trace for auth.spec.ts on failure.” The agent will route through the Playwright MCP server using the pre-generated auth state.
- If tests fail due to stale auth, rerun the global setup (`npx playwright test --global-setup e2e/global-setup.ts`) or execute `npm run test:setup` if defined.
- Use traces (`trace: "on-first-retry"`) for debugging; open them with `npx playwright show-trace <file>` or via MCP.

## Extensibility Guidelines
- Co-locate helpers under `e2e/utils/` and import them via relative paths. Keep cross-cutting utilities documented in `e2e/utils/README.md` if created.
- Prefer data factories or API seed helpers over hard-coded fixture IDs to minimise flakiness.
- Document any new suites or patterns here so Cursor agents and human collaborators stay aligned.
