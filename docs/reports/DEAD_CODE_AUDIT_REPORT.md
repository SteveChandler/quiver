# Dead Code Audit Report

**Generated:** November 25, 2025  
**Updated:** November 24, 2025 (Phase 1, 2, 3 & 4 cleanup completed)  
**Tools Used:** Knip, ts-prune, depcheck, manual grep analysis

---

## Executive Summary

This audit identified significant dead code across the codebase. **Phase 1, Phase 2, Phase 3, and Phase 4 cleanup have been completed.**

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

### Cleanup Completed (Phase 3):

- **4 unused components deleted** (~600 lines removed):
  - `components/home-conditions-widget.tsx` (114 lines)
  - `components/session-planning-map.tsx` (152 lines)
  - `components/admin/forecast-health-dashboard.tsx` (245 lines)
  - `components/beach-detail/beach-community.tsx` (99 lines)
- **ARCHITECTURE.md files updated** to remove references to deleted components
- **Buoy components verified as USED** (via buoy-conditions.tsx → map-display.tsx)
- **BeachSearch verified as USED** (in multiple components)

### Cleanup Completed (Phase 4 - Verification & Configuration):

- **Dependencies verified as NEEDED** - Original report findings corrected
- **Duplicate exports verified as INTENTIONAL** - Backward compatibility aliases confirmed
- **knip.json updated** - Removed `@next/bundle-analyzer` from ignoreDependencies

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

## 2. COMPLETED - Component Verification (Phase 3)

### 2.1 Verified & Deleted Components ✅

| Component                 | File                                             | Verification Result | Status  |
| ------------------------- | ------------------------------------------------ | ------------------- | ------- |
| `HomeConditionsWidget`    | `components/home-conditions-widget.tsx`          | Only self-reference | DELETED |
| `SessionPlanningMap`      | `components/session-planning-map.tsx`            | Only self-reference | DELETED |
| `ForecastHealthDashboard` | `components/admin/forecast-health-dashboard.tsx` | Only in docs        | DELETED |
| `BeachCommunity`          | `components/beach-detail/beach-community.tsx`    | Only in ARCH.md     | DELETED |

### 2.2 Verified & Kept Components ✅

| Component     | File                          | Verification Result                             | Status |
| ------------- | ----------------------------- | ----------------------------------------------- | ------ |
| `BeachSearch` | `components/beach-search.tsx` | Used in map-view, beach-search-bar, hero-search | KEPT   |

### 2.3 Buoy Components - Verified as USED ✅

From `components/buoy/index.ts` exports - **ALL USED** via dependency chain:

```
buoy/* → buoy-conditions.tsx → map/map-display.tsx
```

- `BuoyCard` - Used in buoy-conditions.tsx
- `Measurement`, `TemperatureMeasurement`, `WindMeasurement`, `WaveMeasurement`, `PressureMeasurement` - Used in buoy-card.tsx
- `BuoyStatusIndicator`, `ConditionBadge`, `WaveQualityBadge` - Used in buoy-card.tsx

### 2.4 API Endpoints to Keep

| Endpoint         | Reason                 |
| ---------------- | ---------------------- |
| `/api/e2e-login` | Required for E2E tests |

---

## 3. REMAINING - Unused Exports (~95 Functions/Constants after Phase 2)

