# Retired Document

Status: Retired
Reason: Early duplication-refactor progress is superseded by the active controlled refactor roadmap.
Retired on: 2026-05-31
Replacement: [Refactor Roadmap](../../refactor-roadmap.md)

# Code Duplication Refactoring Progress

**Goal**: Reduce code duplication from ~19.3% to <3%
**Started**: January 2026

---

## Phase 1: API Error Handling (HIGHEST PRIORITY)

**Impact**: ~8-10% duplication reduction | **Files**: 73 API routes

### Completed ✅

1. **Created `/lib/middleware/api-wrappers.ts`**
   - `withAuth()` - HOF for authenticated routes (supports optional auth)
   - `withErrorHandler()` - HOF for centralized try-catch
   - `withRateLimit()` - HOF for rate limiting (backward compatible with string keys)
   - `withBotBlockingAndRateLimit()` - Combined bot blocking + rate limiting
   - `withProtection()` - Unified declarative wrapper for any combination
   - `validateUuidParam()` - Validates UUID params, returns discriminated union
   - `requireOwnership()` - Checks resource ownership
   - Re-exports: `createSuccessResponse`, `createValidationError`, `createAuthError`, `createNotFoundError`, `methodNotAllowed`, `handleApiError`

2. **Created `__tests__/lib/middleware/api-wrappers.test.ts`**
   - 30 passing tests covering all HOFs and utilities

3. **Unified API Middleware Architecture** (January 2026)
   - Centralized all rate limiting and bot blocking wrappers in `api-wrappers.ts`
   - Updated `/lib/middleware/rate-limiter.ts` to re-export from `api-wrappers.ts` for backward compatibility
   - Created comprehensive design documentation in `docs/API_MIDDLEWARE_*.md`
   - All 6 protection combinations now supported:
     - Public + rate limiting + bot blocking
     - Public + rate limiting only
     - Optional auth + rate limiting + bot blocking
     - Required auth + rate limiting
     - Required auth + rate limiting + bot blocking
     - Auth only (existing `withAuth`)

4. **Migrated Routes (11/11 Batch 1 - COMPLETE)**:
   | Route | Before | After | Savings |
   |-------|--------|-------|---------|
   | `/app/api/boards/route.ts` | 105 lines | 75 lines | 30 lines |
   | `/app/api/sessions/[id]/route.ts` | 189 lines | 135 lines | 54 lines |
   | `/app/api/users/[id]/follow/route.ts` | 63 lines | 58 lines | 5 lines |
   | `/app/api/profile/route.ts` | 39 lines | 25 lines | 14 lines |
   | `/app/api/beaches/favorites/route.ts` | 34 lines | 30 lines | 4 lines |
   | `/app/api/users/[id]/follow/toggle/route.ts` | 41 lines | 32 lines | 9 lines |
   | `/app/api/beaches/[id]/favorite/toggle/route.ts` | 129 lines | 97 lines | 32 lines |
   | `/app/api/sessions/[id]/likes/route.ts` | 56 lines | 46 lines | 10 lines |
   | `/app/api/sessions/[id]/likes/toggle/route.ts` | 33 lines | 17 lines | 16 lines |
   | `/app/api/sessions/[id]/comments/route.ts` | ~80 lines | ~50 lines | ~30 lines |
   | `/app/api/sessions/[id]/comments/[commentId]/route.ts` | ~50 lines | ~30 lines | ~20 lines |

5. **Migrated Routes (6/6 Batch 2 - COMPLETE)**:
   | Route | Before | After | Savings |
   |-------|--------|-------|---------|
   | `/app/api/gamification/xp-status/route.ts` | 118 lines | 82 lines | 36 lines |
   | `/app/api/gamification/user-badges/route.ts` | 45 lines | 36 lines | 9 lines |
   | `/app/api/gamification/badge-definitions/route.ts` | 58 lines | 24 lines | 34 lines |
   | `/app/api/intel/[id]/confirm/route.ts` | 235 lines | 174 lines | 61 lines |
   | `/app/api/intel/route.ts` (POST only) | 195 lines | 169 lines | 26 lines |
   | `/app/api/v1/recommendations/route.ts` | Unit conversions | Shared imports | ~4 lines |

### Batch 1 Notes

The following routes from the original plan **do not exist** and were removed:
- ~~`/app/api/boards/[id]/route.ts`~~ - No individual board endpoint exists
- ~~`/app/api/sessions/route.ts`~~ - Sessions are at `/sessions/[id]` and `/sessions/public`
- ~~`/app/api/profile/update/route.ts`~~ - Profile updates via `/profile` route
- ~~`/app/api/profile/boards/route.ts`~~ - Boards accessed via `/boards` route

