### Changed

- Discover page `View Profile` now opens in-app `UserProfileModal` instead of a new tab, following `components/ARCHITECTURE.md` social modal patterns for a smoother, accessible UX.

# Quiver Surf App - Changelog

All notable changes to the Quiver surf app are documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Playwright E2E `e2e/profile-edit.spec.ts` covering profile edit flow (name, location, home beach via `BeachSelector`) and asserting `home-break-value` updates

- Centralized data gateway expanded at `lib/data/client.ts`: `beaches.getAll()`, `sessions.likes.getStatus/toggle`, `sessions.comments.listTopLevel/create/delete`, `users.follow.getStatusAndCounts/toggle` following `hooks/ARCHITECTURE.md` and `lib/api-utils.ts` patterns.
- New API routes wrapping server actions and centralized utils:
  - `GET /api/users/[id]/comments`, `DELETE /api/comments/[commentId]`
  - `POST /api/auth/email/update`
  - `GET /api/beaches` (list beaches)
  - `GET /api/sessions/[id]/likes`, `POST /api/sessions/[id]/likes/toggle`
  - `GET/POST /api/sessions/[id]/comments`, `DELETE /api/sessions/[id]/comments/[commentId]`
  - `GET /api/users/[id]/follow`, `POST /api/users/[id]/follow/toggle`
- Enforce `profiles.home_beach_id` with FK, index, and update-own RLS policy
- Gamification: status review doc and full system integration groundwork
- Home Beach testing infrastructure for banner, selector, profile tile, and E2E flows
- Unified profile write action with comprehensive validation and types
- SQL view `profiles_with_home_beach` for server-side join of profiles to beaches (exposes `home_beach_name`)

- Bundle analysis build and report generation via `ANALYZE=true npm run build` using `webpack-bundle-analyzer`. Report saved to `.next/bundle-analyzer-report.html`.

### Changed

- Type System Hardening:

  - Aligned forecast `ConfidenceScore` scale to 0–100 and added `toConfidenceScore()` converter in `types/forecast.ts`.
  - Regenerated Supabase database types and restored app-facing aliases in `types/database.ts` (`IntelPostTag`, `IntelPost`, `IntelPostWithUser`, `Beach`, `Board`, `Profile`, `Session`, `SessionWithDetails`, `SessionPhoto`, `Forecast`, `EnhancedForecast`, `BeachForecastAccuracy`, `SessionForecastSnapshot`, `GetBestTimesRow`, `BeachReview`, `BeachReviewWithUser`, `CheckIn`, `CheckInWithUser`).
  - Added resilient, additive DTO fields used by UI: `Profile.homeBeachName`, `Profile.home_beach` (optional), and richer `ActivityFeedItem` metadata to match feed consumption.
  - Relaxed `EnhancedForecastEntity` shape to tolerate historical/fixture gaps while preserving core fields and transparency payload.

- Migrated five high-traffic client surfaces to the data gateway while preserving realtime:

  - `components/profile/user-comments.tsx` now uses gateway for list/delete; realtime kept
  - `components/profile/basic-profile-form.tsx` updates email via gateway API

- Dead code elimination (unused server actions removed):
  - Removed `updateSessionPrivacy` from `actions/analytics-actions.ts`
  - Removed default export wrapper from `actions/intel-actions.ts`
  - Removed `deleteIntelPost` from `actions/intel-actions.ts`
  - Removed `cleanupOrphanedMediaAction` and `batchUpdatePhotoCaptionsAction` from `actions/session-media-actions.ts`

### Documentation

- Components architecture now includes a deprecation note directing client components to use the data gateway instead of direct Supabase queries.

- Types architecture updated to reflect 0–100 confidence scale.

  - `components/BeachSelector.tsx` now uses `useDataFetcher` + `data.beaches.getAll()`
  - `hooks/use-session-like.ts` uses gateway for initial state + toggle; realtime kept
  - `hooks/use-comment-count.ts` uses gateway for initial count; realtime kept
  - `components/session-comments.tsx` uses gateway for list/create/delete; realtime kept
  - `hooks/use-user-follow.ts` uses gateway for initial state + toggle; realtime kept

