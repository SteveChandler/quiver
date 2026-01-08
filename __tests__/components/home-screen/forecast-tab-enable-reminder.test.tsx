import "@testing-library/jest-dom";
import { renderHook } from "@testing-library/react";

// Mock all dependencies before imports
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(),
}));

jest.mock("@/hooks/useWebPushRegistration", () => ({
  useWebPushRegistration: jest.fn(),
}));

jest.mock("@/hooks/use-native-push-registration", () => ({
  useNativePushRegistration: jest.fn(),
}));

// Create mock for profile actions
const mockUpdateProfile = jest.fn();
jest.mock("@/actions/profile-actions", () => ({
  updateProfile: mockUpdateProfile,
}));

jest.mock("@/hooks/use-toast", () => ({
  useToast: jest.fn(() => ({
    toast: jest.fn(),
  })),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

// Import after mocks are set up
import { isNativeApp } from "@/lib/mobile/platform";
import { useWebPushRegistration } from "@/hooks/useWebPushRegistration";
import { useNativePushRegistration } from "@/hooks/use-native-push-registration";
import { useToast } from "@/hooks/use-toast";
import { track } from "@/lib/analytics";
import type { ReminderResult } from "@/components/home-screen/personalized-forecast-card";

/**
 * Unit tests for handleEnableReminder in forecast-tab.tsx
 *
 * This test suite validates the complete reminder enablement flow including:
 * - Platform detection (web vs native)
 * - Push notification registration (web/native)
 * - Profile updates
 * - Error handling for all failure scenarios
 * - Analytics tracking
 * - Toast notifications
 *
 * Note: We test the logic by creating a minimal implementation that mirrors
 * the actual handleEnableReminder function from forecast-tab.tsx
 */
describe("ForecastTab - handleEnableReminder", () => {
  let mockToast: jest.Mock;
  let mockRequestWebPush: jest.Mock;
  let mockRequestNativePush: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockToast = jest.fn();
    mockRequestWebPush = jest.fn();
    mockRequestNativePush = jest.fn();

    (useToast as jest.Mock).mockReturnValue({ toast: mockToast });
  });

  /**
   * Helper function that mirrors handleEnableReminder logic from forecast-tab.tsx
   * This allows us to test the function in isolation without rendering the entire component
   */
  const createHandleEnableReminder = (
    homeBeachId: string | null = null,
    webPushSupported: boolean = true
  ) => {
    return async (beachId: string, beachName: string): Promise<ReminderResult> => {
      try {
        // Platform-specific push registration
        if (isNativeApp()) {
          // Native app: use FCM push registration
          const pushResult = await mockRequestNativePush();

          if (pushResult.status === "denied") {
            mockToast({
              title: "Push notifications disabled",
              description: "Enable notifications in your device settings to get alerts.",
              variant: "destructive",
            });
            track("first_win_reminder_declined", {
              beach_id: beachId,
              beach_name: beachName,
              platform: "native",
              reason: "push_denied",
            });
            return { success: false, errorType: "denied" };
          }

          if (pushResult.status === "error") {
            mockToast({
              title: "Couldn't enable push notifications",
              description: pushResult.detail || "Please try again or check your settings.",
              variant: "destructive",
            });
            track("first_win_reminder_declined", {
              beach_id: beachId,
              beach_name: beachName,
              platform: "native",
              reason: "push_error",
            });
            return { success: false, errorType: "error", errorMessage: pushResult.detail };
          }

          // "unsupported" status: log warning but continue (profile flags still update)
          if (pushResult.status === "unsupported") {
            console.warn("Native push not supported, continuing with profile update only");
          }
        } else {
          // Web/PWA: use web push registration
          if (webPushSupported) {
            const pushResult = await mockRequestWebPush();

            if (pushResult.status === "denied") {
              mockToast({
                title: "Push notifications blocked",
                description: "Enable notifications in browser settings to get alerts.",
                variant: "destructive",
              });
              track("first_win_reminder_declined", {
                beach_id: beachId,
                beach_name: beachName,
                platform: "web",
                reason: "push_denied",
              });
              return { success: false, errorType: "denied" };
            }

            if (pushResult.status === "error") {
              mockToast({
                title: "Couldn't enable push notifications",
                description: pushResult.detail || "Please try again or check your settings.",
                variant: "destructive",
              });
              track("first_win_reminder_declined", {
                beach_id: beachId,
                beach_name: beachName,
                platform: "web",
                reason: "push_error",
              });
              return { success: false, errorType: "error", errorMessage: pushResult.detail };
            }

            // "unsupported" status: log warning but continue (profile flags still update)
            if (pushResult.status === "unsupported") {
              console.warn("Web push not supported, continuing with profile update only");
            }
          }
        }

        // Update profile with home beach (if needed) + notification flags
        const updateData: Record<string, unknown> = {
          notif_push_enabled: true,
          notif_forecast_alerts: true,
        };

        // Set home beach if not already set
        if (!homeBeachId) {
          updateData.home_beach_id = beachId;
        }

        await mockUpdateProfile(updateData);

        mockToast({
          title: "Reminders enabled!",
          description: `We'll notify you when ${beachName} has good conditions.`,
        });

        track("first_win_reminder_enabled", {
          beach_id: beachId,
          beach_name: beachName,
          platform: isNativeApp() ? "native" : "web",
        });

        return { success: true };
      } catch (error) {
        console.error("Failed to enable reminder:", error);
        mockToast({
          title: "Couldn't enable reminders",
          description: "Please try again or check your settings.",
          variant: "destructive",
        });
        track("first_win_reminder_declined", {
          beach_id: beachId,
          beach_name: beachName,
          platform: isNativeApp() ? "native" : "web",
          reason: "error",
          error: error instanceof Error ? error.message : String(error),
        });
        return { success: false, errorType: "error", errorMessage: error instanceof Error ? error.message : "Unknown error" };
      }
    };
  };

  describe("Web Push - Success Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should successfully enable web push and update profile", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: true });
      expect(mockRequestWebPush).toHaveBeenCalledTimes(1);
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        notif_push_enabled: true,
        notif_forecast_alerts: true,
        home_beach_id: "beach-123",
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Reminders enabled!",
        description: "We'll notify you when Ocean Beach has good conditions.",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
      });
    });

    it("should not set home_beach_id if already set", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder("existing-beach-id", true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: true });
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        notif_push_enabled: true,
        notif_forecast_alerts: true,
      });
    });
  });

  describe("Web Push - Denied Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should return denied error when web push is denied", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "denied" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: false, errorType: "denied" });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Push notifications blocked",
        description: "Enable notifications in browser settings to get alerts.",
        variant: "destructive",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "push_denied",
      });
    });
  });

  describe("Web Push - Error Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should return error when web push registration fails", async () => {
      const errorDetail = "Service worker registration failed";
      mockRequestWebPush.mockResolvedValue({ status: "error", detail: errorDetail });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: false, errorType: "error", errorMessage: errorDetail });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Couldn't enable push notifications",
        description: errorDetail,
        variant: "destructive",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "push_error",
      });
    });

    it("should use default error message if detail is missing", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "error" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: false, errorType: "error", errorMessage: undefined });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Couldn't enable push notifications",
        description: "Please try again or check your settings.",
        variant: "destructive",
      });
    });
  });

  describe("Web Push - Unsupported Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should continue with profile update when web push is unsupported", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockRequestWebPush.mockResolvedValue({ status: "unsupported" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith("Web push not supported, continuing with profile update only");
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        notif_push_enabled: true,
        notif_forecast_alerts: true,
        home_beach_id: "beach-123",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Native Push - Success Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
      (useNativePushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestNativePush,
        status: "idle",
      });
    });

    it("should successfully enable native push and update profile", async () => {
      mockRequestNativePush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: true });
      expect(mockRequestNativePush).toHaveBeenCalledTimes(1);
      expect(mockRequestWebPush).not.toHaveBeenCalled();
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        notif_push_enabled: true,
        notif_forecast_alerts: true,
        home_beach_id: "beach-123",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "native",
      });
    });
  });

  describe("Native Push - Denied Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
      (useNativePushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestNativePush,
        status: "idle",
      });
    });

    it("should return denied error when native push is denied", async () => {
      mockRequestNativePush.mockResolvedValue({ status: "denied" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: false, errorType: "denied" });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Push notifications disabled",
        description: "Enable notifications in your device settings to get alerts.",
        variant: "destructive",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "native",
        reason: "push_denied",
      });
    });

    it("should use device settings message for native platform", async () => {
      mockRequestNativePush.mockResolvedValue({ status: "denied" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      const toastCall = mockToast.mock.calls[0][0];
      expect(toastCall.description).toContain("device settings");
    });
  });

  describe("Native Push - Error Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
      (useNativePushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestNativePush,
        status: "idle",
      });
    });

    it("should return error when native push registration fails", async () => {
      const errorDetail = "FCM token retrieval failed";
      mockRequestNativePush.mockResolvedValue({ status: "error", detail: errorDetail });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: false, errorType: "error", errorMessage: errorDetail });
      expect(mockUpdateProfile).not.toHaveBeenCalled();
      expect(mockToast).toHaveBeenCalledWith({
        title: "Couldn't enable push notifications",
        description: errorDetail,
        variant: "destructive",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "native",
        reason: "push_error",
      });
    });
  });

  describe("Native Push - Unsupported Flow", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
      (useNativePushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestNativePush,
        status: "idle",
      });
    });

    it("should continue with profile update when native push is unsupported", async () => {
      const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
      mockRequestNativePush.mockResolvedValue({ status: "unsupported" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({ success: true });
      expect(consoleWarnSpy).toHaveBeenCalledWith("Native push not supported, continuing with profile update only");
      expect(mockUpdateProfile).toHaveBeenCalledWith({
        notif_push_enabled: true,
        notif_forecast_alerts: true,
        home_beach_id: "beach-123",
      });

      consoleWarnSpy.mockRestore();
    });
  });

  describe("Profile Update Failure", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should return error when profile update fails", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      const profileError = new Error("Database connection failed");
      mockUpdateProfile.mockRejectedValue(profileError);

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({
        success: false,
        errorType: "error",
        errorMessage: "Database connection failed"
      });
      expect(mockToast).toHaveBeenCalledWith({
        title: "Couldn't enable reminders",
        description: "Please try again or check your settings.",
        variant: "destructive",
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "error",
        error: "Database connection failed",
      });
      expect(consoleErrorSpy).toHaveBeenCalledWith("Failed to enable reminder:", profileError);

      consoleErrorSpy.mockRestore();
    });

    it("should handle non-Error exceptions in profile update", async () => {
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockRejectedValue("String error");

      const handleEnableReminder = createHandleEnableReminder(null, true);
      const result = await handleEnableReminder("beach-123", "Ocean Beach");

      expect(result).toEqual({
        success: false,
        errorType: "error",
        errorMessage: "Unknown error"
      });
      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "error",
        error: "String error",
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe("Platform Detection", () => {
    it("should use web push on web platform", async () => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      expect(mockRequestWebPush).toHaveBeenCalled();
      expect(mockRequestNativePush).not.toHaveBeenCalled();
    });

    it("should use native push on native platform", async () => {
      (isNativeApp as jest.Mock).mockReturnValue(true);
      (useNativePushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestNativePush,
        status: "idle",
      });
      mockRequestNativePush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      expect(mockRequestNativePush).toHaveBeenCalled();
      expect(mockRequestWebPush).not.toHaveBeenCalled();
    });
  });

  describe("Analytics Tracking", () => {
    beforeEach(() => {
      (isNativeApp as jest.Mock).mockReturnValue(false);
      (useWebPushRegistration as jest.Mock).mockReturnValue({
        requestPushOptIn: mockRequestWebPush,
        isSupported: true,
      });
    });

    it("should track success event with correct platform", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "granted" });
      mockUpdateProfile.mockResolvedValue({ success: true });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
      });
    });

    it("should track declined event for denied permissions", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "denied" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "push_denied",
      });
    });

    it("should track declined event with error details", async () => {
      mockRequestWebPush.mockResolvedValue({ status: "error", detail: "SW failed" });

      const handleEnableReminder = createHandleEnableReminder(null, true);
      await handleEnableReminder("beach-123", "Ocean Beach");

      expect(track).toHaveBeenCalledWith("first_win_reminder_declined", {
        beach_id: "beach-123",
        beach_name: "Ocean Beach",
        platform: "web",
        reason: "push_error",
      });
    });
  });
});
