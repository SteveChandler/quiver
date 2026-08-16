# PWA Development Guide

This document describes Quiver's Progressive Web App (PWA) configuration and development best practices, particularly the localhost handling that prevents common development issues.

## Overview

Quiver uses a PWA strategy that provides offline capabilities and native-like experience in production while preventing development issues caused by stale service worker caches.

> **Retirement note (August 7, 2026):** Capacitor is not a dependency of this repository. This guide covers the current PWA and web-push implementation only; native app integration is maintained separately.

## Environment-Specific Behavior

| Environment | PWA Status | Service Worker | Caching |
|-------------|------------|----------------|---------|
| **Production** (HTTPS) | Enabled | Registers `/sw.js` | Full Workbox caching |
| **Staging** (HTTPS) | Enabled | Registers `/sw.js` | Full Workbox caching |
| **Development** (localhost) | Disabled | Unregisters existing | Caches cleared |

## Configuration Files

### Next.js Configuration (`next.config.mjs`)

```javascript
const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: !isProd,           // Disabled in development
  register: false,            // Manual registration in runtime
  skipWaiting: true,          // Activate new SW immediately
  buildExcludes: [            // Exclude build manifests
    /app-build-manifest\.json$/,
    /build-manifest\.json$/,
  ],
  // ... caching strategies
});
```

**Key Settings:**
- `disable: !isProd` - Only generates service worker in production builds
- `register: false` - Disables automatic registration (we control it in runtime)
- `skipWaiting: true` - New service workers activate immediately

### Runtime Registration (`pwa-and-push-listeners.tsx`)

```typescript
// Location: components/analytics/pwa-and-push-listeners.tsx

useEffect(() => {
  const host = window.location.hostname;
  const isLocalhost = host === "localhost" || host === "127.0.0.1";
  const isDev = process.env.NODE_ENV !== "production";

  if (isLocalhost || isDev) {
    // NEVER register on localhost - clean up instead
    void unregisterQuiverSwIfPresent();
    return;
  }

  // Only register in production HTTPS contexts
  if (window.location.protocol === "https:" && "serviceWorker" in navigator) {
    registerServiceWorker();
  }
}, []);
```

## Why PWA is Disabled on Localhost

During development, cached service workers can cause:

1. **Stale Next.js Chunks**: Old JavaScript bundles served from cache, causing 404 errors
2. **Hydration Failures**: Mismatch between server HTML and cached client JS
3. **Build Artifact Conflicts**: Previous build files interfering with current development
4. **Difficult Debugging**: Cached responses masking actual code behavior

The solution: **Never register service workers on localhost** and proactively clean up any existing registrations.

## Service Worker Cleanup

When on localhost, the system automatically:

1. Unregisters any existing `/sw.js` service workers
2. Clears all browser caches
3. Prevents new registrations

```typescript
async function unregisterQuiverSwIfPresent() {
  if (!("serviceWorker" in navigator)) return;

  const registrations = await navigator.serviceWorker.getRegistrations();
  for (const registration of registrations) {
    if (registration.active?.scriptURL.endsWith("/sw.js")) {
      await registration.unregister();
      console.log("[PWA] Unregistered stale service worker");
    }
  }

  // Clear all caches
  const cacheNames = await caches.keys();
  await Promise.all(cacheNames.map(name => caches.delete(name)));
}
```

## Caching Strategies

In production, the PWA uses Workbox caching strategies:

| Resource Type | Strategy | Cache Duration |
|---------------|----------|----------------|
| Forecast API | NetworkFirst (3s timeout) | 30 minutes |
| Beach API | NetworkFirst (3s timeout) | 1 hour |
| Buoy API | NetworkFirst (3s timeout) | 15 minutes |
| Images | StaleWhileRevalidate | 7 days |
| Static Assets | CacheFirst | 1 year |
| Pages & Data | NetworkFirst | With expiration |

### Strategy Definitions

```javascript
// From next.config.mjs
runtimeCaching: [
  {
    urlPattern: /\/api\/forecasts\/.*/,
    handler: "NetworkFirst",
    options: {
      cacheName: "forecast-cache",
      networkTimeoutSeconds: 3,
      expiration: { maxAgeSeconds: 1800 }, // 30 min
    },
  },
  {
    urlPattern: /\.(png|jpg|jpeg|gif|webp|svg)$/,
    handler: "StaleWhileRevalidate",
    options: {
      cacheName: "image-cache",
      expiration: { maxAgeSeconds: 604800 }, // 7 days
    },
  },
  // ...
]
```

## PWA Manifest

Located at `/public/manifest.json`:

```json
{
  "name": "Quiver",
  "short_name": "Quiver",
  "description": "Surf community, live forecasts, and session logging",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "theme_color": "#0f172a",
  "background_color": "#0f172a",
  "protocol_handlers": [
    {
      "protocol": "web+quiver",
      "url": "/sessions/new?deepLink=%s"
    }
  ],
  "shortcuts": [
    { "name": "Log Session", "url": "/sessions/new?mode=log" },
    { "name": "Check Forecast", "url": "/#forecast" }
  ]
}
```

## Mobile Integration

The current web mobile surface is the PWA:

- **Web (PWA)**: Service worker caching and push notifications via web APIs
- **Native app**: Maintained separately from this repository

## Troubleshooting

### Issue: Hydration Errors on Localhost

**Symptoms:**
- Console errors about hydration mismatches
- "Text content did not match" warnings
- 404 errors for JavaScript chunks

**Solution:**
1. Clear browser application data
2. Unregister service workers manually:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(regs => {
     regs.forEach(reg => reg.unregister());
   });
   ```
3. Hard refresh: `Cmd+Shift+R` (Mac) or `Ctrl+Shift+R` (Windows)

### Issue: Service Worker Not Updating in Production

**Symptoms:**
- Old content served after deployment
- New features not appearing

**Solution:**
- `skipWaiting: true` is set, so new SWs should activate immediately
- If persists, check for build configuration issues

### Issue: Push Notifications Not Working

**Symptoms:**
- No notification permission prompt
- Notifications not received

**Check:**
1. HTTPS is required (not localhost)
2. Firebase configuration is correct
3. User granted notification permission
4. Check browser console for errors

## Development Workflow

### Best Practices

1. **Always develop on localhost** - PWA is disabled automatically
2. **Test PWA in staging** - Deploy to preview URL for PWA testing
3. **Clear caches when switching branches** - Prevents stale code issues
4. **Check Network tab** - Verify requests aren't being served from cache

### Testing PWA Features

To test PWA features during development:

1. Deploy to a staging/preview environment
2. Use Chrome DevTools > Application > Service Workers
3. Check "Update on reload" for faster iteration
4. Use "Bypass for network" to disable caching temporarily

## Related Documentation

- `next.config.mjs` - PWA configuration
- `components/analytics/pwa-and-push-listeners.tsx` - Runtime registration
- `public/manifest.json` - PWA manifest
- `public/sw.js` - Generated service worker

---

**Last Updated:** December 2025
