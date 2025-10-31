# Session Shares Migration - Completion Guide

## Overview
The session shares tracking feature is ready to deploy. This guide walks through the final steps to apply the database migration and verify everything works.

## ✅ Completed Work

### 1. Database Migration Created
- **File**: `supabase/migrations/20251024000002_create_session_shares_tracking_fixed.sql`
- **Status**: Ready to apply
- **Key Fix**: Uses dedicated `share_date` column instead of date expressions in unique index

### 2. Test Suite Implemented & Validated
- ✅ **Unit Tests**: 16 tests for share utilities ([__tests__/lib/utils/share-image-utils.test.ts](/__tests__/lib/utils/share-image-utils.test.ts))
- ✅ **Component Tests**: 72 tests for share UI components
  - 25 tests for SessionShareButton
  - 47 tests for SessionShareModal
- ✅ **E2E Tests**: 15 scenarios for complete sharing flow ([e2e/session-sharing.spec.ts](/e2e/session-sharing.spec.ts))
- **Total**: 88 passing, 1 skipped

### 3. Code Fix Applied
- **File**: [actions/social-share-actions.ts](actions/social-share-actions.ts#L111)
- **Fix**: Exported `generateShareUrl` function (was previously internal-only)
- **Reason**: SessionShareModal component imports this function

## 🚀 Steps to Complete

### Step 1: Apply the Migration

Run the migration to create the `session_shares` table and related functions:

```bash
npx supabase db push
```

**Expected Output**:
```
Applying migration 20251024000002_create_session_shares_tracking_fixed.sql...
Migration applied successfully!
```

**What this creates**:
- `session_shares` table with proper unique constraint
- `share_date` column for daily share tracking
- Trigger functions to auto-maintain `share_count` on sessions
- RLS policies for secure access
- Helper functions:
  - `get_session_share_stats(p_session_id uuid)`
  - `get_user_viral_coefficient(p_user_id uuid)`

### Step 2: Regenerate TypeScript Types

After applying the migration, regenerate TypeScript types:

```bash
npx supabase gen types typescript --linked > types/database.generated.ts
```

This will add type definitions for:
- `session_shares` table
- New helper functions
- Updated `sessions` table (with `share_count` column)

### Step 3: Verify the Migration

Check that the table was created correctly:

```bash
npx supabase db shell
```

Then run:
```sql
-- Check table structure
\d session_shares

-- Verify unique constraint
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'session_shares';

-- Test share tracking
SELECT proname, prosrc
FROM pg_proc
WHERE proname LIKE '%share%';
```

### Step 4: Run Tests

Verify all tests still pass with the new migration:

```bash
# Run unit tests
npm run test:unit

# Run E2E tests (with dev server running)
npm run test:e2e
```

### Step 5: Test in Browser

1. Start the dev server: `npm run dev`
2. Navigate to a session page
3. Click the share button
4. Verify the share modal opens
5. Try sharing to different platforms
6. Check that share count increments

## 📊 Database Schema Reference

### `session_shares` Table

```sql
CREATE TABLE session_shares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform text NOT NULL CHECK (platform IN ('instagram', 'tiktok', 'twitter', 'facebook', 'copy', 'native', 'other')),
  share_url text,
  variant text DEFAULT 'story' CHECK (variant IN ('story', 'square')),
  created_at timestamptz NOT NULL DEFAULT now(),
  share_date date NOT NULL DEFAULT CURRENT_DATE
);
```

### Unique Constraint
- **Purpose**: Prevent duplicate shares per day
- **Columns**: `(session_id, user_id, platform, share_date)`
- **Behavior**: User can share same session to same platform once per day

### Auto-maintained Fields
- `sessions.share_count` - Auto-incremented via trigger when share is created
- `share_date` - Auto-populated with current date on insert

## 🔧 Troubleshooting

### Migration Fails with "relation already exists"
```bash
# Check if table exists
npx supabase db shell -c "\dt session_shares"

# If it exists, you may need to manually drop it first
npx supabase db shell -c "DROP TABLE IF EXISTS session_shares CASCADE;"
```

### TypeScript Errors After Migration
```bash
# Regenerate types
npx supabase gen types typescript --linked > types/database.generated.ts

# Restart TypeScript server in VSCode
# Cmd+Shift+P -> "TypeScript: Restart TS Server"
```

### Share Count Not Updating
```sql
-- Check if triggers exist
SELECT tgname, tgrelid::regclass
FROM pg_trigger
WHERE tgname LIKE '%share%';

-- Manually test trigger
INSERT INTO session_shares (session_id, user_id, platform)
VALUES ('your-session-id', 'your-user-id', 'instagram');

-- Check share count updated
SELECT id, share_count FROM sessions WHERE id = 'your-session-id';
```

## 📝 Next Steps (Optional)

After successful migration, consider:

1. **Analytics Dashboard**: Create a page to view sharing analytics
2. **Share Leaderboard**: Show users who share the most
3. **Viral Badges**: Award badges for high viral coefficients
4. **Share Insights**: Show user which sessions get shared most
5. **Social Proof**: Display "X people shared this" on session cards

## 🎉 Success Criteria

Migration is complete when:
- ✅ `session_shares` table exists in database
- ✅ TypeScript types regenerated without errors
- ✅ All 88 tests passing
- ✅ Can share sessions in browser
- ✅ Share count increments correctly
- ✅ XP awarded for sharing

## 📚 Related Files

### Database
- [Migration](supabase/migrations/20251024000002_create_session_shares_tracking_fixed.sql)

### Server Actions
- [social-share-actions.ts](actions/social-share-actions.ts) - Share tracking & analytics

### Components
- [SessionShareButton](components/session/session-share-button.tsx) - Share button UI
- [SessionShareModal](components/session/session-share-modal.tsx) - Share platform selection

### Tests
- [share-image-utils.test.ts](__tests__/lib/utils/share-image-utils.test.ts)
- [session-share-button.test.tsx](__tests__/components/session/session-share-button.test.tsx)
- [session-share-modal.test.tsx](__tests__/components/session/session-share-modal.test.tsx)
- [session-sharing.spec.ts](e2e/session-sharing.spec.ts)

### Utilities
- [share-image-utils.ts](lib/utils/share-image-utils.ts) - Image generation helpers
- [share.ts](lib/mobile/share.ts) - Native share API wrapper

---

**Need Help?**
- Check the [Supabase Migration Docs](https://supabase.com/docs/guides/cli/local-development#database-migrations)
- Review the [test files](__tests__/) for usage examples
- Check console logs in browser DevTools
