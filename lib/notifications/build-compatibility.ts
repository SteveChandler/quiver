export interface NotificationPresentationCompatibilityInput {
  platform: string | null | undefined;
  appVersion: string | null | undefined;
  buildNumber: string | null | undefined;
  notificationType: string;
}

export type NotificationPresentationCompatibilityReason =
  | "eligible"
  | "ordinary_notification"
  | "missing_metadata"
  | "malformed_metadata"
  | "unknown_platform"
  | "old_build"
  | "unknown_build";

export interface NotificationPresentationCompatibilityDecision {
  eligible: boolean;
  outcome: "eligible_custom" | "legacy_default" | "ordinary_default";
  reason: NotificationPresentationCompatibilityReason;
  platform: "ios" | "android" | "unknown";
  presentation:
    | "ios_custom_sound"
    | "android_custom_channel"
    | "legacy_default";
}

interface EligibleBuild {
  appVersion: string;
  buildNumber: number;
  presentation: "ios_custom_sound" | "android_custom_channel";
}

const ELIGIBLE_BUILDS: Record<"ios" | "android", EligibleBuild> = {
  ios: {
    appVersion: "1.0.1",
    buildNumber: 11,
    presentation: "ios_custom_sound",
  },
  android: {
    appVersion: "1.0.1",
    buildNumber: 12,
    presentation: "android_custom_channel",
  },
};

const APP_VERSION_PATTERN = /^\d+\.\d+\.\d+$/;
const BUILD_NUMBER_PATTERN = /^(0|[1-9]\d*)$/;
const SURF_ALERT_NOTIFICATION_TYPES = new Set([
  "forecast_alert",
  "similarity_match",
  "swell_watch",
  "weekend_window",
]);

function legacyDecision(
  platform: NotificationPresentationCompatibilityDecision["platform"],
  reason: Exclude<
    NotificationPresentationCompatibilityReason,
    "eligible" | "ordinary_notification"
  >,
): NotificationPresentationCompatibilityDecision {
  return {
    eligible: false,
    outcome: "legacy_default",
    reason,
    platform,
    presentation: "legacy_default",
  };
}

export function resolveNotificationPresentationCompatibility({
  platform,
  appVersion,
  buildNumber,
  notificationType,
}: NotificationPresentationCompatibilityInput): NotificationPresentationCompatibilityDecision {
  const normalizedPlatform =
    platform === "ios" || platform === "android" ? platform : "unknown";

  if (!SURF_ALERT_NOTIFICATION_TYPES.has(notificationType)) {
    return {
      eligible: false,
      outcome: "ordinary_default",
      reason: "ordinary_notification",
      platform: normalizedPlatform,
      presentation: "legacy_default",
    };
  }

  if (
    typeof platform !== "string" ||
    platform.trim().length === 0 ||
    typeof appVersion !== "string" ||
    appVersion.trim().length === 0 ||
    typeof buildNumber !== "string" ||
    buildNumber.trim().length === 0
  ) {
    return legacyDecision(normalizedPlatform, "missing_metadata");
  }

  if (normalizedPlatform === "unknown") {
    return legacyDecision(normalizedPlatform, "unknown_platform");
  }

  if (
    !APP_VERSION_PATTERN.test(appVersion) ||
    !BUILD_NUMBER_PATTERN.test(buildNumber)
  ) {
    return legacyDecision(normalizedPlatform, "malformed_metadata");
  }

  const eligibleBuild = ELIGIBLE_BUILDS[normalizedPlatform];
  const numericBuildNumber = Number(buildNumber);

  if (
    appVersion === eligibleBuild.appVersion &&
    numericBuildNumber === eligibleBuild.buildNumber
  ) {
    return {
      eligible: true,
      outcome: "eligible_custom",
      reason: "eligible",
      platform: normalizedPlatform,
      presentation: eligibleBuild.presentation,
    };
  }

  if (
    appVersion === eligibleBuild.appVersion &&
    numericBuildNumber < eligibleBuild.buildNumber
  ) {
    return legacyDecision(normalizedPlatform, "old_build");
  }

  return legacyDecision(normalizedPlatform, "unknown_build");
}
