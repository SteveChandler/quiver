# Quiver Testing Guide

## 🎯 Purpose

This is the canonical guide for testing in Quiver. It eliminates confusion about running tests, connecting to Supabase, and understanding the test architecture.

## 🧪 Test Types Overview

Quiver uses a test pyramid approach with three distinct levels:

```
         /\
        /E2E\       Playwright (Slow, Real Environment)
       /______\
      /        \
     /Integration\ Jest (Medium, Partial Mocks)
    /____________\
   /              \
  /  Unit Tests    \ Jest (Fast, Full Mocks)
 /__________________\
```

### When to Use Each Type

| Test Type | Speed | Supabase | Use For |
|-----------|-------|----------|---------|
| **Unit** | ⚡ Fast (ms) | 🚫 Mocked | Component logic, utilities, calculations |
| **Integration** | ⚙️ Medium (sec) | 🚫 Mocked | Component interactions, data flow |
| **E2E** | 🐌 Slow (min) | ✅ Real | User journeys, critical paths |

---

## 🚀 Quick Start

### Running All Tests

```bash
# Unit & Integration Tests (Jest)
yarn test

# E2E Tests (Playwright)
npx playwright test

# Run everything
yarn test && npx playwright test
```

### Running Specific Tests

```bash
# Unit test by name
yarn test avatar-upload

# Unit test by path
yarn test __tests__/components/profile/

# E2E test by file
npx playwright test profile-edit

# E2E test with UI
npx playwright test --ui
```

### Watch Mode for Development

```bash
# Jest watch mode (re-runs on file changes)
yarn test --watch

# Playwright UI mode (interactive)
npx playwright test --ui
```

---

## 📦 Unit Tests (Jest)

### Configuration

**File:** `jest.config.js`

**Key Settings:**
- Test environment: `jsdom` (browser simulation)
- Timeout: 15 seconds
- Coverage: Enabled by default
- Mock setup: `__tests__/setup/mock-supabase.ts`

### Running Unit Tests

```bash
# All tests
yarn test

# Watch mode
yarn test --watch

# Coverage report
yarn test --coverage

# Specific test file
yarn test avatar-upload.test.tsx

# Specific test pattern
yarn test --testNamePattern="should validate"
```

### Supabase in Unit Tests

**❌ Never use real Supabase in unit tests**

Unit tests ALWAYS mock Supabase using `__tests__/setup/mock-supabase.ts`:

```typescript
// Automatic mocking via jest.config.js
// Supabase is already mocked - just write your test!

import { createClient } from '@/lib/supabase/client';

test('should fetch user sessions', async () => {
  const mockData = [{ id: 1, name: 'Test Session' }];

  // Mock is already set up, just use the client
  const supabase = createClient();

  // Your test logic...
  const { data } = await supabase
    .from('sessions')
    .select('*');

  expect(data).toBeDefined();
});
```

### Custom Mocks for Specific Tests

```typescript
// Override default mock for specific test
jest.mock('@/lib/supabase/client', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn().mockResolvedValue({
        data: [{ id: 1, name: 'Custom Mock Data' }],
        error: null
      })
    }))
  }))
}));

test('with custom mock', async () => {
  // Test with your custom mock...
});
```

### Test File Organization

```
__tests__/
├── components/          # Component unit tests
│   ├── profile/
│   │   ├── avatar-upload.test.tsx
│   │   ├── profile-form.test.tsx
│   │   └── user-stats.test.tsx
│   └── ui/
│       └── form.test.tsx
├── lib/                 # Utility unit tests
│   ├── api-utils.test.ts
│   └── image-upload.test.ts
├── hooks/               # Custom hook tests
│   └── use-data-fetcher.test.ts
└── setup/               # Test configuration
    ├── mock-supabase.ts
    └── mock-canvas.js
```

---

## 🌐 E2E Tests (Playwright)

### Configuration

**File:** `playwright.config.ts`

**Key Settings:**
- Base URL: `http://localhost:3000` (or from `BASE_URL` env var)
- Timeout: 120 seconds per test
- Global setup: Authenticates test user
- Storage state: `e2e/.auth/state.json`

### Running E2E Tests

```bash
# All E2E tests
npx playwright test

# With UI (interactive)
npx playwright test --ui

# Headed mode (see browser)
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# Specific test file
npx playwright test profile-edit-user-flow

# Specific test by name
npx playwright test --grep "should submit form"

# Against dev environment
BASE_URL=https://dev.quiversurf.app npx playwright test
```

### Supabase in E2E Tests

**✅ Always use real Supabase in E2E tests**

E2E tests connect to a real Supabase instance (local or remote).

**Environment Configuration:**

Create `.env.playwright`:

```bash
# Supabase (Local Development - Recommended)
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key

# Test User Credentials
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=testpassword123

# Application URL
BASE_URL=http://localhost:3000
```

