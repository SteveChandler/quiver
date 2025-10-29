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
npm install

# 2. Copy environment template
cp .env.playwright.example .env.playwright

# 3. Update credentials in .env.playwright
# Edit TEST_USER_EMAIL and TEST_USER_PASSWORD

# 4. Start local development server
npm run dev

# 5. Run all tests
npm run test:e2e
```

---

## Setup

### Prerequisites

- Node.js 18+ installed
- Local Supabase instance running (for local testing)
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

   For local testing, ensure the test user exists in your local Supabase instance:
   ```bash
   # Check if user exists (should return 1)
   PGPASSWORD=postgres psql -h 127.0.0.1 -p 54322 -U postgres -d postgres \
     -c "SELECT email FROM auth.users WHERE email = 'your-test-user@example.com';"
   ```

4. **Generate Authentication State**
   ```bash
   npm run test:e2e:auth:setup
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
npm run test:e2e

# Run all tests with UI
npm run test:e2e:ui

# Run all tests in headed mode
npm run test:e2e:headed

# Run with debug mode
npm run test:e2e:debug
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

### Environment-Specific Tests

```bash
# Test on local development server (default)
npm run test:e2e

# Test on dev environment
npm run test:e2e:dev

# Test on dev with UI
npm run test:e2e:dev:ui

# Test on dev in headed mode
npm run test:e2e:dev:headed
```

---

## Environment Configuration

### Configuration Files

- **`.env.playwright`** - Your local test configuration (gitignored)
- **`.env.playwright.example`** - Template for new developers
- **`.env`** - Main application environment variables (fallback)

### Switching Environments

#### Local Testing (Default)

Edit `.env.playwright`:
```bash
TEST_ENV=local
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=your-local-test-user@example.com
TEST_USER_PASSWORD=your-password
```

#### Dev Environment Testing

Edit `.env.playwright`:
```bash
TEST_ENV=dev
BASE_URL=https://dev.quiversurf.app
TEST_USER_EMAIL=your-dev-test-user@example.com
TEST_USER_PASSWORD=your-password
VERCEL_BYPASS_TOKEN=your-vercel-bypass-token
```

**Important:** When switching environments, you MUST regenerate auth state:
```bash
npm run test:e2e:auth:reset
npm run test:e2e:auth:setup
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
npm run test:e2e:auth:debug

# Check if auth state has cookies
cat e2e/.auth/state.json | jq '.cookies | length'
```

#### Reset Auth State

```bash
# Clear auth state (useful when authentication fails)
npm run test:e2e:auth:reset
```

#### Regenerate Auth State

```bash
# Regenerate auth state (runs global setup in headed mode)
npm run test:e2e:auth:setup
```

#### Full Auth Reset

```bash
# Complete auth reset and regeneration
npm run test:e2e:auth:reset && npm run test:e2e:auth:setup
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
npm run test:e2e:auth:debug

# 2. If empty or invalid, regenerate
npm run test:e2e:auth:reset
npm run test:e2e:auth:setup

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
DEBUG_AUTH=true npm run test:e2e:auth:setup
```

#### Problem: Domain mismatch (localhost vs dev)

**Symptoms:**
- Tests worked on localhost but fail on dev (or vice versa)
- Auth state contains cookies for wrong domain

**Solution:**
```bash
# Auth state is domain-specific, regenerate for new environment
npm run test:e2e:auth:reset
npm run test:e2e:auth:setup
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
npm run test:e2e:headed
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
npm run dev

# Or configure Playwright to start server automatically
# (Already configured in playwright.config.ts)
```

### Debugging Tips

1. **Run in Headed Mode**
   ```bash
   npm run test:e2e:headed
   ```
   Watch tests execute in real browser

2. **Use Debug Mode**
   ```bash
   npm run test:e2e:debug
   ```
   Step through tests line by line

3. **Enable Verbose Logging**
   ```bash
   DEBUG_AUTH=true DEBUG_TESTS=true npm run test:e2e
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
   npm run test:e2e:auth:reset && npm run test:e2e:auth:setup
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

   Skip with: `SKIP_DATA_TESTS=true npm run test:e2e`

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
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npm run test:e2e
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
- **Keep Playwright updated** (`npm update @playwright/test`)

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
npm run test:e2e:auth:setup

# Run tests
npm run test:e2e              # All tests
npm run test:e2e:headed       # With browser visible
npm run test:e2e:dev          # On dev environment

# Debug
npm run test:e2e:auth:debug   # Show auth state
npm run test:e2e:auth:reset   # Clear auth state
npm run test:e2e:debug        # Step through tests
DEBUG_AUTH=true npm run test  # Verbose auth logging

# Specific tests
npx playwright test e2e/sessions.spec.ts
npx playwright test --grep "session wizard"
npx playwright test --project=guest
```

---

**Last Updated:** 2025-01-29
**Version:** 1.0.0
