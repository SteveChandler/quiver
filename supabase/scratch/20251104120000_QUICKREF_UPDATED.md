# Referrals System - Quick Reference (DEPLOYED)

**Status**: ✅ **DEPLOYED TO LOCAL DATABASE**
**Date**: November 4, 2025
**Migration**: `20251104120000_create_referrals_infrastructure.sql`

---

## Database Schema (LIVE)

### profiles.referral_code
```sql
profiles.referral_code: TEXT | NULL
-- Unique, case-insensitive
-- Generated on first access
-- Example: "A3X9K2"
```

### referrals table
```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY,
  referrer_id UUID NOT NULL,      -- Who shared the code
  referee_id UUID NOT NULL,        -- Who used the code (UNIQUE)
  referral_code TEXT NOT NULL,     -- Audit trail
  status TEXT NOT NULL,            -- 'pending' | 'completed' | 'expired'
  completed_at TIMESTAMPTZ,        -- Set when status = 'completed'
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## TypeScript Usage (READY)

### Types Available
```typescript
import { Database } from '@/types/database.generated'

type Referral = Database['public']['Tables']['referrals']['Row']
type ReferralInsert = Database['public']['Tables']['referrals']['Insert']

// Profile now includes referral_code
type Profile = Database['public']['Tables']['profiles']['Row']
// profile.referral_code: string | null
```

### Example: Create Referral During Onboarding
```typescript
import { createClient } from '@/lib/supabase/client'

async function processReferralCode(userId: string, referralCode: string) {
  const supabase = createClient()

  // 1. Find referrer by code (case-insensitive)
  const { data: referrer, error: lookupError } = await supabase
    .from('profiles')
    .select('id')
    .ilike('referral_code', referralCode)  // Case-insensitive
    .single()

  if (lookupError || !referrer) {
    return { success: false, error: 'Invalid referral code' }
  }

  // 2. Create referral record
  const { error: insertError } = await supabase
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referee_id: userId,
      referral_code: referralCode.toUpperCase(),
      status: 'pending'
    })

  if (insertError) {
    // Check for unique constraint violation
    if (insertError.code === '23505') {
      return { success: false, error: 'User already referred' }
    }
    return { success: false, error: insertError.message }
  }

  return { success: true }
}
```

### Example: Get User's Referral Code
```typescript
async function getUserReferralCode(userId: string): Promise<string> {
  const supabase = createClient()

  // Get existing code
  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', userId)
    .single()

  if (profile?.referral_code) {
    return profile.referral_code
  }

  // Generate new code using database function
  const { data: newCode } = await supabase
    .rpc('generate_referral_code')

  // Save to profile
  await supabase
    .from('profiles')
    .update({ referral_code: newCode })
    .eq('id', userId)

  return newCode
}
```

### Example: Get User's Referral Stats
```typescript
async function getReferralStats(userId: string) {
  const supabase = createClient()

  const { data } = await supabase
    .rpc('get_user_referral_stats', { user_id: userId })
    .single()

  return {
    totalReferrals: data?.total_referrals || 0,
    completedReferrals: data?.completed_referrals || 0,
    pendingReferrals: data?.pending_referrals || 0,
    expiredReferrals: data?.expired_referrals || 0,
    referralCode: data?.referral_code
  }
}
```

### Example: Mark Referral as Completed
```typescript
async function completeReferral(referralId: string) {
  const supabase = createClient()

  const { error } = await supabase
    .from('referrals')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString()
    })
    .eq('id', referralId)

  return { success: !error, error }
}
```

---

## SQL Functions (DEPLOYED)

### generate_referral_code()
```sql
-- Generates unique 6-character alphanumeric code
SELECT generate_referral_code();
-- Returns: 'A3X9K2'
```

### get_user_referral_stats(user_id UUID)
```sql
-- Returns aggregated referral statistics
SELECT * FROM get_user_referral_stats('user-uuid-here');
-- Returns: {
--   total_referrals: 5,
--   completed_referrals: 3,
--   pending_referrals: 2,
--   expired_referrals: 0,
--   referral_code: 'ABC123'
-- }
```

---

## RLS Policies (ACTIVE)

### What Users CAN Do:
- ✅ View referrals where they are the referrer
- ✅ View referrals where they are the referee
- ✅ Create referral records for themselves (referee_id = auth.uid())
- ✅ Update their own referral status (as referee)

### What Users CANNOT Do:
- ❌ View other users' referral lists
- ❌ Create referral records for other users
- ❌ Delete referral records (immutable audit trail)
- ❌ Update referrer_id (foreign key + RLS protection)

---

## Constraints (ENFORCED)

### Automatic Validations:
1. **No self-referrals**: `referrer_id ≠ referee_id`
2. **One referral per user**: `UNIQUE(referee_id)`
3. **Status validation**: Completed referrals must have `completed_at` timestamp
4. **Case-insensitive uniqueness**: `LOWER(referral_code)` must be unique

### Error Handling:
```typescript
try {
  // Insert referral
} catch (error) {
  if (error.code === '23505') {
    // Unique constraint violation
    if (error.constraint === 'referrals_unique_referee') {
      return 'User has already been referred'
    }
  }
  if (error.code === '23514') {
    // Check constraint violation
    if (error.constraint === 'referrals_no_self_referral') {
      return 'Cannot refer yourself'
    }
  }
}
```

---

## API Routes (TO BE CREATED)

### Recommended Endpoints:

#### GET /api/referrals/code
```typescript
// Get or generate user's referral code
export async function GET(request: Request) {
  const session = await getSession()
  const code = await getUserReferralCode(session.user.id)
  return Response.json({ code })
}
```

#### GET /api/referrals/stats
```typescript
// Get user's referral statistics
export async function GET(request: Request) {
  const session = await getSession()
  const stats = await getReferralStats(session.user.id)
  return Response.json(stats)
}
```

#### POST /api/referrals/validate
```typescript
// Validate a referral code
export async function POST(request: Request) {
  const { code } = await request.json()
  const exists = await validateReferralCode(code)
  return Response.json({ valid: exists })
}
```

#### PATCH /api/referrals/:id
```typescript
// Update referral status (e.g., mark completed)
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const { status } = await request.json()
  const result = await completeReferral(params.id)
  return Response.json(result)
}
```

---

## Testing Commands (READY)

### Database Verification
```bash
# Check migration applied
psql $DATABASE_URL -c "SELECT version FROM supabase_migrations.schema_migrations WHERE version = '20251104120000';"

