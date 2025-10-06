# Real-Time Intel Updates Verification Guide

## ✅ Verification Steps

### 1. **Check Browser Console**

Open your browser's Developer Tools (F12 or Cmd+Option+I) and go to the Console tab.

When you navigate to the Local Intel tab, you should see:

```
[IntelTab] Setting up realtime subscriptions...
[IntelTab] intel_posts subscription status: SUBSCRIBED
[IntelTab] intel_post_confirmations subscription status: SUBSCRIBED
```

If you see `SUBSCRIBED`, the realtime is working! ✅

### 2. **Test Real-Time Updates**

**Method 1: Two Browser Windows**

1. Open your app in two browser windows/tabs
2. Navigate to the Local Intel tab in both
3. In Window 1: Create a new intel post
4. In Window 2: You should see the new post appear automatically (within 1-2 seconds)

**Method 2: Console + Create Post**

1. Open Local Intel tab with console open
2. Create a new intel post
3. You should see in console:
   ```
   [IntelTab] Received intel_posts change: INSERT
   ```
4. The new post should appear in the feed immediately

**Method 3: Confirmation Test**

1. Open Local Intel tab with console open
2. Confirm an existing intel post (click the check icon)
3. You should see in console:
   ```
   [IntelTab] Received intel_post_confirmations change: INSERT
   ```
4. The confirmation count should update immediately

### 3. **Common Issues & Solutions**

#### ❌ Not seeing "SUBSCRIBED" status

**Check 1: Migration Applied**
Run this SQL query in Supabase Studio:

```sql
SELECT tablename, schemaname
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
AND tablename LIKE 'intel%';
```

You should see:

- `intel_posts`
- `intel_post_confirmations`

If tables are missing, re-run the migration:

```bash
# In Supabase Studio SQL Editor, run:
ALTER TABLE public.intel_posts REPLICA IDENTITY FULL;
ALTER TABLE public.intel_post_confirmations REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_posts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.intel_post_confirmations;
```

**Check 2: Realtime Enabled in Supabase**

1. Go to Supabase Dashboard → Database → Replication
2. Ensure both tables are checked/enabled for realtime

#### ❌ Subscriptions timing out

This usually means realtime is not enabled in Supabase settings. Check the Replication settings in your Supabase Dashboard.

#### ❌ Getting "CHANNEL_ERROR"

Check your Supabase credentials in `.env`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### 4. **Debugging Commands**

**Test subscriptions directly:**

```bash
node scripts/test-realtime-subscription.mjs
```

This script will:

- Connect to your Supabase instance
- Subscribe to both intel tables
- Listen for 10 seconds
- Report subscription status

**Expected output:**

```
✅ Successfully subscribed to intel_posts
✅ Successfully subscribed to intel_post_confirmations
```

## 🎉 Success Indicators

You'll know real-time is working when:

1. ✅ Console shows "SUBSCRIBED" status for both channels
2. ✅ New posts appear automatically without refresh
3. ✅ Confirmation counts update instantly
4. ✅ Updates from other users/windows appear in real-time

## 🔧 Troubleshooting

If real-time still isn't working after all checks:

1. **Hard refresh the browser** (Cmd+Shift+R or Ctrl+Shift+R)
2. **Clear browser cache**
3. **Check Network tab** in DevTools for websocket connections to Supabase
4. **Verify you're on the latest code** with the realtime changes
5. **Check Supabase Dashboard** → Database → Replication settings

## 📝 Technical Details

The realtime implementation:

- Uses Supabase Realtime websockets
- Listens to Postgres changes via publications
- Automatically refetches data on any change
- Properly cleans up subscriptions on unmount

Migration file: `supabase/migrations/20251006000001_enable_realtime_for_intel_tables.sql`
Component: `components/intel/intel-tab-simple.tsx`
