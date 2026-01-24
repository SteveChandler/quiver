# Profile API Refactoring Design

**Status:** Proposed
**Created:** 2026-01-20
**Context:** Follow-up to onboarding modal bug fix (commit 92b48fb6)

---

## Background

During the fix for the onboarding modal bug, code review identified several opportunities to improve the profile API architecture. The fix successfully resolved the bug but revealed underlying code quality issues that should be addressed.

### Bug Fix Summary

The onboarding modal was incorrectly showing for existing users because the profile API endpoints were not returning `onboarding_completed_at`. The fix added this field to:
- `/api/profile/[id]/route.ts`
- `/api/profile/route.ts`
- `types/profile.ts` (ProfileDTO type)

7 new API tests were added to prevent regression.

---

## Issues Identified

### 1. Duplicated Field Selections (HIGH PRIORITY)

**Problem:** Both profile API endpoints have nearly identical SELECT statements for profile fields (~70 lines duplicated).

**Current State:**

`/api/profile/[id]/route.ts` has a 25+ field SELECT:
```typescript
const { data: details } = await supabase
  .from("profiles")
  .select(`
    followers_count,
    following_count,
    created_at,
    avatar_url,
    // ... 20+ more fields
    onboarding_completed_at,
    home_beach:beaches!profiles_home_beach_id_fkey(id, name)
  `)
```

**Impact:**
- Future field additions require changes in multiple locations
- Risk of inconsistency between endpoints
- Maintenance overhead

### 2. Architectural Inconsistency (MEDIUM PRIORITY)

**Problem:** Two endpoints use different strategies to fetch `onboarding_completed_at`:

| Endpoint | Strategy | Queries |
|----------|----------|---------|
| `/api/profile/[id]` | Includes in main query | 1 |
| `/api/profile` | Separate query after DTO fetch | 2 |

**Root Cause:** The `profiles_with_home_beach` materialized view (used by `getProfileDTOById`) doesn't include `onboarding_completed_at`.

**Impact:**
- Extra database round-trip for `/api/profile`
- Inconsistent code patterns
- Confusing for future maintainers

### 3. Test Code Duplication (MEDIUM PRIORITY)

**Problem:** All profile API test files have nearly identical mock setup boilerplate (~150 lines repeated).

**Pattern repeated in:**
- `__tests__/api/users/user-profile-route.test.ts`
- `__tests__/api/profile/profile-by-id.test.ts`
- `__tests__/api/profile/profile-route-onboarding.test.ts`

---

## Proposed Solutions

### Solution 1: Profile Field Constants

Create a centralized constants file for profile field selections.

**File:** `lib/profile/constants.ts`

```typescript
export const PROFILE_CORE_FIELDS = [
  'followers_count',
  'following_count',
  'created_at',
  'avatar_url',
  'email',
  'bio',
  'location',
  'experience_level',
  'instagram',
  'onboarding_completed_at',
] as const;

export const PROFILE_PREFERENCE_FIELDS = [
  'surf_styles',
  'preferred_wave_size',
  'preferred_break_type',
  'crowd_preference',
] as const;

export const PROFILE_NOTIFICATION_FIELDS = [
  'notif_push_enabled',
  'notif_forecast_alerts',
  // ... etc
] as const;

export const PROFILE_FULL_SELECT = [
  ...PROFILE_CORE_FIELDS,
  ...PROFILE_PREFERENCE_FIELDS,
  ...PROFILE_NOTIFICATION_FIELDS,
  'home_beach:beaches!profiles_home_beach_id_fkey(id, name)',
].join(',\n  ');
```

**Benefits:**
- Single source of truth
- Easy to extend
- Self-documenting field groups

### Solution 2: Update Materialized View

Add `onboarding_completed_at` to the `profiles_with_home_beach` view.

**Migration:** `YYYYMMDDHHMMSS_add_onboarding_to_profile_view.sql`

```sql
DROP MATERIALIZED VIEW IF EXISTS profiles_with_home_beach;

CREATE MATERIALIZED VIEW profiles_with_home_beach AS
SELECT
  p.id,
  p.full_name,
  p.home_beach_id,
  p.experience_level,
  p.created_at,
  p.updated_at,
  p.onboarding_completed_at,  -- ADD THIS
  b.name as home_beach_name
FROM profiles p
LEFT JOIN beaches b ON p.home_beach_id = b.id;

CREATE UNIQUE INDEX ON profiles_with_home_beach (id);
```

**Benefits:**
- Eliminates extra query in `/api/profile`
- Consistent data access pattern
- Better performance

### Solution 3: Test Helper Factory

Create reusable test helpers for profile API mocking.

**File:** `test-utils/profile-api-test-helpers.ts`

```typescript
export function setupProfileApiMocks(
  mockClient: MockSupabaseClient,
  testData: ProfileTestData
) {
  // Consolidated mock setup logic
}

export function createMockProfileWithOnboarding(
  overrides: Partial<Profile> = {}
): Profile {
  return createMockProfile({
    onboarding_completed_at: null,
    ...overrides,
  });
}
```

**Benefits:**
- 30% reduction in test code
- Eliminates copy-paste errors
- Easier maintenance

---

## Metrics

### Current State

| Metric | Value |
|--------|-------|
| API route lines | ~410 total |
| Duplicated field selections | ~70 lines (17%) |
| Test file lines | ~500 total |
| Duplicated mock setup | ~150 lines (30%) |
| DB queries for `/api/profile` | 2 |

### Target State

| Metric | Value | Change |
|--------|-------|--------|
| API route lines | ~360 | -12% |
| Duplicated field selections | 0 | -100% |
| Test file lines | ~350 | -30% |
| Duplicated mock setup | 0 | -100% |
| DB queries for `/api/profile` | 1 | -50% |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking API response format | Low | High | Comprehensive tests exist |
| View refresh performance | Low | Medium | Use CONCURRENTLY |
| Test refactor breaks coverage | Low | Medium | Run coverage before/after |

---

## Questions for Team

1. Should we add `onboarding_completed_at` to the materialized view, or is there a reason it was excluded?
2. Do we want to standardize on using views for all profile data access?
3. Should we create a shared test fixture system for all API tests?

---

## Next Steps

See: [2026-01-20-profile-api-refactoring-implementation.md](./2026-01-20-profile-api-refactoring-implementation.md)
