# Dev Validation Test Suite

## Overview

The dev validation suite (`e2e/dev-validation.spec.ts`) is a curated collection of ~50 E2E tests designed for rapid development validation. These tests cover critical functionality and can run in under 5 minutes.

## Purpose

- **Fast feedback loop** during development
- **Pre-commit validation** of critical flows
- **CI/CD quick checks** before running full test suite
- **Smoke testing** after deployments

## Running the Tests

### Quick Commands

```bash
# Run on dev environment (recommended)
npm run test:e2e:dev:quick

# Run on localhost
playwright test --grep @dev

# Run with UI mode (interactive)
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --ui

# Run headed (see browser)
TEST_ENV=dev BASE_URL=https://dev.quiversurf.app playwright test --grep @dev --headed

# Run specific test group
playwright test --grep "@dev.*Critical Page Loads"
```

### Environment Setup

Tests are designed to work on both:
- **Localhost** (`http://localhost:3000`) - for local development
- **Dev environment** (`https://dev.quiversurf.app`) - for deployed testing

Auth state must be configured for authenticated tests:
```bash
npm run test:e2e:setup  # Generate auth state
```

## Test Coverage (51 Tests)

### 1. Critical Page Loads (5 tests)
- ✅ Home page loads without errors
- ✅ Beach detail page loads
- ✅ Map page loads
- ✅ Sessions page loads
- ✅ Profile page loads

**Why**: These are the highest-traffic pages that must always work.

### 2. Core Navigation (8 tests)
- ✅ Navigation to map from home
- ✅ Navigation to sessions
- ✅ Navigation to profile
- ✅ Beach detail navigation
- ✅ Back button works
- ✅ Logo click returns to home
- ✅ Deep link to beach works
- ✅ Reload preserves page state

**Why**: Users must be able to move through the app without errors.

### 3. Authentication (3 tests)
- ✅ User can view login modal
- ✅ Auth modal shows email option
- ✅ Protected routes redirect to login

**Why**: Authentication is critical for protected features.

### 4. API Endpoints (6 tests)
- ✅ GET /api/v1/beaches returns success
- ✅ GET /api/v1/recommendations returns success
- ✅ GET /api/v1/beaches/:id returns beach data
- ✅ Invalid API request returns error
- ✅ API returns JSON content-type
- ✅ API handles CORS correctly

**Why**: API contract must remain stable.

### 5. SEO Basics (5 tests)
- ✅ Home page has title tag
- ✅ Beach page has structured data
- ✅ Sitemap is accessible
- ✅ Robots.txt is accessible
- ✅ OG image endpoint works

**Why**: SEO infrastructure protects search rankings.

### 6. User Interactions (8 tests)
- ✅ Session wizard can be opened
- ✅ Beach search works
- ✅ Forecast data displays on beach page
- ✅ Beach photos display
- ✅ Mobile viewport renders correctly
- ✅ Tablet viewport renders correctly
- ✅ Desktop viewport renders correctly
- ✅ Clicking beach card navigates to detail

**Why**: Users must be able to interact with core features.

### 7. Data Integrity (5 tests)
- ✅ Beach data has required fields
- ✅ Session list shows valid data
- ✅ Map shows beach markers
- ✅ User profile shows data
- ✅ No console errors on page load

**Why**: Data quality ensures good UX.

### 8. Performance Basics (5 tests)
- ✅ Home page loads in reasonable time
- ✅ Beach page loads in reasonable time
- ✅ No memory leaks on navigation
- ✅ Images lazy load
- ✅ No excessive API calls

**Why**: Performance is a core feature, not an afterthought.

### 9. Error Handling (6 tests)
- ✅ 404 page shows for invalid route
- ✅ Invalid beach ID shows error
- ✅ Network error handling
- ✅ Missing required data shows fallback
- ✅ API errors do not crash page

**Why**: Graceful error handling prevents user frustration.

## Design Principles

### 1. Speed First
- All tests use `@dev` tag for easy filtering
- No unnecessary waits beyond validation
- Parallel execution where possible
- Target: <5 minutes for full suite

### 2. Stability
- Uses existing test helpers (`test-helpers.ts`, `error-detection.ts`)
- Graceful fallbacks for optional elements
- Appropriate timeouts from `TIMEOUTS` constants
- Retries for rate-limited API calls

### 3. Coverage
- Tests critical user journeys
- Validates data integrity
- Checks error boundaries
- Ensures responsive design works