### Batch 3 (Rate-Limited Routes) - BACKWARD COMPATIBLE ✅

The unified API wrapper architecture makes migration **optional**. Existing routes continue to work with no changes:

**Routes using `withBotBlockingAndRateLimit`** (12 routes):
- ✅ `/app/api/beaches/[id]/route.ts` - Works with existing import
- ✅ `/app/api/beaches/search/route.ts` - Works with existing import
- ✅ `/app/api/recent-posts/route.ts`
- ✅ `/app/api/buoys/conditions/route.ts`
- ✅ `/app/api/buoys/nearby/route.ts`
- ✅ `/app/api/intel/route.ts` (GET)
- ✅ `/app/api/users/search/route.ts`
- ✅ `/app/api/users/[id]/sessions/route.ts`
- ✅ `/app/api/sessions/public/route.ts`
- ✅ `/app/api/beaches/route.ts` (GET)
- ✅ `/app/api/profile/[id]/route.ts`
- ✅ `/app/api/users/[id]/comments/route.ts`

**Routes using `withRateLimit`** (9 routes):
- ✅ All continue to work with existing string key syntax

**New Migration Option**: Routes can optionally migrate to `withProtection()` for:
- Cleaner declarative syntax
- Combined auth + rate limiting support
- Unified configuration

Example migration (optional):
```typescript
// Before (still works)
export const GET = withBotBlockingAndRateLimit(handler, "public-default");

// After (new unified syntax)
export const GET = withProtection(handler, {
  rateLimit: { key: "public-default" },
  botBlocking: { enabled: true }
});
```

---

## Phase 2: Forecast Display Components ✅ COMPLETE

**Impact**: ~4-5% reduction | **Files**: 6 components

### Completed ✅

1. **Created `/lib/utils/unit-conversions.ts`**
   - `metersToFeet()` / `feetToMeters()`
   - `msToKnots()` / `knotsToMs()`
   - `msToMph()` / `mphToMs()`
   - `kmhToKnots()`
   - `celsiusToFahrenheit()` / `fahrenheitToCelsius()`
   - `formatWaveHeight()` / `formatWindSpeed()`
   - `degreesToCardinal()` / `cardinalToDegrees()`
   - Aliases: `mToFt`, `msToKts` (backward compatibility)

2. **Added `getConfidenceInfo()` to `/lib/utils/forecast-freshness.ts`**
   ```typescript
   export interface ConfidenceInfo {
     level: 'high' | 'medium' | 'low';
     color: 'green' | 'yellow' | 'red';
     bgColor: string;
     textColor: string;
   }
   export function getConfidenceInfo(score: number): ConfidenceInfo;
   ```

3. **Created `/components/forecast/forecast-state-displays.tsx`**
   - `ForecastLoading` - Loading state with spinner
   - `ForecastError` - Error state with retry button
   - `ForecastEmpty` - Empty state with wave icon
   - `ForecastOffline` - Offline/connection error state
   - `ForecastSkeleton` - Table skeleton loader
   - `ForecastStateWrapper` - Unified wrapper component

4. **Refactored Forecast Components**:
   | Component | Change |
   |-----------|--------|
   | `/components/forecast/spot-conditions-summary.tsx` | Now uses `mToFt` from unit-conversions |
   | `/components/forecast/confidence-score-explanation.tsx` | Now uses `getConfidenceInfo` |
   | `/components/forecast/forecast-data-source-indicator.tsx` | Now uses `getConfidenceInfo` |
   | `/app/api/v1/recommendations/route.ts` | Now uses `msToKts`, `mToFt` from unit-conversions |

---

## Phase 3: Profile Form Variants - DEFERRED (Low ROI)

**Original Impact Estimate**: ~3-4% reduction | **Files**: 4 components
**Assessment**: After review, the components are already reasonably clean:
- `experience-step.tsx`: 109 lines (well-structured)
- `wave-preferences-step.tsx`: 189 lines (well-structured)

The "duplication" is similar UI patterns that differ enough to warrant separate implementations. Creating abstract adapters would add complexity without clear benefit.

### Status: Deferred

- [ ] ~~Create `/components/onboarding/shared/preference-adapters.tsx`~~ - Lower priority
- [x] Assessed ROI - determined not cost-effective at this time

**Recommendation**: Revisit if onboarding steps are modified or additional selection patterns are added.

---

## Phase 4: Auth Form Components ✅ COMPLETE

**Impact**: ~1% reduction | **Files**: 2 files

### Completed ✅