**Setup Steps:**

```bash
# 1. Start local Supabase
supabase start

# 2. Get local keys
supabase status

# 3. Copy keys to .env.playwright
# NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Create test user in Supabase dashboard or via SQL
# 5. Update TEST_USER_EMAIL and TEST_USER_PASSWORD

# 6. Run tests
npx playwright test
```

### Global Setup (Authentication)

**File:** `e2e/global-setup.ts`

Before all E2E tests run, global setup:
1. Navigates to the app
2. Logs in the test user
3. Saves authentication state to `e2e/.auth/state.json`
4. All tests use this authenticated state

**Why?** Tests don't need to log in repeatedly - faster execution!

### Test File Organization

```
e2e/
├── .auth/
│   └── state.json               # Saved auth state
├── global-setup.ts               # Pre-test authentication
├── global-teardown.ts            # Post-test cleanup
├── profile-edit-user-flow.spec.ts
├── session-wizard.spec.ts
├── onboarding.spec.ts
└── utils/
    └── auth-helpers.ts
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test';

test.describe('Profile Edit Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to profile page before each test
    await page.goto('/profile');
    await page.waitForLoadState('load');
  });

  test('should edit and save profile', async ({ page }) => {
    // Open edit modal
    await page.getByTestId('edit-profile-button').click();

    // Wait for modal
    const modal = page.getByRole('dialog', { name: /edit profile/i });
    await expect(modal).toBeVisible();

    // Fill form
    await page.getByLabel(/name/i).fill('New Name');
    await page.getByLabel(/bio/i).fill('New bio text');

    // Submit
    await page.getByTestId('save-profile').click();

    // Verify success
    await expect(modal).not.toBeVisible();
    await expect(page.getByText('New Name')).toBeVisible();
  });

  test('should handle validation errors', async ({ page }) => {
    await page.getByTestId('edit-profile-button').click();

    // Clear required field
    await page.getByLabel(/name/i).clear();

    // Try to submit
    await page.getByTestId('save-profile').click();

    // Form should still be visible (validation prevented submission)
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible();
  });
});
```

---

## 🔧 Test Configuration Files

### Mock Setup Files

**Location:** `__tests__/setup/`

| File | Purpose |
|------|---------|
| `mock-supabase.ts` | Main Supabase mock for unit tests |
| `mock-canvas.js` | Canvas API mock for image tests |
| `mock-next-cache.ts` | Next.js cache mock |
| `mock-next-server.ts` | Next.js server functions mock |
| `location-mocks.ts` | Geolocation API mock |
| `forecast-test-utils.ts` | Forecast data test utilities |

### Jest Setup

**File:** `jest.setup.js`

Runs before all Jest tests:
- Configures Testing Library
- Sets up global mocks
- Configures test environment

### Playwright Setup

**Files:**
- `playwright.config.ts` - Main configuration
- `e2e/global-setup.ts` - Pre-test authentication
- `e2e/global-teardown.ts` - Post-test cleanup
- `.env.playwright` - Environment variables

---

## 🌍 Testing Against Different Environments

### Local Development (Recommended)

```bash
# .env.playwright
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
BASE_URL=http://localhost:3000

# Run tests
npx playwright test
```

