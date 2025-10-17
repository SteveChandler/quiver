# Building Android App with Push Notifications

## ✅ Pre-Build Status

**Capacitor Sync**: ✅ Complete

```
✔ copy android in 25.53ms
✔ Updating Android plugins in 6.81ms
Found 2 Capacitor plugins for android:
  @capacitor/push-notifications@7.0.3
  @capacitor/share@7.0.2
✔ Sync finished in 0.105s
```

**Android Studio**: Opening...

---

## 📱 Build Steps

### 1. Wait for Android Studio to Load

Android Studio should be opening now. Wait for:

- Gradle sync to complete
- Project index to finish
- No red errors in the toolbar

### 2. Connect a Device or Start Emulator

**Option A: Physical Device** (Recommended for push testing)

1. Enable Developer Options on your Android phone
2. Enable USB Debugging
3. Connect via USB
4. Allow USB debugging when prompted
5. Device should appear in Android Studio toolbar

**Option B: Emulator**

1. Click **Device Manager** (phone icon in toolbar)
2. Click **Create Device** if no emulator exists
3. Select a device (e.g., Pixel 6)
4. Select system image (Android 13+ recommended)
5. Click **Play** to start emulator

### 3. Build and Run

1. Select your device/emulator in the toolbar dropdown
2. Click the **Run** button (green play icon) or press `Ctrl+R`
3. Wait for build to complete
4. App will install and launch automatically

---

## 🧪 Testing Push Notifications

### Step 1: Login to the App

- Use your Quiver account credentials
- The app will automatically register the device token

### Step 2: Check Logs in Android Studio

**Look for these in Logcat**:

```
[Quiver] Push notifications: Token registered with backend
[Quiver] Push notifications: Registration initiated
[Quiver] Device token: [token preview]
```

**Filter Logcat**:

1. Click **Logcat** tab at bottom
2. In filter box, type: `Push notifications`
3. You should see token registration logs

### Step 3: Test Session Invite

**On Web or Another Device**:

1. Login as a different user
2. Create a new session
3. Add this device's user as an invitee
4. Submit the session

**On This Device**:

1. You should receive a push notification
2. Notification should show: "New Surf Session Invite"
3. Body: "[User] invited you to [Beach]"
4. Tap notification → Opens session detail page

### Step 4: Verify in Database

Check that device token was saved:

```sql
SELECT * FROM user_devices
WHERE platform = 'android'
ORDER BY created_at DESC
LIMIT 1;
```

---

## 🔍 Troubleshooting

### Build Errors

**"SDK not found"**

- Android Studio → Settings → Android SDK
- Install latest SDK Platform and Build Tools

**"Gradle sync failed"**

- Click **Try Again** in the error notification
- Or: File → Invalidate Caches → Invalidate and Restart

**"Firebase/Google Services error"**

- Verify: `android/app/google-services.json` exists
- Should contain: `"project_id": "quiver-1f787"`

### Runtime Issues

**"Push notification permission denied"**

- Android 13+ requires runtime permission
- App should request on first login
- Or: Settings → Apps → Quiver → Notifications → Enable

**"Token not registering"**

- Check internet connection
- Verify Firebase credentials in Vercel (for production)
- Check Logcat for error messages

**"Notification not received"**

- Verify device token in database: `SELECT * FROM user_devices`
- Check Vercel logs for push send attempt
- Ensure app is in foreground or background (not force-stopped)

---

## 📊 What to Expect

### On First Launch

1. App loads web content
2. User logs in
3. Push permission requested (Android 13+)
4. Device token generated
5. Token sent to backend: `POST /api/devices/upsert`
6. Token saved in database
7. Ready to receive notifications!

### Push Notification Flow

```
Backend sends notification
        ↓
Firebase Cloud Messaging
        ↓
Google Play Services
        ↓
Your Android Device
        ↓
Quiver app receives
        ↓
Notification displayed
```

### When User Taps Notification

```
Notification tapped
        ↓
App opens/focuses
        ↓
Navigation to session detail
        ↓
Session loads with full data
```

---

## ✅ Success Indicators

**In Logcat**:

- ✅ "Push notifications: Registration initiated"
- ✅ "Push notifications: Token registered with backend"
- ✅ "Push notifications: Received in foreground" (when notification arrives)

**In Database**:

- ✅ New row in `user_devices` table
- ✅ `platform` = 'android'
- ✅ `device_token` populated
- ✅ `user_id` matches logged-in user

**User Experience**:

- ✅ Notification appears in system tray
- ✅ Tapping opens app to correct session
- ✅ Email also received (multi-channel)
- ✅ In-app notification badge updated

---

## 🎯 Firebase Configuration (Already Complete)

Your Android app is fully configured:

- ✅ `google-services.json` in `android/app/`
- ✅ Firebase BOM 32.7.0 added to dependencies
- ✅ Firebase Messaging included
- ✅ Google services plugin applied
- ✅ Capacitor PushNotifications plugin installed

---

## 🔐 Security Notes

**Device Tokens**:

- Automatically registered on login
- Securely stored in database
- Protected by RLS policies
- Invalid tokens automatically pruned

**Permissions**:

- POST_NOTIFICATIONS required on Android 13+
- Requested at runtime by app
- Can be revoked by user in settings

**Data Privacy**:

- Tokens only accessible by user and system
- Push messages contain minimal data
- Full content fetched from backend after tap

---

## 🚀 Next Steps After Build

1. **Test locally** with device
2. **Deploy to Vercel** with Firebase credentials
3. **Test production** push notifications
4. **Build iOS** app and test
5. **Monitor** push delivery rates in Firebase Console

---

## 📱 Build Variants

**Debug Build** (what you're doing now):

- Fast build times
- Connects to local or staging backend
- Detailed logging enabled
- Good for development and testing

**Release Build** (for Play Store):

```bash
# In Android Studio:
Build → Generate Signed Bundle/APK → Android App Bundle
```

- Optimized and minified
- Requires signing key
- Production Firebase config
- No debug logging

---

## 📝 Build Configuration Summary

**App Details**:

- **Package**: app.quiversurf.mobile
- **Name**: Quiver Dev (or Quiver)
- **Firebase Project**: quiver-1f787
- **Min SDK**: As configured in build.gradle
- **Target SDK**: Latest stable

**Plugins Included**:

- Capacitor Core
- Push Notifications
- Share
- (plus any others from your Podfile/build.gradle)

---

**Status**: 🟢 Ready to Build  
**Configuration**: ✅ 100% Complete  
**Next**: Wait for Android Studio → Build → Test!

Good luck! The Android app is fully configured for push notifications. 📱🚀


