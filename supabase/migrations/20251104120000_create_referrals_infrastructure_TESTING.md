# Referrals Infrastructure Migration - Testing Guide

## Migration Summary

**File**: `20251104120000_create_referrals_infrastructure.sql`

This migration creates the complete database infrastructure for the referrals system used during user onboarding.

### What Was Created

#### 1. **profiles.referral_code Column**
- Type: `TEXT`
- Unique, case-insensitive
- Indexed for fast lookups
- Each user gets their own referral code to share

#### 2. **referrals Table**
Complete schema with:
- `id` (UUID, primary key)
- `referrer_id` (UUID, FK to profiles) - Who shared the code
- `referee_id` (UUID, FK to profiles) - Who used the code
- `referral_code` (TEXT) - The code that was entered
- `status` (TEXT) - 'pending', 'completed', 'expired'
- `completed_at` (TIMESTAMPTZ) - When referral was completed
- `created_at`, `updated_at` (TIMESTAMPTZ)

#### 3. **Constraints & Validation**
- Self-referral prevention: `referrer_id != referee_id`
- Unique referee: Each user can only be referred once
- Completion timestamp validation: completed status requires timestamp
- Case-insensitive code lookups

#### 4. **Indexes (7 total)**
- `idx_profiles_referral_code_lower` - Case-insensitive unique on profiles
- `idx_profiles_referral_code` - Fast profile code lookup
- `idx_referrals_code_lower` - Case-insensitive referral code search
- `idx_referrals_referrer_id` - Find all referrals by referrer
- `idx_referrals_referee_id` - Check if user was referred
- `idx_referrals_status` - Filter by status
- `idx_referrals_referrer_status` - Composite for stats queries
- `idx_referrals_created_at` - Recent referrals

#### 5. **RLS Policies (4 total)**
- Users can view their own referrals (as referrer)
- Users can view their own referrals (as referee)
- Users can create referrals for themselves
- Users can update their own referral status
- **No DELETE policy** - referrals are immutable for audit

#### 6. **Helper Functions**
- `generate_referral_code()` - Creates unique 6-char alphanumeric codes
- `get_user_referral_stats(user_id)` - Returns referral statistics

#### 7. **Triggers**
- Auto-update `updated_at` on row modifications

---

## Testing Instructions

### Prerequisites

```bash
# Start Supabase locally
supabase start

# Apply the migration
supabase db reset  # or
supabase migration up
```

### Test 1: Verify Schema Creation

```sql
-- Check profiles.referral_code column exists
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'referral_code';
-- Expected: referral_code | text | YES

-- Check referrals table exists with correct columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'referrals'
ORDER BY ordinal_position;
-- Expected: id, referrer_id, referee_id, referral_code, status, completed_at, created_at, updated_at

-- Verify indexes were created
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('profiles', 'referrals')
AND indexname LIKE '%referral%'
ORDER BY indexname;
-- Expected: 7 indexes related to referrals
```

### Test 2: Test Referral Code Generation

```sql
-- Generate a referral code
SELECT generate_referral_code();
-- Expected: 6-character alphanumeric code (e.g., 'A3X9K2')

-- Generate multiple codes and verify uniqueness
SELECT generate_referral_code() AS code
FROM generate_series(1, 10);
-- Expected: 10 unique codes

-- Assign referral code to a test user
UPDATE profiles
SET referral_code = generate_referral_code()
WHERE id = (SELECT id FROM profiles LIMIT 1);
```

### Test 3: Test Referral Creation (Happy Path)

```sql
-- Setup: Create two test users
-- User 1 (Referrer): Has a referral code to share
-- User 2 (Referee): Will sign up using User 1's code

-- Step 1: Give User 1 a referral code
UPDATE profiles
SET referral_code = 'TEST01'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Step 2: User 2 signs up with User 1's referral code
-- (This simulates the onboarding-actions.ts flow)
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    completed_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',  -- User 1 (referrer)
    '00000000-0000-0000-0000-000000000002',  -- User 2 (referee)
    'TEST01',
    'completed',
    NOW()
);

-- Verify referral was created
SELECT
    r.id,
    r.referrer_id,
    r.referee_id,
    r.referral_code,
    r.status,
    r.completed_at IS NOT NULL AS has_completion_date
FROM referrals r;
-- Expected: 1 row with status='completed' and has_completion_date=true
```

### Test 4: Test Constraints