### 4. Maintainability
- Clear test descriptions
- Grouped by functionality
- JSDoc comments explaining purpose
- Follows existing patterns from smoke tests

## Test Structure

```typescript
test.describe('Group Name @dev', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test('Test description @dev', async ({ page }) => {
    // Test implementation
    await gotoWithErrorCheck(page, errorCapture, '/path', { timeout: TIMEOUTS.medium });

    // Assertions
    expect(something).toBeTruthy();

    // Verify no errors
    await assertNoErrors(page, errorCapture, { context: 'Test context' });
  });
});
```

## Error Detection

All tests use the error detection framework:
- **Console errors** captured and filtered
- **Network errors** (4xx, 5xx) detected
- **Visible error messages** on page checked
- **Screenshots** taken on failures

This ensures tests fail when users see errors, not just when assertions fail.

## Expected Execution Time

| Test Group | Expected Duration | Tests |
|------------|------------------|-------|
| Critical Page Loads | ~15-20s | 5 |
| Core Navigation | ~25-30s | 8 |
| Authentication | ~10-15s | 3 |
| API Endpoints | ~15-20s | 6 |
| SEO Basics | ~15-20s | 5 |
| User Interactions | ~30-40s | 8 |
| Data Integrity | ~15-20s | 5 |
| Performance Basics | ~30-40s | 5 |
| Error Handling | ~20-30s | 6 |
| **Total** | **~3-4 minutes** | **51** |

*Note: Times may vary based on network speed and test environment*

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Run Dev Validation Tests
  run: |
    npm run test:e2e:setup
    npm run test:e2e:dev:quick
  env:
    TEST_ENV: dev
    BASE_URL: https://dev.quiversurf.app
```

### Pre-commit Hook Example

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running dev validation tests..."
npm run test:e2e:dev:quick

if [ $? -ne 0 ]; then
  echo "❌ Dev validation tests failed. Commit aborted."
  exit 1
fi

echo "✅ Dev validation tests passed."
```

## Troubleshooting

### Tests timing out
- Increase timeout in TIMEOUTS constants
- Check network connectivity
- Verify dev environment is accessible

### Auth tests failing
- Regenerate auth state: `npm run test:e2e:setup`
- Check TEST_USER credentials in `.env.playwright`
- Verify Supabase connection

### API tests failing with 429
- Tests include retry logic for rate limits
- If persistent, increase wait times between retries
- Consider using localhost for development

### Flaky tests
- Check for race conditions
- Add appropriate waits for dynamic content
- Use `waitForPageLoad()` helper
- Verify element selectors are stable

## Extending the Suite

To add new tests:

1. **Add to appropriate group** or create new group
2. **Follow naming convention**: `test('Description @dev', ...)`
3. **Use error detection**: `setupErrorDetection()` and `assertNoErrors()`
4. **Import from fixtures**: Use TEST_BEACHES, TIMEOUTS, etc.
5. **Keep it fast**: Aim for <10 seconds per test
6. **Make it stable**: Use helpers and appropriate waits

Example:
```typescript
test('New feature works @dev', async ({ page }) => {
  const errorCapture = setupErrorDetection(page);

  await gotoWithErrorCheck(page, errorCapture, '/new-feature', {
    timeout: TIMEOUTS.medium
  });

  const feature = page.getByRole('button', { name: /feature/i });
  await expect(feature).toBeVisible({ timeout: TIMEOUTS.short });

  await assertNoErrors(page, errorCapture, { context: 'New feature' });
});
```

## Related Documentation

- **E2E Architecture**: `e2e/ARCHITECTURE.md`
- **Test Helpers**: `e2e/utils/test-helpers.ts`
- **Error Detection**: `e2e/utils/error-detection.ts`
- **Test Data**: `e2e/fixtures/test-data.ts`
- **Smoke Tests**: `e2e/smoke-critical-pages.spec.ts`, `e2e/smoke-seo.spec.ts`

## Metrics

Track these metrics over time:
- **Pass rate**: Should be >95%
- **Execution time**: Should stay <5 minutes
- **Flakiness**: Retries should be <5%
- **Coverage**: Add tests when critical bugs found

## Maintenance

- **Weekly**: Review failed tests and update selectors
- **Monthly**: Check execution time and optimize slow tests
- **Quarterly**: Review coverage and add missing critical flows
- **After major features**: Add corresponding validation tests
