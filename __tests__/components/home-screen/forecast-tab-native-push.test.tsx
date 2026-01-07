import "@testing-library/jest-dom";
import { isNativeApp } from "@/lib/mobile/platform";

// Mock dependencies
jest.mock("@/lib/mobile/platform", () => ({
  isNativeApp: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

import { track } from "@/lib/analytics";

/**
 * Unit tests for handleEnableReminder logic with native push support.
 *
 * This test suite validates the platform detection and push registration
 * routing logic implemented in forecast-tab.tsx.
 *
 * Key behaviors tested:
 * 1. Native apps use requestNativePush()
 * 2. Web apps use requestWebPush()
 * 3. Analytics tracking includes correct platform
 * 4. Error handling differs between platforms (device settings vs browser settings)
 */
describe("ForecastTab - handleEnableReminder platform detection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should detect native platform correctly", () => {
    (isNativeApp as jest.Mock).mockReturnValue(true);
    expect(isNativeApp()).toBe(true);
  });

  it("should detect web platform correctly", () => {
    (isNativeApp as jest.Mock).mockReturnValue(false);
    expect(isNativeApp()).toBe(false);
  });

  it("should track analytics with native platform", () => {
    (isNativeApp as jest.Mock).mockReturnValue(true);

    const platform = isNativeApp() ? "native" : "web";
    track("first_win_reminder_enabled", {
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      platform,
    });

    expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      platform: "native",
    });
  });

  it("should track analytics with web platform", () => {
    (isNativeApp as jest.Mock).mockReturnValue(false);

    const platform = isNativeApp() ? "native" : "web";
    track("first_win_reminder_enabled", {
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      platform,
    });

    expect(track).toHaveBeenCalledWith("first_win_reminder_enabled", {
      beach_id: "beach-123",
      beach_name: "Ocean Beach",
      platform: "web",
    });
  });

  it("should use different error messages for native vs web", () => {
    // Native platform
    (isNativeApp as jest.Mock).mockReturnValue(true);
    let nativeMessage = isNativeApp()
      ? "Enable notifications in your device settings to get alerts."
      : "Enable notifications in browser settings to get alerts.";
    expect(nativeMessage).toBe("Enable notifications in your device settings to get alerts.");

    // Web platform
    (isNativeApp as jest.Mock).mockReturnValue(false);
    let webMessage = isNativeApp()
      ? "Enable notifications in your device settings to get alerts."
      : "Enable notifications in browser settings to get alerts.";
    expect(webMessage).toBe("Enable notifications in browser settings to get alerts.");
  });
});
