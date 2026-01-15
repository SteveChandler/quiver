# Database Integration Tests

This directory contains integration tests that verify database-level functionality like triggers, functions, and RLS policies.

## Running Database Tests

These tests require a running Supabase instance with the service role key.

### Prerequisites

1. Ensure `.env.local` or `.env` contains:
   ```
   NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
   SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
   ```

2. Ensure you have mock test users in the database (created by seed scripts)

### Run Tests

```bash
# Run all database tests
npm test -- __tests__/database

# Run specific test file
npm test -- __tests__/database/auto-assign-beach-trigger.test.ts

# Run with verbose output
npm test -- __tests__/database --verbose
```

## Test Files

### `auto-assign-beach-trigger.test.ts`

Tests the auto-assign beach trigger feature that automatically finds and assigns the nearest beach to intel posts when they are created.

**What it tests:**
- Trigger fires on INSERT and assigns nearest beach within 2 miles
- Returns NULL when no beach is within 2 miles
- Does not overwrite explicitly set beach_id values
- Handles invalid coordinates gracefully
- Selects the correct beach when multiple are nearby
- Backfill logic worked for existing posts

**Migration:** `20260114173139_auto_assign_beach_to_intel_posts.sql`

**Design Doc:** `docs/plans/2026-01-14-auto-assign-beach-to-intel-design.md`

## Test Patterns

### Using Service Role Client

Database tests use the service role client to bypass RLS and directly test database functionality:

```typescript
const supabase = createClient<Database>(supabaseUrl, supabaseServiceKey);
```

### Cleanup

Tests should clean up after themselves in `afterAll`:

```typescript
afterAll(async () => {
  // Delete test data
  await supabase.from("intel_posts").delete().in("id", createdIds);
});
```

### Mock Users

Tests should use mock users from the profiles table:

```typescript
const { data: users } = await supabase
  .from("profiles")
  .select("id")
  .eq("is_mock", true)
  .limit(1);
```

## Writing New Database Tests

1. Create a new test file in this directory: `<feature-name>.test.ts`
2. Use the service role client for direct database access
3. Clean up test data in `afterAll` hook
4. Document what migration/feature is being tested
5. Add test file documentation to this README

## Troubleshooting

**Error: Missing environment variables**
- Ensure `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set

**Error: No mock test user found**
- Run the database seed scripts to create mock users

**Tests failing after migration**
- Ensure migrations have been applied to your test database
- Check that the database schema matches what the test expects

**Cleanup failures**
- Tests may leave data if they crash/timeout
- Manually clean test data: Look for `test-*` prefixed records