**Advantages:**
- Fast (no network latency)
- Isolated (doesn't affect production data)
- Full control (reset database easily)

### Dev/Staging Environment

```bash
# Run against dev environment
BASE_URL=https://dev.quiversurf.app npx playwright test

# Or set in .env.playwright
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_production_anon_key
BASE_URL=https://dev.quiversurf.app
```

**Advantages:**
- Tests real deployment
- Catches environment-specific issues

**Disadvantages:**
- Slower
- May affect shared data
- Requires coordination with team

### Production (CI/CD Only)

**⚠️ Never run tests against production manually**

Production tests run automatically in CI/CD pipelines only.

---

## 🐛 Troubleshooting

### Unit Test Issues

#### Problem: "Cannot find module '@/lib/supabase/client'"

**Solution:**
1. Check `jest.config.js` has correct `moduleNameMapper`
2. Verify mock file exists: `__tests__/setup/mock-supabase.ts`
3. Restart Jest: `yarn test --clearCache`

#### Problem: Tests timing out

**Solution:**
1. Check for unresolved promises
2. Ensure async operations use `await`
3. Use `waitFor` for async state changes:
   ```typescript
   await waitFor(() => {
     expect(mockFunction).toHaveBeenCalled();
   });
   ```

#### Problem: Mock not working

**Solution:**
1. Verify mock is set up BEFORE importing the module
2. Use `jest.clearAllMocks()` in `beforeEach`
3. Check mock implementation matches actual API

### E2E Test Issues

#### Problem: "Authentication failed"

**Solution:**
1. Check `.env.playwright` has correct credentials
2. Verify test user exists in Supabase database
3. Check `e2e/.auth/state.json` is not corrupted
4. Re-run global setup: `rm -rf e2e/.auth && npx playwright test --project=setup`

#### Problem: Tests fail locally but pass in CI

**Solution:**
1. Check environment variables match
2. Verify local Supabase is running: `supabase status`
3. Reset local database: `supabase db reset`
4. Check for timing issues - add explicit waits

#### Problem: "Element not found" errors

**Solution:**
1. Use `page.waitForLoadState('load')` before interactions
2. Use more resilient selectors:
   ```typescript
   // ❌ Brittle
   await page.locator('.submit-btn').click();

   // ✅ Resilient
   await page.getByRole('button', { name: /submit/i }).click();
   ```
3. Add debug screenshot:
   ```typescript
   await page.screenshot({ path: 'debug.png' });
   ```

#### Problem: Tests timing out

**Solution:**
1. Increase timeout for slow operations:
   ```typescript
   test('slow test', async ({ page }) => {
     test.setTimeout(180000); // 3 minutes

     // ...
   });
   ```
2. Check for infinite loading states
3. Verify API is responding: check Network tab

---

## 📊 Test Coverage

### Viewing Coverage Reports

```bash
# Generate coverage report
yarn test --coverage

# View HTML report
open coverage/lcov-report/index.html
```

### Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Statements | 80%+ | ~95% |
| Branches | 75%+ | ~90% |
| Functions | 80%+ | ~95% |
| Lines | 80%+ | ~95% |

### What to Cover

**✅ High Priority:**
- Authentication flows
- Payment processing
- Data validation
- Critical user paths
- Security features

**⚙️ Medium Priority:**
- UI components
- Utility functions
- Data transformations

**➖ Low Priority:**
- Simple components
- Type definitions
- Configuration files

---

## 🎯 Best Practices

### Unit Test Best Practices

1. **Test behavior, not implementation**
   ```typescript
   // ❌ Bad - tests implementation
   test('should call uploadImage', () => {
     expect(mockUploadImage).toHaveBeenCalled();
   });

   // ✅ Good - tests behavior
   test('should display success message after upload', async () => {
     await uploadAvatar(file);
     expect(screen.getByText(/upload successful/i)).toBeVisible();
   });
   ```

2. **Keep tests independent**
   - Don't rely on other tests
   - Use `beforeEach` for setup
   - Clean up in `afterEach`

3. **Use descriptive test names**
   ```typescript
   // ❌ Bad
   test('upload works', () => {});

   // ✅ Good
   test('should reject files larger than 5MB', () => {});
   ```

4. **Mock only what's necessary**
   - Mock external services (Supabase, APIs)
   - Don't mock utilities you control
   - Keep mocks simple

### E2E Test Best Practices

1. **Test user journeys, not features**
   ```typescript
   // ❌ Bad - tests feature
   test('profile form validation', () => {});

   // ✅ Good - tests journey
   test('user should be able to update profile and see changes', () => {});
   ```

2. **Use realistic data**
   - Create actual test users
   - Use realistic form inputs
   - Test with real images/files

3. **Handle async operations properly**
   ```typescript
   // ✅ Wait for load state
   await page.waitForLoadState('load');

   // ✅ Wait for specific element
   await page.getByText('Success').waitFor();

   // ❌ Don't use arbitrary timeouts
   await page.waitForTimeout(5000); // Avoid this
   ```

4. **Use descriptive selectors**
   ```typescript
   // ✅ Best - semantic selectors
   await page.getByRole('button', { name: /submit/i });
   await page.getByLabel(/email/i);

   // ⚙️ OK - test IDs
   await page.getByTestId('submit-button');

   // ❌ Avoid - CSS selectors
   await page.locator('.btn-primary');
   ```

---

## 📚 Further Reading

- [TEST_ARCHITECTURE.md](../TEST_ARCHITECTURE.md) - Detailed test architecture
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Playwright Documentation](https://playwright.dev/docs/intro)
- [Testing Library](https://testing-library.com/docs/react-testing-library/intro/)
- [lib/supabase/ARCHITECTURE.md](../lib/supabase/ARCHITECTURE.md) - Supabase patterns

---

## ✅ Quick Reference Checklist

Before writing tests:

- [ ] Identified test type (unit/integration/E2E)
- [ ] Set up proper Supabase connection (mocked for unit, real for E2E)
- [ ] Configured environment variables (`.env.playwright` for E2E)
- [ ] Understood test data requirements
- [ ] Reviewed existing tests for patterns

Before committing:

- [ ] All tests passing: `yarn test && npx playwright test`
- [ ] Coverage meets targets: `yarn test --coverage`
- [ ] Tests are independent (can run in any order)
- [ ] Test names are descriptive
- [ ] Removed debug code and console.logs

---

**Last Updated:** January 2025
**Status:** Canonical testing reference
**Maintainer:** Quiver Development Team
