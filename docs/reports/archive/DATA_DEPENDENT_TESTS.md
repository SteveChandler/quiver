# Skipping Data-Dependent Tests in Local Development

## Overview

When running Playwright tests locally, you may not have all the required test data (photos, forecasts, reviews, intel posts, sessions, etc.). This causes 80+ tests to fail or timeout.

We've added a configuration option to **skip data-dependent tests** when running locally.

---

## Quick Start

### Run tests WITHOUT data-dependent tests (recommended for local dev):

```bash
SKIP_DATA_TESTS=true BASE_URL=http://localhost:3000 npx playwright test
```

### Run ALL tests (for CI or after seeding data):

```bash
BASE_URL=http://localhost:3000 npx playwright test
```

---

## How It Works

### 1. Playwright Configuration

We added a `grep` filter to [playwright.config.ts](playwright.config.ts:19):

```typescript
export default defineConfig({
  // ...
  grep: process.env.SKIP_DATA_TESTS === 'true' ? /^(?!.*@requires-data)/ : undefined,
  // ...
});
```

This skips any test whose name contains `@requires-data` when `SKIP_DATA_TESTS=true`.

### 2. Test Annotations

Tests that require specific data should be annotated with `@requires-data` in their test name:

```typescript
test('@requires-data shows review summary in Reviews tab', async ({ page }) => {
  // This test needs reviews to exist in the database
  // It will be skipped when SKIP_DATA_TESTS=true
});
```

---

## Annotating Tests

### Tests That Should Be Annotated

Add `@requires-data` to tests that expect:

#### Beach Data
- ✅ Photos/images
- ✅ Forecast data
- ✅ Reviews
- ✅ Intel posts
- ✅ Sessions
- ✅ Live cam data
- ✅ Beach description/tips content

#### User Data
- ✅ User followers/following
- ✅ User sessions history
- ✅ User favorites
- ✅ User notifications

#### Other Data
- ✅ Comments on intel posts
- ✅ Likes on reviews
- ✅ Featured beaches list
- ✅ Activity types

### Tests That Should NOT Be Annotated

Keep WITHOUT `@requires-data`:

- ❌ UI rendering tests (buttons, layouts, navigation)
- ❌ Authentication flows (login, logout, signup)
- ❌ Routing tests (redirects, protected routes)
- ❌ Form validation
- ❌ Modal/dialog behavior
- ❌ Tab switching (UI only, not content)
- ❌ Search functionality (UI, not results)
- ❌ Error handling
- ❌ Loading states

---

## Examples

### ✅ GOOD: Data-dependent test properly annotated

```typescript
test.describe('@beach - Forecast Tab Content', () => {
  test('@requires-data shows current conditions snapshot in Forecast tab', async ({ page }) => {
    await page.goto(`/beach/${BEACH_ID}`);
    await page.getByRole('tab', { name: /forecast/i }).click();

    // Expects forecast data to exist
    await expect(page.getByText(/wave height/i)).toBeVisible();
    await expect(page.getByText(/wind speed/i)).toBeVisible();
  });

  test('@requires-data shows 5-Day Outlook in Forecast tab', async ({ page }) => {
    // Expects forecast data for next 5 days
    await page.goto(`/beach/${BEACH_ID}`);
    // ...test forecast cards...
  });

  test('@requires-data shows live cam section when available', async ({ page }) => {
    // Expects live cam URL to be present
    await page.goto(`/beach/${BEACH_ID}`);
    // ...test camera feed...
  });
});
```

### ✅ GOOD: UI test WITHOUT annotation

```typescript
test.describe('@beach - Beach Detail Tab Navigation', () => {
  test('displays all 5 tabs in correct order', async ({ page }) => {
    // This just checks tabs render - doesn't need data
    await page.goto(`/beach/${BEACH_ID}`);

    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /forecast/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /reviews/i })).toBeVisible();
    // No @requires-data needed
  });

  test('switches between tabs correctly', async ({ page }) => {
    // Tests tab switching UI behavior - doesn't need content
    await page.goto(`/beach/${BEACH_ID}`);

    await page.getByRole('tab', { name: /forecast/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await page.getByRole('tab', { name: /reviews/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
    // No @requires-data needed
  });
});
```

### ❌ BAD: Data test without annotation

```typescript
// BAD - This test WILL FAIL without data, but has no annotation
test('shows beach photos in gallery', async ({ page }) => {
  await page.goto(`/beach/${BEACH_ID}`);

  // This expects photos to exist!
  const photo = page.locator('img[alt*="beach photo"]').first();
  await expect(photo).toBeVisible(); // FAILS if no photos
});

// GOOD - Same test with annotation
test('@requires-data shows beach photos in gallery', async ({ page }) => {
  await page.goto(`/beach/${BEACH_ID}`);

  const photo = page.locator('img[alt*="beach photo"]').first();
  await expect(photo).toBeVisible(); // Skipped when SKIP_DATA_TESTS=true
});
```

---

## Tests That Need Annotation

Based on the test run, these test files have data-dependent tests that should be annotated:

### High Priority (Timing out at 2 minutes)

