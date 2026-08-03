# E2E Guidelines — Quiver Playwright

## Scope

This directory contains Quiver web Playwright tests. Follow the root `AGENTS.md` instructions first, then these stricter E2E rules.

## Relevant Context

- Before editing tests, inspect nearby specs and the relevant portions of `README.md`, `ARCHITECTURE.md`, `TEST_DEBT.md`, `playwright.config.ts`, helpers in `utils/`, and fixtures in `fixtures/`.
- Use available local specs, helpers, package scripts, and Playwright tooling. Optional skills, plugins, or integrations are not prerequisites.
- Identify the real user flow and existing coverage gap before adding tests. Do not add tests that only duplicate current coverage or prove that a page rendered.
- For non-trivial changes, review the approach for risky assumptions, missing setup, missing cleanup, weak assertions, and unnecessary production-code changes.

## Writing and Updating Tests

- Prefer stable user-facing selectors: roles, labels, visible names, and intentional `data-testid` values. Avoid brittle CSS, DOM depth, order-only selectors, and implementation details.
- Avoid arbitrary sleeps. Use explicit waits tied to UI state, app state, auth state, request/response state, or route readiness.
- Use `setupErrorDetection(page)` in `beforeEach` and `assertNoErrors(page, errorCapture)` in `afterEach` for browser specs unless a test has a documented reason not to.
- Negative API tests must assert the expected 400/401/403/404/405 status. Treat 500 as a product bug.
- Assertions must fail if the intended behavior is broken. Avoid weak assertions such as generic visibility when the test is meant to prove data, navigation, persistence, or permissions.
- Isolate test data. Use marked E2E data, existing cleanup helpers, and dedicated test accounts where possible. Do not leak auth state, rows, uploaded files, or local generated assets between runs.
- Keep mocks narrow. Do not mock away the behavior the E2E test is meant to prove.

## Running Tests

- Targeted local E2E: `npx playwright test e2e/path/to/spec.ts`.
- Cheap registration check for large touched sets: `npx playwright test --list <files...>`.
- Guest-only checks: `npx playwright test --project=guest`.
- Authenticated checks: `npx playwright test --project=auth`.
- Smoke checks: `yarn test:e2e:smoke` or `npx playwright test --grep @smoke`.
- Dev environment: `BASE_URL=https://dev.quiversurf.app npx playwright test <files...>` or the matching `yarn test:e2e:dev*` script.
- If localhost collides with another Next dev server, prefer `BASE_URL=https://dev.quiversurf.app` so the local `webServer` is skipped.
- Do not run parallel `yarn test:e2e:dev` commands; shared `e2e/.auth/state.json` can be corrupted.
- Do not run the full E2E suite by default. Run the smallest meaningful subset, then broaden only when the change or risk requires it.

## Failure Triage and Iteration

- Classify each failure as product bug, test bug, flaky timing issue, missing setup, or environment issue.
- Fix actionable failures and rerun the relevant E2E command.
- Review the diff like a PR for missing assertions, weak assertions, false positives, flaky waits/timeouts, race conditions, brittle selectors, test data leakage, environment assumptions, CI-only failures, untested behavior changes, unnecessary production-code changes, overbroad mocks, and tests that pass without proving behavior.
- Repeat review → fix → test while making progress, then report any unresolved findings with the exact failing commands.

## Final Response

- Report the E2E specs reviewed or changed, exact commands run with pass/fail status, unresolved findings, and remaining risks.
- If E2E tests were not run, state that clearly.
