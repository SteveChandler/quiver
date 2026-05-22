# Quiver E2E Testing Guide

Comprehensive guide for running and maintaining Playwright end-to-end tests for the Quiver surf application.

## Table of Contents

- [Quick Start](#quick-start)
- [Setup](#setup)
- [Running Tests](#running-tests)
- [Environment Configuration](#environment-configuration)
- [Authentication](#authentication)
- [Test Structure](#test-structure)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Quick Start

```bash
# 1. Install dependencies
yarn install

# 2. Copy environment template
cp .env.playwright.example .env.playwright

# 3. Update credentials in .env.playwright
# Edit TEST_USER_EMAIL and TEST_USER_PASSWORD

# 4. Start local development server
yarn dev

# 5. Run all tests
yarn test:e2e
```

---

## Setup

### Prerequisites

- Node.js 20.18+ installed
- Access to the Supabase environment configured in `.env.playwright` (localhost runs may still point at prod DB)
- Valid test user credentials

### Initial Configuration

1. **Create Environment File**
   ```bash
   cp .env.playwright.example .env.playwright
   ```

2. **Configure Test Credentials**

   Edit `.env.playwright` and update:
   ```bash
   TEST_USER_EMAIL=your-test-user@example.com
   TEST_USER_PASSWORD=your-secure-password
   ```

3. **Verify Test User Exists**

   Ensure the test user exists in the Supabase environment configured by `.env.playwright`:
   ```bash
   # Tip: try logging in locally with the credentials from `.env.playwright`
   ```

4. **Generate Authentication State**
   ```bash
   yarn test:e2e:auth:setup
   ```

   This will:
   - Launch a browser in headed mode
   - Authenticate with your test credentials
   - Save auth state to `e2e/.auth/state.json`

---

## Running Tests

### All Tests

```bash
# Run all tests (headless)
yarn test:e2e

# Run all tests with UI
yarn test:e2e:ui

# Run all tests in headed mode
yarn test:e2e:headed

# Run with debug mode
yarn test:e2e:debug
```

### Specific Tests

```bash
# Run a specific test file
npx playwright test e2e/session-wizard.spec.ts

# Run tests matching a pattern
npx playwright test --grep "session wizard"

# Run a specific test by line number
npx playwright test e2e/session-wizard.spec.ts:42
```

### Project-Specific Tests

```bash
# Run guest tests only (no auth required)
npx playwright test --project=guest

# Run authenticated tests only
npx playwright test --project=auth
```

### Production Read-Only Review

```bash
yarn test:e2e:prod:readonly:list
yarn test:e2e:prod:readonly:guest
yarn test:e2e:prod:readonly:auth
yarn test:e2e:prod:readonly
```

This suite lives in `e2e/prod-readonly/`. It is read-only with respect to business data, but it still emits normal telemetry such as page views and auth activity. When `PLAYWRIGHT_PROD_READONLY=true`, auth bootstrap may refresh the approved `.env.playwright` account for session establishment. If that refresh fails, guest coverage still runs and auth specs are reported as blocked.

### Dev Validation Suite (Fast - <5 minutes)

```bash
# Run curated dev validation tests (~50 tests in <5 minutes)
yarn test:e2e:dev:quick

# Run with UI mode
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --ui

# Run on localhost
playwright test --grep @dev
```

**See `e2e/DEV_VALIDATION.md` for detailed documentation.**

### Environment-Specific Tests

```bash
# Test on local development server (default)
yarn test:e2e

# Test on dev environment
yarn test:e2e:dev

# Test on dev with UI
yarn test:e2e:dev:ui

# Test on dev in headed mode
yarn test:e2e:dev:headed
```

---

## Environment Configuration

### Configuration Files

- **`.env.playwright`** - Shared/default Playwright settings
- **`.env.playwright.local`** - Developer-local overrides (recommended for localhost-only toggles)
- **`.env.playwright.example`** - Template for new developers
- **`.env`** - Main application environment variables (fallback)

### Switching Environments

#### Local Testing (Default)

Prefer editing `.env.playwright.local` for localhost-only toggles:
```bash
TEST_ENV=local
BASE_URL=http://localhost:3000
```

Keep Supabase + test user credentials in `.env.playwright` (so localhost can point at the prod DB with the same test user).

#### Dev Environment Testing

Edit `.env.playwright` (or set `BASE_URL=...` on the command line):
```bash
TEST_ENV=dev
BASE_URL=https://dev.quiversurf.app
TEST_USER_EMAIL=your-dev-test-user@example.com
TEST_USER_PASSWORD=your-password
VERCEL_BYPASS_TOKEN=your-vercel-bypass-token
```

**Important:** When switching environments, you MUST regenerate auth state:
```bash
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup
```

This is because auth cookies are domain-specific (localhost vs dev.quiversurf.app).

---

## Authentication

### How Authentication Works

1. **Global Setup** (`e2e/global-setup.ts`)
   - Runs once before all tests
   - Navigates to the application
   - Logs in with test credentials
   - Saves authenticated state to `e2e/.auth/state.json`

2. **Test Projects**
   - **Guest Project**: Runs without authentication (for login/signup tests)
   - **Auth Project**: Uses saved authentication state from global setup

3. **Auth State File** (`e2e/.auth/state.json`)
   - Contains cookies and localStorage for authenticated session
   - Environment-specific (localhost cookies won't work on dev)
   - Gitignored for security

### Managing Authentication

#### Check Auth State

```bash
# View current auth state
yarn test:e2e:auth:debug

# Check if auth state has cookies
cat e2e/.auth/state.json | jq '.cookies | length'
```

#### Reset Auth State

```bash
# Clear auth state (useful when authentication fails)
yarn test:e2e:auth:reset
```

#### Regenerate Auth State

```bash
# Regenerate auth state (runs global setup in headed mode)
yarn test:e2e:auth:setup
```

#### Full Auth Reset

```bash
# Complete auth reset and regeneration
yarn test:e2e:auth:reset && yarn test:e2e:auth:setup
```

### Authentication Verification in Tests

For tests that require authentication, you can add verification:

```typescript
import { test } from '@playwright/test';
import { ensureAuthenticated, waitForPageLoad } from './utils/test-helpers';

test.describe('Sessions', () => {
  test.beforeEach(async ({ page }) => {
    // Verify authentication before running test
    await ensureAuthenticated(page);
    await page.goto('/sessions');
    await waitForPageLoad(page);
  });

  test('should display user sessions', async ({ page }) => {
    // Test code here
  });
});
```

---

## Test Structure

### Test Organization

```
e2e/
├── .auth/                    # Auth state (gitignored)
│   └── state.json           # Saved authentication cookies/storage
├── utils/                    # Test utilities
│   ├── auth-helpers.ts      # Authentication verification helpers
│   └── test-helpers.ts      # General test utilities
├── global-setup.ts          # Runs once before all tests (auth setup)
├── global-teardown.ts       # Runs once after all tests (validation)
├── guest-*.spec.ts          # Tests that don't require authentication
├── *.spec.ts                # Tests that require authentication
└── README.md                # This file
```

### Test Naming Conventions

- **`guest-*.spec.ts`** - Tests for unauthenticated users (login, signup, public pages)
- **`*.spec.ts`** - Tests for authenticated users (sessions, profile, etc.)
- Use descriptive test names that explain what's being tested

### Example Test Structure

```typescript
import { test, expect } from '@playwright/test';
import { ensureAuthenticated, waitForPageLoad } from './utils/test-helpers';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup that runs before each test
    await ensureAuthenticated(page);
    await page.goto('/feature-page');
    await waitForPageLoad(page);
  });

  test('should perform expected behavior', async ({ page }) => {
    // Arrange
    const element = page.getByRole('button', { name: 'Submit' });

    // Act
    await element.click();

    // Assert
    await expect(page.getByText('Success')).toBeVisible();
  });

  test('should handle error cases', async ({ page }) => {
    // Test error scenarios
  });
});
```

---

## Personalization Testing

### Overview

Personalization tests validate user-specific features including:
- **Forecast Transparency** - Data source indicators, confidence scores, buoy station links
- **Enhanced Onboarding** - Surf preference questions (wave size, break type, crowd preference)
- **Session Conditions** - Automatic forecast snapshot capture during sessions
- **Beach Affinity** - Familiarity indicators for frequently visited beaches
- **Personalized Recommendations** - Tailored beach scoring based on user preferences

**Important:** Personalization tests require local environment with seeded data and skip automatically in dev/production.

### Database Setup

Before running personalization tests, you must set up the database with test data:

```bash
# 1. Ensure local Supabase is running
supabase status

# 2. Ensure dev server is running
yarn dev

# 3. Ensure authentication state exists
yarn test:e2e:auth:setup

# 4. Run personalization database setup
npx tsx e2e/scripts/setup-personalization-db.ts
```

**What the setup script does:**
- Creates 12 sessions across 3 beaches (Blacks: 6, Swamis: 4, Birdrock: 2)
- Triggers beach affinity calculation (auto-updates via database trigger)
- Triggers preference learning (requires 5+ rated sessions)
- Populates tables:
  - `session_forecast_snapshots` (~12 records)
  - `user_beach_affinity` (~3 records)
  - `user_surf_preferences` (~1 record with confidence > 0.5)

**Expected Duration:** 2-3 minutes

### Running Personalization Tests

```bash
# Run all personalization tests
npx playwright test e2e/personalization.spec.ts

# Run specific test groups
npx playwright test e2e/personalization.spec.ts --grep "Forecast Transparency"
npx playwright test e2e/personalization.spec.ts --grep "Beach Affinity"
npx playwright test e2e/personalization.spec.ts --grep "Personalized Recommendations"

# Run in headed mode to see UI interactions
npx playwright test e2e/personalization.spec.ts --headed

# Run specific test by name
npx playwright test e2e/personalization.spec.ts --grep "should show PersonalizedBadge"
```

### Test Suite Structure

The personalization test suite (`e2e/personalization.spec.ts`) contains 26 tests across 5 categories:

1. **Forecast Transparency (5 tests)**
   - Data source badges (CDIP, NOAA, Fallback)
   - Confidence indicators
   - Data freshness displays
   - BuoyStationLink component (3 variants)
   - Fallback data messaging

2. **Enhanced Onboarding (8 tests)**
   - Wave size preference questions
   - Break type preference questions
   - Crowd preference questions
   - Preference persistence to database
   - Profile display of preferences

3. **Session Conditions Capture (3 tests)**
   - Automatic forecast snapshot on session creation
   - Conditions display in session detail
   - Historical conditions from session time

4. **Beach Affinity (4 tests)**
   - Familiarity badges on beach cards
   - Visit count indicators
   - Last surfed dates
   - Affinity boost in recommendations

5. **Personalized Recommendations (6 tests)**
   - PersonalizedBadge component rendering
   - Score breakdown tooltips
   - Affinity badge display
   - Morning API personalization data
   - Beach re-ranking by preference
   - Graceful fallback without preferences

### Environment Detection

Personalization tests automatically skip in dev/production environments:

```typescript
// Tests skip with this message:
// "Personalization tests require local environment with seeded data"

const isDevEnvironment =
  process.env.BASE_URL?.includes('dev.quiversurf.app') ||
  process.env.BASE_URL?.includes('quiversurf.app') ||
  process.env.TEST_ENV === 'dev';
```

### Verifying Test Data

Check if personalization data exists in your database:

```bash
# Check session forecast snapshots
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM session_forecast_snapshots;"

# Check beach affinity
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT beach_id, affinity_score, session_count FROM user_beach_affinity;"

# Check user preferences
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT confidence, sample_size FROM user_surf_preferences;"
```

### Test Data Maintenance

If personalization tests start failing:

1. **Check if test data exists:**
   ```bash
   # Verify session count
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
     -c "SELECT COUNT(*) FROM sessions;"

   # Expected: 12+ sessions
   ```

2. **Re-run database setup:**
   ```bash
   npx tsx e2e/scripts/setup-personalization-db.ts
   ```

3. **Clear and recreate (if needed):**
   ```bash
   # Reset database
   supabase db reset

   # Regenerate types
   yarn db:types

   # Re-run setup
   npx tsx e2e/scripts/setup-personalization-db.ts
   ```

### Helper Functions

Personalization tests use specialized helpers from `e2e/utils/personalization-helpers.ts`:

```typescript
import {
  hasPersonalizationData,      // Check if user has preferences/affinity
  verifyAffinityScore,          // Check beach affinity exists
  getPersonalizedRecommendations, // Fetch from morning API
  skipIfNoPersonalizationData,  // Conditionally skip tests
  verifyPersonalizedBadge,      // Assert badge rendering
} from './utils/personalization-helpers';
```

**Example usage:**
```typescript
test('should show personalized badge', async ({ page }) => {
  // Skip if insufficient data
  await skipIfNoPersonalizationData(page, test, {
    needsPreferences: true,
    minSessions: 5
  });

  // Verify badge displays
  await verifyPersonalizedBadge(page, {
    shouldBeVisible: true,
    shouldShowBreakdown: true
  });
});
```

### Troubleshooting Personalization Tests

#### Problem: Tests skip with "No personalization data"

**Cause:** Database not seeded with test data

**Solution:**
```bash
npx tsx e2e/scripts/setup-personalization-db.ts
```

#### Problem: Beach affinity not updating

**Cause:** Affinity trigger may not have fired

**Solution:**
```bash
# Manually run affinity computation
yarn affinity:compute

# Or via script
npx tsx scripts/compute-initial-affinities.ts
```

#### Problem: Preferences not computed

**Cause:** Need 5+ rated sessions for preference learning

**Solution:**
```bash
# Check session count
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
  -c "SELECT COUNT(*) FROM sessions WHERE rating >= 3;"

# If <5, re-run setup script to create more sessions
```

#### Problem: PersonalizedBadge not visible

**Cause:** UI integration may not be complete (Phase 6.3)

**Note:** PersonalizedBadge component exists but may not be integrated into all screens yet. Tests will skip gracefully when component is not found.

---

## Troubleshooting

### Authentication Issues

#### Problem: Tests fail with "not authenticated" errors

**Symptoms:**
- Tests timeout waiting for elements that require authentication
- Navigation to authenticated pages fails
- Error: "Test requires authentication but user is not authenticated"

**Solution:**
```bash
# 1. Check auth state
yarn test:e2e:auth:debug

# 2. If empty or invalid, regenerate
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup

# 3. Verify test credentials in .env.playwright
# 4. Ensure test user exists in target environment
```

#### Problem: Auth state is empty after global setup

**Symptoms:**
- `e2e/.auth/state.json` contains `{"cookies":[],"origins":[]}`
- Global setup completes but tests fail

**Possible Causes:**
1. Test credentials are incorrect
2. Test user doesn't exist in the environment
3. Supabase configuration is wrong
4. Network/connectivity issues

**Solution:**
```bash
# 1. Verify credentials
cat .env.playwright | grep TEST_USER

# 2. Test login manually
# Open browser and try logging in with test credentials

# 3. Check Supabase connection
# Ensure local Supabase is running (if testing locally)
npx supabase status

# 4. Run global setup with more logging
DEBUG_AUTH=true yarn test:e2e:auth:setup
```

#### Problem: Domain mismatch (localhost vs dev)

**Symptoms:**
- Tests worked on localhost but fail on dev (or vice versa)
- Auth state contains cookies for wrong domain

**Solution:**
```bash
# Auth state is domain-specific, regenerate for new environment
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup
```

### Test Failures

#### Problem: Flaky tests (tests that sometimes pass, sometimes fail)

**Common Causes:**
1. Race conditions (not waiting for elements)
2. Network timing issues
3. Animations interfering with clicks
4. Stale element references

**Solutions:**
```typescript
// Use built-in waiting mechanisms
await expect(element).toBeVisible(); // Better than isVisible()

// Wait for network to settle
await page.waitForLoadState('networkidle');

// Wait for specific conditions
await page.waitForFunction(() => !document.querySelector('.loading'));

// Use auto-waiting methods
await page.getByRole('button', { name: 'Submit' }).click(); // Auto-waits
```

#### Problem: Tests timeout

**Solutions:**
```bash
# Increase timeout for specific test
test('slow test', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  // test code
});

# Run with headed mode to see what's happening
yarn test:e2e:headed
```

### Configuration Issues

#### Problem: Can't find `.env.playwright`

**Solution:**
```bash
# Create from template
cp .env.playwright.example .env.playwright

# Or create manually
cat > .env.playwright <<EOF
TEST_ENV=local
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=test@quiver.com
TEST_USER_PASSWORD=testpassword123
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF
```

#### Problem: Tests can't connect to localhost

**Solution:**
```bash
# Ensure dev server is running
yarn dev

# Or configure Playwright to start server automatically
# (Already configured in playwright.config.ts)
```

### Debugging Tips

1. **Run in Headed Mode**
   ```bash
   yarn test:e2e:headed
   ```
   Watch tests execute in real browser

2. **Use Debug Mode**
   ```bash
   yarn test:e2e:debug
   ```
   Step through tests line by line

3. **Enable Verbose Logging**
   ```bash
   DEBUG_AUTH=true DEBUG_TESTS=true yarn test:e2e
   ```

4. **View Test Reports**
   ```bash
   # After test run, open HTML report
   npx playwright show-report
   ```

5. **Screenshot on Failure**
   Tests automatically capture screenshots on failure.
   Find them in `test-results/` directory.

6. **Check Global Setup Output**
   Look for:
   ```
   [Global Setup] ✓ Authentication successful!
   [Global Setup] ✓ Saved authentication state
   ```

7. **Check Global Teardown Output**
   Look for:
   ```
   [Global Teardown] ✓ Auth state appears valid
   [Global Teardown] Supabase cookies: X
   ```

---

## Best Practices

### Writing Tests

1. **Use Page Object Model for complex pages**
   ```typescript
   class SessionWizard {
     constructor(private page: Page) {}

     async selectBeach(beachName: string) {
       await this.page.getByRole('combobox').click();
       await this.page.getByText(beachName).click();
     }
   }
   ```

2. **Keep tests independent**
   - Each test should be able to run alone
   - Don't rely on test execution order
   - Clean up after yourself

3. **Use meaningful selectors**
   ```typescript
   // Good - semantic and stable
   page.getByRole('button', { name: 'Submit' })
   page.getByLabel('Email')
   page.getByText('Welcome')

   // Avoid - fragile and unclear
   page.locator('.btn-primary')
   page.locator('#submit-123')
   ```

4. **Wait for stability**
   ```typescript
   // Wait for element to be stable before interacting
   await element.waitFor({ state: 'visible' });
   await element.click();
   ```

5. **Use test helpers**
   ```typescript
   import { waitForPageLoad, ensureAuthenticated } from './utils/test-helpers';
   ```

### Authentication

1. **Don't repeat login in tests**
   - Use saved auth state (already configured)
   - Only guest tests should perform login

2. **Verify auth when needed**
   ```typescript
   test.beforeEach(async ({ page }) => {
     await ensureAuthenticated(page);
   });
   ```

3. **Regenerate auth state when switching environments**
   ```bash
   yarn test:e2e:auth:reset && yarn test:e2e:auth:setup
   ```

### Test Organization

1. **Group related tests**
   ```typescript
   test.describe('Session Wizard', () => {
     test.describe('Beach Selection', () => {
       // Beach-related tests
     });

     test.describe('Date Selection', () => {
       // Date-related tests
     });
   });
   ```

2. **Use descriptive test names**
   ```typescript
   // Good
   test('should allow user to select a beach and save it as home beach')

   // Bad
   test('beach test')
   ```

3. **Tag tests appropriately**
   ```typescript
   test('should load beach data @requires-data', async ({ page }) => {
     // This test needs real data
   });
   ```

   Skip with: `SKIP_DATA_TESTS=true yarn test:e2e`

### Performance

1. **Run tests in parallel**
   - Already configured in `playwright.config.ts`
   - Tests in different files run concurrently

2. **Use selective testing during development**
   ```bash
   # Only run tests you're working on
   npx playwright test --grep "session wizard"
   ```

3. **Reuse authenticated state**
   - Don't login in every test
   - Use global setup (already configured)

---

## CI/CD Integration

### GitHub Actions

Tests should run in CI/CD pipeline:

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: yarn install --frozen-lockfile
      - run: npx playwright install --with-deps
      - run: yarn test:e2e
        env:
          BASE_URL: https://dev.quiversurf.app
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          VERCEL_BYPASS_TOKEN: ${{ secrets.VERCEL_BYPASS_TOKEN }}
```

### Important CI Configuration

- Store test credentials in GitHub Secrets
- Use dev environment for CI tests
- Ensure Vercel bypass token is set
- Save test artifacts (screenshots, videos, reports)

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Project Main README](../README.md)

---

## Getting Help

If you encounter issues not covered in this guide:

1. Check global setup logs for auth errors
2. Verify environment configuration
3. Try regenerating auth state
4. Run tests in headed mode to observe behavior
5. Check test artifacts (screenshots, videos)
6. Ask the team for help

---

## Maintenance

### Regular Tasks

- **Update test credentials** when they change
- **Regenerate auth state** after Supabase updates
- **Review flaky tests** and fix root causes
- **Update test helpers** when app patterns change
- **Keep Playwright updated** (`yarn upgrade @playwright/test`)

### When to Regenerate Auth State

- After switching between local and dev environments
- After test user credentials change
- After Supabase configuration updates
- When auth state file is corrupted
- After long periods of inactivity

---

## Quick Reference

```bash
# Setup
cp .env.playwright.example .env.playwright
yarn test:e2e:auth:setup

# Run tests
yarn test:e2e              # All tests
yarn test:e2e:headed       # With browser visible
yarn test:e2e:dev          # On dev environment

# Debug
yarn test:e2e:auth:debug   # Show auth state
yarn test:e2e:auth:reset   # Clear auth state
yarn test:e2e:debug        # Step through tests
DEBUG_AUTH=true yarn test  # Verbose auth logging

# Specific tests
npx playwright test e2e/sessions.spec.ts
npx playwright test --grep "session wizard"
npx playwright test --project=guest
```

---

**Last Updated:** 2025-01-29
**Version:** 1.0.0
