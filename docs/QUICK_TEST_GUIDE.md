# 🚀 Quick Notification Testing Guide

## TL;DR - Test Notifications in 2 Commands

```bash
# 1. Find registered devices
node scripts/check-devices.mjs

# 2. Send test notification
node scripts/test-push-notification.mjs <USER_ID>
```

---

## Complete Example

### Step 1: Check for Registered Devices

```bash
node scripts/check-devices.mjs
```

**Output:**

```
✅ Found 1 registered device(s):

1. User ID: bcdc5d59-2e22-4006-98a6-cada8618577a
   Platform: web
   Token: cE-WDUrd3RCf-GisCyXL...
   Registered: 10/15/2025, 11:29:36 AM

💡 To test notifications, copy a User ID and run:
   node scripts/test-push-notification.mjs <USER_ID>
```

### Step 2: Send Test Notification

```bash
node scripts/test-push-notification.mjs bcdc5d59-2e22-4006-98a6-cada8618577a
```

**Output:**

```
✅ Environment variables loaded
✅ Firebase Admin SDK initialized
✅ Supabase client initialized
✅ Found 1 registered device(s)

📤 Sending push notification...

📊 Results:
   ✅ Success: 1
   ❌ Failed: 0

✨ Success! Push notifications are working correctly.
```

### Step 3: Check Your Browser

You should see a notification pop up in your browser! 🎉

---

## If No Devices Found

### Register a Device:

1. Open your app in a browser: `npm run dev`
2. Navigate to `http://localhost:3000`
3. Login with your account
4. Grant notification permissions when prompted
5. Wait a few seconds for device to register
6. Run `node scripts/check-devices.mjs` again

---

## Test Multiple Users

```bash
# Send to multiple users at once
node scripts/test-push-notification.mjs USER_ID_1 USER_ID_2 USER_ID_3
```

---

## Troubleshooting

### "Missing environment variables"

**Fix**: Ensure Firebase variables are in `.env.local`:

```bash
FIREBASE_PROJECT_ID=quiver-1f787
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@quiver-1f787.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
```

### "No registered devices found"

**Fix**: Login to the app and grant notification permissions.

### Notification sent but not received

**Fix**:

- Check if browser tab is open
- Check browser notification permissions
- Check browser notification settings (not blocked)
- Try a different browser

---

## Additional Testing

### Unit Tests

```bash
npm test -- push-notifications
```

### Integration Tests

See `docs/NOTIFICATION_TESTING_GUIDE.md` for complete guide.

---

## Quick Links

- **Test Results**: `NOTIFICATION_TEST_SUCCESS.md`
- **Console Fixes**: `CONSOLE_ERRORS_FIXED.md`
- **Full Testing Guide**: `docs/NOTIFICATION_TESTING_GUIDE.md`
- **Setup Guide**: `docs/PUSH_NOTIFICATIONS_SETUP.md`

---

## Current Status

✅ **All Systems Working**

- Console errors: Fixed
- Device registration: Working
- Notification delivery: 100% success rate
- Test scripts: Ready to use

**Last Tested**: October 15, 2025  
**Result**: ✅ SUCCESS

