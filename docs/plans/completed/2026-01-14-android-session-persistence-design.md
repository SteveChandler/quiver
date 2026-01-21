# Android Session Persistence Design

## Problem Statement

Users on Android are forced to re-login every time the app is cold-started (force-closed and reopened). The session/auth tokens stored in WebView cookies are not persisting across app restarts.

## Root Cause

The Quiver app uses a remote URL architecture (`https://www.quiversurf.app` loaded in Capacitor WebView). Android WebView stores cookies in memory by default and only writes them to disk when:
- `CookieManager.flush()` is explicitly called
- The WebView is properly destroyed

When users force-close the app, the flush may not happen, causing session cookies to be lost.

## Solution

Modify the native Android `MainActivity.java` to:
1. Enable cookie persistence at app startup
2. Flush cookies to disk at key lifecycle moments (pause, destroy)

## Implementation

### File Modified
`android/app/src/main/java/app/quiversurf/mobile/MainActivity.java`

### Code Changes

```java
package app.quiversurf.mobile;

import android.os.Bundle;
import android.webkit.CookieManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Enable cookie persistence for WebView
        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(getBridge().getWebView(), true);
    }

    @Override
    public void onPause() {
        super.onPause();
        // Flush cookies to disk when app goes to background
        CookieManager.getInstance().flush();
    }

    @Override
    public void onDestroy() {
        // Flush cookies before app is destroyed
        CookieManager.getInstance().flush();
        super.onDestroy();
    }
}
```

### What Each Method Does

| Method | Purpose |
|--------|---------|
| `onCreate` | Enables cookies and third-party cookies for the WebView |
| `onPause` | Flushes cookies when user switches apps or presses home |
| `onDestroy` | Flushes cookies when app is properly closed |

### Why `setAcceptThirdPartyCookies`?

Since the app loads `https://www.quiversurf.app` in a WebView, Supabase auth cookies from their domain might be considered "third-party" by Android. Enabling this ensures all auth-related cookies persist.

## Testing Plan

### Test 1: Basic Cold Start
1. Fresh install the updated APK
2. Log in with any auth method
3. Force close the app (swipe away from recent apps)
4. Reopen the app
5. **Expected**: Still logged in

### Test 2: Background Survival
1. Log in to the app
2. Press home button
3. Use other apps for 5-10 minutes
4. Return to Quiver
5. **Expected**: Still logged in

### Test 3: Extended Cold Start
1. Log in and force close
2. Wait 1+ hours or restart device
3. Reopen app
4. **Expected**: Still logged in

## Rollback Plan

The change is isolated to `MainActivity.java`. To rollback, revert the file to the default Capacitor boilerplate:

```java
package app.quiversurf.mobile;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {}
```

## Future Enhancements

If more robust security is needed later, consider adding:
- `@capacitor-community/secure-storage` for encrypted token storage
- Biometric authentication via `@capacitor-community/biometric`

These would layer on top of this fix without requiring removal of the cookie persistence code.

## iOS Consideration

iOS WKWebView handles cookie persistence more reliably by default. This fix is Android-specific. Test iOS separately - it likely already works.
