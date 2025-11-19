# E2E Testing Architecture - Quiver

This document describes the architecture, patterns, and best practices for end-to-end testing in the Quiver surf application.

## Table of Contents

- [Overview](#overview)
- [Test Structure](#test-structure)
- [Fixtures and Test Data](#fixtures-and-test-data)
- [Helper Utilities](#helper-utilities)
- [Testing Patterns](#testing-patterns)
- [Authentication and User Profiles](#authentication-and-user-profiles)
- [Location and GPS Testing](#location-and-gps-testing)
- [Best Practices](#best-practices)

---

## Overview

The Quiver E2E test suite uses Playwright to provide comprehensive browser automation testing covering:

- **User authentication flows**
- **GPS and location-based features**
- **Home beach management**
- **Beach recommendations**
- **Profile settings**
- **Session tracking**
- **Social features**

### Test Projects

Tests are organized into two Playwright projects:

1. **`guest`** - Unauthenticated tests (login, signup, public pages)
2. **`auth`** - Authenticated tests (uses stored auth state from global setup)

### Directory Structure

```
e2e/
├── fixtures/               # Test data and fixtures
│   ├── test-data.ts       # General test data (timeouts, viewports, beach IDs)
│   ├── location-data.ts   # Location and beach test data
│   └── user-profiles.ts   # User profile fixtures with different states
│
├── utils/                  # Helper utilities
│   ├── auth-helpers.ts    # Authentication verification helpers
│   ├── profile-helpers.ts # Profile management utilities
│   ├── test-helpers.ts    # General test utilities
│   └── location-helpers.ts # Location testing utilities
│
├── *.spec.ts               # Test specification files
├── global-setup.ts         # Authenticates test user before all tests
├── global-teardown.ts      # Cleanup after all tests
└── README.md               # Running tests and setup guide
```

---

## Test Structure

### Naming Conventions

Test files follow these conventions:

- `{feature}-{area}.spec.ts` - Feature-specific tests (e.g., `home-beach-edge-cases.spec.ts`)
- `guest-{feature}.spec.ts` - Unauthenticated tests
- `{feature}.spec.ts` - General feature tests

### Test Organization

Tests are organized using `test.describe` blocks:

```typescript
test.describe('Feature Name - Specific Area', () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup for all tests in this describe block
  });

  test('should do something specific', async ({ page }) => {
    // Test implementation
  });
});
```

### Test Annotations

Use the `@project` annotation to specify which project a test suite belongs to:

```typescript
/**
 * Feature Tests
 * Description of what this test suite covers
 *
 * @project auth
 */
test.describe('Feature Tests', () => {
  // Tests that require authentication
});
```

---

## Fixtures and Test Data

### User Profile Fixtures

**Location:** `e2e/fixtures/user-profiles.ts`

Provides test user profiles with different home beach configurations:

```typescript
import { TEST_USER_PROFILES, TEST_USER_SCENARIOS } from './fixtures/user-profiles';

// User with no home beach set
TEST_USER_PROFILES.withoutHomeBeach;

// User with valid home beach
TEST_USER_PROFILES.withHomeBeach;

// User with invalid/orphaned home beach reference
TEST_USER_PROFILES.withInvalidHomeBeach;
```

### Test Scenarios

Predefined scenarios for common test cases:

```typescript
import { TEST_USER_SCENARIOS } from './fixtures/user-profiles';

// GPS-only mode (no home beach)
const scenario = TEST_USER_SCENARIOS.gpsOnly;
expect(scenario.expectedHeading).toBe('Forecast for Home Beach');

// Home beach fallback (GPS denied)
const fallbackScenario = TEST_USER_SCENARIOS.homeBeachFallback;
```

### Location Test Data

**Location:** `e2e/fixtures/location-data.ts`

Provides location and beach test data:

```typescript
import { TEST_LOCATIONS, MOCK_RANKED_BEACHES } from './fixtures/location-data';

// Test with specific location
const laJolla = TEST_LOCATIONS.laJolla;
// { city: "La Jolla", state: "CA", country: "USA" }
```

### General Test Data

**Location:** `e2e/fixtures/test-data.ts`

Provides timeouts, viewports, and test configuration:

```typescript
import { TIMEOUTS, VIEWPORTS, TEST_BEACH_IDS } from './fixtures/test-data';

// Use standardized timeouts
await expect(element).toBeVisible({ timeout: TIMEOUTS.long });

// Use predefined viewports
await page.setViewportSize(VIEWPORTS.mobile);
```

---

## Helper Utilities

### Profile Management Helpers

**Location:** `e2e/utils/profile-helpers.ts`

Utilities for managing test user profiles and home beach configuration:

```typescript
import {
  setupTestUserProfile,
  setHomeBeach,
  clearHomeBeach,
  setInvalidHomeBeach,
  getHomeBeachName,
  getCurrentUserProfile,
  logProfileState,
} from './utils/profile-helpers';

// Example: Set up user with specific home beach
test('should show home beach fallback', async ({ page }) => {
  await setupTestUserProfile(page, { homeBeach: 'Windansea Beach' });
  // Test continues...
});

// Example: Clear home beach for "no home beach" test
test('should handle no home beach', async ({ page }) => {
  await clearHomeBeach(page);
  // Test continues...
});

// Example: Get current profile state for assertions
test('should update profile correctly', async ({ page }) => {
  const profile = await getCurrentUserProfile(page);
  expect(profile.home_beach_id).toBeTruthy();
});
```

### Authentication Helpers

**Location:** `e2e/utils/auth-helpers.ts`

Utilities for verifying and debugging authentication:

```typescript
import {
  verifySupabaseAuth,
  waitForAuthCompletion,
  getAuthTokens,
  logAuthState,
} from './utils/auth-helpers';

// Verify user is authenticated
const isAuthenticated = await verifySupabaseAuth(page);
expect(isAuthenticated).toBe(true);

// Debug authentication issues
await logAuthState(page, 'After Login');
```

### General Test Helpers

**Location:** `e2e/utils/test-helpers.ts`

General-purpose test utilities:

```typescript
import { waitForPageLoad } from './utils/test-helpers';

// Wait for page to fully load
await waitForPageLoad(page);
```

---

## Testing Patterns

### Pattern 1: GPS and Location Testing

Test GPS-based features with proper permission setup:

```typescript
test('should use GPS location when available', async ({ page, context }) => {
  // Grant geolocation permission
  await context.grantPermissions(['geolocation']);

  // Set specific GPS coordinates
  await context.setGeolocation({
    latitude: 32.8473,
    longitude: -117.2750, // La Jolla area
  });

  await page.goto('/');
  await waitForPageLoad(page);

  // Verify GPS-based content
  const heading = page.getByTestId('forecast-heading');
  await expect(heading).toHaveText('Forecast for Nearby Beaches');
});
```

### Spatial RPC Regression Guard

To ensure the `get_nearby_beaches` Postgres function stays healthy even when the UI has client-side fallbacks, E2E tests use a **console-based regression guard**:

```typescript
// Server action (simplified)
const result = await getNearbyBeaches(lat, lon, radiusMiles);
// When the RPC fails and we fall back to client-side filtering,
// the server action returns { success: true, data, fallbackUsed: true }.

if (result.success && result.data && result.fallbackUsed) {
  console.warn(
    "Spatial function failed, falling back to client-side filtering"
  );
}
```

Playwright tests can attach a `page.on("console")` listener and **fail** if any browser console message contains:

```text
Spatial function failed, falling back to client-side filtering
```

This ensures that:

- The spatial RPC path is exercised in real flows (GPS-based nearby beaches).
- Any DB-level regression (e.g., function referencing a dropped column) becomes an immediate, visible test failure even if the UI still looks “okay” due to client-side distance fallback.

### Pattern 2: Permission State Transitions

Test different permission states:

```typescript
test('should handle permission revocation', async ({ page, context }) => {
  // Start with permission granted
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

  await page.goto('/');
  await waitForPageLoad(page);

  // Verify GPS mode
  const heading = page.getByTestId('forecast-heading');
  await expect(heading).toHaveText('Forecast for Nearby Beaches');

  // Revoke permission mid-session
  await context.clearPermissions();

  // Navigate to trigger refetch
  await page.goto('/map');
  await page.goto('/');
  await waitForPageLoad(page);

  // Should fall back to home beach or show error
  const headingText = await heading.textContent();
  expect(headingText).not.toBe('Forecast for Nearby Beaches');
});
```

### Pattern 3: Home Beach Setup and Testing

Test features with different home beach states:

```typescript
test('should fall back to home beach when GPS denied', async ({ page, context }) => {
  // Setup: Set home beach using beach name (not slug)
  const result = await setHomeBeach(page, 'Windansea Beach');
  expect(result.success).toBe(true);

  // Deny GPS
  await context.clearPermissions();

  await page.goto('/');
  await waitForPageLoad(page);

  // Verify home beach fallback
  const homeBeachName = await getHomeBeachName(page);
  const heading = page.getByTestId('forecast-heading');
  const headingText = await heading.textContent();

  expect(headingText).toContain(homeBeachName);
});
```

### Pattern 4: Edge Case and Error Testing

Test graceful degradation when no location is available:

```typescript
test('should handle no location available gracefully', async ({ page, context }) => {
  // Setup: No home beach + GPS denied
  await clearHomeBeach(page);
  await context.clearPermissions();

  await page.goto('/');
  await waitForPageLoad(page);

  const section = page.getByTestId('forecast-section');
  const error = page.getByTestId('forecast-error');

  // Section should either:
  // 1. Be hidden (graceful degradation)
  // 2. Show clear error message
  const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

  if (sectionVisible) {
    // If visible, should show error
    await expect(error).toBeVisible();
    const errorText = await error.textContent();
    expect(errorText).toMatch(/location|permission|gps|home beach/i);
  }
});
```

### Pattern 5: Loading States and Transitions

Test loading, content, and error state transitions:

```typescript
test('should transition from loading to content', async ({ page, context }) => {
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });

  // Start navigation
  const navigationPromise = page.goto('/');

  // Check for skeleton (loading state)
  const skeleton = page.getByTestId('forecast-skeleton');
  const skeletonAppeared = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

  if (skeletonAppeared) {
    // Wait for skeleton to disappear
    await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
  }

  await navigationPromise;
  await waitForPageLoad(page);

  // Verify content is visible
  const section = page.getByTestId('forecast-section');
  await expect(section).toBeVisible();

  const cards = page.getByTestId('forecast-card');
  expect(await cards.count()).toBeGreaterThan(0);
});
```

### Pattern 6: Accessibility Testing

Test keyboard navigation and screen reader support:

```typescript
test('should be keyboard navigable', async ({ page }) => {
  await page.goto('/');
  await waitForPageLoad(page);

  const firstCard = page.getByTestId('forecast-card').first();
  await firstCard.focus();

  // Verify focus
  const isFocused = await firstCard.evaluate(el => el === document.activeElement);
  expect(isFocused).toBe(true);

  // Test keyboard interaction
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/beach\/.+/);
});

test('should have proper ARIA attributes', async ({ page }) => {
  await page.goto('/');
  await waitForPageLoad(page);

  const error = page.getByTestId('forecast-error');
  const errorVisible = await error.isVisible().catch(() => false);

  if (errorVisible) {
    const role = await error.getAttribute('role');
    const ariaLive = await error.getAttribute('aria-live');

    // Should have alert role or aria-live
    expect(role === 'alert' || ariaLive === 'polite' || ariaLive === 'assertive').toBe(true);
  }
});
```

---

## Authentication and User Profiles

### Global Setup

**Location:** `e2e/global-setup.ts`

The global setup runs once before all tests to authenticate the test user:

1. Navigates to the application
2. Logs in with test credentials
3. Saves authentication state to `e2e/.auth/state.json`
4. All `auth` project tests use this saved state

### Managing User Profiles in Tests

Tests can modify the authenticated user's profile as needed:

```typescript
// Example: Test "no home beach" scenario
test('User with no home beach', async ({ page }) => {
  // Clear home beach for this test
  await clearHomeBeach(page);

  // Reload to apply changes
  await page.reload();
  await waitForPageLoad(page);

  // Test behavior with no home beach
  // ...
});

// Example: Test with specific home beach
test('User with Windansea as home beach', async ({ page }) => {
  // Set home beach
  await setHomeBeach(page, 'windansea');

  // Get beach name for assertions
  const beachName = await getHomeBeachName(page);

  // Test behavior with home beach
  // ...
});
```

### Profile State Isolation

**Important:** Profile changes persist across tests unless explicitly reset. Best practices:

1. **Setup in `beforeEach`:** Reset profile state for each test if needed
2. **Cleanup in `afterEach`:** Restore default state after tests that modify profiles
3. **Use independent test users:** Consider creating multiple test users for parallel execution

```typescript
test.describe('Home Beach Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Reset to known state
    await clearHomeBeach(page);
  });

  test.afterEach(async ({ page }) => {
    // Optional: restore default state
    await setupTestUserProfile(page, { homeBeach: null });
  });

  // Tests...
});
```

---

## Location and GPS Testing

### GPS Coordinates

Use realistic GPS coordinates for your test scenarios:

```typescript
const TEST_COORDINATES = {
  laJolla: { latitude: 32.8473, longitude: -117.2750 },
  blacks: { latitude: 32.8857, longitude: -117.2511 },
  oceanBeach: { latitude: 32.7503, longitude: -117.2534 },
  malibu: { latitude: 34.0259, longitude: -118.7798 },
};
```

### Permission Management

```typescript
// Grant GPS permission
await context.grantPermissions(['geolocation']);

// Deny GPS permission
await context.clearPermissions();

// Set GPS coordinates
await context.setGeolocation({
  latitude: 32.8473,
  longitude: -117.2750,
});
```

### Testing Geolocation Timeout

```typescript
test('should handle geolocation timeout', async ({ page, context }) => {
  // Grant permission but don't set location
  // This simulates a timeout scenario
  await context.grantPermissions(['geolocation']);

  await page.goto('/');

  // Wait longer than the geolocation timeout (10 seconds)
  await page.waitForTimeout(12000);

  // Verify timeout handling
  const error = page.getByTestId('forecast-error');
  const errorVisible = await error.isVisible().catch(() => false);

  if (errorVisible) {
    const errorText = await error.textContent();
    expect(errorText).toBeTruthy();
  }
});
```

---

## Best Practices

### 1. Use Test IDs for Selectors

Always use `data-testid` attributes for test selectors:

```typescript
// Good
const section = page.getByTestId('forecast-section');

// Avoid
const section = page.locator('.forecast-section');
```

### 2. Handle Async Loading Gracefully

Features that fetch data asynchronously should be tested with appropriate timeouts:

```typescript
// Good: Use long timeout for async data loading
await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

// Good: Handle cases where element might not appear
const visible = await element.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

if (!visible) {
  test.skip(true, 'Element not available');
  return;
}
```

### 3. Test Multiple States

Always test:
- Loading state (skeleton/spinner)
- Success state (data displayed)
- Error state (error message)
- Empty state (no data available)

### 4. Use Meaningful Test Names

```typescript
// Good
test('should display GPS-based recommendations when location permission granted', async ({ page }) => {
  // ...
});

// Avoid
test('test 1', async ({ page }) => {
  // ...
});
```

### 5. Log Debugging Information

Use logging helpers to aid debugging:

```typescript
await logProfileState(page, 'Before Test');
// [Before Test] { userId: '...', homeBeachId: '...', ... }

await logAuthState(page, 'After Login');
// [After Login] Auth tokens found: 3 cookies, 2 storage entries
```

### 6. Clean Up After Tests

```typescript
test.afterEach(async ({ page }) => {
  // Remove request mocks
  await page.unroute('**/api/**');

  // Restore default permissions
  await context.grantPermissions(['geolocation']);
});
```

### 7. Test in Different Viewport Sizes

```typescript
test('should work on mobile', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  // Test mobile-specific behavior
});

test('should work on desktop', async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  // Test desktop-specific behavior
});
```

### 8. Verify Data Integrity

When testing features that depend on database state:

```typescript
test('should handle orphaned home beach reference', async ({ page }) => {
  // Set invalid home beach ID
  await setInvalidHomeBeach(page);

  // Verify graceful handling
  const error = page.getByTestId('forecast-error');
  const errorVisible = await error.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

  // Either shows error or hides section
  expect(errorVisible).toBe(true);
});
```

---

## Test Coverage Areas

### Current Coverage


✅ Home Beach Fallback Mode
- GPS denied + home beach set → Show home beach results
- Home beach heading with beach name
- Fallback when GPS unavailable

✅ No Location Available
- GPS denied + no home beach → Error state or hidden section
- Clear error messaging
- Actionable user guidance

✅ GPS Permission State Transitions
- Permission prompt state
- Mid-session permission revocation
- Permission grant after denial
- Browser geolocation blocked
- Geolocation API unavailable (legacy browsers)

✅ Permission State Persistence
- Permission state across page reloads
- Permission state in new tabs/windows

✅ Geolocation Timeout Handling
- Timeout state after 10+ seconds
- Retry capability after timeout

✅ Edge Cases
- Invalid/orphaned home beach reference
- Home beach with null coordinates
- Mid-session home beach changes
- Stale data handling

✅ Loading States
- Skeleton display during load
- Transition from loading to content
- Transition from loading to error

✅ Error States
- Clear, actionable error messages
- Proper ARIA attributes for accessibility
- Error styling validation

✅ Accessibility
- Heading hierarchy
- Keyboard navigation
- Focus management
- Color contrast for badges
- Screen reader announcements

### Future Coverage (Planned)

🔄 Integration Scenarios
- Complete user flows (GPS → Home Beach → Set in Profile)
- Session timezone changes
- Offline fallback behavior

🔄 Mobile-Specific Scenarios
- App backgrounding/resumption
- Battery saver mode effects
- App reinstall (localStorage loss)

🔄 Performance Regression Tests
- Slow network (3G/LTE) simulation
- Large beach database (1000+ beaches)
- Memory leak detection

---

## Troubleshooting

### Tests Failing with "Section not visible"

This is expected behavior when:
- User has no home beach AND GPS is denied
- The section should gracefully hide in this scenario

Tests should handle this:

```typescript
const sectionVisible = await section.isVisible({ timeout: TIMEOUTS.long }).catch(() => false);

if (!sectionVisible) {
  test.skip(true, 'Section appropriately hidden');
  return;
}
```

### Authentication State Lost

If tests fail with authentication errors:

1. Delete saved state: `rm e2e/.auth/state.json`
2. Re-run global setup: `npx playwright test --global-setup-only`
3. Verify test credentials in `.env.playwright`

### Geolocation Not Working

Ensure you're granting permissions AND setting coordinates:

```typescript
// Both are required
await context.grantPermissions(['geolocation']);
await context.setGeolocation({ latitude: 32.8473, longitude: -117.2750 });
```

### Profile Changes Not Persisting

Profile helper functions execute client-side code. If they fail:

1. Ensure Supabase client is initialized
2. Check browser console for errors
3. Verify RLS policies allow profile updates
4. Use `logProfileState()` to debug

---

## Contributing

When adding new tests:

1. **Follow existing patterns** - Use established fixtures and helpers
2. **Add fixtures** - Create reusable test data in `e2e/fixtures/`
3. **Create helpers** - Add utilities to `e2e/utils/` for common operations
4. **Document patterns** - Update this ARCHITECTURE.md with new patterns
5. **Test accessibility** - Include keyboard navigation and ARIA tests
6. **Handle edge cases** - Test error states and graceful degradation
7. **Use meaningful names** - Clear test and variable names
8. **Add comments** - Explain complex test logic

### Pull Request Checklist

- [ ] Tests pass locally
- [ ] New fixtures added to `e2e/fixtures/`
- [ ] Helper utilities created for reusable logic
- [ ] Documentation updated (this file and/or README.md)
- [ ] Accessibility tests included
- [ ] Edge cases covered
- [ ] Mobile viewports tested

---

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Quiver E2E README](./README.md) - Running tests and setup
- [Test Data Fixtures](./fixtures/) - Reusable test data
- [Helper Utilities](./utils/) - Test helper functions
- [Quiver CLAUDE.md](../CLAUDE.md) - Project overview and guidelines