1. **Standardized password validation in `/lib/auth/auth-utils.ts`**
   - Added `MIN_PASSWORD_LENGTH = 8` constant (exported)
   - Updated `validatePassword()` to use constant instead of hardcoded value
   - Error message now uses template literal for consistency

2. **Updated `/app/auth/reset/page.tsx` to use shared validation**
   - Removed duplicate local `validatePassword` function
   - Now imports `validatePassword` and `MIN_PASSWORD_LENGTH` from `@/lib/auth/auth-utils`
   - Input `minLength` attributes now use the constant
   - Helper text now uses the constant for consistency

---

## Validation Steps

- [x] Run unit test suite: `yarn test:unit` - 30 api-wrappers tests pass, 42 auth-utils tests pass
- [x] Run E2E tests: `yarn test:e2e` - Auth tests passing
- [x] Run TypeScript check: `yarn typecheck` - Pass (2 pre-existing errors in .next/types)
- [x] Run linter: `yarn lint` - Pass
- [x] Measure final duplication percentage: **2.91%** (target <3%) ✅

---

## Migration Pattern Reference

### Before (Old Pattern)
```typescript
export async function GET(request: NextRequest, context: { params: { id: string } }) {
  try {
    const { id } = context.params;
    if (!id || !isValidUuid(id)) {
      return createValidationError("Invalid id format");
    }
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) {
      return createAuthError();
    }
    // ... business logic
  } catch (error) {
    return handleApiError(error, "Failed to load resource");
  }
}
```

### After (New Pattern)
```typescript
import type { NextRequest } from "next/server";
import { withAuth, type AuthenticatedContext, createSuccessResponse } from "@/lib/middleware/api-wrappers";

export const GET = withAuth(
  async (_request: NextRequest, { user, supabase, params }: AuthenticatedContext) => {
    const uuidResult = validateUuidParam(params.id, "resource");
    if ("error" in uuidResult) return uuidResult.error;

    // ... business logic only
    return createSuccessResponse({ data });
  },
  { errorMessage: "Failed to load resource" }
);
```

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `/lib/middleware/api-wrappers.ts` | All HOFs for API routes (auth, rate limit, bot blocking) |
| `/lib/middleware/rate-limiter.ts` | Re-exports from api-wrappers (backward compatibility) |
| `/lib/middleware/bot-blocker.ts` | Bot detection logic |
| `/lib/auth/auth-utils.ts` | Auth utilities + `MIN_PASSWORD_LENGTH` constant + `validatePassword()` |
| `/lib/utils/unit-conversions.ts` | Unit conversion utilities |
| `/lib/utils/forecast-freshness.ts` | Forecast freshness + confidence info |
| `/components/forecast/forecast-state-displays.tsx` | Unified forecast state components |
| `/lib/api-utils.ts` | Original API utilities (still used) |
| `/__tests__/lib/middleware/api-wrappers.test.ts` | HOF tests |
| `/__tests__/lib/auth/auth-utils.test.ts` | Auth utilities tests |
| `/docs/API_MIDDLEWARE.md` | Developer guide with patterns, migration, FAQ |
| `/docs/API_MIDDLEWARE_REFERENCE.md` | Technical reference with types, architecture |

---

## Success Metrics

| Metric | Before | Current | Target |
|--------|--------|---------|--------|
| Code Duplication | ~19.3% | **2.91%** ✅ | <3% |
| API Route Boilerplate | ~30 lines/route | ~5 lines/route | ~5 lines/route |
| Batch 1 Routes Migrated | 0/11 | **11/11** ✅ | 11/11 |
| Batch 2 Routes Migrated | 0/6 | **6/6** ✅ | 6/6 |
| Phase 2 Components | 0/6 | **6/6** ✅ | 6/6 |
| Phase 4 Auth Components | 0/2 | **2/2** ✅ | 2/2 |
| Unified API Wrappers | - | **8 wrappers** ✅ | Complete |
| Total Lines Saved (Batch 1) | - | ~224 lines | - |
| Total Lines Saved (Batch 2) | - | ~170 lines | - |
| **Total Lines Saved** | - | **~394 lines** | - |

### New API Wrapper Capabilities (January 2026)

| Wrapper | Purpose |
|---------|---------|
| `withAuth()` | Authentication + error handling |
| `withErrorHandler()` | Centralized try-catch |
| `withRateLimit()` | Rate limiting (backward compatible) |
| `withBotBlocking()` | Bot detection/blocking |
| `withBotBlockingAndRateLimit()` | Bot + rate limit combined |
| `withProtection()` | Unified declarative wrapper |