```sql
-- Test 1: Prevent self-referral
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000001',  -- Same as referrer_id
    'TEST01',
    'pending'
);
-- Expected: ERROR - violates check constraint "referrals_no_self_referral"

-- Test 2: Prevent duplicate referee
-- (Assuming User 2 is already referred from Test 3)
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status
)
VALUES (
    '00000000-0000-0000-0000-000000000003',  -- Different referrer
    '00000000-0000-0000-0000-000000000002',  -- Same referee as Test 3
    'TEST03',
    'pending'
);
-- Expected: ERROR - violates unique constraint "referrals_unique_referee"

-- Test 3: Completed status requires completed_at
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    completed_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'TEST01',
    'completed',
    NULL  -- Missing completion timestamp
);
-- Expected: ERROR - violates check constraint "referrals_completed_at_when_completed"

-- Test 4: Pending status should not have completed_at
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    completed_at
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000004',
    'TEST01',
    'pending',
    NOW()  -- Should be NULL for pending
);
-- Expected: ERROR - violates check constraint "referrals_completed_at_when_completed"
```

### Test 5: Test Case-Insensitive Lookups

```sql
-- Setup: Create referral code in mixed case
UPDATE profiles
SET referral_code = 'AbCd12'
WHERE id = '00000000-0000-0000-0000-000000000001';

-- Test: Lookup with different cases should all work
SELECT id, referral_code
FROM profiles
WHERE LOWER(referral_code) = LOWER('ABCD12');
-- Expected: 1 row found

SELECT id, referral_code
FROM profiles
WHERE LOWER(referral_code) = LOWER('abcd12');
-- Expected: 1 row found

SELECT id, referral_code
FROM profiles
WHERE LOWER(referral_code) = LOWER('AbCd12');
-- Expected: 1 row found

-- Test: Cannot create duplicate code with different case
UPDATE profiles
SET referral_code = 'ABCD12'  -- Same code, different case
WHERE id = '00000000-0000-0000-0000-000000000002';
-- Expected: ERROR - violates unique constraint "idx_profiles_referral_code_lower"
```

### Test 6: Test RLS Policies

```sql
-- Setup: Set auth context to User 1
SET LOCAL "request.jwt.claims" = '{"sub": "00000000-0000-0000-0000-000000000001"}';

-- Test 1: User can view their own referrals (as referrer)
SELECT COUNT(*) FROM referrals WHERE referrer_id = '00000000-0000-0000-0000-000000000001';
-- Expected: Count of referrals where User 1 is the referrer

-- Test 2: User cannot view other users' referrals
SELECT COUNT(*) FROM referrals WHERE referrer_id = '00000000-0000-0000-0000-000000000002';
-- Expected: 0 (or only referrals where User 1 is referee)

-- Test 3: User can insert referral for themselves
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status
)
VALUES (
    '00000000-0000-0000-0000-000000000002',  -- Different user as referrer
    '00000000-0000-0000-0000-000000000001',  -- Current user as referee (allowed)
    'TEST02',
    'pending'
);
-- Expected: SUCCESS

-- Test 4: User cannot insert referral for someone else
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status
)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',  -- Different user (not allowed)
    'TEST02',
    'pending'
);
-- Expected: ERROR - new row violates row-level security policy
```

### Test 7: Test Helper Functions

```sql
-- Test get_user_referral_stats function
SELECT * FROM get_user_referral_stats('00000000-0000-0000-0000-000000000001');
-- Expected: Row with total_referrals, completed_referrals, pending_referrals, expired_referrals, referral_code

-- Test with user who has no referrals
SELECT * FROM get_user_referral_stats('00000000-0000-0000-0000-000000000099');
-- Expected: Row with all counts = 0, referral_code may be NULL

-- Verify stats are accurate
-- Setup: Create various referral statuses for testing
INSERT INTO referrals (referrer_id, referee_id, referral_code, status)
VALUES
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', 'TEST01', 'pending'),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000011', 'TEST01', 'completed'),
    ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000012', 'TEST01', 'expired');

-- Check stats
SELECT
    total_referrals,
    completed_referrals,
    pending_referrals,
    expired_referrals
FROM get_user_referral_stats('00000000-0000-0000-0000-000000000001');
-- Expected: total=3, completed=1, pending=1, expired=1
```

### Test 8: Test Updated_At Trigger

```sql
-- Create a referral
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status
)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000020',
    'TEST01',
    'pending'
)
RETURNING id, created_at, updated_at;
-- Note: created_at and updated_at should be the same initially

-- Wait a moment, then update the status
SELECT pg_sleep(1);

UPDATE referrals
SET status = 'completed',
    completed_at = NOW()
WHERE referee_id = '00000000-0000-0000-0000-000000000020'
RETURNING created_at, updated_at;
-- Expected: updated_at should be greater than created_at
```

### Test 9: Integration Test with Onboarding Flow

This test simulates the actual flow from `actions/onboarding-actions.ts`:

