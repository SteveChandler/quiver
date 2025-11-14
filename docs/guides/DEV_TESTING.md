# Testing Against dev.quiversurf.app

This guide explains how to run Playwright E2E tests against the dev environment.

## Quick Start

```bash
# 1. Verify .env.playwright configuration
cat .env.playwright

# 2. Run authentication setup (if needed)
npx playwright test --grep auth

# 3. Run all E2E tests
npx playwright test

# 4. Run specific test file
npx playwright test e2e/feed-photo-thumbnails.spec.ts
```

## Configuration

### Current Setup (`.env.playwright`)

```env
# Active dev environment configuration
TEST_ENV=local
BASE_URL=https://dev.quiversurf.app
TEST_USER_EMAIL=stcha0004@gmail.com
TEST_USER_PASSWORD=SCquiver1!
VERCEL_AUTOMATION_BYPASS_SECRET=9cGTJ2mnmoH7QQQMgUCIdet3953HvHbl
```

### Playwright Config Features

The [playwright.config.ts](../playwright.config.ts) automatically:
- Uses `BASE_URL` environment variable
- Includes Vercel bypass token headers for protected deployments
- Skips webServer startup when BASE_URL is not localhost
- Configures two test projects:
  - **guest**: Unauthenticated tests
  - **auth**: Tests using `e2e/.auth/state.json`

## Authentication

### How It Works

1. **Global Setup** ([e2e/global-setup.ts](../e2e/global-setup.ts)):
   - Runs once before all tests
   - Authenticates with dev.quiversurf.app
   - Saves authentication state to `e2e/.auth/state.json`

