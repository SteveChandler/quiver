# Push Notifications Setup Guide

This guide covers setting up Firebase Cloud Messaging (FCM) for push notifications on iOS and Android.

## Overview

The push notification system uses:

- **Backend**: Firebase Admin SDK (server-side push)
- **Email**: Resend (existing email infrastructure)
- **Mobile**: Capacitor PushNotifications plugin + FCM
- **Database**: Supabase (user_devices, notifications tables)

## Prerequisites

- Firebase project created (already exists: quiver-1f787)
- Firebase Admin service account credentials
- iOS/Android apps configured in Firebase Console
- Capacitor mobile app setup

---

## Part 1: Firebase Console Setup

### 1. Service Account Credentials

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: `quiver-1f787`
3. Click gear icon → **Project Settings**
4. Navigate to **Service accounts** tab
5. Click **Generate new private key**
6. Download the JSON file (keep it secure!)

### 2. iOS Setup

1. In Firebase Console → **Project Settings** → **General**
2. Under "Your apps", click **Add app** → iOS
3. Register bundle ID: `app.quiversurf.mobile`
4. Download `GoogleService-Info.plist`
5. Place file at: `ios/App/App/GoogleService-Info.plist`

### 3. Android Setup

1. In Firebase Console → **Project Settings** → **General**
2. Under "Your apps", click **Add app** → Android
3. Register package name: `app.quiversurf.mobile`
4. Download `google-services.json`
5. Place file at: `android/app/google-services.json`

---

## Part 2: Environment Variables

Add these to Vercel/Supabase environment:

```bash
# Firebase Admin SDK (for server-side push)
FIREBASE_PROJECT_ID=quiver-1f787
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@quiver-1f787.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nMulti\nLine\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

**Important**:

- The private key must include literal `\n` characters (not actual newlines)
- Wrap the entire key in quotes
- Extract these values from the service account JSON:
  - `project_id` → `FIREBASE_PROJECT_ID`
  - `client_email` → `FIREBASE_CLIENT_EMAIL`
  - `private_key` → `FIREBASE_PRIVATE_KEY`

### Setting in Vercel

```bash
vercel env add FIREBASE_PROJECT_ID
vercel env add FIREBASE_CLIENT_EMAIL
vercel env add FIREBASE_PRIVATE_KEY
```

Or via Vercel Dashboard:

1. Go to project settings
2. Navigate to **Environment Variables**
3. Add each variable for Production, Preview, and Development

### Setting Locally

Add to `.env.local`:

```bash
FIREBASE_PROJECT_ID=quiver-1f787
FIREBASE_CLIENT_EMAIL=your-service-account@quiver-1f787.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

---

## Part 3: Mobile App Configuration

### iOS (Xcode)

1. Open `ios/App/App.xcodeproj` in Xcode
2. Add Firebase SDK via CocoaPods:

```ruby
# ios/App/Podfile
target 'App' do
  capacitor_pods

  # Add Firebase
  pod 'Firebase/Messaging'
end
```

3. Run: `cd ios/App && pod install`
4. Ensure `GoogleService-Info.plist` is added to Xcode project
5. Enable Push Notifications capability:
   - Select project → **Signing & Capabilities**
   - Click **+ Capability** → **Push Notifications**
6. Add APNs authentication key in Firebase Console

### Android (Android Studio)

1. Open `android/` in Android Studio
2. Ensure `google-services.json` is in `android/app/`
3. Add Firebase dependencies to `android/app/build.gradle`:

```gradle
apply plugin: 'com.google.gms.google-services'

dependencies {
    implementation platform('com.google.firebase:firebase-bom:32.7.0')
    implementation 'com.google.firebase:firebase-messaging'
}
```

4. Add Google services plugin to `android/build.gradle`:

```gradle
buildscript {
    dependencies {
        classpath 'com.google.gms:google-services:4.4.0'
    }
}
```

---

## Part 4: Database Migration

