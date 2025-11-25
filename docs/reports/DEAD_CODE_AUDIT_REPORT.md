# Dead Code Audit Report

**Generated:** November 25, 2025  
**Updated:** November 25, 2025 (Phase 1 & 2 cleanup completed)  
**Tools Used:** Knip, ts-prune, depcheck, manual grep analysis

---

## Executive Summary

This audit identified significant dead code across the codebase. **Phase 1 and Phase 2 cleanup have been completed.**

### Original Findings:

- **16 unused files** (safe to delete)
- **109 unused exports** (functions/constants)
- **77 unused type exports**
- **7 unused npm dependencies**
- **5+ potentially unused API endpoints**
- **2 unused action files** (CORRECTED - see below)

### Cleanup Completed (Phase 1):

- **24 files deleted** (~2,500+ lines removed)
- **5 API endpoints removed**
- **1 orphaned test file removed**

### Cleanup Completed (Phase 2):

- **10 unused exports removed** from lib/api-utils.ts, lib/attribution.ts
- **6 unused exports removed** from lib/constants/ files
- **2 duplicate type definitions removed** from error-boundaries/types.ts
- **3 exports made private** (BLUR_PLACEHOLDERS, METRO_AREAS, internal functions)

### Corrections to Original Report:

The following files were incorrectly flagged as unused:

- `actions/beach-calibration-actions.ts` - **ACTUALLY USED** in `beach-stats-grid.tsx`, `spot-overview.tsx`
- `actions/beach-media-actions.ts` - **ACTUALLY USED** in `beach-photo-gallery.tsx`, `spot-overview.tsx`

---

## 1. COMPLETED - Phase 1 Cleanup (November 25, 2025)

### 1.1 Deleted Library Files (7 files) ✅

| File                                                 | Description                                | Status  |
| ---------------------------------------------------- | ------------------------------------------ | ------- |
| `hooks/use-attribution.ts`                           | Attribution tracking hook (never imported) | DELETED |
| `lib/constants/beach-search-config.ts`               | Search config constants (unused)           | DELETED |
| `lib/data/landing-page.ts`                           | Landing page data (unused)                 | DELETED |
| `lib/services/personalized-home-forecast-service.ts` | Deprecated by surf-discovery-service       | DELETED |
| `lib/surf/data.ts`                                   | Surf data utilities (unused)               | DELETED |
| `lib/surf/sun.ts`                                    | Sun calculation utilities (unused)         | DELETED |
| `lib/time.ts`                                        | Time utilities (unused)                    | DELETED |

### 1.2 Deleted One-Time Scripts (9 files) ✅

| File                                            | Status  |
| ----------------------------------------------- | ------- |
| `scripts/check-beach-schema.ts`                 | DELETED |
| `scripts/check-experience-levels.ts`            | DELETED |
| `scripts/clear-profile-cache.ts`                | DELETED |
| `scripts/set-home-beach.ts`                     | DELETED |
| `scripts/verify-experience-levels-fix.ts`       | DELETED |
| `scripts/verify-home-beach.ts`                  | DELETED |
| `scripts/verify-integration.ts`                 | DELETED |
| `scripts/verify-personalized-forecast-cache.ts` | DELETED |
| `scripts/verify-profile-complete.ts`            | DELETED |

### 1.3 Deleted Example/Demo Files (2 files) ✅

| File                               | Status  |
| ---------------------------------- | ------- |
| `app/api/surf/example.ts`          | DELETED |
| `app/sentry-example-page/page.tsx` | DELETED |

### 1.4 Deleted API Endpoints (5 endpoints) ✅

| Endpoint                          | Reason                  | Status  |
| --------------------------------- | ----------------------- | ------- |
| `/api/test/auth/dev-session`      | Test-only endpoint      | DELETED |
| `/api/test/auth/seed-and-session` | Test-only endpoint      | DELETED |
| `/api/admin/resolve-stations`     | Only referenced in docs | DELETED |
| `/api/forecasts/window`           | Only referenced in docs | DELETED |
| `/api/cache/status`               | Only referenced in docs | DELETED |

### 1.5 Deleted Orphaned Test Files (1 file) ✅

| File                                                            | Status  |
| --------------------------------------------------------------- | ------- |
| `__tests__/services/personalized-home-forecast-service.test.ts` | DELETED |

### 1.6 Action Files - CORRECTED ❌

