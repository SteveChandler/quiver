# E2E Testing Architecture - Quiver

This document describes the architecture, patterns, and best practices for end-to-end testing in the Quiver surf application.

## Table of Contents

- [Overview](#overview)
- [Test Environments](#test-environments)
- [Test Structure](#test-structure)
- [Fixtures and Test Data](#fixtures-and-test-data)
- [Helper Utilities](#helper-utilities)
- [Testing Patterns](#testing-patterns)
- [Authentication and User Profiles](#authentication-and-user-profiles)
- [Persona-Based Testing](#persona-based-testing)
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
- **Multi-user interactions** (via persona testing)

### Test Projects

Tests are organized into three Playwright projects:

1. **`guest`** - Unauthenticated tests (login, signup, public pages)
2. **`auth`** - Authenticated tests (uses stored auth state from global setup)
3. **`personas`** - Multi-user persona tests (6 NPC personalities for social/community features)

### Directory Structure

```
e2e/
├── fixtures/               # Test data and fixtures
│   ├── test-data.ts       # General test data (timeouts, viewports, beach IDs)
│   ├── location-data.ts   # Location and beach test data
│   ├── user-profiles.ts   # User profile fixtures with different states
│   └── personas.ts        # Persona type definitions (6 NPC personalities)
│
├── utils/                  # Helper utilities
│   ├── auth-helpers.ts    # Authentication verification helpers
│   ├── profile-helpers.ts # Profile management utilities
│   ├── test-helpers.ts    # General test utilities
│   ├── location-helpers.ts # Location testing utilities
│   ├── persona-auth.ts    # Multi-user authentication for personas
│   ├── persona-content-generators.ts  # Persona-style content generation
│   └── persona-helpers.ts # High-level persona test helpers
│
├── personas/               # Per-persona test specs
│   ├── rookie.spec.ts
│   ├── local.spec.ts
│   ├── traveler.spec.ts
│   ├── photographer.spec.ts
│   ├── tactical.spec.ts
│   └── competitor.spec.ts
│
├── persona-features/       # Cross-persona feature tests
│   ├── intel-posts.spec.ts
│   ├── session-logging.spec.ts
│   ├── session-planning.spec.ts
│   ├── discovery-follow.spec.ts
│   └── profiles.spec.ts
│
├── api/                    # API contract tests
│   └── *.spec.ts
│
├── *.spec.ts               # Test specification files
├── global-setup.ts         # Authenticates test user before all tests
├── global-teardown.ts      # Cleanup after all tests
├── persona-setup.ts        # Authenticates all 6 personas
├── ARCHITECTURE.md         # This file
├── PERSONAS.md             # Comprehensive persona testing documentation
└── README.md               # Running tests and setup guide
```

---

## Test Environments

### Default Configuration: Localhost

**By default, Playwright tests run against `http://localhost:3000`.**

The test configuration is designed to work seamlessly with your local development environment:

- **Automatic dev server startup**: If the dev server isn't already running, Playwright will automatically start it using `npm run dev`
- **Server reuse**: If the dev server is already running, Playwright will reuse it (`reuseExistingServer: true`)
- **No manual setup needed**: Just run `npm run test:e2e` and tests will execute against localhost

### Configuration Files

Test environment settings are managed through:

- `.env.playwright` - shared/default Playwright settings
- `.env.playwright.local` - developer-local overrides (optional; recommended for localhost-only toggles)

```bash
# Default configuration
TEST_ENV=local
BASE_URL=http://localhost:3000
```

Env precedence for Playwright runs:

- CLI / OS env (highest)
- `.env.playwright.local`
- `.env.playwright`
- `.env` (lowest)

This allows you to keep `.env.playwright` as the shared baseline for Supabase + test user credentials while using `.env.playwright.local` for localhost-only overrides (e.g., `BASE_URL=http://localhost:3000`, headed/debug toggles).

### Running Tests Against Different Environments

#### Option 1: Use npm Scripts (Recommended)

```bash
# Run against localhost (default)
npm run test:e2e
npm run test:e2e:headed          # With browser visible
npm run test:e2e:ui               # With Playwright UI

# Run against dev environment
npm run test:e2e:dev
npm run test:e2e:dev:ui

# Run persona tests
npm run test:e2e:personas
npm run test:e2e:personas:dev    # Against dev environment
```

#### Option 2: Set Environment Variables

```bash
# Override BASE_URL for a single test run
BASE_URL=https://dev.quiversurf.app npm run test:e2e

# Or export for multiple commands
export BASE_URL=https://dev.quiversurf.app
npm run test:e2e
```

#### Option 3: Edit `.env.playwright`

For longer testing sessions against a specific environment:

```bash
# Change these values in .env.playwright
TEST_ENV=dev
BASE_URL=https://dev.quiversurf.app
# Uncomment VERCEL_AUTOMATION_BYPASS_SECRET if needed
```

### Environment-Specific Behavior

The Playwright configuration automatically adjusts based on the target environment:

**When testing localhost:**

- Dev server starts automatically if needed
- No bypass headers required
- Full control over application code
- Faster feedback loop for development

**When testing remote (dev/staging/prod):**

- Skips dev server startup
- Adds Vercel bypass headers if configured
- Tests against deployed application
- Validates production-like behavior

### Authentication State

**Important**: Authentication state is environment-specific!

- Auth cookies from `localhost:3000` won't work on `dev.quiversurf.app`
- Auth state is saved to `e2e/.auth/state.json` (main test user)
- Persona auth states are saved to `e2e/.auth/{persona}-state.json`
- When switching environments, regenerate auth state:

```bash
# Clear existing auth state
npm run test:e2e:auth:reset

# Regenerate for current environment
npm run test:e2e:setup

# Regenerate persona auth states
npm run test:e2e:persona-setup
```

### Troubleshooting

**Tests fail with "Target closed" or connection errors:**

- Ensure the correct `BASE_URL` is set in `.env.playwright`
- If testing localhost, make sure no other process is using port 3000
- Check that dev server starts successfully: `npm run dev`

**Authentication failures:**

- Regenerate auth state for your target environment
- Verify `TEST_USER_EMAIL` and `TEST_USER_PASSWORD` in `.env.playwright`
- Check Supabase URLs match your target environment

**Slow test startup:**

- If testing localhost and dev server is starting, wait for full Next.js compilation
- Consider keeping dev server running separately: `npm run dev` in another terminal
- Playwright will detect and reuse the existing server

---

## Test Structure

### Naming Conventions

Test files follow these conventions:

- `{feature}-{area}.spec.ts` - Feature-specific tests (e.g., `home-beach-edge-cases.spec.ts`)
- `guest-{feature}.spec.ts` - Unauthenticated tests
- `{feature}.spec.ts` - General feature tests
- `personas/{persona}.spec.ts` - Per-persona tests
- `persona-features/{feature}.spec.ts` - Cross-persona feature tests

### Test Organization

Tests are organized using `test.describe` blocks:

```typescript
test.describe("Feature Name - Specific Area", () => {
  test.beforeEach(async ({ page, context }) => {
    // Setup for all tests in this describe block
  });

  test("should do something specific", async ({ page }) => {
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
test.describe("Feature Tests", () => {
  // Tests that require authentication
});
```

---

## Fixtures and Test Data

### User Profile Fixtures

**Location:** `e2e/fixtures/user-profiles.ts`

Provides test user profiles with different home beach configurations:

```typescript
import {
  TEST_USER_PROFILES,
  TEST_USER_SCENARIOS,
} from "./fixtures/user-profiles";

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
import { TEST_USER_SCENARIOS } from "./fixtures/user-profiles";

// GPS-only mode (no home beach)
const scenario = TEST_USER_SCENARIOS.gpsOnly;
expect(scenario.expectedHeading).toBe("Forecast for Home Beach");

// Home beach fallback (GPS denied)
const fallbackScenario = TEST_USER_SCENARIOS.homeBeachFallback;
```

### Location Test Data

**Location:** `e2e/fixtures/location-data.ts`

Provides location and beach test data:

```typescript
import { TEST_LOCATIONS, MOCK_RANKED_BEACHES } from "./fixtures/location-data";

// Test with specific location
const laJolla = TEST_LOCATIONS.laJolla;
// { city: "La Jolla", state: "CA", country: "USA" }
```

### General Test Data

**Location:** `e2e/fixtures/test-data.ts`

Provides timeouts, viewports, and test configuration:

```typescript
import { TIMEOUTS, VIEWPORTS, TEST_BEACH_IDS } from "./fixtures/test-data";

// Use standardized timeouts
await expect(element).toBeVisible({ timeout: TIMEOUTS.long });

// Use predefined viewports
await page.setViewportSize(VIEWPORTS.mobile);
```

### Persona Fixtures

**Location:** `e2e/fixtures/personas.ts`

Provides persona definitions for multi-user testing:

```typescript
import { PERSONAS, PersonaType, getPersona } from "./fixtures/personas";

// Access persona by type
const rookie = PERSONAS.rookie;
// { type: 'rookie', displayName: 'Riley R. (Rookie)', email: '...', ... }

// Get random phrase for content generation
import { getRandomPhrase } from "./fixtures/personas";
const phrase = getRandomPhrase('local');
// "Pro tip" or "Heads up" or "Been coming here for years"
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
} from "./utils/profile-helpers";

// Example: Set up user with specific home beach
test("should show home beach fallback", async ({ page }) => {
  await setupTestUserProfile(page, { homeBeach: "Windansea Beach" });
  // Test continues...
});

// Example: Clear home beach for "no home beach" test
test("should handle no home beach", async ({ page }) => {
  await clearHomeBeach(page);
  // Test continues...
});

// Example: Get current profile state for assertions
test("should update profile correctly", async ({ page }) => {
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
} from "./utils/auth-helpers";

// Verify user is authenticated
const isAuthenticated = await verifySupabaseAuth(page);
expect(isAuthenticated).toBe(true);

// Debug authentication issues
await logAuthState(page, "After Login");
```

### General Test Helpers

**Location:** `e2e/utils/test-helpers.ts`

General-purpose test utilities:

```typescript
import { waitForPageLoad } from "./utils/test-helpers";

// Wait for page to fully load
await waitForPageLoad(page);
```

### Persona Helpers

**Location:** `e2e/utils/persona-helpers.ts`

High-level helpers for persona-based testing:

```typescript
import {
  createIntelPostAsPersona,
  logSessionAsPersona,
  verifyLoggedInAsPersona,
  exploreDiscoveryAsPersona,
} from "./utils/persona-helpers";

// Create intel post as a specific persona
const result = await createIntelPostAsPersona(page, 'local', {
  beach: { name: 'Trestles', city: 'San Clemente', state: 'California' },
  tag: 'conditions',
});

// Verify correct persona is logged in
const verification = await verifyLoggedInAsPersona(page, 'rookie');
expect(verification.isCorrectPersona).toBe(true);
```

---

## Testing Patterns

### Pattern 1: GPS and Location Testing

Test GPS-based features with proper permission setup:

```typescript
test("should use GPS location when available", async ({ page, context }) => {
  // Grant geolocation permission
  await context.grantPermissions(["geolocation"]);

  // Set specific GPS coordinates
  await context.setGeolocation({
    latitude: 32.8473,
    longitude: -117.275, // La Jolla area
  });

  await page.goto("/");
  await waitForPageLoad(page);

  // Verify GPS-based content
  const heading = page.getByTestId("forecast-heading");
  await expect(heading).toHaveText("Forecast for Nearby Beaches");
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
- Any DB-level regression (e.g., function referencing a dropped column) becomes an immediate, visible test failure even if the UI still looks "okay" due to client-side distance fallback.

### Pattern 2: Permission State Transitions

Test different permission states:

```typescript
test("should handle permission revocation", async ({ page, context }) => {
  // Start with permission granted
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 32.8473, longitude: -117.275 });

  await page.goto("/");
  await waitForPageLoad(page);

  // Verify GPS mode
  const heading = page.getByTestId("forecast-heading");
  await expect(heading).toHaveText("Forecast for Nearby Beaches");

  // Revoke permission mid-session
  await context.clearPermissions();

  // Navigate to trigger refetch
  await page.goto("/map");
  await page.goto("/");
  await waitForPageLoad(page);

  // Should fall back to home beach or show error
  const headingText = await heading.textContent();
  expect(headingText).not.toBe("Forecast for Nearby Beaches");
});
```

### Pattern 3: Home Beach Setup and Testing

Test features with different home beach states:

```typescript
test("should fall back to home beach when GPS denied", async ({
  page,
  context,
}) => {
  // Setup: Set home beach using beach name (not slug)
  const result = await setHomeBeach(page, "Windansea Beach");
  expect(result.success).toBe(true);

  // Deny GPS
  await context.clearPermissions();

  await page.goto("/");
  await waitForPageLoad(page);

  // Verify home beach fallback
  const homeBeachName = await getHomeBeachName(page);
  const heading = page.getByTestId("forecast-heading");
  const headingText = await heading.textContent();

  expect(headingText).toContain(homeBeachName);
});
```

### Pattern 4: Edge Case and Error Testing

Test graceful degradation when no location is available:

```typescript
test("should handle no location available gracefully", async ({
  page,
  context,
}) => {
  // Setup: No home beach + GPS denied
  await clearHomeBeach(page);
  await context.clearPermissions();

  await page.goto("/");
  await waitForPageLoad(page);

  const section = page.getByTestId("forecast-section");
  const error = page.getByTestId("forecast-error");

  // Section should either:
  // 1. Be hidden (graceful degradation)
  // 2. Show clear error message
  const sectionVisible = await section
    .isVisible({ timeout: TIMEOUTS.medium })
    .catch(() => false);

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
test("should transition from loading to content", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 32.8473, longitude: -117.275 });

  // Start navigation
  const navigationPromise = page.goto("/");

  // Check for skeleton (loading state)
  const skeleton = page.getByTestId("forecast-skeleton");
  const skeletonAppeared = await skeleton
    .isVisible({ timeout: 2000 })
    .catch(() => false);

  if (skeletonAppeared) {
    // Wait for skeleton to disappear
    await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
  }

  await navigationPromise;
  await waitForPageLoad(page);

  // Verify content is visible
  const section = page.getByTestId("forecast-section");
  await expect(section).toBeVisible();

  const cards = page.getByTestId("forecast-card");
  expect(await cards.count()).toBeGreaterThan(0);
});
```

### Pattern 6: Accessibility Testing

Test keyboard navigation and screen reader support:

```typescript
test("should be keyboard navigable", async ({ page }) => {
  await page.goto("/");
  await waitForPageLoad(page);

  const firstCard = page.getByTestId("forecast-card").first();
  await firstCard.focus();

  // Verify focus
  const isFocused = await firstCard.evaluate(
    (el) => el === document.activeElement
  );
  expect(isFocused).toBe(true);

  // Test keyboard interaction
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/beach\/.+/);
});

test("should have proper ARIA attributes", async ({ page }) => {
  await page.goto("/");
  await waitForPageLoad(page);

  const error = page.getByTestId("forecast-error");
  const errorVisible = await error.isVisible().catch(() => false);

  if (errorVisible) {
    const role = await error.getAttribute("role");
    const ariaLive = await error.getAttribute("aria-live");

    // Should have alert role or aria-live
    expect(
      role === "alert" || ariaLive === "polite" || ariaLive === "assertive"
    ).toBe(true);
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
test("User with no home beach", async ({ page }) => {
  // Clear home beach for this test
  await clearHomeBeach(page);

  // Reload to apply changes
  await page.reload();
  await waitForPageLoad(page);

  // Test behavior with no home beach
  // ...
});

// Example: Test with specific home beach
test("User with Windansea as home beach", async ({ page }) => {
  // Set home beach
  await setHomeBeach(page, "windansea");

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
test.describe("Home Beach Tests", () => {
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

## Persona-Based Testing

Quiver includes a comprehensive persona-based testing framework for validating multi-user features, social interactions, and user-generated content. The system uses 6 NPC (Non-Player Character) personalities with distinct writing styles and behaviors.

**For complete documentation, see [PERSONAS.md](./PERSONAS.md).**

### Quick Start

```bash
# 1. Seed mock users (one-time setup)
yarn seed:prod-mock-users

# 2. Authenticate all personas
yarn test:e2e:persona-setup

# 3. Run persona tests
yarn test:e2e:personas
```

### The 6 Personas

| Persona | Email | Experience | Style |
|---------|-------|------------|-------|
| **Rookie** | riley.r@example.invalid | Beginner | Enthusiastic |
| **Local** | local.larry@example.invalid | Expert | Knowledgeable |
| **Traveler** | tina.c@example.invalid | Intermediate | Comparative |
| **Photographer** | p.martinez@example.invalid | Intermediate | Aesthetic |
| **Tactical** | solid.snake@example.invalid | Advanced | Military precision |
| **Competitor** | kai.n@example.invalid | Expert | Performance-focused |

### Writing Persona Tests

```typescript
import { test, expect } from '@playwright/test';
import { PERSONAS } from '../fixtures/personas';
import { getPersonaAuthStatePath } from '../utils/persona-auth';
import { generateIntelContent, verifyPersonaContent } from '../utils/persona-content-generators';

const PERSONA_TYPE = 'local' as const;
const persona = PERSONAS[PERSONA_TYPE];

// Use this persona's auth state
test.use({
  storageState: getPersonaAuthStatePath(PERSONA_TYPE),
});

test.describe(`${persona.displayName} Tests`, () => {
  test('generates knowledgeable content', () => {
    const content = generateIntelContent(PERSONA_TYPE,
      { name: 'Test Beach', city: 'San Diego', state: 'CA' },
      'conditions'
    );

    const verification = verifyPersonaContent(PERSONA_TYPE, content.description);
    expect(verification.isValid).toBe(true);
  });
});
```

### Content Generation

The framework includes content generators that produce persona-appropriate text:

```typescript
import { generateIntelContent, generateSessionContent } from '../utils/persona-content-generators';

// Generate intel post
const intel = generateIntelContent('tactical', beach, 'hazards');
// Returns: { title: 'Test Beach threat assessment', description: 'Tactical assessment: ...', tag: 'hazards' }

// Generate session notes
const session = generateSessionContent('rookie');
// Returns: { notes: 'OMG! Best session ever!...', rating: 5, waveHeight: '2-3 ft', crowdLevel: 2 }
```

### Cross-Persona Tests

For testing features that involve multiple users:

```typescript
import { ALL_PERSONA_TYPES, PERSONAS } from '../fixtures/personas';
import { createPersonaPage, personaAuthStateExists } from '../utils/persona-auth';

test.describe('Cross-Persona Feature', () => {
  for (const personaType of ALL_PERSONA_TYPES) {
    const persona = PERSONAS[personaType];

    test(`${persona.displayName} can use feature`, async ({ browser }) => {
      if (!personaAuthStateExists(personaType)) {
        test.skip();
        return;
      }

      const { page, context } = await createPersonaPage(browser, personaType);

      try {
        await page.goto('/feature');
        // Test feature...
      } finally {
        await context.close();
      }
    });
  }
});
```

---

## Location and GPS Testing

### GPS Coordinates

Use realistic GPS coordinates for your test scenarios:

```typescript
const TEST_COORDINATES = {
  laJolla: { latitude: 32.8473, longitude: -117.275 },
  blacks: { latitude: 32.8857, longitude: -117.2511 },
  oceanBeach: { latitude: 32.7503, longitude: -117.2534 },
  malibu: { latitude: 34.0259, longitude: -118.7798 },
};
```

### Permission Management

```typescript
// Grant GPS permission
await context.grantPermissions(["geolocation"]);

// Deny GPS permission
await context.clearPermissions();

// Set GPS coordinates
await context.setGeolocation({
  latitude: 32.8473,
  longitude: -117.275,
});
```

### Testing Geolocation Timeout

```typescript
test("should handle geolocation timeout", async ({ page, context }) => {
  // Grant permission but don't set location
  // This simulates a timeout scenario
  await context.grantPermissions(["geolocation"]);

  await page.goto("/");

  // Wait longer than the geolocation timeout (10 seconds)
  await page.waitForTimeout(12000);

  // Verify timeout handling
  const error = page.getByTestId("forecast-error");
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
const section = page.getByTestId("forecast-section");

// Avoid
const section = page.locator(".forecast-section");
```

### 2. Handle Async Loading Gracefully

Features that fetch data asynchronously should be tested with appropriate timeouts:

```typescript
// Good: Use long timeout for async data loading
await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

// Good: Handle cases where element might not appear
const visible = await element
  .isVisible({ timeout: TIMEOUTS.medium })
  .catch(() => false);

if (!visible) {
  test.skip(true, "Element not available");
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
test("should display GPS-based recommendations when location permission granted", async ({
  page,
}) => {
  // ...
});

// Avoid
test("test 1", async ({ page }) => {
  // ...
});
```

### 5. Log Debugging Information

Use logging helpers to aid debugging:

```typescript
await logProfileState(page, "Before Test");
// [Before Test] { userId: '...', homeBeachId: '...', ... }

await logAuthState(page, "After Login");
// [After Login] Auth tokens found: 3 cookies, 2 storage entries
```

### 6. Clean Up After Tests

```typescript
test.afterEach(async ({ page }) => {
  // Remove request mocks
  await page.unroute("**/api/**");

  // Restore default permissions
  await context.grantPermissions(["geolocation"]);
});
```

### 7. Test in Different Viewport Sizes

```typescript
test("should work on mobile", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.mobile);
  // Test mobile-specific behavior
});

test("should work on desktop", async ({ page }) => {
  await page.setViewportSize(VIEWPORTS.desktop);
  // Test desktop-specific behavior
});
```

### 8. Verify Data Integrity

When testing features that depend on database state:

```typescript
test("should handle orphaned home beach reference", async ({ page }) => {
  // Set invalid home beach ID
  await setInvalidHomeBeach(page);

  // Verify graceful handling
  const error = page.getByTestId("forecast-error");
  const errorVisible = await error
    .isVisible({ timeout: TIMEOUTS.medium })
    .catch(() => false);

  // Either shows error or hides section
  expect(errorVisible).toBe(true);
});
```

---

## Test Coverage Areas

### Current Coverage

Home Beach Fallback Mode

- GPS denied + home beach set -> Show home beach results
- Home beach heading with beach name
- Fallback when GPS unavailable

No Location Available

- GPS denied + no home beach -> Error state or hidden section
- Clear error messaging
- Actionable user guidance

GPS Permission State Transitions

- Permission prompt state
- Mid-session permission revocation
- Permission grant after denial
- Browser geolocation blocked
- Geolocation API unavailable (legacy browsers)

Permission State Persistence

- Permission state across page reloads
- Permission state in new tabs/windows

Geolocation Timeout Handling

- Timeout state after 10+ seconds
- Retry capability after timeout

Edge Cases

- Invalid/orphaned home beach reference
- Home beach with null coordinates
- Mid-session home beach changes
- Stale data handling

Loading States

- Skeleton display during load
- Transition from loading to content
- Transition from loading to error

Error States

- Clear, actionable error messages
- Proper ARIA attributes for accessibility
- Error styling validation

Accessibility

- Heading hierarchy
- Keyboard navigation
- Focus management
- Color contrast for badges
- Screen reader announcements

Multi-User / Persona Testing

- 6 distinct persona personalities
- Content generation matching writing styles
- Cross-persona social interactions
- Intel posts with persona-appropriate content
- Session logging with experience-appropriate data

### Future Coverage (Planned)

Integration Scenarios

- Complete user flows (GPS -> Home Beach -> Set in Profile)
- Session timezone changes
- Offline fallback behavior

Mobile-Specific Scenarios

- App backgrounding/resumption
- Battery saver mode effects
- App reinstall (localStorage loss)

Performance Regression Tests

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
const sectionVisible = await section
  .isVisible({ timeout: TIMEOUTS.long })
  .catch(() => false);

if (!sectionVisible) {
  test.skip(true, "Section appropriately hidden");
  return;
}
```

### Authentication State Lost

If tests fail with authentication errors:

Quiver E2E tests now **server-validate** auth state (not just cookie presence). This catches stale/rotated tokens early, before a protected route shows a login prompt.

1. Reset auth state: `npm run test:e2e:auth:reset`
2. Regenerate auth state for your current `BASE_URL`: `npm run test:e2e:setup`
3. Verify test credentials and `BASE_URL` in `.env.playwright`
4. If you manually sign in/out in the browser using the same test user, regenerate auth state again (refresh token rotation can invalidate `e2e/.auth/state.json`).

### Persona Auth State Missing

If persona tests fail with auth state errors:

1. Run persona setup: `yarn test:e2e:persona-setup`
2. Verify mock users exist: `yarn seed:prod-mock-users`
3. Check `PERSONA_PASSWORD` environment variable

### Geolocation Not Working

Ensure you're granting permissions AND setting coordinates:

```typescript
// Both are required
await context.grantPermissions(["geolocation"]);
await context.setGeolocation({ latitude: 32.8473, longitude: -117.275 });
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
- [ ] Documentation updated (this file, PERSONAS.md, and/or README.md)
- [ ] Accessibility tests included
- [ ] Edge cases covered
- [ ] Mobile viewports tested

---

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Quiver E2E README](./README.md) - Running tests and setup
- [Persona Testing Guide](./PERSONAS.md) - Multi-user persona testing
- [Test Data Fixtures](./fixtures/) - Reusable test data
- [Helper Utilities](./utils/) - Test helper functions
- [Quiver CLAUDE.md](../CLAUDE.md) - Project overview and guidelines

---

## Personalized Insights Tests

### Test File: `e2e/personalized-insights.spec.ts`

**Purpose**: Comprehensive E2E testing of the personalized insights feature that compares forecast conditions to user's session history.

**Test Coverage** (13 scenarios):

1. **Onboarding State Display**
   - Validates users with <3 rated sessions see onboarding encouragement
   - Ensures no board tips or similar sessions shown in onboarding
   - Tests graceful UI for new users building session history

2. **Insights Display with Sufficient Data**
   - Validates users with >=3 rated sessions see personalized insights
   - Checks "For You" KPI tile displays match label or percentage
   - Verifies reason bullets displayed in summary section

3. **Match Quality Indicators**
   - Tests match labels (Perfect/Great/Good/Low) align with percentages
   - Validates percentage thresholds: Perfect >=80%, Great 60-79%, Good 40-59%, Low <40%

4. **Board Recommendation Display**
   - Tests board tip appears when pattern detected (>=60% same board)
   - Validates amber UI element with ruler icon
   - Checks board name and type displayed correctly

5. **Similar Sessions Drawer Opening**
   - Tests "View similar sessions" button opens drawer
   - Validates drawer contains session items with conditions/boards
   - Checks close button functionality

6. **For You Tile Click Interaction**
   - Tests clicking "For You" KPI tile opens similar sessions drawer
   - Validates cursor-pointer class indicates clickability
   - Only when similar sessions available

7. **Insights API Error Handling**
   - Tests graceful fallback when /api/surf/insights fails
   - Validates card still renders with standard "For You" label
   - Ensures no board tips or similar sessions links on error

8. **Insights Loading State**
   - Tests loading skeleton displays while fetching
   - Validates transition from loading to loaded state
   - Checks error state handling

9. **Mobile Responsiveness**
   - Tests insights display correctly on mobile viewport (375x667)
   - Validates touch-friendly button sizes (>=40px height)
   - Checks text wrapping and no horizontal scroll

10. **Data Consistency Validation**
    - Tests match percentage aligns with label
    - Validates threshold consistency
    - Ensures no mismatched data displayed

11. **Personalization Badge Present**
    - Tests "For You" badge visible on personalized forecast cards
    - Validates badge indicates insights are active

12. **Insights Update on Forecast Change**
    - Tests insights refresh when recommendation changes
    - Validates insights match new forecast conditions

13. **Drawer Session Details**
    - Tests similar sessions show: beach, date, rating (stars), conditions, board
    - Validates match percentage badges color-coded correctly
    - Checks empty state when no sessions found

**Test Data Requirements**:

- **User with <3 rated sessions**: For onboarding state tests
- **User with 3+ rated sessions**: For full insights tests
- **Sessions with board_snapshot data**: For board recommendations
- **Sessions with similar conditions**: For similar sessions list
- **Sessions from different beaches**: For cross-spot explanations

**Key Test Patterns**:

```typescript
// Wait for personalized forecast card
const card = page.getByTestId('personalized-forecast-card');
await expect(card).toBeVisible({ timeout: TIMEOUTS.long });

// Check For You tile
const forYouTile = card.locator('.bg-purple-50').first();
const tileText = await forYouTile.textContent();

// Validate board tip (amber background)
const boardTip = card.locator('.bg-amber-50.border-amber-200');
await expect(boardTip).toBeVisible();

// Open similar sessions drawer
const viewSimilarButton = card.getByRole('button', {
  name: /view.*similar session/i
});
await viewSimilarButton.click();

const drawer = page.locator('[role="dialog"]');
await expect(drawer).toBeVisible({ timeout: TIMEOUTS.medium });
```

**Performance Considerations**:

- Uses `test.skip()` when personalized forecast not available
- Gracefully handles conditional UI elements (insights may vary by user)
- Waits for API responses with appropriate timeouts
- Tests error scenarios with mocked API failures

**Integration Points**:

- Depends on `/api/surf/insights` endpoint
- Uses same authentication as other @auth tests
- Interacts with PersonalizedForecastCard component
- Tests SimilarSessionsDrawer component interaction

---

## API Contract Tests

### Overview

The `e2e/api/` directory contains **API contract tests** that validate REST endpoint behavior without browser automation. These tests use Playwright's `APIRequestContext` for direct HTTP requests, providing faster execution and clearer failure messages for API-specific issues.

### Directory Structure

```
e2e/api/
├── admin.spec.ts           # Admin-only endpoints (test push, etc.)
├── beach-search.spec.ts    # Beach search and filtering
├── boards.spec.ts          # User board management CRUD
├── favorites-management.spec.ts  # Beach favorites toggle
├── featured-beaches.spec.ts      # Featured beaches for landing page
├── gamification.spec.ts    # Badges, XP, achievements
├── health.spec.ts          # Health check endpoints
├── intel.spec.ts           # Local intel CRUD and confirmations
├── recommendations.spec.ts # AI-powered surf recommendations
├── session-comments.spec.ts    # Session comment threads
├── session-planner.spec.ts     # Optimal time calculations
├── sessions-crud.spec.ts       # Session logging lifecycle
├── social-interactions.spec.ts # Follows, likes, social features
└── user-profile.spec.ts        # Profile read/update
```

### API Request Helper

**Location:** `e2e/utils/api-request-helpers.ts`

The `createIsolatedApiContext` helper creates an `APIRequestContext` with per-test rate limit isolation:

```typescript
import { createIsolatedApiContext } from "./utils/api-request-helpers";

test("should fetch user profile", async ({ playwright }, testInfo) => {
  const api = await createIsolatedApiContext(
    playwright,
    process.env.BASE_URL || "http://localhost:3000",
    testInfo,
    { storageState: "e2e/.auth/state.json" } // For authenticated requests
  );

  const response = await api.get("/api/profile");
  expect(response.ok()).toBe(true);

  const data = await response.json();
  expect(data.success).toBe(true);
  expect(data.data).toHaveProperty("id");
});
```

**Why Rate Limit Isolation?**

Our API rate limiter uses `x-forwarded-for` to identify clients. Without isolation, parallel tests share the `"unknown"` client bucket and can randomly receive 429 responses. The helper sets a deterministic per-test IP in TEST-NET-3 (`203.0.113.0/24`) so tests remain stable.

### API Contract Test Patterns

#### Pattern 1: Unauthenticated Endpoint

```typescript
test.describe("Featured Beaches API", () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await createIsolatedApiContext(
      playwright,
      process.env.BASE_URL!,
      testInfo
    );
  });

  test("GET /api/beaches/featured returns beach array", async () => {
    const response = await api.get("/api/beaches/featured");
    expect(response.status()).toBe(200);

    const { success, data } = await response.json();
    expect(success).toBe(true);
    expect(Array.isArray(data)).toBe(true);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("name");
  });
});
```

#### Pattern 2: Authenticated Endpoint

```typescript
test.describe("User Profile API", () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await createIsolatedApiContext(
      playwright,
      process.env.BASE_URL!,
      testInfo,
      { storageState: "e2e/.auth/state.json" }
    );
  });

  test("GET /api/profile returns authenticated user", async () => {
    const response = await api.get("/api/profile");
    expect(response.status()).toBe(200);

    const { success, data } = await response.json();
    expect(success).toBe(true);
    expect(data).toHaveProperty("email");
  });

  test("returns 401 without auth", async ({ playwright }, testInfo) => {
    const unauthApi = await createIsolatedApiContext(
      playwright,
      process.env.BASE_URL!,
      testInfo
      // No storageState = unauthenticated
    );

    const response = await unauthApi.get("/api/profile");
    expect(response.status()).toBe(401);
  });
});
```

#### Pattern 3: CRUD Lifecycle Test

```typescript
test.describe("Boards API CRUD", () => {
  let api: APIRequestContext;
  let createdBoardId: string;

  test.beforeAll(async ({ playwright }, testInfo) => {
    api = await createIsolatedApiContext(
      playwright,
      process.env.BASE_URL!,
      testInfo,
      { storageState: "e2e/.auth/state.json" }
    );
  });

  test("POST /api/boards creates board", async () => {
    const response = await api.post("/api/boards", {
      data: {
        name: "Test Board",
        board_type: "shortboard",
        length_ft: 6,
        length_in: 2,
      },
    });
    expect(response.status()).toBe(201);

    const { data } = await response.json();
    createdBoardId = data.id;
    expect(data.name).toBe("Test Board");
  });

  test("DELETE /api/boards/:id removes board", async () => {
    const response = await api.delete(`/api/boards/${createdBoardId}`);
    expect(response.status()).toBe(200);
  });
});
```

#### Pattern 4: Validation Error Testing

```typescript
test("POST /api/boards returns 400 for invalid payload", async () => {
  const response = await api.post("/api/boards", {
    data: {
      // Missing required fields
      name: "Incomplete",
    },
  });
  expect(response.status()).toBe(400);

  const { success, error } = await response.json();
  expect(success).toBe(false);
  expect(error).toMatch(/validation|required/i);
});
```

### When to Use API Contract Tests vs Browser E2E

| Use API Contract Tests When | Use Browser E2E When |
|----------------------------|----------------------|
| Testing REST endpoint behavior | Testing full user flows |
| Validating response schemas | Testing UI interactions |
| Testing auth/permissions | Testing navigation |
| Testing error responses | Testing visual states |
| Testing rate limiting | Testing JavaScript-dependent features |

### Best Practices for API Tests

1. **Always use `createIsolatedApiContext`** - Prevents rate limit collisions
2. **Test both success and error paths** - Include 400, 401, 403, 404 scenarios
3. **Validate response envelope** - Check `success`, `data`, `error` fields
4. **Clean up created resources** - Delete test data in afterAll or afterEach
5. **Use descriptive test names** - "POST /api/boards returns 400 for missing board_type"

---

---

## Test Data Cleanup

### Overview

E2E tests running against `dev.quiversurf.app` create test data (sessions, intel posts) that can accumulate and clutter the community feed. The cleanup system uses **soft-delete patterns** to remove test data without permanent data loss.

### How Test Data Is Identified

Test users are identified by two criteria:

1. **Main test user** - The email address specified in `TEST_USER_EMAIL` environment variable
2. **Mock persona users** - User profiles with `is_mock = true` flag in the database

All content (sessions, intel posts) created by these users is considered test data.

### Soft Delete Patterns

The cleanup uses existing soft-delete infrastructure:

| Table | Soft Delete Column | Active State | Deleted State |
|-------|-------------------|--------------|---------------|
| `sessions` | `deleted_at` | `NULL` | Timestamp |
| `intel_posts` | `is_active` | `true` | `false` |

Soft-deleted data can be restored using the `restore_entity()` SQL function if needed.

### Automatic Cleanup (Global Teardown)

When running E2E tests against the dev environment, cleanup runs automatically after all tests complete:

```bash
# Tests against dev environment trigger cleanup
yarn test:e2e:dev

# Local tests do NOT trigger cleanup (to preserve your local data)
yarn test:e2e
```

The global teardown (`e2e/global-teardown.ts`) detects the dev environment and soft-deletes test data:
- Only runs when `TEST_ENV=dev` or `BASE_URL` contains `dev.quiversurf.app`
- Cleanup failures don't fail the test suite (non-fatal)
- Results are logged for debugging

### Manual Cleanup

For manual cleanup of existing test data:

```bash
# Preview what would be deleted (dry run)
yarn test:e2e:cleanup:dry-run

# Actually soft-delete test data
yarn test:e2e:cleanup
```

The standalone script (`e2e/scripts/cleanup-test-data.ts`):
- Always shows a preview first
- Asks for confirmation before deletion (unless `--yes` flag)
- Reports statistics after cleanup
- Supports `--dry-run` for safe previewing

### Cleanup Utility

**Location:** `e2e/utils/test-data-cleanup.ts`

The cleanup utility can be imported and used programmatically:

```typescript
import {
  cleanupAllTestData,
  previewCleanup,
  executeCleanup
} from './utils/test-data-cleanup';

// Preview what would be cleaned
const preview = await previewCleanup(true); // verbose=true
console.log(`Would clean ${preview.totalCleaned} items`);

// Execute cleanup
const result = await executeCleanup(true); // verbose=true
console.log(`Cleaned ${result.totalCleaned} items`);
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS) | Yes |
| `TEST_USER_EMAIL` | Main test user email | Optional |
| `TEST_ENV` | Environment name (e.g., 'dev') | Optional |
| `BASE_URL` | Target URL for tests | Optional |

### Safety Considerations

- **Soft delete only**: Data is marked as deleted, not permanently removed
- **Test users only**: Only affects content from identified test users
- **Dev environment only**: Automatic cleanup only triggers for dev, not production
- **Recoverable**: Use `restore_entity()` SQL function to recover soft-deleted data
- **Non-fatal**: Cleanup failures don't fail the test suite

### Troubleshooting

**Cleanup not running:**
- Verify `TEST_ENV=dev` or `BASE_URL` contains `dev.quiversurf.app`
- Check environment variables are loaded from `.env.playwright`

**No test users found:**
- Verify `TEST_USER_EMAIL` is set correctly
- Ensure mock users have `is_mock = true` in profiles table
- Run `yarn seed:prod-mock-users` to create mock users

**Permission errors:**
- Verify `SUPABASE_SERVICE_ROLE_KEY` is set
- Service role key must have access to bypass RLS

**Want to restore deleted data:**
```sql
-- Restore a session
SELECT restore_entity('sessions', 'uuid-here');

-- Restore intel post (manual update)
UPDATE intel_posts SET is_active = true WHERE id = 'uuid-here';
```

---

**Last Updated**: February 1, 2026