```
e2e/beach-detail.spec.ts
  - @requires-data displays photo gallery with hero photo and map (line 37)
  - @requires-data shows current conditions snapshot in Forecast tab (line 207)
  - @requires-data shows 5-Day Outlook in Forecast tab (line 225)
  - @requires-data opens detailed swell modal (line 242)
  - @requires-data shows live cam section (line 269)
  - @requires-data shows forecast and tides details (line 293)
  - @requires-data shows review summary in Reviews tab (line 323)
  - @requires-data opens write review dialog (line 338)
  - @requires-data shows intel section in Local Intel tab (line 366)
  - @requires-data deep-link to intel tab works (line 379)
  - @requires-data view all intel posts toggle works (line 392)
  - @requires-data intel is only displayed once (line 415)
  - @requires-data shows sessions content in Sessions tab (line 432)

e2e/guest-landing-page.spec.ts
  - @requires-data featured beaches section displays cards (line 148)
  - @requires-data activities section shows surf activity types (line 182)

e2e/photo-integration.spec.ts (entire file likely needs @requires-data)
e2e/forecast-verification.spec.ts (entire file likely needs @requires-data)
e2e/intel-dashboard.spec.ts (most tests likely need @requires-data)
```

### Medium Priority

```
e2e/beach-detail-performance.spec.ts
  - @requires-data Photo Gallery - Component Render Performance (if expects photos)
  - @requires-data Stats Grid - Data Fetching Performance (if expects real data)

e2e/session-wizard.spec.ts
  - May need @requires-data if it loads existing session data
```

---

## Updating Existing Tests

### Step-by-step process:

1. **Identify data-dependent tests**
   - Look for tests that timeout at 2.0 minutes
   - Look for tests that expect specific data (photos, forecasts, reviews, etc.)

2. **Add @requires-data to test name**
   ```typescript
   // Before
   test('shows review summary in Reviews tab', async ({ page }) => {

   // After
   test('@requires-data shows review summary in Reviews tab', async ({ page }) => {
   ```

3. **Test locally**
   ```bash
   SKIP_DATA_TESTS=true npx playwright test e2e/[your-test-file].spec.ts
   ```

4. **Verify skipped**
   You should see in output:
   ```
   -  [auth] › beach-detail.spec.ts:323 › shows review summary in Reviews tab
   ```
   (Note the `-` means skipped)

---

## Running Tests in Different Scenarios

### Local Development (no test data)
```bash
SKIP_DATA_TESTS=true BASE_URL=http://localhost:3000 npx playwright test
```
**Expected:** ~150-200 tests pass, ~300 tests skipped

### After Seeding Test Data
```bash
# 1. Seed data first
yarn forecast:update
CONFIRM_TARGET=DEV yarn seed:npc-content:dev
yarn photos:fetch

# 2. Run all tests
BASE_URL=http://localhost:3000 npx playwright test
```
**Expected:** ~450+ tests pass

### CI/CD Environment
```bash
# CI should run ALL tests with full data
BASE_URL=https://staging.quiversurf.app npx playwright test
```
**Expected:** All 499 tests run

---

## Checking Test Status

### Count skipped tests:
```bash
SKIP_DATA_TESTS=true npx playwright test --list | grep '@requires-data' | wc -l
```

### See which tests will be skipped:
```bash
SKIP_DATA_TESTS=true npx playwright test --list | grep '@requires-data'
```

### Run only data-dependent tests:
```bash
# Inverse grep - only run @requires-data tests
npx playwright test --grep '@requires-data'
```

---

## Benefits

### For Local Development
✅ **Faster test runs** - Skip 300+ tests that will fail
✅ **Fewer false failures** - Only run tests that can pass locally
✅ **Focus on bugs** - See real application issues, not data issues
✅ **Better developer experience** - No need to seed full test data

### For CI/CD
✅ **Full coverage** - All tests run with proper data
✅ **Catch data issues** - Tests fail if data seeding breaks
✅ **Confidence** - Know all features work with real data

---

## FAQ

### Q: Why not just seed all the data locally?
**A:** Seeding full production-like data takes time and requires external services (forecast APIs, photo APIs, etc.). For quick local testing, it's faster to skip data-dependent tests.

### Q: Won't we miss bugs if we skip tests?
**A:** No - we still run all UI, auth, and navigation tests. We only skip tests that require specific database records to exist. Those tests will run in CI with proper data.

### Q: How do I know if my test needs @requires-data?
**A:** Ask: "Will this test fail if the database is empty?" If yes, add `@requires-data`. If it's just testing UI rendering/behavior, no annotation needed.

### Q: Can I run just one data-dependent test?
**A:** Yes! Just don't set `SKIP_DATA_TESTS`:
```bash
npx playwright test -g "@requires-data shows review summary"
```

### Q: What if I want to seed minimal data for one test?
**A:** You can! Seed just what you need:
```sql
-- Seed just one review for testing
INSERT INTO beach_reviews (beach_id, user_id, overall_rating, review_text)
VALUES ('33ee7a3a-0753-4f6c-84e9-0beaa0c6549e', '610a5745-1fac-429c-8f5a-8d085783a5ea', 4, 'Test review');
```

Then run without skipping:
```bash
npx playwright test e2e/beach-detail.spec.ts
```

---

## Next Steps

1. **Annotate existing data-dependent tests**
   - Start with [e2e/beach-detail.spec.ts](e2e/beach-detail.spec.ts)
   - Add `@requires-data` to all tests listed above

2. **Create data seeding guide**
   - Document how to seed minimal test data
   - Create scripts for common data needs

3. **Update CI configuration**
   - Ensure CI never sets `SKIP_DATA_TESTS=true`
   - Ensure test data is seeded before CI runs

4. **Educate team**
   - Share this guide with team
   - Add to onboarding docs
   - Update PR templates to remind about annotations

---

**Last Updated:** October 25, 2025
**Maintained By:** QA/SDET Team
