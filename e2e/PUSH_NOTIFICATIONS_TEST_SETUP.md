# Push Notifications E2E Test Setup

## Overview

Comprehensive E2E tests for the push notification device registration feature in Quiver.

**Test File:** `e2e/push-notifications.spec.ts`

**Test Coverage:** 28 test cases across 7 test suites

## What's Tested

### 1. API Endpoint Tests (POST /api/devices/upsert)
- ✅ Register valid iOS device token
- ✅ Register valid Android device token
- ✅ Register valid web device token
- ✅ Reject invalid platform (e.g., 'windows')
- ✅ Reject missing device_token
- ✅ Reject missing platform
- ✅ Update existing device token (upsert behavior)
- ✅ Return 200 with success message

### 2. Unauthenticated Access Tests
- ✅ Require authentication for POST (401 for unauthenticated)

### 3. Device Removal Tests (DELETE /api/devices/upsert)
- ✅ Remove device token when provided
- ✅ Require device_token parameter
- ✅ Return 200 on successful deletion
- ✅ Handle deletion of non-existent token gracefully

### 4. Database Validation Tests
- ✅ Verify correct user_id in database
- ✅ Verify correct platform in database
- ✅ Verify timestamps set correctly (created_at, updated_at)
- ✅ Ensure no duplicate entries on upsert
- ✅ Verify updated_at timestamp changes on re-registration

### 5. Edge Cases
- ✅ Handle extremely long device tokens (250 characters)
- ✅ Handle special characters in device tokens
- ✅ Handle concurrent registrations (same user, different devices)
- ✅ Reject empty string device tokens
- ✅ Reject case-insensitive platform values (must be lowercase)
- ✅ Support multiple devices for same user

### 6. RLS Policy Tests
- ✅ Users can only view their own devices
- ✅ Users can delete their own devices

### 7. Performance Tests
- ✅ Device registration completes within 2 seconds
- ✅ Handle rapid successive registrations without duplicates

## Prerequisites

### Environment Variables

Ensure the following are set in `.env.playwright`:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321  # or your Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key  # Required for database verification

# Test User Credentials
TEST_USER_EMAIL=test@quiver.com
TEST_USER_PASSWORD=testpassword123

# Application URL
BASE_URL=http://localhost:3000
```

### Database Setup

Ensure the push notifications migration has been applied:

```bash
# If using local Supabase
supabase db reset

# Or apply migration directly
supabase migration up
```

**Required Tables:**
- `user_devices` - Stores device tokens for push notifications
- `profiles` - User profile data (needed for test user lookup)

### Test User Setup

The tests use the global authenticated test user created during `globalSetup`. Ensure:

1. Test user exists in your database
2. Test user credentials match `.env.playwright` configuration
3. Authentication state is saved in `e2e/.auth/state.json`

To recreate authentication state:

```bash
# Delete existing state
rm e2e/.auth/state.json

# Re-run global setup
npx playwright test --global-setup-only
```

## Running the Tests

### Run All Push Notification Tests

```bash
yarn test:e2e e2e/push-notifications.spec.ts
```

### Run Specific Test Suite

```bash
# API Tests only
yarn test:e2e e2e/push-notifications.spec.ts -g "API Tests"

# Database Validation only
yarn test:e2e e2e/push-notifications.spec.ts -g "Database Validation"

# Edge Cases only
yarn test:e2e e2e/push-notifications.spec.ts -g "Edge Cases"
```

### Run with UI Mode (Recommended for Development)

```bash
yarn test:e2e:ui e2e/push-notifications.spec.ts
```

### Run with Debug Output

```bash
DEBUG=pw:api yarn test:e2e e2e/push-notifications.spec.ts
```

## Test Architecture

### Test Data Generation

The tests use realistic device token generation:

```typescript
generateDeviceToken('ios')      // 64 hex characters
generateDeviceToken('android')  // ~152 characters (FCM format)
generateDeviceToken('web')      // Base64-like web push format
```

### Database Verification

Tests verify database state using Supabase admin client:

```typescript
// Verify device exists
await verifyDeviceInDatabase(userId, deviceToken, 'ios');

// Verify device removed
await verifyDeviceNotInDatabase(userId, deviceToken);
```

### Cleanup Strategy

Each test suite includes:

```typescript
test.beforeEach(async () => {
  // Clean up existing test tokens before each test
  await cleanupDeviceTokens(userId);
});

test.afterEach(async () => {
  // Clean up test data after each test
  await cleanupDeviceTokens(userId);
});
```

This ensures test isolation and prevents data pollution.

## Test Patterns Used

### 1. Request Context Testing

Uses Playwright's `request` context to test API endpoints directly:

```typescript
test('should register valid iOS device token', async ({ request }) => {
  const response = await request.post('/api/devices/upsert', {
    data: {
      platform: 'ios',
      device_token: deviceToken,
    },
  });

  expect(response.ok()).toBe(true);
  // ... assertions
});
```

### 2. Database State Verification

Queries database directly to verify API behavior:

```typescript
const { data } = await admin
  .from('user_devices')
  .select('*')
  .eq('user_id', userId)
  .eq('device_token', deviceToken)
  .single();

