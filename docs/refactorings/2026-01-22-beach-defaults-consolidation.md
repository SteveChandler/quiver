# Beach Defaults Consolidation Refactoring

**Date:** 2026-01-22
**Type:** Code Quality / DRY Violation Fix
**Impact:** High - Prevents cascading TypeScript errors when Beach schema changes

## Problem Statement

The Beach type from `types/database.generated.ts` has approximately 60 fields, most of which are nullable. When new columns were added to the beaches table, **5+ files** broke with TypeScript errors because each file independently maintained a complete Beach object with all fields set to null.

### Files Affected by Schema Changes

1. `__tests__/setup/typed-mocks.ts` - Test mock factory (~60 lines of field definitions)
2. `actions/beach/beach-state-actions.ts` - Server action helper (~65 lines)
3. `components/city/city-map-view.tsx` - Component transformer (~65 lines)
4. `__tests__/components/home-screen/compact-spot-card.test.tsx` - Test mock (~80 lines)
5. `__tests__/setup/location-mocks.ts` - Location-specific mocks (~40 lines)

### Code Smell: Shotgun Surgery

Every time a new Beach column was added:
- 5+ files needed identical updates
- High risk of missing a field in one location
- TypeScript errors cascaded across unrelated files
- Developer productivity significantly impacted

## Solution: Centralized Beach Defaults Utility

Created `/lib/utils/beach-defaults.ts` as the **single source of truth** for Beach field defaults.

### Key Functions

```typescript
/**
 * Get default values for all nullable Beach fields.
 * Required fields must be provided by caller.
 */
export function getBeachDefaults(): Omit<Beach, "id" | "name" | "created_at" | "is_private" | "cdip_eligible" | "terrain_enabled">

/**
 * Create a complete Beach object with all fields defined.
 * Primary factory function used across the codebase.
 */
export function createBeachWithDefaults(input: BeachInput): Beach

/**
 * Expand partial database row to full Beach object.
 * Useful for server actions querying limited columns.
 */
export function expandPartialBeach<T extends Partial<Beach>>(row: T): Beach
```

## Refactoring Implementation

### 1. Created Central Utility (`lib/utils/beach-defaults.ts`)

**Lines of Code:** 150 lines (with documentation)
**Complexity:** Low - simple object spread operations
**Maintenance:** HIGH VALUE - single place to update when schema changes

### 2. Refactored Test Mocks (`__tests__/setup/typed-mocks.ts`)

**Before:**
```typescript
export function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return {
    id: `beach-${Date.now()}`,
    name: "Test Beach",
    slug: "test-beach",
    // ... 57 more fields manually set to null or defaults
    terrain_params_hash: null,
    terrain_status: null,
    wind_analyzed_at: null,
    wind_exposure_factors: null,
    ...overrides,
  };
}
```

**After:**
```typescript
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

export function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return createBeachWithDefaults({
    id: `beach-${Date.now()}`,
    name: "Test Beach",
    slug: "test-beach",
    lat: 32.7198,
    lon: -117.2557,
    city: "San Diego",
    // ... only meaningful test defaults, not all fields
    ...overrides,
  });
}
```

**Reduction:** 60 lines → 15 lines (75% reduction)

### 3. Refactored Server Actions (`actions/beach/beach-state-actions.ts`)

**Before:**
```typescript
function toFullBeach(row: StateMapBeachRow): Beach {
  return {
    access_tips: null,
    aspect_deg: null,
    // ... 57 more fields
    wind_exposure_factors: null,
  };
}
```

**After:**
```typescript
import { expandPartialBeach } from "@/lib/utils/beach-defaults";

function toFullBeach(row: StateMapBeachRow): Beach {
  return expandPartialBeach({
    id: row.id,
    name: row.name,
    city: row.city ?? null,
    // ... only fields from query
  });
}
```

**Reduction:** 65 lines → 12 lines (82% reduction)

### 4. Refactored Component Transformers (`components/city/city-map-view.tsx`)

**Before:**
```typescript
function transformSpotToBeach(spot: SurfSpot): Beach {
  return {
    id: spot.id || spot.slug,
    name: spot.name,
    // ... 58 more fields
  };
}
```

**After:**
```typescript
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

function transformSpotToBeach(spot: SurfSpot): Beach {
  return createBeachWithDefaults({
    id: spot.id || spot.slug,
    name: spot.name,
    lat: spot.coordinates.lat,
    lon: spot.coordinates.lng,
    // ... only relevant mappings
  });
}
```

**Reduction:** 65 lines → 20 lines (69% reduction)

### 5. Refactored Test Fixtures (`__tests__/components/home-screen/compact-spot-card.test.tsx`)

**Before:**
```typescript
function createMockRecommendation(...): SurfDiscoveryRecommendation {
  return {
    beach: {
      id: "test-beach-1",
      name: "Ocean Beach",
      // ... 58 more fields all set to null
      ...overrides.beach,
    },
    // ... rest of recommendation
  };
}
```