2. **Auth State**:
   - Contains Supabase cookies for dev domain
   - Reused across all authenticated tests
   - Environment-specific (dev cookies won't work on localhost)

### Verify Authentication

```bash
# Check auth state file
ls -la e2e/.auth/state.json

# View auth cookies (first 20 lines)
head -20 e2e/.auth/state.json

# Regenerate auth state if needed
npx playwright test --grep auth
```

## Test Results

### Latest Run (Nov 2, 2025)

**Environment**: dev.quiversurf.app
**Pass Rate**: **100%** (10/10 executable tests)
**Total Duration**: 23 seconds

#### Passed Tests (10/18)
✓ Photo layout variations
✓ Photo count badges
✓ Console error checking
✓ Page load performance (<5s)
✓ Mobile responsive display
✓ ARIA accessibility labels
✓ Grid layout rendering
✓ Overflow indicators (+N)
✓ Scroll position stability
✓ Consistent rendering across refreshes

#### Skipped Tests (8/18)
These tests require sessions with photos in the dev database:
- Session cards with photos in home feed
- Photos in sessions feed
- Mixed feed rendering
- Photo click navigation
- Lazy loading verification
- Touch interactions
- Keyboard navigation

**Note**: Skipping is intentional. See "Creating Test Data" below.

## Creating Test Data on Dev

Some tests require sessions with photos to exist. You can create test data using the automated script:

### Prerequisites

1. Authenticated session (run `npx playwright test --grep auth`)
2. `.env.playwright` configured for dev environment

### Running the Script

```bash
# Create 5 test sessions with photos on dev
npx ts-node e2e/scripts/create-photo-test-data.ts
```

The script will:
- Use BASE_URL from `.env.playwright` (dev.quiversurf.app)
- Use authentication from `e2e/.auth/state.json`
- Create sessions via the UI wizard
- Upload test photos (minimal valid JPEGs)
- Create sessions at different beaches with varying photo counts

### What It Creates

- **Session 1**: Blacks Beach, 3 stars, 1 photo
- **Session 2**: Swamis, 4 stars, 2 photos
- **Session 3**: Windansea, 5 stars, 3 photos
- *Sessions 4-5*: Varied beaches and photo counts

## Switching Environments

### Local → Dev

Edit `.env.playwright`:

```diff
- BASE_URL=http://localhost:3000
- TEST_USER_EMAIL=testuser@quiver.surf
- TEST_USER_PASSWORD=testpassword123
+ BASE_URL=https://dev.quiversurf.app
+ TEST_USER_EMAIL=stcha0004@gmail.com
+ TEST_USER_PASSWORD=SCquiver1!
+ VERCEL_AUTOMATION_BYPASS_SECRET=your_token_here
```

Then regenerate auth state:

```bash
npx playwright test --grep auth
```

### Dev → Local

Reverse the process above and ensure:
- Local Supabase is running (`supabase start`)
- Local dev server is running (`yarn dev`)
- Test user exists in local database

## Troubleshooting

### Authentication Failures

**Problem**: "Authentication failed after 3 attempts"

**Solutions**:
1. Check credentials in `.env.playwright`
2. Verify user exists in dev environment
3. Ensure Vercel bypass token is valid
4. Delete `e2e/.auth/state.json` and regenerate

### Tests Timing Out

**Problem**: Tests hang or timeout on dev

**Solutions**:
1. Check network connectivity to dev.quiversurf.app
2. Increase timeout in `.env.playwright`: `TEST_TIMEOUT=60000`
3. Run with `--headed` to see what's happening
4. Check Vercel deployment status

### Skipped Tests

**Problem**: Many tests are skipping

**Expected Behavior**: This is intentional for data-dependent tests
- Tests gracefully skip when required data doesn't exist
- Create test data using the script (see "Creating Test Data" section)
- Or manually create sessions via dev UI

### Different Results from Local

**Problem**: Tests pass locally but fail on dev (or vice versa)

**Possible Causes**:
1. **Data differences**: Dev and local have different data
2. **Beach IDs**: Dev uses UUIDs, local uses slugs (see [e2e/fixtures/test-data.ts](../e2e/fixtures/test-data.ts))
3. **API differences**: Dev may have newer/older code
4. **Performance**: Dev may be slower due to network latency

## Best Practices

### 1. Use Appropriate Test Projects

```bash
# Guest tests (no authentication)
npx playwright test --project=guest

# Authenticated tests
npx playwright test --project=auth
```

### 2. Target Specific Tests

```bash
# Run only photo-related tests
npx playwright test --grep photo

# Run specific file
npx playwright test e2e/feed-photo-thumbnails.spec.ts

# Run specific test
npx playwright test --grep "should display session cards with photos"
```

### 3. Debug Failures

```bash
# Run with headed browser
npx playwright test --headed

# Enable debug output
DEBUG=pw:api npx playwright test

# Generate trace for failed tests
npx playwright test --trace on-first-retry
```

### 4. Check Test Reports

```bash
# View HTML report after test run
npx playwright show-report
```

## CI/CD Integration

For running tests in CI against dev:

```yaml
- name: Setup environment
  run: |
    cp .env.playwright.example .env.playwright
    # Set secrets from CI environment
    echo "BASE_URL=https://dev.quiversurf.app" >> .env.playwright
    echo "TEST_USER_EMAIL=${{ secrets.DEV_TEST_EMAIL }}" >> .env.playwright
    echo "TEST_USER_PASSWORD=${{ secrets.DEV_TEST_PASSWORD }}" >> .env.playwright
    echo "VERCEL_BYPASS_TOKEN=${{ secrets.VERCEL_BYPASS_TOKEN }}" >> .env.playwright

- name: Install dependencies
  run: |
    npm ci
    npx playwright install --with-deps chromium

- name: Run E2E tests
  run: npx playwright test --reporter=html,json
```

## Performance Expectations

### Dev Environment

- **Auth setup**: 2-3 seconds
- **Page load**: 2-5 seconds
- **Test suite**: 20-30 seconds for 18 scenarios
- **Network overhead**: +10-20% vs local

### Optimization Tips

1. Use `--workers=4` for parallel execution
2. Skip unnecessary navigation with `test.use({ baseURL })`
3. Reuse authentication state (don't re-authenticate per test)
4. Use network idle timeouts sparingly

## Related Documentation

- [Test Architecture](../TEST_ARCHITECTURE.md) - Overall test structure
- [E2E Architecture](../e2e/ARCHITECTURE.md) - E2E testing patterns
- [Test Data Script](../e2e/scripts/README.md) - Creating test sessions
- [Playwright Config](../playwright.config.ts) - Configuration details

## Support

If you encounter issues:

1. Check this documentation
2. Review [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
3. Check Playwright logs in `test-results/`
4. Open an issue with test output and environment details