These were **incorrectly flagged** as unused. Manual verification found they ARE actively used:

| File                                   | Actually Used In                                                                               |
| -------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `actions/beach-calibration-actions.ts` | `components/beach-detail/beach-stats-grid.tsx`, `components/beach-detail/spot-overview.tsx`    |
| `actions/beach-media-actions.ts`       | `components/beach-detail/beach-photo-gallery.tsx`, `components/beach-detail/spot-overview.tsx` |

---

## 2. REMAINING - Needs Human Verification

### 2.1 Potentially Unused Components (from ts-prune)

| Component                 | File                                                |
| ------------------------- | --------------------------------------------------- |
| `BeachSearch`             | `components/beach-search.tsx:98`                    |
| `HomeConditionsWidget`    | `components/home-conditions-widget.tsx:27`          |
| `SessionPlanningMap`      | `components/session-planning-map.tsx:16`            |
| `ForecastHealthDashboard` | `components/admin/forecast-health-dashboard.tsx:46` |
| `BeachCommunity`          | `components/beach-detail/beach-community.tsx:15`    |

### 2.2 Buoy Components (Potentially Unused)

From `components/buoy/index.ts` exports:

- `BuoyCard`
- `Measurement`, `TemperatureMeasurement`, `WindMeasurement`, `WaveMeasurement`, `PressureMeasurement`
- `BuoyStatusIndicator`, `ConditionBadge`, `WaveQualityBadge`

### 2.3 API Endpoints to Keep

| Endpoint         | Reason                 |
| ---------------- | ---------------------- |
| `/api/e2e-login` | Required for E2E tests |

---

## 3. REMAINING - Unused Exports (109 Functions/Constants)

### High-Impact Unused Functions (Top 30)

| Function                        | File                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `getLocationStats`              | `actions/beach/beach-location-list-actions.ts:267`          |
| `getOnboardingStatus`           | `actions/onboarding-actions.ts:110`                         |
| `isRetryableError`              | `components/error-boundaries/utils/retry-strategies.ts:27`  |
| `clearExpiredFormStates`        | `components/error-boundaries/utils/state-persistence.ts:69` |
| `useLocationIntelData`          | `hooks/use-intel-data.ts:265`                               |
| `useIntelFilters`               | `hooks/use-intel-data.ts:387`                               |
| `useMotionVariants`             | `hooks/use-reduced-motion.ts:56`                            |
| `adaptDiscoveryRecommendation`  | `lib/adapters/discovery-to-personalized.ts:38`              |
| `adaptDiscoveryRecommendations` | `lib/adapters/discovery-to-personalized.ts:116`             |
| `degreesToCardinal`             | `lib/analyzers/wind-analyzer.ts:35`                         |
| `validateSchema`                | `lib/api-utils.ts:197`                                      |
| `safeValidateSchema`            | `lib/api-utils.ts:221`                                      |
| `generateETag`                  | `lib/api-utils.ts:360`                                      |
| `isETagMatch`                   | `lib/api-utils.ts:361`                                      |
| `getRateLimitConfig`            | `lib/api/rate-limit-config.ts:197`                          |
| `RATE_LIMIT_MESSAGES`           | `lib/api/rate-limit-config.ts:207`                          |
| `captureAttribution`            | `lib/attribution.ts:161`                                    |
| `clearAttributionCookies`       | `lib/attribution.ts:246`                                    |
| `BLUR_PLACEHOLDERS`             | `lib/constants/blur-placeholders.ts:7`                      |
| `getFallbackImageForBeach`      | `lib/constants/featured-beaches-config.ts:67`               |
| `isExcludedBeach`               | `lib/constants/featured-beaches-config.ts:82`               |
| `isPriorityBeach`               | `lib/constants/featured-beaches-config.ts:86`               |
| `METRO_AREAS`                   | `lib/constants/metro-areas.ts:51`                           |
| `getAllMetroConfigs`            | `lib/constants/metro-areas.ts:142`                          |
| `SURF_SPOTS`                    | `lib/data/surf-spots.ts:238`                                |
| `getTopSpotsForIntent`          | `lib/data/surf-spots.ts:1680`                               |
| `withAdminAction`               | `lib/server-action-utils/admin.ts:25`                       |
| `scoreBeachesForUser`           | `lib/services/personalized-scoring-service.ts:196`          |
| `topWindowsInRange`             | `lib/surf/windows.ts:115`                                   |
| `windowBlurbDetailed`           | `lib/surf/windows.ts:169`                                   |

