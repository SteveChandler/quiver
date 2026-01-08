# Push Notification Deeplink Routing Testing

## Overview

This document describes the testing strategy for push notification deeplink routing in the Quiver application, specifically for forecast alerts that navigate users to beach detail pages.

## Architecture

### Payload Flow
```
forecast-alerts.ts
  ↓ constructs payload with data.url
sendPushNotification()
  ↓ sends to Firebase Cloud Messaging
FCM
  ↓ delivers to device
firebase-messaging-sw.js
  ↓ handles notificationclick event
  ↓ extracts data.url
  ↓ navigates to beach page
/beach/{slug}
  ↓ loads beach detail page
```

### URL Format

Forecast alert push notifications use this payload structure:

```typescript
{
  notification: {
    title: "Quiver Forecast Alert",
    body: "Ocean Beach looks good 1/15 2PM UTC: 3.5ft @ 12s • 10mph wind"
  },
  data: {
    type: "forecast_alert",
    beach_id: "beach-001",
    beach_slug: "ocean-beach",
    forecast_ts: "2025-01-15T14:00:00Z",
    url: "/beach/ocean-beach"  // ← Deeplink URL
  }
}
```

**URL Format**: `/beach/{beach_slug}`
- Relative path (starts with `/`)
- Uses beach slug directly (no encoding)
- No query parameters or fragments
- Lowercase with hyphens only

## Testing Strategy

### 1. Unit Tests
**File**: `__tests__/lib/services/forecast-alerts-deeplink.test.ts`

Tests URL construction logic and payload structure validation:
- ✅ URL format validation
- ✅ Payload structure verification
- ✅ Service worker contract documentation
- ✅ Edge cases (missing slugs, special characters)
- ✅ Manual testing checklist

**Run**: `yarn test:unit --testPathPattern=forecast-alerts-deeplink`

### 2. E2E Tests
**File**: `e2e/push-deeplink-routing.spec.ts`

Tests actual navigation behavior:
- ✅ Beach page navigation with deeplink URLs
- ✅ URL format consistency
- ✅ Multi-word beach slugs
- ✅ Authenticated vs guest users
- ✅ New tab vs existing tab behavior
- ✅ Invalid beach slug handling
- ✅ Loading performance

**Run**: `yarn test:e2e push-deeplink-routing`

### 3. Service Worker Behavior

**File**: `public/firebase-messaging-sw.js` (lines 61-103)

The service worker cannot be easily unit tested, but its behavior is documented:

```javascript
// Extracts data.url from notification
const data = event.notification.data || {};
let urlToOpen = self.location.origin;

// For forecast_alert type, uses data.url fallback
if (data.url) {
  urlToOpen = data.url.startsWith("http")
    ? data.url
    : `${self.location.origin}${data.url}`;
}

// Focus existing tab or open new window
clients.matchAll({ type: "window", includeUncontrolled: true })
  .then((clientList) => {
    for (const client of clientList) {
      if (client.url === urlToOpen && "focus" in client) {
        return client.focus(); // Focus existing tab
      }
    }
    if (clients.openWindow) {
      return clients.openWindow(urlToOpen); // Open new tab
    }
  });
```

## Manual Testing

### Prerequisites
- [ ] Browser push notifications enabled
- [ ] User has home beach set in profile
- [ ] Forecast alerts enabled (`notif_forecast_alerts: true`)
- [ ] Valid FCM device token registered

### Test Procedure

#### 1. Trigger Forecast Alert

**Option A: Wait for scheduled cron**
- Cron runs daily (configured in vercel.json)
- Checks if home beach conditions match user thresholds

**Option B: Use test endpoint**
```bash
curl -X POST https://quiver.app/api/admin/test-push \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "beachSlug": "ocean-beach",
    "title": "Test Forecast Alert",
    "body": "Ocean Beach looks good!"
  }'
```

**Option C: Manual database trigger**
```sql
-- Update user preferences to match current forecast
UPDATE user_surf_preferences
SET wave_min_ft = 2, wave_max_ft = 6
WHERE user_id = 'your-user-id';
```

#### 2. Verify Notification Delivery

- [ ] Notification appears on device
- [ ] Title: "Quiver Forecast Alert"
- [ ] Body includes beach name and conditions
- [ ] Icon displays correctly

#### 3. Test Navigation

**Test Case 1: Click notification (no existing tab)**
- [ ] Click notification
- [ ] Browser/app opens
- [ ] Navigates to `/beach/{slug}`
- [ ] URL matches beach from alert
- [ ] Beach detail page loads correctly
- [ ] Forecast data is displayed

