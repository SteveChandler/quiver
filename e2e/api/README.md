# API Contract Tests

This directory contains API contract tests that validate the stability and correctness of API endpoints independently of the UI.

## Purpose

API contract tests serve as a safety net to catch breaking changes in API responses before they impact the frontend. They validate:

- **Response Structure**: Ensure API responses maintain expected shape
- **Data Quality**: Verify data meets quality standards (no duplicates, required fields present)
- **Error Handling**: Confirm graceful degradation and proper error responses
- **Performance**: Check response times meet SLA requirements
- **Security**: Validate security headers and rate limiting

## Test Files

### `featured-beaches.spec.ts`

Contract tests for `/api/beaches/featured` endpoint.

**Coverage:**
- Response structure validation (success wrapper, timestamp, data array)
- Beach object schema validation (all required fields present and correctly typed)
- Photo prioritization logic (beaches with photos come first)
- Data quality checks (no duplicates, reasonable count, valid UUIDs)
- Error handling (graceful degradation, proper HTTP status codes)
- Performance (response time < 1000ms)
- Rate limiting (burst protection)
- Security headers (CORS, CSP, etc.)

## Running the Tests

### Prerequisites

1. Start the Next.js dev server:
   ```bash
   npm run dev
   ```

2. Ensure Supabase is running (if using local dev):
   ```bash
   npx supabase start
   ```

### Run All API Contract Tests

```bash
# Run all API tests
npx playwright test e2e/api/ --project=guest

# Run with detailed output
npx playwright test e2e/api/ --project=guest --reporter=list

# Run specific test file
npx playwright test e2e/api/featured-beaches.spec.ts --project=guest
```

### Run Specific Test Suites

```bash
# Run only response structure tests
npx playwright test e2e/api/featured-beaches.spec.ts -g "API Response Structure"

# Run only schema validation tests
npx playwright test e2e/api/featured-beaches.spec.ts -g "Beach Object Schema"

# Run only photo prioritization tests
npx playwright test e2e/api/featured-beaches.spec.ts -g "Photo Prioritization"
```

### Debug Mode

```bash
# Run with UI for debugging
npx playwright test e2e/api/featured-beaches.spec.ts --project=guest --ui

# Run with headed browser
npx playwright test e2e/api/featured-beaches.spec.ts --project=guest --headed

# Run and keep browser open on failure
npx playwright test e2e/api/featured-beaches.spec.ts --project=guest --debug
```

## CI/CD Integration

These tests run automatically in the CI pipeline:

1. **On Pull Requests**: Validates API contracts haven't changed unexpectedly
2. **On Main Branch**: Ensures production API stability
3. **Nightly**: Full regression suite including edge cases

### CI Configuration

The tests run in the `guest` project, which doesn't require authentication:

```typescript
// playwright.config.ts
{
  name: 'guest',
  testMatch: ['e2e/guest-*.spec.ts', 'e2e/api/**/*.spec.ts'],
  use: { ...devices['Desktop Chrome'] },
}
```

## Test Organization

API contract tests are organized by endpoint:

```
e2e/api/
├── README.md                    # This file
├── featured-beaches.spec.ts     # /api/beaches/featured
├── nearby-beaches.spec.ts       # /api/beaches/nearby (future)
├── beach-search.spec.ts         # /api/beaches/search (future)
└── forecasts.spec.ts            # /api/forecasts (future)
```

## Writing New API Contract Tests

### Template

```typescript
/**
 * [Endpoint Name] API Contract Tests
 *
 * Tests the API contract for [endpoint path] to ensure:
 * - Response structure remains stable
 * - Data quality meets requirements
 * - Error handling is graceful
 *
 * @project guest
 */

import { test, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const ENDPOINT = `${BASE_URL}/api/[endpoint]`;

test.describe('[Endpoint Name] API Contract', () => {
  test.describe('API Response Structure', () => {
    test('should return 200 OK status', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      expect(response.status()).toBe(200);
    });

    test('should return valid JSON', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();
      expect(json).toBeDefined();
    });
  });

  test.describe('[Data Type] Schema', () => {
    test('should have required fields', async ({ request }) => {
      const response = await request.get(ENDPOINT);
      const json = await response.json();

      json.data.forEach((item: any) => {
        expect(item).toHaveProperty('id');
        expect(item).toHaveProperty('name');
      });
    });
  });
});
```

### Best Practices

1. **Use `@project guest` annotation**: API tests don't need authentication
2. **Test the contract, not the data**: Focus on structure and types, not specific values
3. **Validate all response fields**: Check presence, type, and format
4. **Test edge cases**: Empty results, errors, invalid inputs
5. **Check security headers**: Ensure proper headers are present
6. **Validate performance**: Set reasonable SLA thresholds
7. **Test rate limiting**: Verify burst protection works
8. **Document what you're testing**: Clear test descriptions

## Troubleshooting

### Tests Failing Locally

1. **Dev server not running**:
   ```bash
   npm run dev
   ```

2. **Database not accessible**:
   ```bash
   npx supabase start
   ```

3. **Environment variables missing**:
   - Check `.env.local` exists
   - Verify Supabase credentials are correct

### Tests Failing in CI

1. **Rate limiting**: Tests may hit rate limits in CI
   - Add delays between requests
   - Use different test data

2. **Database state**: Ensure test database has required data
   - Run migrations before tests
   - Seed test data if needed

3. **Timeout issues**: Increase timeout for slower CI environments
   ```typescript
   test.setTimeout(60000); // 60 seconds
   ```

## Maintenance

### When to Update Tests

Update API contract tests when:

1. **API endpoint changes**: New fields, different response structure
2. **New endpoint added**: Create new test file
3. **Business logic changes**: Photo prioritization, sorting, filtering
4. **Error handling changes**: New error codes, different error messages
5. **Performance requirements change**: New SLA thresholds

### Breaking Changes

If tests fail after API changes:

1. **Review the change**: Is it intentional or a regression?
2. **Update UI components**: Ensure frontend handles new contract
3. **Update tests**: Reflect new contract in test expectations
4. **Document change**: Update API documentation and CHANGELOG

## Related Documentation

- [E2E Testing Architecture](../ARCHITECTURE.md)
- [Playwright Configuration](../../playwright.config.ts)
- [API Utils](../../lib/api-utils.ts)
- [Featured Beaches Route](../../app/api/beaches/featured/route.ts)

## Questions?

For questions about API contract tests:
- Check [E2E Architecture Docs](../ARCHITECTURE.md)
- Review [existing test examples](../rate-limiting.spec.ts)
- Consult the team lead or test automation engineer
