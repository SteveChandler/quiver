/**
 * Mobile Push Notifications Client
 * Handles FCM token registration and notification handling on iOS/Android
 * Integrates with Capacitor PushNotifications plugin
 */

import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";

/**
 * Initialize and register push notifications
 * Call this after user authentication
 */
export async function registerPushNotifications() {
  // Only run on native platforms (iOS/Android)
  if (!Capacitor.isNativePlatform()) {
    console.log("Push notifications: Web platform, skipping native registration");
    return;
  }

  try {
    // Request permissions
    const permissionStatus = await PushNotifications.requestPermissions();

    if (permissionStatus.receive !== "granted") {
      console.log("Push notification permissions not granted");
      return;
    }

    // Register with FCM
    await PushNotifications.register();
    console.log("Push notifications: Registration initiated");
  } catch (error) {
    console.error("Push notifications: Registration failed", error);
  }
}

/**
 * Set up push notification listeners
 * Call this once during app initialization
 */
export function setupPushNotificationListeners() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  // Listen for successful registration
  PushNotifications.addListener("registration", async (token) => {
    const platform = Capacitor.getPlatform() as "ios" | "android";

    console.log("Push notifications: Token received", {
      platform,
      tokenPreview: token.value.substring(0, 20) + "...",
    });

    try {
      // Register token with backend
      const response = await fetch("/api/devices/upsert", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          platform,
          device_token: token.value,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error("Push notifications: Token registration failed", errorData);
      } else {
        console.log("Push notifications: Token registered with backend");
      }
    } catch (error) {
      console.error("Push notifications: Failed to register token with backend", error);
    }
  });

  // Listen for registration errors
  PushNotifications.addListener("registrationError", (error) => {
    console.error("Push notifications: Registration error", error);
  });

  // Handle notification received while app is in foreground
  PushNotifications.addListener("pushNotificationReceived", (notification) => {
    console.log("Push notifications: Received in foreground", {
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });

    // Optionally show an in-app notification or update badge
    // The app can handle this based on notification type
  });

  // Handle notification tap (when user taps notification)
  PushNotifications.addListener(
    "pushNotificationActionPerformed",
    (action) => {
      console.log("Push notifications: Action performed", {
        actionId: action.actionId,
        data: action.notification.data,
      });

      const data = action.notification.data;

      // Route based on notification type
      if (data.type === "session_invite" && data.session_id) {
        // Navigate to session details
        const sessionUrl = `/sessions/${data.session_id}`;
        console.log("Push notifications: Navigating to", sessionUrl);
        window.location.href = sessionUrl;
      } else if (data.type === "comment" && data.session_id) {
        // Navigate to session with comments visible
        window.location.href = `/sessions/${data.session_id}#comments`;
      } else if (data.type === "like" && data.session_id) {
        // Navigate to session
        window.location.href = `/sessions/${data.session_id}`;
      } else if (data.type === "follow" && data.user_id) {
        // Navigate to user profile
        window.location.href = `/user/${data.user_id}`;
      }
    }
  );

  console.log("Push notifications: Listeners configured");
}

/**
 * Unregister device token (e.g., on logout)
 */
export async function unregisterPushNotifications() {
  if (!Capacitor.isNativePlatform()) {
    return;
  }

  try {
    // Get current token to remove from backend
    // Note: There's no direct way to get the current token without listening to registration
    // So we'll just remove all listeners and let the server prune stale tokens

    // Remove all listeners
    await PushNotifications.removeAllListeners();

    console.log("Push notifications: Unregistered and listeners removed");
  } catch (error) {
    console.error("Push notifications: Unregistration failed", error);
  }
}

/**
 * Check current notification permission status
 */
export async function checkNotificationPermissions(): Promise<{
  granted: boolean;
  status: string;
}> {
  if (!Capacitor.isNativePlatform()) {
    return { granted: false, status: "web" };
  }

  try {
    const status = await PushNotifications.checkPermissions();
    return {
      granted: status.receive === "granted",
      status: status.receive,
    };
  } catch (error) {
    console.error("Push notifications: Failed to check permissions", error);
    return { granted: false, status: "error" };
  }
}














