/**
 * Web Push Notifications Client
 * Handles FCM token registration and notification handling for web browsers
 * Mirrors the structure of lib/mobile/push-notifications.ts
 */

import { getToken, onMessage, type Unsubscribe } from "firebase/messaging";
import { getFirebaseMessaging } from "@/lib/firebase/config";

// VAPID key from Firebase Console (Cloud Messaging → Web Push certificates)
// This is a public key and safe to include in client-side code
const VAPID_KEY =
  "BOPUrm9VNqgRwNl4lL7z6jJ7qH6mf7wHRZPkEyl0fexR4MrBsufQg-NvveWMgle2K78Y1G5sECVi524Lq7pu-Ds";

// Store the unsubscribe function for cleanup
let unsubscribeFromMessages: Unsubscribe | null = null;

/**
 * Check if push notifications are supported
 */
function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  return "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Initialize and register push notifications
 * Call this after user authentication
 */
export async function registerWebPushNotifications(): Promise<void> {
  // Check browser support
  if (!isPushSupported()) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Push notifications: Not supported in this browser (missing Notification or ServiceWorker API)"
      );
    }
    return;
  }

  // Check if Firebase is configured before attempting to initialize
  // This prevents 400 errors when NEXT_PUBLIC_FIREBASE_* env vars are missing
  const firebaseConfigured = !!(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID
  );

  if (!firebaseConfigured) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        "Push notifications: Firebase not configured (missing NEXT_PUBLIC_FIREBASE_* environment variables)"
      );
    }
    return;
  }

  try {
    // Check if we already have permission
    let permission = Notification.permission;

    // Request permission if not yet determined
    if (permission === "default") {
      if (process.env.NODE_ENV === "development") {
        console.log("Push notifications: Requesting permission");
      }
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `Push notifications: Permission ${permission === "denied" ? "denied" : "not granted"}`
        );
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("Push notifications: Permission granted");
    }

    // Get Firebase messaging instance
    const messaging = getFirebaseMessaging();
    if (!messaging) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "Push notifications: Firebase messaging not available (check configuration)"
        );
      }
      return;
    }

    // Register service worker for Firebase messaging
    await registerServiceWorker();

    // Get FCM token
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready,
    });

    if (!token) {
      if (process.env.NODE_ENV === "development") {
        console.warn("Push notifications: Failed to get FCM token");
      }
      return;
    }

    if (process.env.NODE_ENV === "development") {
      console.log("Push notifications: Token received", {
        tokenPreview: token.substring(0, 20) + "...",
      });
    }

    // Register token with backend
    try {
      const response = await fetch("/api/devices/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform: "web",
          device_token: token,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (process.env.NODE_ENV === "development") {
          console.error(
            "Push notifications: Token registration failed",
            errorData
          );
        }
      } else {
        if (process.env.NODE_ENV === "development") {
          console.log("Push notifications: Token registered with backend");
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error(
          "Push notifications: Failed to register token with backend",
          error
        );
      }
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Push notifications: Registration failed", error);
    }
  }
}

/**
 * Register the Firebase messaging service worker
 */
async function registerServiceWorker(): Promise<void> {
  try {
    // Check if the service worker is already registered
    const registrations = await navigator.serviceWorker.getRegistrations();
    const existingRegistration = registrations.find((reg) =>
      reg.active?.scriptURL.includes("firebase-messaging-sw.js")
    );

    if (existingRegistration) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          "Push notifications: Service worker already registered",
          existingRegistration.scope
        );
      }
      return;
    }

    // Register the service worker
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
      {
        scope: "/",
      }
    );

    if (process.env.NODE_ENV === "development") {
      console.log(
        "Push notifications: Service worker registered",
        registration.scope
      );
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error(
        "Push notifications: Service worker registration failed",
        error
      );
    }
    throw error;
  }
}

/**
 * Set up push notification listeners
 * Call this once during app initialization
 */
export function setupWebPushListeners(): void {
  if (!isPushSupported()) {
    return;
  }

  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return;
  }

  // Handle foreground messages (when app is open)
  unsubscribeFromMessages = onMessage(messaging, (payload) => {
    if (process.env.NODE_ENV === "development") {
      console.log("Push notifications: Received in foreground", {
        title: payload.notification?.title,
        body: payload.notification?.body,
        data: payload.data,
      });
    }

    // Show an in-app notification or toast
    // The browser won't show a system notification while the app is in focus
    // You could integrate this with a toast library or show a custom UI element

    const data = payload.data;
    const title = payload.notification?.title || "Quiver";
    const body = payload.notification?.body || "New notification";

    // Optional: Show a browser notification even when in foreground
    // (Most apps don't do this, but it's possible)
    if (Notification.permission === "granted" && document.hidden) {
      new Notification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        data,
      });
    }

    // Optional: You could dispatch a custom event here that your app listens to
    // to show an in-app toast/notification
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("push-notification", {
          detail: { title, body, data },
        })
      );
    }
  });

  if (process.env.NODE_ENV === "development") {
    console.log("Push notifications: Foreground listeners configured");
  }
}

/**
 * Unregister push notifications (e.g., on logout)
 */
export async function unregisterWebPushNotifications(): Promise<void> {
  if (!isPushSupported()) {
    return;
  }

  try {
    // Unsubscribe from foreground messages
    if (unsubscribeFromMessages) {
      unsubscribeFromMessages();
      unsubscribeFromMessages = null;
    }

    // Note: We don't delete the token from the backend here
    // The server will prune invalid tokens automatically when they fail
    // This allows users to re-enable notifications without re-registering

    if (process.env.NODE_ENV === "development") {
      console.log("Push notifications: Unregistered and listeners removed");
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Push notifications: Unregistration failed", error);
    }
  }
}

/**
 * Check current notification permission status
 */
export function checkNotificationPermissions(): {
  granted: boolean;
  status: NotificationPermission;
} {
  if (!isPushSupported()) {
    return { granted: false, status: "default" };
  }

  const status = Notification.permission;
  return {
    granted: status === "granted",
    status,
  };
}