**Test Case 2: Click notification (existing tab open)**
- [ ] Open `/beach/ocean-beach` in tab
- [ ] Click notification for ocean-beach
- [ ] Existing tab is focused (no new tab opened)
- [ ] Page content updates if needed

**Test Case 3: Click notification (different beach tab open)**
- [ ] Open `/beach/blacks-beach` in tab
- [ ] Click notification for ocean-beach
- [ ] New tab opens with ocean-beach
- [ ] Both tabs remain open

#### 4. Cross-Platform Testing

**Desktop Browsers**
- [ ] Chrome (Windows/Mac)
- [ ] Firefox (Windows/Mac)
- [ ] Safari (Mac)
- [ ] Edge (Windows)

**Mobile Apps** (via Capacitor)
- [ ] iOS app
- [ ] Android app

#### 5. Edge Cases

- [ ] Multiple rapid notification clicks
- [ ] Browser in background
- [ ] Browser completely closed
- [ ] Invalid beach slug (should handle gracefully)
- [ ] Network offline (app should queue navigation)

## Troubleshooting

### Notification Not Appearing

1. **Check browser permissions**:
   - Chrome: Settings → Privacy → Site Settings → Notifications
   - Firefox: Preferences → Privacy & Security → Permissions
   - Safari: Preferences → Websites → Notifications

2. **Verify device token**:
   ```sql
   SELECT device_token, platform, last_used_at
   FROM user_devices
   WHERE user_id = 'your-user-id';
   ```

3. **Check Firebase console**:
   - Go to Firebase Console → Cloud Messaging
   - Verify project configuration
   - Check for delivery errors

### Deeplink Not Working

1. **Check service worker registration**:
   ```javascript
   navigator.serviceWorker.getRegistrations().then((registrations) => {
     console.log('Service workers:', registrations);
   });
   ```

2. **Verify notification payload**:
   - Check browser console for service worker logs
   - Look for `[firebase-messaging-sw] Notification clicked`
   - Verify `data.url` is present

3. **Check route configuration**:
   - Verify `/beach/[beachSlug]/page.tsx` exists
   - Test direct navigation: `window.location.href = '/beach/ocean-beach'`

### Beach Page Not Loading

1. **Check database**:
   ```sql
   SELECT id, slug, name
   FROM beaches
   WHERE slug = 'ocean-beach';
   ```

2. **Verify route params**:
   - Open browser DevTools → Network tab
   - Check API requests to `/api/beach/*`
   - Verify beach data is returned

3. **Check for errors**:
   - Browser console errors
   - Network errors
   - Server-side errors (Vercel logs)

## Success Criteria

### Unit Tests
- ✅ All 13 tests passing
- ✅ URL format validation
- ✅ Payload structure validation
- ✅ Edge case handling

### E2E Tests
- ✅ Navigation tests passing
- ✅ Beach pages load correctly
- ✅ URL routing works as expected

### Manual Testing
- ✅ Push notifications delivered
- ✅ Deeplink navigation works
- ✅ Correct beach page loads
- ✅ Works on all platforms (web, iOS, Android)

## Related Files

### Source Code
- `/lib/services/forecast-alerts.ts` - Payload construction (lines 390-402)
- `/public/firebase-messaging-sw.js` - Service worker click handler (lines 61-103)
- `/app/beach/[beachSlug]/page.tsx` - Beach detail page

### Tests
- `/__tests__/lib/services/forecast-alerts-deeplink.test.ts` - Unit tests
- `/e2e/push-deeplink-routing.spec.ts` - E2E tests
- `/__tests__/lib/services/forecast-alerts.test.ts` - Existing forecast alert tests

### Documentation
- `/docs/api/api-guidelines.md` - API patterns
- `/e2e/ARCHITECTURE.md` - E2E testing patterns
- `/CLAUDE.md` - Project architecture overview

## Future Enhancements

### Potential Improvements
1. **Deep Section Linking**: Support hash fragments (e.g., `/beach/ocean-beach#forecast`)
2. **Query Parameters**: Add context (e.g., `?from=push_notification`)
3. **Analytics Tracking**: Track notification click-through rates
4. **A/B Testing**: Test different notification copy
5. **Rich Media**: Add images to push notifications

### Technical Debt
- [ ] Service worker unit testing (requires browser automation)
- [ ] Automated deeplink validation in CI/CD
- [ ] Push notification delivery metrics
- [ ] User engagement tracking

## References

- [FCM Web Push Documentation](https://firebase.google.com/docs/cloud-messaging/js/client)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Notification API](https://developer.mozilla.org/en-US/docs/Web/API/Notifications_API)
- [Next.js Dynamic Routes](https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes)
