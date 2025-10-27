# Quiver E2E Test Suite

Comprehensive end-to-end tests for the Quiver surf forecasting application using Playwright.

## Overview

This test suite covers the critical user flows and features of the Quiver application, including both guest and authenticated user experiences.

## Test Structure

### Test Projects

The suite is organized into two main projects:

- **guest**: Tests for unauthenticated users
- **auth**: Tests for authenticated users (uses saved authentication state)

### Test Files

#### Guest Tests
- `guest-landing.spec.ts` - Landing page for unauthenticated users
- `guest-auth.spec.ts` - Authentication flows (login, signup, login loop regression test)

#### Authenticated Tests
- `home.spec.ts` - Authenticated home screen/dashboard
- `beach-detail.spec.ts` - Beach detail pages
- `map.spec.ts` - Interactive map functionality
- `profile.spec.ts` - User profile and settings
- `sessions.spec.ts` - Session list and management

### Test Infrastructure

- `global-setup.ts` - Authenticates test user and saves session state
- `fixtures/test-data.ts` - Centralized test data (users, beach IDs, viewports)
- `utils/test-helpers.ts` - Reusable test utilities
- `.auth/state.json` - Saved authentication state for authenticated tests

## Setup

### Prerequisites

1. Node.js and npm installed
2. Playwright browsers installed:
   ```bash
   npx playwright install
   ```

### Environment Variables

Create a `.env.playwright` file (or use existing `.env`) with test credentials:

```env
TEST_USER_EMAIL=test@quiver.com
TEST_USER_PASSWORD=testpassword123
```

**Note**: Make sure this test user exists in your database before running authenticated tests.

### Running Tests

#### All Tests
```bash
npm run test:e2e
# or
npx playwright test
```

#### Guest Tests Only
```bash
npx playwright test --project=guest
```

#### Authenticated Tests Only
```bash
npx playwright test --project=auth
```

#### Specific Test File
```bash
npx playwright test e2e/guest-landing.spec.ts
```

#### With UI Mode (Interactive)
```bash
npx playwright test --ui
```

#### Headed Mode (See Browser)
```bash
npx playwright test --headed
```

#### Debug Mode
```bash
npx playwright test --debug
```

## Test Development

### Writing New Tests

1. Determine if the test requires authentication
2. Use the appropriate project annotation:
   ```typescript
   /**
    * @project guest  // For unauthenticated tests
    */
   // or
   /**
    * @project auth   // For authenticated tests
    */
   ```

3. Import utilities and fixtures:
   ```typescript
   import { waitForPageLoad } from './utils/test-helpers';
   import { VIEWPORTS, TEST_BEACH_IDS } from './fixtures/test-data';
   ```

4. Use helper functions for common operations:
   ```typescript
   import { isAuthenticated, login, navigateToBeach } from './utils/test-helpers';
   ```

### Best Practices

1. **Use Semantic Locators**: Prefer `getByRole`, `getByLabel`, `getByPlaceholder` over CSS selectors
2. **Wait for Page Load**: Use `waitForPageLoad()` after navigation
3. **Handle Timing**: Use Playwright's auto-waiting; only add explicit waits when necessary
4. **Graceful Skips**: Use conditional skips for features that may not be implemented yet
5. **Responsive Testing**: Test critical flows on mobile viewports using `VIEWPORTS.mobile`

### Example Test

```typescript
import { test, expect } from '@playwright/test';
import { waitForPageLoad, navigateToBeach } from './utils/test-helpers';
import { TEST_BEACH_IDS } from './fixtures/test-data';

test.describe('Example Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test('should do something', async ({ page }) => {
    // Navigate to a beach
    await navigateToBeach(page, TEST_BEACH_IDS.blacks);

    // Test something
    const element = page.getByRole('button', { name: /click me/i });
    await expect(element).toBeVisible();

    await element.click();

    // Assert result
    await expect(page.getByText(/success/i)).toBeVisible();
  });
});
```

## Continuous Integration

These tests are designed to run in CI environments. Ensure the following:

1. Authentication state is generated during global setup
2. Test user credentials are available via environment variables
3. Database is seeded with required test data (beaches, etc.)

## Debugging Failed Tests

### View Test Report
```bash
npx playwright show-report
```

### Trace Viewer (for detailed debugging)
```bash
npx playwright test --trace on
npx playwright show-trace trace.zip
```

### Screenshots and Videos
Failed tests automatically capture screenshots. Enable video recording in `playwright.config.ts` if needed.

## Known Issues and Workarounds

### Login Loop Regression Test
The `guest-auth.spec.ts` file includes a regression test for the login loop bug that was fixed. This test validates that:
- The auth modal closes after successful login
- No hard page reload occurs
- The user remains on the intended page

## Coverage

Current test coverage includes:
- ✅ Guest landing page
- ✅ Authentication flows
- ✅ Beach detail pages
- ✅ Interactive map
- ✅ User profile
- ✅ Sessions list
- ✅ Authenticated home

### Future Coverage
Consider adding tests for:
- Session wizard/creation flow
- Beach search and filtering
- Forecast details and interactions
- Social features (following, sharing)
- Admin functionality (if applicable)
- Error states and edge cases

## Maintenance

### Updating Test Data
Update `fixtures/test-data.ts` when:
- Beach IDs change
- Test user credentials change
- New viewports need to be tested

### Updating Utilities
Update `utils/test-helpers.ts` when:
- New common operations emerge
- Authentication flow changes
- Navigation patterns change

## Support

For issues or questions about the E2E test suite:
1. Check the Playwright documentation: https://playwright.dev
2. Review existing tests for patterns
3. Use `test.skip()` for tests that are currently failing due to known issues