Run the migration to create required tables:

```bash
# The migration file already exists
supabase/migrations/20250116000000_push_notifications_infrastructure.sql
```

This creates:

- `user_devices` - Device token storage
- `notifications` - In-app notification records

To apply locally:

```bash
npm run supabase:migration:apply
```

To apply to production:

```bash
supabase db push
```

---

## Part 5: Testing

### Test Push Notifications Locally

1. Start dev server: `npm run dev`
2. Build and run mobile app:
   ```bash
   npm run mobile:sync
   # Open in Android Studio or Xcode
   ```
3. Login to the app
4. Check logs for "Push notifications: Token registered"
5. Create a session and invite a friend
6. Friend should receive push notification

### Test Email Fallback

If push notifications fail, emails are still sent via Resend (existing system).

### Test In-App Notifications

In-app notification records are created in the `notifications` table for badge counts and notification feeds.

---

## Part 6: Monitoring & Debugging

### Server-Side Logs

Check Vercel logs for:

- "Firebase Admin SDK initialized successfully" (startup)
- "Push notifications sent: X success, Y failed" (per invitation)
- "Pruning X invalid device tokens" (token cleanup)

### Mobile Logs

Check native console for:

- "Push notifications: Token received" (registration)
- "Push notifications: Received in foreground" (notification received)
- "Push notifications: Action performed" (notification tapped)

### Database Queries

Check device token registration:

```sql
select user_id, platform, created_at
from user_devices
order by created_at desc
limit 10;
```

Check notification records:

```sql
select user_id, type, read_at, created_at
from notifications
order by created_at desc
limit 10;
```

---

## Architecture

**Key Files:**

- `lib/services/firebase-admin.ts` - Admin SDK init
- `lib/services/push-notifications.ts` - Push utilities
- `app/api/devices/upsert/route.ts` - Token registration
- `lib/mobile/push-notifications.ts` - Mobile client

---

## Troubleshooting

### "Firebase Admin SDK not initialized"

- Check environment variables are set correctly
- Verify private key has literal `\n` characters
- Restart dev server / redeploy

### "No device tokens found"

- User hasn't granted push notification permissions
- App not running on native platform (web doesn't register)
- Token registration failed (check mobile logs)

### Push notifications not received

- Check Firebase Console → Cloud Messaging for delivery stats
- Verify APNs certificate (iOS) or FCM token (Android)
- Check notification permissions on device
- Look for "Registration token not registered" errors (stale token)

### iOS: "Missing Push Notifications entitlement"

- Enable Push Notifications capability in Xcode
- Regenerate provisioning profile
- Clean and rebuild

---

## Security Notes

- **Service account key**: Never commit to git, store in env vars only
- **Device tokens**: Stored with user ownership via RLS policies
- **Token pruning**: Invalid tokens automatically removed
- **Rate limiting**: Consider adding rate limits to prevent spam

---

## Part 7: Web Push Notifications

Web push notifications are now supported for browser users. See **[WEB_PUSH_SETUP.md](./WEB_PUSH_SETUP.md)** for complete setup instructions.

**Quick Summary**:

1. Get VAPID key from Firebase Console → Cloud Messaging → Web Push certificates
2. Update `VAPID_KEY` in `lib/web/push-notifications.ts`
3. Add `NEXT_PUBLIC_FIREBASE_*` environment variables
4. Web users automatically prompted on login (same as mobile)

**Supported Browsers**:

- Chrome 42+, Firefox 44+, Edge 79+, Safari 16.4+ (macOS only)

**Key Differences from Mobile**:

- Service worker required (`public/firebase-messaging-sw.js`)
- Browser notification permissions (not OS-level)
- Same backend API endpoints (`/api/devices/upsert`)
- Platform value: `web` (vs `ios` or `android`)

---

**Last Updated**: January 16, 2025  
**Status**: Production Ready (Mobile + Web)  
**Owner**: Engineering Team