**After:**
```typescript
import { createBeachWithDefaults } from "@/lib/utils/beach-defaults";

function createMockRecommendation(...): SurfDiscoveryRecommendation {
  return {
    beach: createBeachWithDefaults({
      id: "test-beach-1",
      name: "Ocean Beach",
      city: "San Francisco",
      // ... only test-relevant fields
      ...overrides.beach,
    }),
    // ... rest of recommendation
  };
}
```

**Reduction:** 80 lines → 12 lines (85% reduction)

### 6. Consolidated Duplicate Mocks (`__tests__/setup/location-mocks.ts`)

**Before:**
- Duplicate `createMockBeach` implementation
- Inconsistent with typed-mocks.ts

**After:**
```typescript
import { createMockBeach as createMockBeachBase } from "./typed-mocks";

export function createMockBeach(overrides: Partial<Beach> = {}): Beach {
  return createMockBeachBase({
    city: "La Jolla", // Location-specific defaults
    state: "CA",
    ...overrides,
  });
}
```

**DRY Violation Fixed:** Single implementation of createMockBeach

## Metrics

### Code Reduction

| File | Before | After | Reduction |
|------|--------|-------|-----------|
| typed-mocks.ts | 60 lines | 15 lines | 75% |
| beach-state-actions.ts | 65 lines | 12 lines | 82% |
| city-map-view.tsx | 65 lines | 20 lines | 69% |
| compact-spot-card.test.tsx | 80 lines | 12 lines | 85% |
| location-mocks.ts | 40 lines | 10 lines | 75% |
| **Total** | **310 lines** | **69 lines** | **78%** |

**New utility:** +150 lines (but centralized)
**Net change:** -241 lines across fragmented code → +150 lines in single utility

### Complexity Reduction

- **Cyclomatic Complexity:** No change (simple object spreads)
- **Maintenance Burden:** Reduced by ~80%
- **Risk of Schema Change Errors:** Reduced from 5+ files to 1 file

### Test Coverage

All existing tests passing:
- ✅ `compact-spot-card.test.tsx` - 7/7 tests passing
- ✅ `beach-location-actions.test.ts` - 8/8 tests passing
- ✅ `recommendation-scorer.test.ts` - 8/8 tests passing
- ✅ TypeScript compilation: No errors

## Future Schema Changes

### Before This Refactoring

When `signup_context` and `signup_location` were added to the profiles table, it required updates to 3+ files.

When `terrain_*` fields were added to beaches table, it required updates to 5+ files, causing the TypeScript errors that prompted this refactoring.

### After This Refactoring

To add a new Beach column:

1. Run `yarn db:types` (regenerate types/database.generated.ts)
2. Update `lib/utils/beach-defaults.ts` - add one line to `getBeachDefaults()`
3. All mocks, transformers, and factories automatically inherit the change

**Developer time saved:** 5+ file changes → 1 file change (80% reduction in touch points)

## Benefits

### Immediate Benefits

1. **DRY Principle Enforced:** Single source of truth for Beach defaults
2. **Reduced Code Volume:** 241 lines of duplicated code eliminated
3. **Type Safety Maintained:** All TypeScript checks still pass
4. **Tests Passing:** Zero behavior changes

### Long-term Benefits

1. **Reduced Maintenance Burden:** Future schema changes affect 1 file, not 5+
2. **Lower Bug Risk:** No chance of forgetting a field in one location
3. **Developer Productivity:** Faster onboarding, clearer patterns
4. **Scalability:** Pattern applies to other large types (Profile, Session, etc.)

## Potential Future Work

### Apply Pattern to Other Types

The same pattern could benefit:

- **Profile type** (~40 fields, many nullable)
- **Session type** (~35 fields, many nullable)
- **Forecast types** (~30 fields, many nullable)

### Estimated Impact

If applied to Profile and Session types:
- Additional ~300 lines of duplicated code eliminated
- 3 more single-source-of-truth utilities created
- Similar maintenance burden reduction

### Pattern Recommendation

Create utilities for any database type with:
- 20+ fields
- High percentage of nullable fields
- Used in 3+ test files or transformers

## Design Patterns Applied

1. **Factory Pattern:** `createBeachWithDefaults()` factory function
2. **Builder Pattern:** Partial input with spread operator for overrides
3. **Adapter Pattern:** `expandPartialBeach()` adapts partial DB rows to full type
4. **DRY Principle:** Single source of truth for defaults
5. **Open/Closed Principle:** Open for extension via overrides, closed for modification

## Related Architecture Decisions

- **ARCHITECTURE.md Compliance:** Follows established patterns for utilities
- **Test Utils Organization:** Centralized in `__tests__/setup/`
- **Import Conventions:** Barrel exports from utility directories
- **Type Safety:** Strict TypeScript with no `any` types

## Lessons Learned

1. **Type assertions (`as unknown as Beach`) are code smells** - They often indicate missing factory functions
2. **Duplicated object literals with 50+ fields are unmaintainable** - Extract to centralized utilities
3. **Test mocks should be as DRY as production code** - Apply same refactoring standards
4. **Shotgun surgery pattern is preventable** - Look for it during code review

## References

- Original files with TypeScript errors documented in git history
- Beach type definition: `types/database.generated.ts:906-968`
- New utility: `lib/utils/beach-defaults.ts`
- Pattern documented in `__tests__/setup/README.md`