- Pinned critical dependencies to explicit versions: `@hookform/resolvers@3.3.4`, `@supabase/ssr@0.5.1`, `@supabase/supabase-js@2.45.4`, `react-hook-form@7.53.2`. Keeps builds reproducible and aligns with consolidation RFC.
- Profile updates consolidated on `updateProfile({ home_beach_id })`; removed `setHomeBeach`
- API and stats now use `home_beach_id` (legacy `default_beach_id` removed)
- Removed legacy `favorite_spot` UI, API fields, and types; Home Break now resolved via `home_beach_id → beaches.name`
- Toast system consolidated to unified app toast API
- API endpoints `/api/profile` and `/api/profile/[id]` now include `homeBeachName` in response using joined query
- Standardized profile API responses to `ProfileDTO` with `homeBeachName` and optional nested `home_beach`; added mapper in `lib/profile/fetchers.ts`
- Replaced scattered `getBeachById` UI lookups with DTO fallback: prefer `homeBeachName`, then `profile.home_beach?.name`, then '—' across `app/user/[id]/page.tsx`, `components/social/user-profile-modal.tsx`, `components/user-stats.tsx`, and `components/profile-view.tsx`.
- Clarified Surf Journal+ labels: quick stat now shows "Favorite Beach" (most visited via analytics) to differentiate from profile "Home Break" selection.
- Replaced Home Beach dropdown with unified `BeachSelector` search in `components/edit-profile-form.tsx` and `components/profile/profile-preferences.tsx` for reliable typing-and-select behavior (matches session Location search pattern)

- Dependency and bundle optimization:

  - Removed unused dev deps: `@next/bundle-analyzer`, `@testing-library/dom` (analyzer handled via direct plugin, DOM utils unused)
  - Moved `@types/lodash` to devDependencies (types-only)
  - Added `modularizeImports` for `lodash` and `date-fns` in `next.config.mjs` to prefer per-module imports
  - Fixed ESM require in `next.config.mjs` using `createRequire`
  - Pinned core versions to lockfile-resolved values for reproducible builds (next, react, react-dom, lodash, date-fns, lucide-react)
  - Migrated remaining script shebangs from `ts-node` to `node`; removed `ts-node` (scripts run via `tsx`)

- E2E Testing Stabilization:
  - Standardized waits across E2E: replaced `waitForLoadState("networkidle")` with `"load"` and explicit element assertions
  - Removed runtime `test.skip(...)` guards; enforced deterministic assertions and project scoping for mobile tests
  - Added canonical helpers in `test-utils/navigation-helpers.ts`: `waitForRealtimeUpdate`, `fillFormSafely`
  - Consolidated helpers; removed unused `e2e/test-helpers-improved.ts`
  - Added Playwright mobile project `mobile-chrome` targeting motion interactions; no runtime mobile skips
- Removed brittle unit test `__tests__/components/profile/EditProfileModal.spec.tsx` in favor of E2E coverage

### Fixed

- Home Beach selection now persists reliably; UI duplication/crash fixes
- Instagram field name aligned between frontend and database
- E2E/MCP configuration fixes; improved stability of tests and dev server
- Spatial query ambiguity resolved; production build verified
- Server-side fallback: `updateProfile` now resolves `home_beach_text` to a valid `home_beach_id` when no ID is provided
- Discover page follow-status infinite request loop resolved: stabilized `hooks/use-user-follow` effect dependencies and callback handling; memoized follower count updater in `app/discover/page.tsx`. Follows `hooks/ARCHITECTURE.md` realtime subscription pattern and centralized data gateway in `lib/data/client.ts`.

## [2025.09.02] - Development Update

### Added

- Nullable `home_beach_id` support in `profileUpdateSchema` (use `null` to clear selection)

### Changed

- `components/edit-profile-form.tsx`: bind `home_beach_id` directly to RHF; remove shadow state
- `components/profile/profile-preferences.tsx`: map empty string to `null`; defaults use `null`
- Follow `components/ARCHITECTURE.md` patterns; centralize validation in actions

### Notes

- Temporary instrumentation: added debug logs around Home Beach updates (UI/server) to investigate overwrite; to be removed after verification

## Archive

Older entries have been pruned to keep this file readable. For the full history, use Git history on this file.
