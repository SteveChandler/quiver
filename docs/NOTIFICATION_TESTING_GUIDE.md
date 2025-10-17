# 🧪 Notification System Testing Guide

## Overview

This guide covers testing the complete notification system including:

- Push notifications (iOS/Android)
- Web push notifications (browser)
- Email notifications (fallback)
- In-app notifications (badge counts)

---

## Prerequisites

### Environment Setup

**Required Environment Variables:**

```bash
# Firebase Admin SDK (server-side)
FIREBASE_PROJECT_ID=quiver-1f787
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@quiver-1f787.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Firebase Web SDK (client-side - for web push)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=quiver-1f787.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=quiver-1f787
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=quiver-1f787.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Email (Resend)
RESEND_API_KEY=your_resend_key
```

### Database Setup

Ensure migration is applied:

```bash
# Check if migration exists
npm run supabase:migration:list

# Apply if needed
npm run supabase:migration:apply
```

---

## Testing Methods

### 1. Unit Tests (Fastest)

Run existing test suite:

```bash
# Run all notification tests
npm test -- push-notifications

# Watch mode for development
npm test -- --watch push-notifications

# With coverage
npm test -- --coverage push-notifications
```

**What's tested:**

- ✅ Push notification service logic
- ✅ Token management and pruning
- ✅ Error handling
- ✅ Message formatting

---

### 2. Manual API Testing (Quick Feedback)

Use the test script to send notifications directly:

```bash
# Send test notification to specific users
node scripts/test-push-notification.mjs <user_id_1> <user_id_2>
```

**Example:**

```bash
# Send to your test user
node scripts/test-push-notification.mjs 610a5745-1fac-429c-8f5a-8d085783a5ea
```

---

### 3. Integration Testing (Full Flow)

#### A. Web Push Notifications (Browser)

**Setup:**

1. Start dev server: `npm run dev`
2. Open browser DevTools (Console tab)
3. Login to your account
4. Grant notification permissions when prompted

**Test Flow:**

```javascript
// In browser console - check if Firebase is configured
console.log(
  "Firebase API Key:",
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? "✓ Set" : "✗ Missing"
);

// Check device registration
fetch("/api/devices/upsert", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    platform: "web",
    device_token: "test-token-" + Date.now(),
  }),
})
  .then((r) => r.json())
  .then(console.log);
```

**Expected Console Logs:**

```
✅ Push notifications: Permission granted
✅ Push notifications: Token received {tokenPreview: "..."}
✅ Push notifications: Token registered with backend
✅ Push notifications: Foreground listeners configured
```

**Test Notification Receipt:**

1. Create a session and invite yourself (use different user)
2. Check console for: "Push notifications: Received in foreground"
3. If tab is hidden, should see browser notification

#### B. Mobile Push Notifications (iOS/Android)

**Build and Install:**

```bash
# iOS
npx cap sync ios
open ios/App/App.xcworkspace
# Build → Run on device

# Android
npx cap sync android
npx cap open android
# Build → Run on device
```

**Test Flow:**

1. **Login** → Device registers automatically
2. **Check Logs:**
   - **iOS**: Xcode console
   - **Android**: Android Studio Logcat
3. **Expected logs:**
   ```
   Push notifications: Token received
   Push notifications: Token registered with backend
   ```

**Test Notification Receipt:**

1. Have another user create a session and invite you
2. Should see push notification appear
3. Tap notification → Should navigate to session detail
4. Check notification data:
   ```
   type: "session_invite"
   session_id: "uuid"
   inviter_name: "John Doe"
   ```

---

### 4. Database Verification

**Check device token registration:**

```sql
-- View registered devices
SELECT
  user_id,
  platform,
  LEFT(device_token, 20) || '...' as token_preview,
  created_at,
  updated_at
FROM user_devices
ORDER BY created_at DESC
LIMIT 10;
```

**Check in-app notifications:**

```sql
-- View notification records
SELECT
  user_id,
  type,
  data->>'session_id' as session_id,
  data->>'inviter_name' as inviter,
  read_at,
  created_at
FROM notifications
WHERE type = 'session_invite'
ORDER BY created_at DESC
LIMIT 10;
```

**Check notification delivery:**

```sql
-- Count by platform
SELECT
  platform,
  COUNT(*) as device_count,
  COUNT(DISTINCT user_id) as unique_users
FROM user_devices
GROUP BY platform;
```

---

### 5. End-to-End Testing (Complete User Flow)

**Scenario: Session Invitation Flow**

**Setup:**

- User A (Inviter): Device/browser with notifications enabled
- User B (Invitee): Device/browser with notifications enabled

**Test Steps:**

1. **User A**: Create planned session

   - Select beach (e.g., "Ocean Beach Pier")
   - Set arrival time (future date/time)
   - Add optional note
   - Select User B as invitee
   - Submit session

2. **System**: Verify multi-channel notification

   - Check Vercel logs for push attempt
   - Check email sent (Resend dashboard)
   - Check database for notification record

3. **User B**: Verify receipt

   - 📱 **Push**: Should receive notification within seconds
   - 📧 **Email**: Should receive email (if push fails)
   - 🔔 **In-app**: Badge count should increase

4. **User B**: Tap notification

   - Should navigate to session detail page
   - Session should show correct beach, time, note
   - Should show User A as creator

5. **User B**: Mark as read
   - Badge count should decrease
   - `read_at` timestamp should be set in database

**Expected Timings:**

- Push notification: < 3 seconds
- Email delivery: < 30 seconds
- In-app record: Immediate (database insert)

---

## Debugging Common Issues

### Issue: No Push Notifications Received

**Check 1: Firebase Configuration**

