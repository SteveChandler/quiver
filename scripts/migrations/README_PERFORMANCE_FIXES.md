# Performance Optimization Migrations

This guide helps you fix Supabase performance warnings for better database performance.

## Quick Fix

Run this single migration to fix all performance warnings:

### Step 1: Apply the Performance Fixes

Copy and paste the contents of `018_fix_performance_warnings.sql` into your Supabase SQL Editor and execute it.

## What Gets Fixed

### ✅ Auth RLS InitPlan Issues (32+ warnings)

**Problem**: RLS policies using `auth.uid()` directly re-evaluate for each row  
**Solution**: Replace with `(select auth.uid())` to evaluate once per query  
**Performance Impact**: 3-10x faster queries on tables with many rows

**Before:**

```sql
auth.uid() = user_id  -- ❌ Slow: evaluates for each row
```

**After:**

```sql
(select auth.uid()) = user_id  -- ✅ Fast: evaluates once per query
```

### ✅ Multiple Permissive Policies (12 warnings)

**Problem**: Duplicate policies for the same action (SELECT) on same table  
**Solution**: Consolidate into single policies per action  
**Performance Impact**: Faster policy evaluation, cleaner permissions

**Tables Fixed:**

- `buoys` - Removed duplicate SELECT policies
- `enhanced_forecasts` - Removed duplicate SELECT policies
- `profiles` - Consolidated duplicate SELECT policies

### ✅ Duplicate Index (1 warning)

**Problem**: Two indexes on same column (`buoys.buoy_uuid`)  
**Solution**: Remove `idx_buoys_uuid`, keep `idx_buoys_buoy_uuid`  
**Performance Impact**: Faster writes, less storage overhead

## Verification

After running the migration, check your Supabase Dashboard:

1. Go to **Settings** → **Database** → **Linter**
2. Look for these specific warnings - they should be gone:
   - ❌ `auth_rls_initplan` warnings
   - ❌ `multiple_permissive_policies` warnings
   - ❌ `duplicate_index` warnings

## Tables Optimized

The migration optimizes RLS policies on these tables:

- `beaches` - Admin policies
- `user_follows` - Follow/unfollow policies
- `forecasts` - Admin policies
- `favorite_beaches` - User ownership policies
- `boards` - User ownership policies
- `session_likes` - Like/unlike policies
- `session_media` - Media ownership policies
- `storage_usage` - Storage tracking policies
- `beach_reviews` - Review ownership policies
- `profiles` - Profile management policies
- `user_activities` - Activity tracking policies
- `enhanced_forecasts` - Forecast management policies
- `buoys` - Buoy data policies
- `comments` - Comment ownership policies

## Expected Results

After applying these fixes:

- ✅ **Faster queries** - Especially on large tables
- ✅ **Better performance** - RLS evaluation is more efficient
- ✅ **Cleaner database** - No duplicate policies or indexes
- ✅ **Supabase linter happy** - All performance warnings resolved

## Migration Safety

This migration is **safe** because it:

- ✅ Only optimizes existing policies (doesn't change permissions)
- ✅ Uses `IF EXISTS` checks to prevent errors
- ✅ Maintains the same security model
- ✅ Only removes truly duplicate indexes
- ✅ Can be run multiple times safely

## Troubleshooting

If you get errors about missing tables or policies:

- The migration checks if tables/policies exist before modifying them
- This is normal if you haven't run all previous migrations
- The migration will skip missing items and continue

**Common message**: `policy does not exist, skipping` - This is fine!

## Next Steps

After applying these fixes:

1. ✅ **Test your application** - Everything should work the same, just faster
2. ✅ **Monitor performance** - Queries should be noticeably faster on large tables
3. ✅ **Check the linter** - Performance warnings should be resolved

Your Quiver surf app database is now optimized for better performance! 🌊⚡
