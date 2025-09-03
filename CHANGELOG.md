# Quiver Surf App - Changelog

All notable changes to the Quiver surf app are documented in this file.

The format is based on Keep a Changelog, and this project adheres to Semantic Versioning.

## [Unreleased]

### Added

- Enforce `profiles.home_beach_id` with FK, index, and update-own RLS policy
- Gamification: status review doc and full system integration groundwork
- Home Beach testing infrastructure for banner, selector, profile tile, and E2E flows
- Unified profile write action with comprehensive validation and types
- SQL view `profiles_with_home_beach` for server-side join of profiles to beaches (exposes `home_beach_name`)

### Changed

- Profile updates consolidated on `updateProfile({ home_beach_id })`; removed `setHomeBeach`
- API and stats now use `home_beach_id` (legacy `default_beach_id` removed)
- Removed legacy `favorite_spot` UI, API fields, and types; Home Break now resolved via `home_beach_id → beaches.name`
- Toast system consolidated to unified app toast API
- API endpoints `/api/profile` and `/api/profile/[id]` now include `homeBeachName` in response using joined query
- Standardized profile API responses to `ProfileDTO` with `homeBeachName` and optional nested `home_beach`; added mapper in `lib/profile/fetchers.ts`
- Replaced scattered `getBeachById` UI lookups with DTO fallback: prefer `homeBeachName`, then `profile.home_beach?.name`, then '—' across `app/user/[id]/page.tsx`, `components/social/user-profile-modal.tsx`, `components/user-stats.tsx`, and `components/profile-view.tsx`.
- Clarified Surf Journal+ labels: quick stat now shows "Favorite Beach" (most visited via analytics) to differentiate from profile "Home Break" selection.

### Fixed

- Home Beach selection now persists reliably; UI duplication/crash fixes
- Instagram field name aligned between frontend and database
- E2E/MCP configuration fixes; improved stability of tests and dev server
- Spatial query ambiguity resolved; production build verified

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
