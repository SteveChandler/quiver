import {
  resolveNotificationPresentationCompatibility,
  type NotificationPresentationCompatibilityInput,
} from "@/lib/notifications/build-compatibility";

function resolve(
  over: Partial<NotificationPresentationCompatibilityInput> = {},
) {
  return resolveNotificationPresentationCompatibility({
    platform: "ios",
    appVersion: "1.0.1",
    buildNumber: "11",
    notificationType: "forecast_alert",
    ...over,
  });
}

describe("notification presentation build compatibility", () => {
  it.each([
    [
      "ios",
      { platform: "ios", appVersion: "1.0.1", buildNumber: "11" },
      "ios_custom_sound",
    ],
    [
      "android",
      { platform: "android", appVersion: "1.0.1", buildNumber: "12" },
      "android_custom_channel",
    ],
  ])("allows the pinned eligible %s build", (_name, input, presentation) => {
    expect(resolve(input)).toEqual({
      eligible: true,
      outcome: "eligible_custom",
      reason: "eligible",
      platform: input.platform,
      presentation,
    });
  });

  it.each([
    ["ios", "10"],
    ["android", "11"],
  ])("keeps old %s builds on legacy presentation", (platform, buildNumber) => {
    expect(resolve({ platform, buildNumber })).toMatchObject({
      eligible: false,
      outcome: "legacy_default",
      reason: "old_build",
      presentation: "legacy_default",
    });
  });

  it.each([
    ["missing iOS platform", { platform: null }, "missing_metadata"],
    ["missing iOS version", { appVersion: null }, "missing_metadata"],
    ["missing Android build", { platform: "android", buildNumber: null }, "missing_metadata"],
    ["malformed iOS version", { appVersion: "v1" }, "malformed_metadata"],
    [
      "malformed Android build",
      { platform: "android", buildNumber: "12beta" },
      "malformed_metadata",
    ],
    ["unknown platform", { platform: "web" }, "unknown_platform"],
    ["unknown iOS version", { appVersion: "1.0.2" }, "unknown_build"],
    [
      "unknown Android newer build",
      { platform: "android", buildNumber: "999" },
      "unknown_build",
    ],
  ])("fails closed for %s", (_name, input, reason) => {
    expect(resolve(input)).toMatchObject({
      eligible: false,
      outcome: "legacy_default",
      reason,
      presentation: "legacy_default",
    });
  });

  it.each(["like", "follow", "daily_digest"])(
    "keeps ordinary %s notifications ordinary on eligible builds",
    (notificationType) => {
      expect(resolve({ notificationType })).toEqual({
        eligible: false,
        outcome: "ordinary_default",
        reason: "ordinary_notification",
        platform: "ios",
        presentation: "legacy_default",
      });
    },
  );
});
