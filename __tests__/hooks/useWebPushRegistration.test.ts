/**
 * Unit tests for useWebPushRegistration hook
 *
 * Tests validate:
 * - Browser support detection
 * - Permission state handling
 * - Registration flow
 * - Error handling
 * - State management
 */

import { renderHook, act } from "@testing-library/react";
import { useWebPushRegistration } from "@/hooks/useWebPushRegistration";

// Mock the toast hook
const mockToast = jest.fn();
jest.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock analytics
jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Mock web push notifications library
const mockRegisterWebPush = jest.fn();
jest.mock("@/lib/web/push-notifications", () => ({
  registerWebPushNotifications: () => mockRegisterWebPush(),
  checkNotificationPermissions: jest.fn(() => ({
    granted: false,
    status: "default",
  })),
}));

// Mock mobile platform detection
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(() => false),
}));

describe("useWebPushRegistration", () => {
  // Store original Notification
  const originalNotification = global.Notification;

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    // Default mock: browser supports notifications
    Object.defineProperty(global, "Notification", {
      value: {
        permission: "default",
        requestPermission: jest.fn(() => Promise.resolve("granted")),
      },
      writable: true,
      configurable: true,
    });

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, "serviceWorker", {
      value: { ready: Promise.resolve({}) },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalNotification) {
      Object.defineProperty(global, "Notification", {
        value: originalNotification,
        writable: true,
        configurable: true,
      });
    }
  });

  describe("initialization", () => {
    it("should return idle status initially", () => {
      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
      expect(result.current.platform).toBe("web");
    });

    it("should detect browser support", () => {
      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.isSupported).toBe(true);
    });

    it("should indicate can prompt when supported and not yet registered", () => {
      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.canPrompt).toBe(true);
    });

    it("should not show canPrompt when permission already denied", () => {
      Object.defineProperty(global, "Notification", {
        value: { permission: "denied" },
        writable: true,
        configurable: true,
      });

      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.canPrompt).toBe(false);
    });

    it("should not show canPrompt when already granted via localStorage", () => {
      localStorage.setItem("quiver-web-push-registered", "granted");

      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.canPrompt).toBe(false);
    });
  });

  describe("requestPushOptIn", () => {
    it("should request permission and return granted on success", async () => {
      mockRegisterWebPush.mockResolvedValue(undefined);
      Object.defineProperty(global.Notification, "permission", {
        get: () => "granted",
        configurable: true,
      });

      const { result } = renderHook(() => useWebPushRegistration());

      let response: { status: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("granted");
      expect(result.current.status).toBe("granted");
      expect(mockToast).toHaveBeenCalledWith({
        title: "Push notifications enabled ⚡",
      });
      expect(localStorage.getItem("quiver-web-push-registered")).toBe("granted");
    });

    it("should handle denied permission after prompt", async () => {
      // Start with default permission, then return denied after registration
      let permissionState = "default";
      mockRegisterWebPush.mockImplementation(() => {
        permissionState = "denied";
        return Promise.resolve();
      });
      Object.defineProperty(global.Notification, "permission", {
        get: () => permissionState,
        configurable: true,
      });

      const { result } = renderHook(() => useWebPushRegistration());

      let response: { status: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("denied");
      expect(result.current.status).toBe("denied");
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Push notifications blocked",
        })
      );
    });

    it("should handle dismissed prompt (default permission)", async () => {
      mockRegisterWebPush.mockResolvedValue(undefined);
      // Permission stays at "default" after registration call

      const { result } = renderHook(() => useWebPushRegistration());

      let response: { status: string; detail?: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("idle");
      expect(response!.detail).toBe("User dismissed prompt");
    });

    it("should handle registration errors", async () => {
      mockRegisterWebPush.mockRejectedValue(new Error("Registration failed"));

      const { result } = renderHook(() => useWebPushRegistration());

      let response: { status: string; detail?: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("error");
      expect(response!.detail).toBe("Registration failed");
      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe("Registration failed");
      expect(mockToast).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Couldn't enable push notifications",
          variant: "destructive",
        })
      );
    });

    it("should return unsupported when Notification API is missing", async () => {
      // Remove Notification API
      // @ts-expect-error - intentionally testing missing API
      delete global.Notification;

      const { result } = renderHook(() => useWebPushRegistration());

      let response: { status: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("unsupported");
    });

    it("should prevent duplicate requests", async () => {
      mockRegisterWebPush.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      const { result } = renderHook(() => useWebPushRegistration());

      // Start first request
      let promise1: Promise<{ status: string }>;
      act(() => {
        promise1 = result.current.requestPushOptIn();
      });

      // Try to start second request immediately
      let response2: { status: string };
      await act(async () => {
        response2 = await result.current.requestPushOptIn();
      });

      expect(response2!.status).toBe("pending");
    });
  });

  describe("unsupported environments", () => {
    it("should handle native app environment", async () => {
      const { isNativeApp } = require("@/lib/mobile/platform");
      isNativeApp.mockReturnValue(true);

      const { result } = renderHook(() => useWebPushRegistration());

      expect(result.current.isSupported).toBe(false);
      expect(result.current.canPrompt).toBe(false);

      let response: { status: string };
      await act(async () => {
        response = await result.current.requestPushOptIn();
      });

      expect(response!.status).toBe("unsupported");
    });
  });
});
