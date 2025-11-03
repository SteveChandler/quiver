# Running Tests - Quick Reference

This is a quick-start guide for running tests. For detailed information, see [docs/TESTING_GUIDE.md](../TESTING_GUIDE.md).

## Quick Commands

### Run All Tests

```bash
# Unit tests only (fast)
yarn test

# E2E tests only (slow)
npx playwright test

# Everything
yarn test && npx playwright test
```

### Run Specific Tests

```bash
# Unit test by name pattern
yarn test avatar-upload

# E2E test by file
npx playwright test profile-edit

# E2E test with UI (recommended for development)
npx playwright test --ui
```

## Unit Tests (Jest)

### Basic Usage

```bash
# Run all unit tests
yarn test

# Watch mode (auto-rerun on file changes)
yarn test --watch

# Coverage report
yarn test --coverage

# Run specific test file
yarn test avatar-upload.test.tsx

# Run tests matching pattern
yarn test --testNamePattern="should validate"
```

### What Are Unit Tests?

- **Fast** (milliseconds)
- **Mocked** Supabase and external services
- Test component logic, utilities, and functions
- Run on every commit

### Common Issues

**Problem:** Tests fail with "Cannot find module"
```bash
# Solution: Clear Jest cache
yarn test --clearCache
yarn test
```

**Problem:** Timeout errors
```typescript
// Solution: Increase timeout in test
test('slow operation', async () => {
  jest.setTimeout(10000); // 10 seconds
  // ... your test
});
```

## E2E Tests (Playwright)

### Basic Usage

```bash
# Run all E2E tests
npx playwright test

# Interactive UI mode (recommended)
npx playwright test --ui

# Run with visible browser
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug

# Run specific test file
npx playwright test profile-edit-user-flow

# Run tests matching pattern
npx playwright test --grep "should submit form"
```

### What Are E2E Tests?

- **Slow** (minutes)
- **Real** Supabase connection (local or remote)
- Test complete user journeys
- Run before merging to main

### Setup (First Time Only)

1. **Start Supabase:**
   ```bash
   supabase start
   ```

2. **Create `.env.playwright`:**
   ```bash
   # Copy from .env.example
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_local_anon_key
   TEST_USER_EMAIL=test@example.com
   TEST_USER_PASSWORD=testpassword123
   ```

3. **Create test user:**
   - Go to http://127.0.0.1:54323 (Supabase Studio)
   - Navigate to Authentication → Users
   - Create user with email/password from `.env.playwright`

4. **Run tests:**
   ```bash
   npx playwright test
   ```

### Common Issues

**Problem:** "Authentication failed"
```bash
# Solution 1: Reset auth state
rm -rf e2e/.auth
npx playwright test

# Solution 2: Verify test user exists
# Go to http://127.0.0.1:54323
# Check Authentication → Users
```

**Problem:** "Connection refused"
```bash
# Solution: Start Supabase
supabase start
supabase status  # Verify it's running
```

**Problem:** Tests timing out
```bash
# Solution: Run with longer timeout
npx playwright test --timeout=180000  # 3 minutes
```

## Test Environments

### Local Development (Default)

```bash
# Uses local Supabase (http://127.0.0.1:54321)
yarn test                # Unit tests
npx playwright test      # E2E tests
```

### Against Dev Environment

```bash
# Unit tests (always use local/mocked)
yarn test

# E2E tests against dev
BASE_URL=https://dev.quiversurf.app npx playwright test
```

### Against Production (CI Only)

**⚠️ Never run tests against production manually!**

Production tests run automatically in GitHub Actions only.

## Test Coverage

### View Coverage Report

```bash
# Generate coverage
yarn test --coverage

# Open HTML report in browser
open coverage/lcov-report/index.html
```

### Coverage Goals

- Statements: 80%+
- Branches: 75%+
- Functions: 80%+
- Lines: 80%+

## CI/CD Integration

### GitHub Actions

Tests run automatically on:
- Every push to a PR
- Every commit to `main`
- Scheduled nightly runs

### Workflow

```
Push to PR
  ↓
Lint & Type Check
  ↓
Unit Tests (Jest)
  ↓
Build
  ↓
E2E Tests (Playwright)
  ↓
Deploy Preview (if all pass)
```

## Quick Debugging

### Unit Test Failures

1. **Read the error message carefully**
   - Shows what expected vs what received
   - Points to exact line number

2. **Run in watch mode**
   ```bash
   yarn test --watch
   # Edit and save file to re-run
   ```

3. **Check mocks**
   ```typescript
   // Add debug log
   console.log('Mock returned:', mockFunction.mock.results);
   ```

### E2E Test Failures

1. **Run with UI mode**
   ```bash
   npx playwright test --ui
   # Step through test visually
   ```

2. **Check screenshots**
   ```bash
   # Screenshots saved on failure
   ls test-results/*/test-failed-1.png
   ```

3. **Run in debug mode**
   ```bash
   npx playwright test --debug
   # Pauses before each action
   ```

4. **Check trace**
   ```bash
   # View trace if test failed
   npx playwright show-trace test-results/*/trace.zip
   ```

## Test File Organization

```
quiver/
├── __tests__/                 # Unit & Integration Tests
│   ├── components/            # Component tests
│   ├── lib/                   # Utility tests
│   ├── hooks/                 # Hook tests
│   └── setup/                 # Mock files
│
└── e2e/                       # E2E Tests
    ├── .auth/                 # Auth state
    ├── profile-edit.spec.ts   # Test files
    └── utils/                 # Test helpers
```

## Best Practices

### ✅ DO

- Run `yarn test` before committing
- Run `npx playwright test` before opening PR
- Write tests for new features
- Fix broken tests immediately
- Use descriptive test names

### ❌ DON'T

- Skip failing tests (use `test.skip`)
- Commit with failing tests
- Test against production manually
- Use arbitrary timeouts
- Test implementation details

## Need More Help?

- **Full guide:** [docs/TESTING_GUIDE.md](../TESTING_GUIDE.md)
- **Test architecture:** [TEST_ARCHITECTURE.md](../../TEST_ARCHITECTURE.md)
- **Mock files:** [__tests__/setup/README.md](../../__tests__/setup/README.md)
- **Troubleshooting:** [docs/TROUBLESHOOTING.md](../TROUBLESHOOTING.md)

---

**Quick Tip:** Use `npx playwright test --ui` for visual debugging - it's much easier than debugging in headed mode!
