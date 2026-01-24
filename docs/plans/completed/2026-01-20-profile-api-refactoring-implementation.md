# Profile API Refactoring Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate duplicated profile API code, improve consistency, and reduce test boilerplate.

**Architecture:** Incremental refactoring preserving existing behavior. All changes covered by existing tests plus new regression tests.

**Tech Stack:** Next.js 14+, TypeScript, Supabase, Jest

**Estimated Total Effort:** 3-4 hours

---

## Table of Contents

1. [Phase 1: Field Selection Constants (1 hour)](#phase-1-field-selection-constants)
2. [Phase 2: Materialized View Update (1 hour)](#phase-2-materialized-view-update)
3. [Phase 3: Test Helper Consolidation (1 hour)](#phase-3-test-helper-consolidation)

---

## Phase 1: Field Selection Constants

**Duration:** 1 hour
**Impact:** Eliminates 70 lines of duplication, single source of truth for fields

### Task 1.1: Create Profile Constants File

**Files:**
- Create: `lib/profile/constants.ts`
- Test: `__tests__/lib/profile/constants.test.ts`

**Step 1: Write the test**

```typescript
// __tests__/lib/profile/constants.test.ts
import {
  PROFILE_CORE_FIELDS,
  PROFILE_PREFERENCE_FIELDS,
  PROFILE_NOTIFICATION_FIELDS,
  PROFILE_FULL_SELECT,
} from '@/lib/profile/constants';

describe('profile constants', () => {
  describe('PROFILE_CORE_FIELDS', () => {
    it('should include onboarding_completed_at', () => {
      expect(PROFILE_CORE_FIELDS).toContain('onboarding_completed_at');
    });

    it('should include essential profile fields', () => {
      expect(PROFILE_CORE_FIELDS).toContain('followers_count');
      expect(PROFILE_CORE_FIELDS).toContain('following_count');
      expect(PROFILE_CORE_FIELDS).toContain('created_at');
    });
  });

  describe('PROFILE_FULL_SELECT', () => {
    it('should be a non-empty string', () => {
      expect(typeof PROFILE_FULL_SELECT).toBe('string');
      expect(PROFILE_FULL_SELECT.length).toBeGreaterThan(0);
    });

    it('should include home_beach relation', () => {
      expect(PROFILE_FULL_SELECT).toContain('home_beach:beaches');
    });

    it('should include onboarding_completed_at', () => {
      expect(PROFILE_FULL_SELECT).toContain('onboarding_completed_at');
    });
  });
});
```

**Step 2: Create the constants file**

```typescript
// lib/profile/constants.ts
/**
 * Profile Field Selection Constants
 *
 * Centralized field lists for profile API queries.
 * Ensures consistency across endpoints and simplifies maintenance.
 *
 * @see /app/api/profile/[id]/route.ts
 * @see /app/api/profile/route.ts
 */

/** Core profile fields - always included in profile responses */
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

/** Surf preference fields */
export const PROFILE_PREFERENCE_FIELDS = [
  'surf_styles',
  'preferred_wave_size',
  'preferred_break_type',
  'crowd_preference',
] as const;

/** Notification preference fields */
export const PROFILE_NOTIFICATION_FIELDS = [
  'notif_push_enabled',
  'notif_forecast_alerts',
  'notif_email_enabled',
  'notif_inapp_enabled',
  'notif_session_invites',
  'notif_likes',
  'notif_follows',
  'notif_reminders',
  'notif_xp_updates',
] as const;

/** Complete SELECT string for profile queries with home beach join */
export const PROFILE_FULL_SELECT = [
  ...PROFILE_CORE_FIELDS,
  ...PROFILE_PREFERENCE_FIELDS,
  ...PROFILE_NOTIFICATION_FIELDS,
  'home_beach:beaches!profiles_home_beach_id_fkey(id, name)',
].join(',\n        ');

/** Minimal SELECT for onboarding status check only */
export const PROFILE_ONBOARDING_SELECT = 'onboarding_completed_at';
```

**Step 3: Run test to verify**

```bash
yarn test:unit -- --testPathPattern="constants"
```

### Task 1.2: Update /api/profile/[id] to Use Constants

**Files:**
- Modify: `app/api/profile/[id]/route.ts`

**Step 1: Import constants**

```typescript
import { PROFILE_FULL_SELECT } from '@/lib/profile/constants';
```

**Step 2: Replace inline SELECT with constant**

```typescript
// Before (25+ lines):
const { data: details } = await supabase
  .from("profiles")
  .select(`
    followers_count,
    following_count,
    // ... many more lines
  `)

// After (3 lines):
const { data: details } = await supabase
  .from("profiles")
  .select(PROFILE_FULL_SELECT)
  .eq("id", userId)
  .single();
```

**Step 3: Run existing tests**

```bash
yarn test:unit -- --testPathPattern="profile"
```

**Verification:** All 301 profile tests should pass.

---

## Phase 2: Materialized View Update

**Duration:** 1 hour
**Impact:** Eliminates extra DB query, consistent data access

### Task 2.1: Create Migration for View Update

**Files:**
- Create: `supabase/migrations/YYYYMMDDHHMMSS_add_onboarding_to_profile_view.sql`

**Step 1: Check current view definition**

```bash
# Connect to database and inspect view
supabase db dump --schema public | grep -A 50 "profiles_with_home_beach"
```

**Step 2: Create migration**

```sql
-- supabase/migrations/20260120100000_add_onboarding_to_profile_view.sql
-- Add onboarding_completed_at to profiles_with_home_beach view
-- This allows the /api/profile endpoint to fetch the field in one query

BEGIN;

-- Drop and recreate the view with the new field
DROP MATERIALIZED VIEW IF EXISTS profiles_with_home_beach;

CREATE MATERIALIZED VIEW profiles_with_home_beach AS
SELECT
  p.id,
  p.full_name,
  p.home_beach_id,
  p.experience_level,
  p.created_at,
  p.updated_at,
  p.onboarding_completed_at,
  b.name as home_beach_name
FROM profiles p
LEFT JOIN beaches b ON p.home_beach_id = b.id;

-- Recreate unique index for CONCURRENTLY refresh
CREATE UNIQUE INDEX profiles_with_home_beach_id_idx ON profiles_with_home_beach (id);

COMMIT;
```

**Step 3: Apply migration locally**

```bash
supabase db push
```

### Task 2.2: Update getProfileDTOById Fetcher

**Files:**
- Modify: `lib/profile/fetchers.ts`

**Step 1: Add onboarding_completed_at to SELECT**

```typescript
export async function getProfileDTOById(userId: string, client?: any): Promise<ProfileDTO | null> {
  const supabase = client || (await createSupabaseServerClient());
  const { data, error } = await supabase
    .from("profiles_with_home_beach")
    .select("id, full_name, home_beach_id, home_beach_name, experience_level, created_at, updated_at, onboarding_completed_at")
    .eq("id", userId)
    .single();

  if (error) throw error;

  return {
    id: data.id,
    full_name: data.full_name ?? null,
    home_beach_id: data.home_beach_id ?? null,
    homeBeachName: data.home_beach_name ?? null,
    experience_level: data.experience_level ?? null,
    created_at: data.created_at ?? null,
    updated_at: data.updated_at ?? null,
    onboarding_completed_at: data.onboarding_completed_at ?? null,
  } as ProfileDTO;
}
```

### Task 2.3: Simplify /api/profile Route

**Files:**
- Modify: `app/api/profile/route.ts`

**Step 1: Remove separate onboarding query**

```typescript
// REMOVE these lines (24-28):
const { data: onboardingData } = await supabase
  .from("profiles")
  .select("onboarding_completed_at")
  .eq("id", user.id)
  .single();

// UPDATE response to use DTO directly:
onboarding_completed_at: dto.onboarding_completed_at ?? null,
```

**Step 2: Run tests**

```bash
yarn test:unit -- --testPathPattern="profile"
```

---

## Phase 3: Test Helper Consolidation

**Duration:** 1 hour
**Impact:** 30% reduction in test code, easier maintenance

### Task 3.1: Create Profile Test Helpers

**Files:**
- Create: `test-utils/profile-api-test-helpers.ts`

**Step 1: Create helper file**

```typescript
// test-utils/profile-api-test-helpers.ts
/**
 * Profile API Test Helpers
 *
 * Consolidated mock setup for profile endpoint tests.
 * Reduces boilerplate and ensures consistent test patterns.
 */

import { createMockProfile } from './api-test-helpers';
import type { Profile } from '@/types/database';

export interface ProfileTestData {
  profileData: Partial<Profile>;
  sessions?: Array<{ id: number; rating: number; status: string }>;
  homeBeach?: { id: string; name: string } | null;
}

/**
 * Sets up Supabase mock for profile API tests
 */
export function setupProfileApiMocks(
  mockClient: any,
  testData: ProfileTestData
): void {
  const { profileData, sessions = [], homeBeach = null } = testData;

  const createMockChain = (data: any) => ({
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({ data, error: null })),
  });

  (mockClient.from as jest.Mock).mockImplementation((tableName: string) => {
    switch (tableName) {
      case 'profiles':
        return createMockChain(profileData);

      case 'sessions':
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          data: sessions,
          error: null,
        };

      case 'beaches':
        return createMockChain(homeBeach);

      default:
        return createMockChain(null);
    }
  });
}

/**
 * Creates mock profile with onboarding field defaulted
 */
export function createMockProfileWithOnboarding(
  overrides: Partial<Profile> = {}
): Partial<Profile> {
  return createMockProfile({
    onboarding_completed_at: null,
    ...overrides,
  });
}

/**
 * Asserts onboarding_completed_at field in response
 */
export function expectOnboardingField(
  responseData: any,
  expectedValue: string | null
): void {
  expect(responseData).toHaveProperty('onboarding_completed_at');
  expect(responseData.onboarding_completed_at).toBe(expectedValue);
}
```

### Task 3.2: Refactor Existing Tests to Use Helpers

**Files:**
- Modify: `__tests__/api/profile/profile-route-onboarding.test.ts`
- Modify: `__tests__/api/profile/profile-by-id.test.ts`
- Modify: `__tests__/api/users/user-profile-route.test.ts`

**Example refactored test:**

```typescript
// Before (~50 lines of setup per test):
it("returns onboarding_completed_at when completed", async () => {
  const profilesChain: any = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn(() => Promise.resolve({
      data: { id: userId, onboarding_completed_at: completionDate, /* ... */ },
      error: null,
    })),
  };
  // ... more setup
});

// After (~10 lines):
it("returns onboarding_completed_at when completed", async () => {
  setupProfileApiMocks(mockSupabaseClient, {
    profileData: createMockProfileWithOnboarding({
      id: userId,
      onboarding_completed_at: completionDate,
    }),
  });

  const response = await GET(request, { params: { id: userId } });
  const data = await expectSuccessResponse(response, 200);

  expectOnboardingField(data.data, completionDate);
});
```

**Step 2: Run all tests**

```bash
yarn test:unit -- --testPathPattern="profile|onboarding"
```

**Verification:** All tests pass, coverage maintained.

---

## Verification Checklist

After completing all phases:

- [ ] `yarn typecheck` passes
- [ ] `yarn test:unit -- --testPathPattern="profile"` - all tests pass
- [ ] `yarn build` completes successfully
- [ ] Manual test: existing user doesn't see onboarding modal
- [ ] Manual test: new user does see onboarding modal
- [ ] Code review completed

---

## Rollback Plan

If issues arise:

1. **Phase 1 (Constants):** Revert to inline SELECT strings
2. **Phase 2 (View):** Run reverse migration to restore original view
3. **Phase 3 (Tests):** Revert test files to original mock patterns

All changes are isolated and can be rolled back independently.

---

## Success Metrics

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Duplicated field selections | 70 lines | 0 | 0 |
| Test mock boilerplate | 150 lines | ~50 lines | <60 lines |
| DB queries for `/api/profile` | 2 | 1 | 1 |
| All tests passing | 301 | 301+ | 301+ |
