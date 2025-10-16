# Web Push Notifications Setup Guide

This guide covers setting up Firebase Cloud Messaging (FCM) web push notifications for browser users.

## Overview

Web push notifications allow users to receive session invites and other notifications in their web browser, even when the Quiver app isn't actively open.

**Key Features**:

- Automatic permission prompt on login
- Background notifications (when browser is minimized)
- Foreground notifications (when app is open)
- Click-to-navigate to session details
- Works on Chrome, Firefox, Edge, Safari 16.4+

## Prerequisites

- Firebase project configured (already done: `quiver-1f787`)
- VAPID key from Firebase Console
- HTTPS enabled (or localhost for testing)

---

## Part 1: Get VAPID Key from Firebase Console

### What is a VAPID Key?

VAPID (Voluntary Application Server Identification) keys are used to authenticate your server when sending push notifications. They're required for web push.

### Steps to Get VAPID Key

1. Go to [Firebase Console](https://console.firebase.google.com/project/quiver-1f787/settings/cloudmessaging)
2. Navigate to **Project Settings** → **Cloud Messaging** tab
3. Scroll to **Web Push certificates** section
4. If you don't have a key pair, click **Generate key pair**
5. Copy the **Key pair** value (starts with `B...`)

### Update the Code

Open `lib/web/push-notifications.ts` and update the `VAPID_KEY` constant:

```typescript
const VAPID_KEY = "YOUR_VAPID_KEY_HERE";
```

**Example**:

```typescript
const VAPID_KEY = "BLpZ...rest_of_key";
```

---

## Part 2: Environment Variables

The web push implementation uses **public** Firebase config values. These are safe to commit to version control.

### Local Development

Add to `.env.local`:

```bash
# Firebase Web SDK (Client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyDFcuLm-nSV4faCeYJhnADym_hVTEqEFVw
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=quiver-1f787.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=quiver-1f787
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=quiver-1f787.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=230741354184
NEXT_PUBLIC_FIREBASE_APP_ID=1:230741354184:web:d03a8737719b1a9d3c67fd
```

### Production (Vercel)

Add the same environment variables to Vercel:

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your Quiver project
3. Navigate to **Settings** → **Environment Variables**
4. Add each `NEXT_PUBLIC_FIREBASE_*` variable
5. Select environments: **Production**, **Preview**, **Development**

---

## Part 3: How It Works

### Permission Flow

1. User logs into Quiver web app
2. `PWAAndPushListeners` component detects web platform
3. Automatically calls `registerWebPushNotifications()`
4. Browser shows native permission prompt
5. If user clicks **Allow**:
   - Gets FCM token from Firebase
   - Registers token with backend (`/api/devices/upsert`)
   - Token stored in `user_devices` table with `platform='web'`

### Notification Delivery

**Foreground (app is open)**:

- `onMessage` listener in `lib/web/push-notifications.ts` fires
- Dispatches custom event that can show in-app toast
- Optional: Show browser notification even when app is focused

**Background (app is minimized)**:

- Service worker (`public/firebase-messaging-sw.js`) handles notification
- Browser shows OS-level notification
- User sees notification in system tray/notification center

**Click Handling**:

- User clicks notification
- Service worker routes to appropriate page:
  - Session invite → `/sessions/{session_id}`
  - Comment → `/sessions/{session_id}#comments`
  - Like → `/sessions/{session_id}`
  - Follow → `/user/{user_id}`

### Backend Integration

✅ **No backend changes needed!** The existing infrastructure already supports web:

- `app/api/devices/upsert/route.ts` accepts `platform: 'web'`
- `lib/services/push-notifications.ts` sends to all device tokens
- `app/api/session-planner/invitations/route.ts` triggers push for all platforms

---

## Part 4: Testing

### Manual Testing

1. **Start dev server**:

   ```bash
   npm run dev
   ```

2. **Open in browser**: `http://localhost:3000`

3. **Login** to the app

4. **Check console** for:

   ```
   [Quiver] Web push notifications initialized
   Push notifications: Permission granted
   Push notifications: Token registered with backend
   ```

5. **Verify in database**:

   ```sql
   SELECT * FROM user_devices WHERE platform = 'web';
   ```

6. **Test notification**:
   - Have another user invite you to a session
   - Should receive browser notification (if browser is minimized)
   - Click notification → should navigate to session

### Browser Testing

| Browser | Version | Support                     |
| ------- | ------- | --------------------------- |
| Chrome  | 42+     | ✅ Full support             |
| Firefox | 44+     | ✅ Full support             |
| Edge    | 79+     | ✅ Full support             |
| Safari  | 16.4+   | ✅ Full support (macOS 13+) |
| Opera   | 29+     | ✅ Full support             |

**Note**: Safari on iOS doesn't support web push notifications yet (as of iOS 17).

### Troubleshooting

**Permission prompt doesn't show:**

- Check browser settings → Site Settings → Notifications
- Clear site data and try again
- Ensure HTTPS (or localhost)

**Token registration fails:**

- Verify environment variables are set
- Check Firebase Console → Cloud Messaging is enabled
- Check browser console for errors

**Notifications not received:**

- Verify token in `user_devices` table
- Check browser notification settings (OS level)
- Test with browser console open to see errors

**Service worker issues:**

- Check if service worker is registered: `chrome://serviceworker-internals/`
- Unregister old workers if needed
- Verify `/firebase-messaging-sw.js` is accessible

---

## Part 5: User Experience

### Permission Timing

We automatically prompt users on **first login**, matching the mobile app behavior. This is intentional because:

1. **User expects it**: After signing up for a social surf app, notifications are expected
2. **High acceptance rate**: Users who just logged in are more likely to accept
3. **Contextual**: Session invites require notifications to be useful

If user denies permission, they can re-enable in browser settings later.

### Notification Appearance

**Browser notification** (background):

```
📱 Quiver
New Surf Session Invite
John Doe invited you to Windansea Beach • Today 6:00 AM
```

**In-app notification** (foreground):

- Could show a toast/banner at top of page
- Currently dispatches custom event: `window.addEventListener('push-notification', ...)`
- Future: Integrate with toast library (e.g., Sonner)

---

## Part 6: Production Checklist

Before deploying to production:

- [ ] Add VAPID key to `lib/web/push-notifications.ts`
- [ ] Add `NEXT_PUBLIC_FIREBASE_*` env vars to Vercel
- [ ] Test on staging environment
- [ ] Test with real users (different browsers)
- [ ] Monitor Vercel logs for errors
- [ ] Check Firebase Console → Cloud Messaging → Usage

---

## Part 7: Monitoring

### Success Metrics

Track in Firebase Console → Cloud Messaging:

- **Impression rate**: How many notifications are delivered
- **Open rate**: How many users click notifications
- **Error rate**: Failed deliveries (usually invalid tokens)

### Database Queries

```sql
-- Web push adoption rate
SELECT
  COUNT(DISTINCT user_id) as web_push_users,
  (SELECT COUNT(*) FROM profiles) as total_users,
  ROUND(100.0 * COUNT(DISTINCT user_id) / (SELECT COUNT(*) FROM profiles), 2) as adoption_rate
FROM user_devices
WHERE platform = 'web';

-- Recent web tokens
SELECT
  ud.platform,
  ud.created_at,
  p.full_name,
  p.email
FROM user_devices ud
JOIN profiles p ON p.id = ud.user_id
WHERE ud.platform = 'web'
ORDER BY ud.created_at DESC
LIMIT 20;
```

### Vercel Logs

Look for:

- ✅ `[Quiver] Web push notifications initialized`
- ✅ `Push notifications: Token registered with backend`
- ❌ `Push notifications: Registration failed`

---

## Part 8: Architecture

### File Structure

```
lib/
├── firebase/
│   └── config.ts              # Firebase web SDK init
└── web/
    └── push-notifications.ts  # Web push client

public/
└── firebase-messaging-sw.js   # Service worker (background notifications)

components/
└── analytics/
    └── pwa-and-push-listeners.tsx  # Auto-registers on login
```

### Key Functions

**`registerWebPushNotifications()`**:

- Requests notification permission
- Gets FCM token
- Registers token with backend

**`setupWebPushListeners()`**:

- Sets up foreground message handler
- Dispatches custom events for UI

**`unregisterWebPushNotifications()`**:

- Cleans up listeners
- Called on logout (optional)

---

## Part 9: Comparison with Mobile

| Feature                  | Mobile (iOS/Android) | Web             |
| ------------------------ | -------------------- | --------------- |
| Permission prompt        | System prompt        | Browser prompt  |
| Background notifications | ✅ Yes               | ✅ Yes          |
| Foreground notifications | ✅ Custom UI         | ✅ Custom event |
| Token registration       | Capacitor plugin     | Firebase SDK    |
| Service worker           | Not needed           | Required        |
| Platform value           | `ios` or `android`   | `web`           |
| Deep linking             | Capacitor handles    | URL navigation  |

---

## Frequently Asked Questions

**Q: Do web push notifications work on iOS?**  
A: Safari on macOS 13+ supports web push (iOS Safari does not yet).

**Q: Can users disable notifications?**  
A: Yes, in browser settings. We don't delete the token, so they can re-enable without re-registering.

**Q: What happens if user has both mobile app and web app?**  
A: They'll receive notifications on both devices. The backend sends to all registered tokens.

**Q: How do we handle token expiration?**  
A: Firebase automatically refreshes tokens. Invalid tokens are pruned by the backend when they fail.

**Q: Can we customize the notification UI?**  
A: Background notifications use browser UI. Foreground notifications can be customized with your own UI components.

---

**Last Updated**: January 16, 2025  
**Status**: Complete and ready for production  
**Next Steps**: Add VAPID key and deploy to staging