```sql
-- Step 1: User 1 signs up and gets a referral code
INSERT INTO auth.users (id, email) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'referrer@example.com');

INSERT INTO profiles (id, full_name, email)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Referrer User', 'referrer@example.com');

UPDATE profiles
SET referral_code = generate_referral_code()
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
RETURNING referral_code;
-- Note the returned code for next step

-- Step 2: User 2 signs up with User 1's referral code
INSERT INTO auth.users (id, email) VALUES
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'referee@example.com');

INSERT INTO profiles (id, full_name, email)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Referee User', 'referee@example.com');

-- Step 3: During onboarding, look up the referrer by code
-- (Replace 'ABC123' with the actual code from Step 1)
SELECT id, referral_code
FROM profiles
WHERE referral_code = 'ABC123';  -- Use actual code
-- Expected: Returns User 1's profile

-- Step 4: Create referral record
-- This is what onboarding-actions.ts does at lines 57-65
INSERT INTO referrals (
    referrer_id,
    referee_id,
    referral_code,
    status,
    completed_at
)
SELECT
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',  -- referrer
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',  -- referee
    'ABC123',  -- Use actual code
    'completed',
    NOW();

-- Step 5: Verify referral was created correctly
SELECT
    r.*,
    p1.full_name AS referrer_name,
    p2.full_name AS referee_name
FROM referrals r
JOIN profiles p1 ON p1.id = r.referrer_id
JOIN profiles p2 ON p2.id = r.referee_id
WHERE r.referee_id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
-- Expected: 1 row with correct referrer/referee relationship
```

---

## Performance Validation

### Index Usage Verification

```sql
-- Check if indexes are being used for common queries
EXPLAIN ANALYZE
SELECT * FROM profiles
WHERE LOWER(referral_code) = LOWER('TEST01');
-- Expected: Index Scan using idx_profiles_referral_code_lower

EXPLAIN ANALYZE
SELECT * FROM referrals
WHERE referrer_id = '00000000-0000-0000-0000-000000000001'
AND status = 'completed';
-- Expected: Index Scan using idx_referrals_referrer_status

EXPLAIN ANALYZE
SELECT * FROM referrals
WHERE referee_id = '00000000-0000-0000-0000-000000000002';
-- Expected: Index Scan using idx_referrals_referee_id
```

### Query Performance Benchmarks

```sql
-- Benchmark: Lookup referral code (should be <5ms)
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT id FROM profiles
WHERE LOWER(referral_code) = LOWER('TEST01');

-- Benchmark: Count user referrals (should be <10ms)
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT COUNT(*) FROM referrals
WHERE referrer_id = '00000000-0000-0000-0000-000000000001'
AND status = 'completed';

-- Benchmark: Check if user was referred (should be <5ms)
EXPLAIN (ANALYZE, BUFFERS, TIMING)
SELECT EXISTS (
    SELECT 1 FROM referrals
    WHERE referee_id = '00000000-0000-0000-0000-000000000002'
);
```

---

## Rollback Instructions

If you need to rollback this migration:

```sql
-- Drop referrals table and cascade to dependent objects
DROP TABLE IF EXISTS public.referrals CASCADE;

-- Remove referral_code column from profiles
ALTER TABLE public.profiles DROP COLUMN IF EXISTS referral_code;

-- Drop helper functions
DROP FUNCTION IF EXISTS public.generate_referral_code();
DROP FUNCTION IF EXISTS public.get_user_referral_stats(UUID);

-- Note: Indexes and triggers are automatically dropped with CASCADE
```

---

## Common Issues & Solutions

### Issue 1: "relation 'referrals' already exists"
**Solution**: The migration uses `CREATE TABLE IF NOT EXISTS`, so this shouldn't occur. If it does, the table was created elsewhere. Verify the schema matches expectations.

### Issue 2: Referral code generation fails
**Solution**: Check that the `profiles` table has the `referral_code` column and the unique index. Verify no duplicate codes exist.

### Issue 3: RLS policy prevents inserts
**Solution**: Ensure `auth.uid()` returns the expected user ID. Check that the `referee_id` matches the authenticated user.

### Issue 4: Case-sensitive code lookups failing
**Solution**: Always use `LOWER(referral_code) = LOWER('code')` for comparisons, never direct equality.

---

## Next Steps

After validating the migration:

1. **Update TypeScript types**: Run `yarn db:types` to generate TypeScript types for the new schema
2. **Test onboarding flow**: Verify the complete user journey in the app
3. **Monitor performance**: Watch query performance in production
4. **Add analytics**: Track referral conversion rates
5. **Consider enhancements**:
   - Referral reward system (XP, badges)
   - Referral expiration logic
   - Referral campaign tracking
   - Referral leaderboards

---

## Documentation References

- Migration file: `supabase/migrations/20251104120000_create_referrals_infrastructure.sql`
- Onboarding actions: `actions/onboarding-actions.ts` (lines 48-77)
- Gamification system: `supabase/migrations/20250828000000_create_gamification_system.sql`