expect(data.platform).toBe('ios');
```

### 3. Timestamp Validation

Ensures timestamps are set correctly and updated on upsert:

```typescript
// Verify initial timestamps
const { data: initialData } = await admin
  .from('user_devices')
  .select('created_at, updated_at')
  .eq('device_token', deviceToken)
  .single();

// Wait and re-register
await new Promise(resolve => setTimeout(resolve, 1000));
await request.post('/api/devices/upsert', { ... });

// Verify updated_at changed
const { data: updatedData } = await admin
  .from('user_devices')
  .select('updated_at')
  .eq('device_token', deviceToken)
  .single();

expect(new Date(updatedData.updated_at).getTime())
  .toBeGreaterThan(new Date(initialData.updated_at).getTime());
```

### 4. Concurrent Request Testing

Tests race conditions and concurrent access:

```typescript
const [response1, response2, response3] = await Promise.all([
  request.post('/api/devices/upsert', { data: { platform: 'ios', ... } }),
  request.post('/api/devices/upsert', { data: { platform: 'android', ... } }),
  request.post('/api/devices/upsert', { data: { platform: 'web', ... } }),
]);

// All should succeed
expect(response1.ok()).toBe(true);
expect(response2.ok()).toBe(true);
expect(response3.ok()).toBe(true);
```

## Troubleshooting

### Authentication Failures

If tests fail with "Authentication required":

1. Check `.env.playwright` has correct test user credentials
2. Delete and recreate auth state:
   ```bash
   rm e2e/.auth/state.json
   npx playwright test --global-setup-only
   ```
3. Verify test user exists in database

### Database Connection Issues

If tests fail with "SUPABASE_SERVICE_ROLE_KEY required":

1. Ensure `SUPABASE_SERVICE_ROLE_KEY` is set in `.env.playwright`
2. For local dev:
   ```bash
   supabase status  # Get service role key
   ```
3. Add to `.env.playwright`:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...your_key_here
   ```

### Test Data Cleanup

If tests fail due to existing data:

1. Manually clean up test data:
   ```sql
   -- Connect to Supabase Studio or psql
   DELETE FROM user_devices
   WHERE user_id = (SELECT id FROM profiles WHERE email = 'test@quiver.com');
   ```

2. Re-run tests

### RLS Policy Issues

If database queries fail with permission errors:

1. Verify RLS policies are applied:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_devices';
   ```

2. Re-apply migration:
   ```bash
   supabase migration up
   ```

## Coverage Report

**Total Test Cases:** 28
**Test Suites:** 7
**Lines of Code:** 1,071

**Coverage by Category:**
- API Endpoint Tests: 8 tests
- Unauthenticated Tests: 1 test
- Device Removal Tests: 4 tests
- Database Validation: 6 tests
- Edge Cases: 6 tests
- RLS Policy Tests: 2 tests
- Performance Tests: 2 tests

**Time to Execute:** ~30-60 seconds (depends on database performance)

## Integration with CI/CD

These tests are designed to run in CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run Push Notification E2E Tests
  run: |
    npx playwright test e2e/push-notifications.spec.ts
  env:
    BASE_URL: ${{ secrets.BASE_URL }}
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
    TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
    TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
```

## Next Steps

### Extending Test Coverage

Consider adding tests for:

1. **Notification Delivery**
   - Test sending push notifications via Firebase
   - Verify notification payload format
   - Test notification delivery to multiple devices

2. **Token Refresh Flow**
   - Test FCM token refresh scenarios
   - Verify old tokens are replaced

3. **User Logout Flow**
   - Test device token cleanup on logout
   - Verify tokens are not reused after logout

4. **Multi-Device Scenarios**
   - User with iPhone + iPad
   - User with Android phone + web browser
   - Token rotation across devices

### Performance Optimization

Monitor and optimize:

- Database query performance for device lookups
- Upsert operation performance at scale
- Cleanup query performance with many devices

### Security Enhancements

Consider testing:

- Rate limiting on device registration
- Maximum devices per user limits
- Token validation and sanitization
- Prevention of token hijacking attempts

## Related Documentation

- [E2E Testing Architecture](./ARCHITECTURE.md)
- [Push Notifications Implementation](../docs/research/IMPLEMENTATION_STATUS_REPORT.md)
- [API Routes Documentation](../app/api/devices/upsert/route.ts)
- [Database Schema](../supabase/migrations/20250116000000_push_notifications_infrastructure.sql)

## Support

For issues or questions:

1. Check [E2E Test README](./README.md) for general E2E testing guidance
2. Review [ARCHITECTURE.md](./ARCHITECTURE.md) for testing patterns
3. Examine test output and traces in `playwright-report/`
4. Open an issue with test failure logs and environment details