### High-Impact Unused Functions (Remaining)

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
| ~~`validateSchema`~~            | ~~`lib/api-utils.ts`~~ ✅ REMOVED                           |
| ~~`safeValidateSchema`~~        | ~~`lib/api-utils.ts`~~ ✅ REMOVED                           |
| ~~`generateETag`~~              | ~~`lib/api-utils.ts`~~ ✅ REMOVED (re-export)               |
| ~~`isETagMatch`~~               | ~~`lib/api-utils.ts`~~ ✅ REMOVED (re-export)               |
| `getRateLimitConfig`            | `lib/api/rate-limit-config.ts:197`                          |
| `RATE_LIMIT_MESSAGES`           | `lib/api/rate-limit-config.ts:207`                          |
| ~~`captureAttribution`~~        | ~~`lib/attribution.ts`~~ ✅ REMOVED                         |
| ~~`clearAttributionCookies`~~   | ~~`lib/attribution.ts`~~ ✅ REMOVED                         |
| ~~`BLUR_PLACEHOLDERS`~~         | ~~`lib/constants/blur-placeholders.ts`~~ ✅ MADE PRIVATE    |
| ~~`getFallbackImageForBeach`~~  | ~~`lib/constants/featured-beaches-config.ts`~~ ✅ REMOVED   |
| ~~`isExcludedBeach`~~           | ~~`lib/constants/featured-beaches-config.ts`~~ ✅ REMOVED   |
| ~~`isPriorityBeach`~~           | ~~`lib/constants/featured-beaches-config.ts`~~ ✅ REMOVED   |
| ~~`METRO_AREAS`~~               | ~~`lib/constants/metro-areas.ts`~~ ✅ MADE PRIVATE          |
| ~~`getAllMetroConfigs`~~        | ~~`lib/constants/metro-areas.ts`~~ ✅ REMOVED               |
| `SURF_SPOTS`                    | `lib/data/surf-spots.ts:238`                                |
| `getTopSpotsForIntent`          | `lib/data/surf-spots.ts:1680`                               |
| `withAdminAction`               | `lib/server-action-utils/admin.ts:25`                       |
| `scoreBeachesForUser`           | `lib/services/personalized-scoring-service.ts:196`          |
| `topWindowsInRange`             | `lib/surf/windows.ts:115`                                   |
| `windowBlurbDetailed`           | `lib/surf/windows.ts:169`                                   |

### Full List in Knip Output

Run `yarn dead:knip` for complete list of 109 unused exports.

---

## 4. REMAINING - Unused Types (~73 Type Exports after Phase 2)

### Top Unused Types

| Type                    | File                                                              |
| ----------------------- | ----------------------------------------------------------------- |
| `ForecastVote`          | `actions/forecast-verification-actions.ts:21`                     |
| `LegacyShareVariant`    | `actions/social-share-actions.ts:10`                              |
| `ErrorBoundaryTier`     | `components/error-boundaries/types.ts:6`                          |
| `ErrorBoundaryType`     | `components/error-boundaries/types.ts:11`                         |
| ~~`ErrorCategory`~~     | ~~`components/error-boundaries/types.ts`~~ ✅ REMOVED (duplicate) |
| ~~`RetryStrategy`~~     | ~~`components/error-boundaries/types.ts`~~ ✅ REMOVED (duplicate) |
| `PushOptInState`        | `hooks/use-native-push-registration.ts:16`                        |
| `SessionFormHookParams` | `hooks/use-session-form.ts:65`                                    |
| `NearbyBeach`           | `hooks/useNearbyBeaches.ts:23`                                    |
| `UTMParam`              | `lib/attribution.ts:32`                                           |
| ~~`FallbackBeachName`~~ | ~~`lib/constants/featured-beaches-config.ts`~~ ✅ REMOVED         |

Run `yarn dead:knip` for complete list.

---

## 5. VERIFIED - Dependencies (Phase 4 - All NEEDED) ✅

### NPM Dependencies Verification Results

**All flagged dependencies were verified as ACTUALLY NEEDED:**

| Dependency               | Original Claim               | Verification Result                                                      |
| ------------------------ | ---------------------------- | ------------------------------------------------------------------------ |
| `@capacitor/android`     | "Not used in web app"        | ✅ **NEEDED** - Used by mobile build scripts (yarn mobile:build:android) |
| `@capacitor/ios`         | "Not used in web app"        | ✅ **NEEDED** - Used by mobile build scripts (yarn mobile:build:ios)     |
| `@types/jest`            | "Using Playwright, not Jest" | ✅ **NEEDED** - Jest IS used (yarn test:unit, yarn test:coverage)        |
| `jest-environment-jsdom` | "Using Playwright"           | ✅ **NEEDED** - Required for Jest DOM tests (**tests**/)                 |
| `eslint-plugin-jsx-a11y` | "Not configured in eslint"   | ✅ **NEEDED** - Active rules in eslint.config.mjs (lines 63-76)          |
| `postcss`                | "Verify usage"               | ✅ **NEEDED** - Required by Tailwind CSS (postcss.config.mjs)            |
| `postcss-load-config`    | "Verify usage"               | ✅ **NEEDED** - Required by Tailwind CSS (postcss.config.mjs)            |
| `ansi-regex`             | "Unused utility"             | ✅ **NEEDED** - In resolutions to fix transitive dependency conflicts    |
| `string-width`           | "Unused utility"             | ✅ **NEEDED** - In resolutions to fix transitive dependency conflicts    |
| `strip-ansi`             | "Unused utility"             | ✅ **NEEDED** - In resolutions to fix transitive dependency conflicts    |