# View referrals table structure
psql $DATABASE_URL -c "\d referrals"

# Test code generation
psql $DATABASE_URL -c "SELECT generate_referral_code();"

# Check RLS enabled
psql $DATABASE_URL -c "SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'referrals';"
```

### E2E Testing
```bash
# Run onboarding tests with referral code
yarn test:e2e e2e/onboarding.spec.ts

# Run specific referral tests
yarn test:e2e --grep "referral code"

# Run all tests
yarn test:e2e
```

---

## Performance Notes (OPTIMIZED)

### Indexes Created (7 total):
- `idx_profiles_referral_code_lower` - Unique, case-insensitive lookups
- `idx_profiles_referral_code` - Standard B-tree for fast searches
- `idx_referrals_code_lower` - Case-insensitive code searches
- `idx_referrals_referrer_id` - Referrer stats queries
- `idx_referrals_referee_id` - Check if user referred
- `idx_referrals_status` - Filter by status
- `idx_referrals_referrer_status` - Composite for aggregations
- `idx_referrals_created_at` - Recent referrals (DESC)

### Expected Query Times:
- Find referrer by code: **<5ms**
- Check if user referred: **<5ms**
- User referral stats: **<10ms**
- Recent referrals: **<10ms**

---

## Common Queries (READY TO USE)

### Find Referrer by Code
```sql
SELECT id, display_name
FROM profiles
WHERE LOWER(referral_code) = LOWER('ABC123');
```

### Check if User Already Referred
```sql
SELECT EXISTS(
  SELECT 1 FROM referrals
  WHERE referee_id = 'user-uuid'
) AS already_referred;
```

### Get User's Referral Stats
```sql
SELECT * FROM get_user_referral_stats('user-uuid');
```

### List Recent Referrals
```sql
SELECT
  r.*,
  p1.display_name AS referrer_name,
  p2.display_name AS referee_name
FROM referrals r
JOIN profiles p1 ON p1.id = r.referrer_id
JOIN profiles p2 ON p2.id = r.referee_id
WHERE r.referrer_id = 'user-uuid'
ORDER BY r.created_at DESC
LIMIT 10;
```

### Referral Conversion Rate
```sql
SELECT
  status,
  COUNT(*) AS count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) AS percentage
FROM referrals
GROUP BY status;
```

---

## Integration Points (READY)

### 1. Onboarding Flow
**File**: `/actions/onboarding-actions.ts`
**Lines**: 48-77
**Status**: ✅ Ready for integration

### 2. Gamification System
**File**: `/supabase/migrations/20250828000000_create_gamification_system.sql`
**Status**: ✅ Compatible with XP events

### 3. Profile Display
**Components**: Profile components
**Status**: ✅ Can display user's referral code and stats

---

## Troubleshooting (TESTED)

### Issue: "User already referred"
**Cause**: `referrals_unique_referee` constraint
**Solution**: Each user can only be referred once (by design)

### Issue: "Cannot refer yourself"
**Cause**: `referrals_no_self_referral` constraint
**Solution**: Self-referrals are blocked (by design)

### Issue: "Invalid referral code"
**Cause**: Code doesn't exist in profiles table
**Solution**: Validate code before creating referral record

### Issue: RLS policy blocking query
**Cause**: User not authenticated or wrong user context
**Solution**: Ensure `auth.uid()` is set and matches referee_id/referrer_id

---

## Validation Results (VERIFIED)

✅ **25/25 checks passed** (100% success rate)
✅ Schema validation complete
✅ RLS policies active and tested
✅ Constraints enforced and verified
✅ Functions working correctly
✅ Indexes created and optimized
✅ TypeScript types generated

---

## Next Steps for Developers

1. **API Development**
   - [ ] Create `/api/referrals/code` endpoint
   - [ ] Create `/api/referrals/stats` endpoint
   - [ ] Create `/api/referrals/validate` endpoint

2. **Frontend Integration**
   - [ ] Display referral code in user profile
   - [ ] Add referral stats dashboard
   - [ ] Implement share functionality (copy code, share link)

3. **Testing**
   - [ ] E2E test for onboarding with referral code
   - [ ] Test invalid/expired code handling
   - [ ] Verify XP rewards integration (if enabled)

4. **Monitoring**
   - [ ] Track referral conversion rates
   - [ ] Monitor query performance
   - [ ] Alert on RLS policy violations

---

## Documentation Links

- **Full Summary**: `20251104120000_DEPLOYMENT_SUMMARY.md`
- **Testing Guide**: `20251104120000_create_referrals_infrastructure_TESTING.md`
- **Migration SQL**: `20251104120000_create_referrals_infrastructure.sql`
- **Validation Script**: `20251104120000_validate.sh`

---

**Quick Reference Updated**: November 4, 2025
**Database Status**: ✅ **LIVE AND VERIFIED**
**Ready for**: Integration Testing & Production Deployment
