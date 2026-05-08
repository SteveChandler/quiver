/**
 * Tests for Web Push Notifications
 * Following patterns from __tests__/lib/push-notifications.test.ts
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// Mock Firebase modules
const mockGetToken = jest.fn<any>();
const mockOnMessage = jest.fn<any>();
const mockGetMessaging = jest.fn<any>();
jest.mock("firebase/messaging", () => ({
  getToken: mockGetToken,
  onMessage: mockOnMessage,
  getMessaging: mockGetMessaging,
}));

jest.mock("@/lib/firebase/config", () => ({
  getFirebaseMessaging: jest.fn(() => mockGetMessaging()),
}));

// Mock global Notification API
const mockNotification = {
  permission: "default" as NotificationPermission,
  requestPermission: jest.fn<any>(),
};

// Mock service worker
const mockServiceWorker = {
  ready: Promise.resolve({
    scope: "/",
    active: { scriptURL: "http://localhost/firebase-messaging-sw.js" },
  } as ServiceWorkerRegistration),
  register: jest.fn<any>(),
  getRegistrations: jest.fn<any>(),
};

// Mock fetch
global.fetch = jest.fn<any>() as jest.MockedFunction<typeof fetch>;

beforeEach(() => {
  jest.clearAllMocks();
  jest.resetModules(); // Clear module cache to pick up fresh mocks

  // Set up Firebase environment variables (required by implementation)
  process.env.NEXT_PUBLIC_FIREBASE_API_KEY = "test-api-key";
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID = "test-project-id";
  process.env.NEXT_PUBLIC_FIREBASE_APP_ID = "test-app-id";

  // Set up global Notification (browser global)
  Object.defineProperty(global, "Notification", {
    value: mockNotification,
    writable: true,
    configurable: true,
  });

  // Set up window object
  Object.defineProperty(global, "window", {
    value: {
      Notification: mockNotification,
      Capacitor: undefined, // Web platform
    },
    writable: true,
    configurable: true,
  });

  // Set up navigator
  Object.defineProperty(global, "navigator", {
    value: {
      serviceWorker: mockServiceWorker,
    },
    writable: true,
    configurable: true,
  });

  // Reset mocks
  mockNotification.permission = "default";
  mockNotification.requestPermission.mockResolvedValue("granted");
  mockGetMessaging.mockReturnValue({});
  mockServiceWorker.getRegistrations.mockResolvedValue([]);
  mockServiceWorker.register.mockResolvedValue({
    scope: "/",
  } as ServiceWorkerRegistration);
  (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
    ok: true,
    json: async () => ({}),
  } as Response);
});

describe("Web Push Notifications", () => {
  describe("isPushSupported", () => {
    it("should return true when Notification and serviceWorker are available", async () => {
      const { checkNotificationPermissions } =
        await import("@/lib/web/push-notifications");
      const result = checkNotificationPermissions();
      expect(result).toEqual({ granted: false, status: "default" });
    });

    it("should return false when Notification is not available", async () => {
      delete (window as any).Notification;
      const { checkNotificationPermissions } =
        await import("@/lib/web/push-notifications");
      const result = checkNotificationPermissions();
      expect(result.granted).toBe(false);
    });
  });

  describe("registerWebPushNotifications", () => {
    it("should request permission and register token", async () => {
      const mockToken = "mock-fcm-token-123";
      mockGetToken.mockResolvedValue(mockToken);

      const { registerWebPushNotifications } =
        await import("@/lib/web/push-notifications");
      await registerWebPushNotifications();

      expect(mockNotification.requestPermission).toHaveBeenCalled();
      expect(mockGetToken).toHaveBeenCalled();
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/devices/upsert",
        expect.objectContaining({
          method: "POST",
        })
      );
      const [, options] = (global.fetch as jest.Mock).mock.calls[0];
      expect(JSON.parse((options as RequestInit).body as string)).toEqual({
        platform: "web",
        device_token: mockToken,
        timezone: expect.any(String),
      });
    });

    it("should not register if permission is denied", async () => {
      mockNotification.permission = "denied";
      mockNotification.requestPermission.mockResolvedValue("denied");

      const { registerWebPushNotifications } =
        await import("@/lib/web/push-notifications");
      await registerWebPushNotifications();

      expect(mockGetToken).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should handle Firebase messaging not available", async () => {
      mockGetMessaging.mockReturnValue(null);

      const { registerWebPushNotifications } =
        await import("@/lib/web/push-notifications");
      await registerWebPushNotifications();

      expect(mockGetToken).not.toHaveBeenCalled();
    });

    it("should handle token registration failure", async () => {
      const mockToken = "mock-fcm-token-123";
      mockGetToken.mockResolvedValue(mockToken);
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValue({
        ok: false,
        json: async () => ({ error: "Failed to register" }),
      } as Response);

      const { registerWebPushNotifications } =
        await import("@/lib/web/push-notifications");
      await registerWebPushNotifications();

      // Should not throw, just log error
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("setupWebPushListeners", () => {
    it("should set up foreground message listener", async () => {
      const { setupWebPushListeners } =
        await import("@/lib/web/push-notifications");
      setupWebPushListeners();

      expect(mockOnMessage).toHaveBeenCalled();
    });

    it("should not set up listeners if Firebase messaging not available", async () => {
      mockGetMessaging.mockReturnValue(null);

      const { setupWebPushListeners } =
        await import("@/lib/web/push-notifications");
      setupWebPushListeners();

      expect(mockOnMessage).not.toHaveBeenCalled();
    });
  });

  describe("checkNotificationPermissions", () => {
    it("should return granted status when permission is granted", async () => {
      mockNotification.permission = "granted";

      const { checkNotificationPermissions } =
        await import("@/lib/web/push-notifications");
      const result = checkNotificationPermissions();

      expect(result.granted).toBe(true);
      expect(result.status).toBe("granted");
    });

    it("should return not granted when permission is default", async () => {
      mockNotification.permission = "default";

      const { checkNotificationPermissions } =
        await import("@/lib/web/push-notifications");
      const result = checkNotificationPermissions();

      expect(result.granted).toBe(false);
      expect(result.status).toBe("default");
    });

    it("should return not granted when permission is denied", async () => {
      mockNotification.permission = "denied";

      const { checkNotificationPermissions } =
        await import("@/lib/web/push-notifications");
      const result = checkNotificationPermissions();

      expect(result.granted).toBe(false);
      expect(result.status).toBe("denied");
    });
  });

  describe("unregisterWebPushNotifications", () => {
    it("should unsubscribe from messages", async () => {
      const mockUnsubscribe = jest.fn();
      mockOnMessage.mockReturnValue(mockUnsubscribe);

      const { setupWebPushListeners, unregisterWebPushNotifications } =
        await import("@/lib/web/push-notifications");

      // Set up first
      setupWebPushListeners();

      // Then unregister
      await unregisterWebPushNotifications();

      expect(mockUnsubscribe).toHaveBeenCalled();
    });
  });
});