**Note:** `zustand` is used in `store/onboarding-store.ts` (depcheck false positive - confirmed)

---

## 6. VERIFIED - Duplicate Exports (Phase 4 - Intentional Aliases) ✅

### Export Alias Verification

**These are INTENTIONAL backward compatibility aliases - NOT duplicates to remove:**

| Export Alias                  | Primary Function           | Verified Usage                                           |
| ----------------------------- | -------------------------- | -------------------------------------------------------- |
| `getBeachAccuracy`            | `getBeachForecastAccuracy` | ✅ **USED** in `hooks/use-forecast-calibration.ts:9,34`  |
| `getSessionForecastSnapshots` | `getBeachSessionSnapshots` | ✅ **USED** in `hooks/use-forecast-calibration.ts:10,48` |

**Context:** Lines 361-362 in `actions/forecast-calibration-actions.ts`:

```typescript
// Function aliases for backward compatibility with hooks
export const getBeachAccuracy = getBeachForecastAccuracy;
export const getSessionForecastSnapshots = getBeachSessionSnapshots;
```

These aliases are documented as backward compatibility exports and ARE actively used. **No cleanup needed.**

---

## 7. COMPLETED - Configuration Cleanup (Phase 4) ✅

### knip.json Updates Applied

| Original Recommendation                                  | Verification                                         | Action         |
| -------------------------------------------------------- | ---------------------------------------------------- | -------------- |
| Remove `@next/bundle-analyzer` from ignoreDependencies   | Not in package.json                                  | ✅ **REMOVED** |
| Remove `webpack-bundle-analyzer` from ignoreDependencies | **NEEDED** - Used in next.config.mjs (lines 301-309) | ❌ KEPT        |
| Remove `@lhci/cli` from ignoreDependencies               | **NEEDED** - Used by yarn lighthouse:ci script       | ❌ KEPT        |

### Other Configuration Hints (Not Applicable)

- `next.config.mjs` entry pattern - Already correctly configured
- `jest.config.js` entry pattern - Already correctly configured

---

## 8. CLEANUP ORDER - ALL PHASES COMPLETED

### Phase 2: Code Cleanup ✅ COMPLETED (November 25, 2025)

1. ✅ Removed `validateSchema`, `safeValidateSchema`, `generateETag`, `isETagMatch` from `lib/api-utils.ts`
2. ✅ Removed `captureAttribution`, `clearAttributionCookies` from `lib/attribution.ts`
3. ✅ Cleaned up `lib/constants/` - made `BLUR_PLACEHOLDERS` and `METRO_AREAS` private, removed unused helper functions
4. ✅ Removed duplicate `ErrorCategory` and `RetryStrategy` types from `components/error-boundaries/types.ts`

### Phase 3: Structural Cleanup ✅ COMPLETED (November 25, 2025)

1. ✅ Verified and deleted unused components:
   - `components/home-conditions-widget.tsx` - Never imported
   - `components/session-planning-map.tsx` - Never imported
   - `components/admin/forecast-health-dashboard.tsx` - Only referenced in docs
   - `components/beach-detail/beach-community.tsx` - Documented but never imported
2. ✅ Verified buoy components are USED (via buoy-conditions.tsx → map-display.tsx)
3. ✅ Updated ARCHITECTURE.md files to remove references to deleted components

### Phase 4: Dependency & Configuration Cleanup ✅ COMPLETED (November 24, 2025)

1. ✅ **Verified ALL dependencies are NEEDED** - Original report had false positives:
   - Capacitor packages needed for mobile builds
   - Jest packages needed for unit tests
   - PostCSS packages needed for Tailwind CSS
   - eslint-plugin-jsx-a11y actively configured in eslint.config.mjs
2. ✅ **Verified duplicate exports are INTENTIONAL** - Backward compatibility aliases actively used
3. ✅ **Updated knip.json** - Removed `@next/bundle-analyzer` (not in package.json), kept needed entries

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
_Phase 2 cleanup completed: November 25, 2025_  
_Phase 3 cleanup completed: November 25, 2025_  
_Phase 4 cleanup completed: November 25, 2025_  
**🎉 ALL PHASES COMPLETE**
_Phase 4 cleanup completed: November 24, 2025_
