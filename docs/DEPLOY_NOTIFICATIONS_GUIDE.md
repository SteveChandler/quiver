# Deploying Notification Preferences to Staging/Production

## Prerequisites

- [ ] Supabase CLI installed (`brew install supabase/tap/supabase`)
- [ ] Access to Supabase project (staging and production)
- [ ] Code changes committed to git
- [ ] Migration tested locally ✅ (already done!)

## Deployment Steps

### Step 1: Link to Supabase Project

**For Staging:**

```bash
# Link to your staging project
supabase link --project-ref your-staging-project-ref

# You'll be prompted for your database password
```

**For Production:**

```bash
# Link to your production project
supabase link --project-ref your-production-project-ref
```

**Finding Your Project Ref:**

1. Go to https://supabase.com/dashboard
2. Select your project
3. Settings → General → Reference ID

### Step 2: Push Database Migration

**To Staging:**

```bash
# Review what will be applied
supabase db diff

# Apply the migration
supabase db push

# This will apply:
# - 20250117000000_add_notification_preferences.sql
```

**To Production:**

```bash
# IMPORTANT: Always test in staging first!

# Link to production
supabase link --project-ref your-production-project-ref

# Apply migration
supabase db push
```

### Step 3: Verify Database Changes

After pushing, verify the columns exist:

```bash
# Using Supabase SQL Editor (Dashboard)
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name LIKE 'notif%'
ORDER BY column_name;

# Should return 8 rows with all notification columns
```

### Step 4: Deploy Frontend Code

**Vercel Deployment (if using Vercel):**

```bash
# 1. Commit all changes
git add .
git commit -m "feat: Add notification preferences to Edit Profile modal

- Add NotificationsSection component with master toggles
- Add 8 notification preference columns to profiles table
- Integrate notification settings into edit profile form
- Add comprehensive tests and documentation"

# 2. Push to staging branch (if you have one)
git push origin staging

# OR push to main for production
git push origin main

# Vercel will auto-deploy
```

**Manual Deployment:**

```bash
# Build locally to verify no errors
npm run build

# If successful, push to git
git push origin main
```

### Step 5: Post-Deployment Verification

**Database Check:**

```sql
-- Verify existing users got default values
SELECT COUNT(*) FROM profiles WHERE notif_push_enabled = true;

-- Should equal total user count
SELECT COUNT(*) FROM profiles;

-- Test update
UPDATE profiles
SET notif_push_enabled = false
WHERE id = 'your-test-user-id';

-- Verify update worked
SELECT notif_push_enabled FROM profiles WHERE id = 'your-test-user-id';
```

**Frontend Check:**

1. ✅ Log into the app
2. ✅ Go to Profile → Edit Profile
3. ✅ Verify "Notifications" section appears
4. ✅ Toggle switches on/off
5. ✅ Click "Save Changes"
6. ✅ Reopen Edit Profile modal
7. ✅ Verify changes persisted

**Test Checklist:**

- [ ] All 3 master toggles visible
- [ ] Advanced Settings expands/collapses
- [ ] All 5 feature toggles visible when expanded
- [ ] Switches toggle correctly
- [ ] Save button persists all changes
- [ ] Dark mode works
- [ ] Mobile responsive layout works

## Rollback Plan (If Needed)

If something goes wrong, you can rollback the migration:

### Option 1: Drop Columns (Destructive)

```sql
BEGIN;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_push_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_email_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_inapp_enabled;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_session_invites;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_likes;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_follows;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_reminders;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS notif_xp_updates;

COMMIT;
```

### Option 2: Revert Frontend Only

```bash
# Revert the frontend code commit
git revert <commit-hash>
git push origin main

# Database columns remain but aren't used
# This is safer - you can redeploy later without data loss
```

## Alternative: Manual SQL Execution

If you prefer not to use Supabase CLI:

1. **Go to Supabase Dashboard**
2. **Select your project**
3. **SQL Editor → New Query**
4. **Copy/paste the migration SQL:**

```sql
-- Copy contents from:
-- supabase/migrations/20250117000000_add_notification_preferences.sql
```

5. **Run the query**
6. **Verify in Table Editor:**
   - Go to Table Editor → profiles
   - Check that 8 new columns appear

## Monitoring After Deployment

### Check for Errors

**Vercel Logs:**

```bash
# If using Vercel
vercel logs --follow
```

**Supabase Logs:**

1. Dashboard → Logs
2. Filter for errors
3. Look for profile-related issues

### Monitor User Behavior

After deployment, track:

- Profile update success rate (should remain ~100%)
- How many users customize notification preferences
- Any error reports from users

### Database Performance

Check query performance:

```sql
-- Ensure queries are still fast
EXPLAIN ANALYZE
SELECT * FROM profiles WHERE id = 'user-id';

-- Should be instant (uses primary key)
```

## Environment-Specific Notes

### Staging

- ✅ Test thoroughly before production
- ✅ Verify with test accounts
- ✅ Check in multiple browsers
- ✅ Test mobile responsive layout

### Production

- ⚠️ **Peak Hours**: Avoid deploying during peak usage times
- ⚠️ **Backup**: Supabase automatically backs up, but verify
- ⚠️ **Communication**: Notify team before deployment
- ⚠️ **Monitor**: Watch logs for 30 minutes after deployment

## Troubleshooting

### Migration Fails

**Error: "column already exists"**

- ✅ Safe to ignore - migration is idempotent
- Or: Run migration again, it will skip existing columns

**Error: "relation 'profiles' does not exist"**

- ❌ Wrong database or schema
- Verify you're connected to correct project

### Frontend Issues

**Notifications section not appearing**

- Check browser console for errors
- Verify build completed successfully
- Clear browser cache and reload

**Switches not saving**

- Check Network tab for failed API calls
- Verify database columns exist
- Check RLS policies on profiles table

### Type Errors

**TypeScript errors about notification fields**

- ✅ Types were manually updated
- If issues persist: `npm run supabase:types` (if you have a types generation script)

## Success Criteria

Deployment is successful when:

- ✅ Migration applied without errors
- ✅ All 8 columns exist in profiles table
- ✅ Existing users have default values (all true)
- ✅ Frontend builds without errors
- ✅ Edit Profile modal shows Notifications section
- ✅ Toggle switches work and persist
- ✅ No console errors
- ✅ Mobile layout works correctly
- ✅ Dark mode works correctly

## Contact & Support

If you encounter issues:

1. Check this guide first
2. Review implementation docs in `/docs` folder
3. Check component tests for usage examples
4. Review the migration SQL for any syntax issues

## Quick Reference Commands

```bash
# Link to project
supabase link --project-ref YOUR_PROJECT_REF

# Push migration
supabase db push

# Check status
supabase status

# View remote database
supabase db remote commit

# Build frontend
npm run build

# Deploy to Vercel
git push origin main
```

---

**Last Updated**: January 17, 2025
**Migration File**: `20250117000000_add_notification_preferences.sql`
**Status**: ✅ Tested locally, ready for deployment
