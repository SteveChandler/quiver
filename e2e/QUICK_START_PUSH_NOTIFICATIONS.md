# Quick Start: Push Notification E2E Tests

## 🚀 Quick Run

```bash
# 1. Ensure Supabase is running (local dev)
supabase start

# 2. Run all push notification tests
yarn test:e2e e2e/push-notifications.spec.ts

# 3. View results in UI mode (recommended first time)
yarn test:e2e:ui e2e/push-notifications.spec.ts
```

## 📋 Prerequisites Checklist

- [ ] `.env.playwright` file exists with required variables
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is set
- [ ] Test user exists and is authenticated
- [ ] Push notifications migration has been applied
- [ ] Auth state file exists (`e2e/.auth/state.json`)

## ⚡ Environment Setup

### Required Variables in `.env.playwright`

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # REQUIRED!
TEST_USER_EMAIL=test@quiver.com
TEST_USER_PASSWORD=testpassword123
BASE_URL=http://localhost:3000
```

### Get Service Role Key (Local Dev)

```bash
supabase status | grep "service_role key"
```

## 🔧 Common Commands

```bash
# Run specific test suite
yarn test:e2e e2e/push-notifications.spec.ts -g "API Tests"

# Run with debug output
DEBUG=pw:api yarn test:e2e e2e/push-notifications.spec.ts

# Recreate auth state
rm e2e/.auth/state.json && npx playwright test --global-setup-only

# View test report
npx playwright show-report
```

## 📊 Test Coverage

**28 Tests** across **7 Suites**:
- ✅ 8 API Endpoint Tests
- ✅ 1 Authentication Test
- ✅ 4 Device Removal Tests
- ✅ 6 Database Validation Tests
- ✅ 6 Edge Case Tests
- ✅ 2 RLS Policy Tests
- ✅ 2 Performance Tests

## 🐛 Quick Troubleshooting

### Issue: "Authentication required"
```bash
rm e2e/.auth/state.json
npx playwright test --global-setup-only
```

### Issue: "SUPABASE_SERVICE_ROLE_KEY required"
Check `.env.playwright` has the service role key from `supabase status`

### Issue: "Failed to get test user"
Verify test user exists in database:
```bash
supabase db reset  # Recreates test data
```

## 📚 Documentation

- **Full Setup Guide:** `e2e/PUSH_NOTIFICATIONS_TEST_SETUP.md`
- **Summary:** `E2E_PUSH_NOTIFICATIONS_TEST_SUMMARY.md`
- **E2E Architecture:** `e2e/ARCHITECTURE.md`

## ✅ Success Indicators

All tests pass when you see:
```
28 passed (30s-60s)
```

## 🎯 What's Tested

- Device token registration (iOS, Android, Web)
- Device token removal
- Database integrity and RLS policies
- Input validation and error handling
- Edge cases (long tokens, special chars, concurrency)
- Performance benchmarks

---

**Ready to run?** Execute: `yarn test:e2e e2e/push-notifications.spec.ts`
