# Playwright Local Setup Guide

Quick guide to get Playwright tests running locally.

## Quick Start

```bash
# Run the setup script
yarn test:e2e:setup

# Or manually:
# 1. Install browsers
npx playwright install chromium

# 2. Ensure .env.playwright is configured for local
# (Already done - TEST_ENV=local, BASE_URL=http://localhost:3000)

# 3. Start Supabase (if not running)
supabase start

# 4. Ensure test user exists in Supabase
# Go to http://127.0.0.1:54323 → Authentication → Users
# Create user matching TEST_USER_EMAIL in .env.playwright

# 5. Generate auth state
yarn test:e2e:auth:setup

# 6. Run tests
yarn test:e2e
```

## Prerequisites

1. **Node.js 18+** installed
2. **Supabase CLI** installed (`brew install supabase/tap/supabase`)
3. **Local Supabase** running (`supabase start`)
4. **Test user** created in Supabase Auth

## Configuration

### Environment File

The `.env.playwright` file is configured for local testing:

```bash
TEST_ENV=local
BASE_URL=http://localhost:3000
TEST_USER_EMAIL=your-test-user@example.com
TEST_USER_PASSWORD=your-password
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```

**Get Supabase keys:**
```bash
supabase status
# Copy NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
```

### Test User Setup

1. Start Supabase Studio:
   ```bash
   supabase start
   ```

2. Open Supabase Studio:
   - URL: http://127.0.0.1:54323
   - Navigate to: **Authentication → Users**
   - Click **"Add user"** → **"Create new user"**
   - Enter email/password matching `.env.playwright`

3. Or create via SQL:
   ```sql
   INSERT INTO auth.users (email, encrypted_password, email_confirmed_at)
   VALUES ('test@example.com', crypt('password123', gen_salt('bf')), now());
   ```

## Running Tests

### All Tests
```bash
yarn test:e2e
```

### With Browser Visible
```bash
yarn test:e2e:headed
```

### Interactive UI
```bash
yarn test:e2e:ui
```

### Specific Test File
```bash
npx playwright test e2e/sessions.spec.ts
```

### Debug Mode
```bash
yarn test:e2e:debug
```

## Authentication

### Generate Auth State

Before running tests, generate authentication state:

```bash
yarn test:e2e:auth:setup
```

This will:
- Launch browser in headed mode
- Log in with test credentials
- Save auth state to `e2e/.auth/state.json`

### Reset Auth State

If authentication fails:

```bash
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup
```

### Check Auth State

```bash
yarn test:e2e:auth:debug
```

## Troubleshooting

### "Authentication failed"

**Solution:**
1. Verify test user exists in Supabase
2. Check credentials in `.env.playwright`
3. Reset and regenerate auth state:
   ```bash
   yarn test:e2e:auth:reset
   yarn test:e2e:auth:setup
   ```

### "Connection refused" or "Cannot connect to localhost:3000"

**Solution:**
- The dev server will start automatically when running tests
- Or start manually: `yarn dev`
- Ensure port 3000 is not in use

### "Supabase not running"

**Solution:**
```bash
supabase start
supabase status  # Verify it's running
```

### Tests timeout

**Solution:**
- Check if dev server is responding: `curl http://localhost:3000`
- Increase timeout in test:
  ```typescript
  test.setTimeout(60000); // 60 seconds
  ```

### "Browser not installed"

**Solution:**
```bash
npx playwright install chromium
```

## Switching Environments

### To Test Against Dev Environment

Edit `.env.playwright`:
```bash
TEST_ENV=dev
BASE_URL=https://dev.quiversurf.app
# Comment out local Supabase config
# Add VERCEL_BYPASS_TOKEN if needed
```

Then regenerate auth state:
```bash
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup
```

### Back to Local

Edit `.env.playwright`:
```bash
TEST_ENV=local
BASE_URL=http://localhost:3000
# Uncomment local Supabase config
```

Regenerate auth state:
```bash
yarn test:e2e:auth:reset
yarn test:e2e:auth:setup
```

## What Gets Tested

- **Guest tests** (`guest-*.spec.ts`): Unauthenticated flows
- **Auth tests** (`*.spec.ts`): Authenticated user flows
- Tests run in parallel by default
- Dev server starts automatically if not running

## Additional Resources

- **Full E2E Guide**: `e2e/README.md`
- **Test Architecture**: `TEST_ARCHITECTURE.md`
- **Playwright Docs**: https://playwright.dev

---

**Last Updated:** 2025-01-29