### Full List in Knip Output

Run `yarn dead:knip` for complete list of 109 unused exports.

---

## 4. REMAINING - Unused Types (77 Type Exports)

### Top Unused Types

| Type                    | File                                          |
| ----------------------- | --------------------------------------------- |
| `ForecastVote`          | `actions/forecast-verification-actions.ts:21` |
| `LegacyShareVariant`    | `actions/social-share-actions.ts:10`          |
| `ErrorBoundaryTier`     | `components/error-boundaries/types.ts:6`      |
| `ErrorBoundaryType`     | `components/error-boundaries/types.ts:11`     |
| `ErrorCategory`         | `components/error-boundaries/types.ts:16`     |
| `RetryStrategy`         | `components/error-boundaries/types.ts:27`     |
| `PushOptInState`        | `hooks/use-native-push-registration.ts:16`    |
| `SessionFormHookParams` | `hooks/use-session-form.ts:65`                |
| `NearbyBeach`           | `hooks/useNearbyBeaches.ts:23`                |
| `UTMParam`              | `lib/attribution.ts:32`                       |

Run `yarn dead:knip` for complete list.

---

## 5. REMAINING - Unused Dependencies

### NPM Dependencies (Safe to Remove)

**Dependencies:**

- `@capacitor/android` - Not used in web app (mobile-only)
- `@capacitor/ios` - Not used in web app (mobile-only)

**Dev Dependencies:**

- `@types/jest` - Using Playwright, not Jest for tests
- `ansi-regex` - Unused utility
- `eslint-plugin-jsx-a11y` - Not configured in eslint
- `jest-environment-jsdom` - Using Playwright
- `postcss` - May be used by Tailwind (verify)
- `postcss-load-config` - May be used by Tailwind (verify)
- `string-width` - Unused utility
- `strip-ansi` - Unused utility

**Note:** `zustand` is actually used in `store/onboarding-store.ts` (depcheck false positive)

---

## 6. DUPLICATE EXPORTS

| Duplicates                                                 | File                                      |
| ---------------------------------------------------------- | ----------------------------------------- |
| `getBeachForecastAccuracy` / `getBeachAccuracy`            | `actions/forecast-calibration-actions.ts` |
| `getBeachSessionSnapshots` / `getSessionForecastSnapshots` | `actions/forecast-calibration-actions.ts` |

---

## 7. CONFIGURATION HINTS

From Knip analysis - redundant `knip.json` entries:

- Remove `@next/bundle-analyzer` from `ignoreDependencies`
- Remove `webpack-bundle-analyzer` from `ignoreDependencies`
- Remove `@lhci/cli` from `ignoreDependencies`
- Remove redundant `next.config.mjs` entry pattern
- Remove redundant `jest.config.js` entry pattern

---

## 8. REMAINING CLEANUP ORDER

### Phase 2: Code Cleanup (Not Started)

1. Remove unused exports from `lib/api-utils.ts`
2. Remove unused exports from `lib/attribution.ts`
3. Clean up `lib/constants/` unused exports
4. Clean up `components/error-boundaries/` unused types

### Phase 3: Structural Cleanup (Not Started)

1. Verify and remove unused components
2. Clean up unused buoy components

### Phase 4: Dependency Cleanup (Not Started)

1. Verify postcss dependencies usage
2. Remove Capacitor dependencies if not building mobile
3. Clean up knip.json configuration

---

## 9. COMMANDS TO RE-RUN AUDIT

```bash
# Run all dead code detection
yarn dead:all

# Individual tools
yarn dead:knip      # Unused files, exports, dependencies
yarn dead:tsprune   # Unused TypeScript exports
yarn dead:deps      # Unused npm dependencies
```

---

## 10. NOTES

- **False Positives:** Some exports may be used dynamically or in edge cases
- **Test Files:** Excluded from analysis per knip.json configuration
- **Type Files:** `types/` directory excluded from unused file analysis
- **E2E Files:** `e2e/` directory excluded from unused file analysis
- **Action Files:** Manual verification is critical - automated tools missed actual usage in `beach-calibration-actions.ts` and `beach-media-actions.ts`

---

_Report generated by dead code audit automation_  
_Phase 1 cleanup completed: November 25, 2025_
