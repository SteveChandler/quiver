type NativePlatform = "ios" | "android";

interface NativeMinimumVersion {
  platform: NativePlatform;
  minimum_version: string | null;
  minimum_bundle_created_at: string | null;
}

const VERSION_PATTERN = /^\d+(\.\d+){0,3}$/;
// Date.parse alone accepts "2026" or "Nov 12 2026"; require an ISO 8601 shape with a zone
// so the value never depends on the server's local time zone.
const ISO_DATE_TIME_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;

const ENV_SUFFIX: Record<NativePlatform, string> = {
  ios: "IOS",
  android: "ANDROID",
};

export function parseNativePlatform(value: string | null): NativePlatform | null {
  if (value === "ios" || value === "android") return value;
  return null;
}

function readEnv(name: string): string | null {
  const raw = process.env[name];
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  return trimmed === "" ? null : trimmed;
}

function warnInvalid(name: string): void {
  // The value is not logged: env values must not reach logs.
  console.warn(`[minimum-version] ${name} is invalid; ignoring it`);
}

function parseMinimumVersion(name: string): string | null {
  const value = readEnv(name);
  if (value === null) return null;
  if (!VERSION_PATTERN.test(value)) {
    warnInvalid(name);
    return null;
  }
  return value;
}

function parseMinimumBundleCreatedAt(name: string): string | null {
  const value = readEnv(name);
  if (value === null) return null;
  if (!ISO_DATE_TIME_PATTERN.test(value)) {
    warnInvalid(name);
    return null;
  }
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) {
    warnInvalid(name);
    return null;
  }
  return new Date(ms).toISOString();
}

export function resolveNativeMinimumVersion(platform: NativePlatform): NativeMinimumVersion {
  const suffix = ENV_SUFFIX[platform];
  return {
    platform,
    minimum_version: parseMinimumVersion(`NATIVE_MIN_APP_VERSION_${suffix}`),
    minimum_bundle_created_at: parseMinimumBundleCreatedAt(
      `NATIVE_MIN_BUNDLE_CREATED_AT_${suffix}`,
    ),
  };
}