```bash
# Verify environment variables
echo $FIREBASE_PROJECT_ID
echo $FIREBASE_CLIENT_EMAIL
echo $NEXT_PUBLIC_FIREBASE_API_KEY
```

**Check 2: Device Token Registration**

```sql
-- Check if device is registered
SELECT * FROM user_devices WHERE user_id = 'your_user_id';
```

**Check 3: Server Logs**

Look for errors in Vercel/local logs:

- "Firebase Admin SDK not initialized"
- "Push notifications: Firebase not configured"
- "Failed to send push notification"

**Check 4: FCM Console**

Visit [Firebase Console](https://console.firebase.google.com/project/quiver-1f787/notification) to check:

- Message delivery stats
- Invalid token errors
- Platform configuration (APNs for iOS)

### Issue: Web Push Not Working

**Console Errors:**

```
❌ POST https://firebaseinstallations.googleapis.com/v1/projects/quiver-1f787/installations 400
```

**Solution:** Missing `NEXT_PUBLIC_FIREBASE_*` environment variables

**Check browser support:**

```javascript
// In console
console.log("Notification" in window); // should be true
console.log("serviceWorker" in navigator); // should be true
console.log(Notification.permission); // "default", "granted", or "denied"
```

### Issue: Service Worker Precaching Error

**Console Error:**

```
❌ Uncaught (in promise) bad-precaching-response: [{"url":".../_next/app-build-manifest.json","status":404}]
```

**Solution:** Already fixed in `next.config.mjs` with `buildExcludes`

### Issue: Notifications Work in Dev but Not Production

**Checklist:**

- [ ] Environment variables added to Vercel
- [ ] Firebase project configured for your production domain
- [ ] iOS: APNs key uploaded to Firebase
- [ ] Android: SHA-1 fingerprint added to Firebase
- [ ] Service worker registered correctly (check HTTPS)

---

## Performance Testing

### Load Testing

**Scenario:** Send notifications to many users

```bash
# Create test script
node scripts/test-mass-notification.mjs 100
```

**Expected Performance:**

- 100 users: < 3 seconds
- 1000 users: < 10 seconds
- Token pruning: Automatic, non-blocking

### Monitor Response Times

```sql
-- Check notification creation speed
SELECT
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as notification_count,
  COUNT(*) / 3600.0 as per_second
FROM notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;
```

---

## Security Testing

### Test RLS Policies

```sql
-- Try to access another user's devices (should fail)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub TO 'user-a-id';

SELECT * FROM user_devices WHERE user_id = 'user-b-id';
-- Should return empty (RLS blocks access)

-- Try to access own devices (should succeed)
SELECT * FROM user_devices WHERE user_id = 'user-a-id';
-- Should return devices
```

### Test Token Security

- [ ] Tokens are never logged in full (only first 20 chars)
- [ ] Tokens stored with proper encryption at rest (Supabase)
- [ ] Invalid tokens are pruned automatically
- [ ] No token leakage in API responses

---

## Monitoring & Alerts

### Key Metrics to Track

1. **Registration Rate**

   ```sql
   SELECT COUNT(*) FROM user_devices WHERE created_at > NOW() - INTERVAL '1 day';
   ```

2. **Delivery Success Rate**

   - Check FCM console for success %
   - Target: > 95% success rate

3. **Token Churn Rate**

   ```sql
   SELECT
     COUNT(*) FILTER (WHERE updated_at < NOW() - INTERVAL '7 days') as stale,
     COUNT(*) as total
   FROM user_devices;
   ```

4. **Email Fallback Rate**
   - Monitor Resend dashboard
   - Target: < 10% fallback rate (90%+ push success)

### Set Up Alerts

**Vercel:**

- Alert on Firebase initialization failures
- Alert on high notification error rates

**Supabase:**

- Alert on unusual device table growth
- Alert on RLS policy violations

---

## Test Checklist

Use this checklist before deploying notification changes:

### Development

- [ ] Unit tests pass (`npm test`)
- [ ] Firebase Admin SDK initializes locally
- [ ] Device token registration works
- [ ] Can send test notification via script
- [ ] Notifications appear in database

### Staging/Preview

- [ ] Environment variables configured
- [ ] Web push works in browser
- [ ] Mobile push works on iOS (TestFlight)
- [ ] Mobile push works on Android
- [ ] Email fallback working
- [ ] In-app notifications display correctly

### Production

- [ ] All staging tests passed
- [ ] Firebase project set to production mode
- [ ] APNs production certificates configured
- [ ] Service worker caching correctly
- [ ] Monitoring and alerts configured
- [ ] Rollback plan documented

---

## Quick Reference Commands

```bash
# Run unit tests
npm test -- push-notifications

# Send test notification
node scripts/test-push-notification.mjs USER_ID

# Check device registration
npm run supabase:db:query "SELECT * FROM user_devices LIMIT 10"

# View logs
vercel logs --follow  # Production
npm run dev           # Local (check console)

# Build mobile apps
npm run mobile:sync   # Sync Capacitor
npx cap open ios      # Open Xcode
npx cap open android  # Open Android Studio
```

---

## Additional Resources

- **Firebase Console**: https://console.firebase.google.com/project/quiver-1f787
- **Push Notification Service**: `lib/services/push-notifications.ts`
- **Device API**: `app/api/devices/upsert/route.ts`
- **Mobile Client**: `lib/mobile/push-notifications.ts`
- **Web Client**: `lib/web/push-notifications.ts`
- **Setup Guide**: `docs/PUSH_NOTIFICATIONS_SETUP.md`

---

**Last Updated:** January 2025  
**Status:** Production-ready notification system with multi-channel delivery
