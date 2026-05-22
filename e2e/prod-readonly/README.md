# Prod Read-Only Review Suite

This suite validates `https://www.quiversurf.app` without creating business data.

Scope:
- guest navigation and public read-only API checks
- authenticated rendering checks using the approved Playwright account
- serial production execution only

Guardrails:
- no form submissions
- no state toggles
- no seeding or cleanup flows
- no POST, PUT, PATCH, or DELETE coverage

Caveat:
- these tests still emit normal production telemetry such as page views and auth session activity

Auth behavior:
- the auth bootstrap may refresh `e2e/.auth/state.json` using the existing `.env.playwright` account
- if auth refresh fails during `PLAYWRIGHT_PROD_READONLY=true`, guest coverage still runs and auth specs are marked blocked via the shared auth-status marker

Commands:
- `yarn test:e2e:prod:readonly:list`
- `yarn test:e2e:prod:readonly:guest`
- `yarn test:e2e:prod:readonly:auth`
- `yarn test:e2e:prod:readonly`
