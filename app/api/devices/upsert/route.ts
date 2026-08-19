/**
 * Device Token Management API
 * Handles registration and removal of FCM device tokens.
 *
 * Accepts both cookie-based SSR auth (web) and Authorization: Bearer <jwt>
 * (native clients) via withAuth — the previous createSupabaseServerClient()
 * path only read cookies, causing all native device registrations to 401.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";

function normalizeOptionalMetadata(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeIanaTimezone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const timezone = value.trim();
  if (timezone.length === 0 || timezone.length > 100) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

/**
 * POST /api/devices/upsert
 * Register or update a device token for push notifications
 */
export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  const body = await request.json();
  const {
    platform,
    device_token,
    installation_id,
    app_version,
    build_number,
    os_version,
    expo_sdk,
    timezone,
    expo_update_id,
    expo_channel,
    expo_runtime_version,
    expo_is_embedded_launch,
    expo_is_emergency_launch,
  } = body;

  if (installation_id !== undefined &&
      (typeof installation_id !== "string" || installation_id.trim().length === 0 || installation_id.length > 200)) {
    return NextResponse.json({ success: false, error: "installation_id must be a non-empty string" }, { status: 400 });
  }

  if (!platform || !device_token) {
    return NextResponse.json(
      {
        success: false,
        error: "Platform and device_token are required",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  if (device_token.length > 512) {
    return NextResponse.json(
      {
        success: false,
        error: "Device token exceeds maximum length of 512 characters",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  if (device_token.trim().length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: "Device token cannot be empty",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  if (!["ios", "android", "web"].includes(platform)) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid platform. Must be "ios", "android", or "web"',
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  // Optional device metadata is bounded to keep dashboard/log payloads small.
  // Bad values fail loudly rather than silently truncating.
  for (const [field, value, maxLength] of [
    ["app_version", app_version, 32],
    ["build_number", build_number, 32],
    ["os_version", os_version, 32],
    ["expo_sdk", expo_sdk, 32],
    ["expo_update_id", expo_update_id, 64],
    ["expo_channel", expo_channel, 64],
    ["expo_runtime_version", expo_runtime_version, 64],
  ] as const) {
    if (value !== undefined && value !== null) {
      if (typeof value !== "string") {
        return NextResponse.json(
          {
            success: false,
            error: `${field} must be a string`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
      const normalizedValue = value.trim();
      if (normalizedValue.length === 0) continue;
      if (normalizedValue.length > maxLength) {
        return NextResponse.json(
          {
            success: false,
            error: `${field} exceeds maximum length of ${maxLength} characters`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
    }
  }

  for (const [field, value] of [
    ["expo_is_embedded_launch", expo_is_embedded_launch],
    ["expo_is_emergency_launch", expo_is_emergency_launch],
  ] as const) {
    if (value !== undefined && value !== null && typeof value !== "boolean") {
      return NextResponse.json(
        {
          success: false,
          error: `${field} must be a boolean`,
          timestamp: new Date().toISOString(),
        },
        { status: 400 }
      );
    }
  }

  const normalizedTimezone =
    timezone === undefined || timezone === null
      ? null
      : normalizeIanaTimezone(timezone);
  if (timezone !== undefined && timezone !== null && !normalizedTimezone) {
    return NextResponse.json(
      {
        success: false,
        error: "timezone must be a valid IANA timezone string",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const upsertRow: Record<string, unknown> = {
    user_id: user.id,
    platform,
    device_token,
    updated_at: new Date().toISOString(),
  };
  const normalizedAppVersion = normalizeOptionalMetadata(app_version);
  const normalizedBuildNumber = normalizeOptionalMetadata(build_number);
  const normalizedOsVersion = normalizeOptionalMetadata(os_version);
  const normalizedExpoSdk = normalizeOptionalMetadata(expo_sdk);
  if (normalizedAppVersion) upsertRow.app_version = normalizedAppVersion;
  if (normalizedBuildNumber) upsertRow.build_number = normalizedBuildNumber;
  if (normalizedOsVersion) upsertRow.os_version = normalizedOsVersion;
  if (normalizedExpoSdk) upsertRow.expo_sdk = normalizedExpoSdk;
  if (normalizedTimezone) upsertRow.timezone = normalizedTimezone;

  for (const [field, value] of [
    ["expo_update_id", expo_update_id],
    ["expo_channel", expo_channel],
    ["expo_runtime_version", expo_runtime_version],
  ] as const) {
    if (value === null) {
      upsertRow[field] = null;
      continue;
    }

    const normalizedValue = normalizeOptionalMetadata(value);
    if (normalizedValue) upsertRow[field] = normalizedValue;
  }

  for (const [field, value] of [
    ["expo_is_embedded_launch", expo_is_embedded_launch],
    ["expo_is_emergency_launch", expo_is_emergency_launch],
  ] as const) {
    if (value !== undefined) upsertRow[field] = value;
  }

  let upsertError: { message: string } | null = null;
  if (typeof installation_id === "string" && installation_id.trim()) {
    const rpcClient = supabase as unknown as {
      rpc(name: "register_device_installation", args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
    const result = await rpcClient.rpc("register_device_installation", {
      p_user_id: user.id,
      p_installation_id: installation_id.trim(),
      p_platform: platform,
      p_device_token: device_token,
      p_metadata: Object.fromEntries(Object.entries(upsertRow).filter(([key]) => key !== "user_id" && key !== "platform" && key !== "device_token")),
    });
    upsertError = result.error;
  } else {
    const rpcClient = supabase as unknown as {
      rpc(name: "register_legacy_device_token", args: Record<string, unknown>): Promise<{ error: { message: string } | null }>;
    };
    const result = await rpcClient.rpc("register_legacy_device_token", {
      p_user_id: user.id,
      p_platform: platform,
      p_device_token: device_token,
      p_metadata: Object.fromEntries(Object.entries(upsertRow).filter(([key]) => key !== "user_id" && key !== "platform" && key !== "device_token")),
    });
    upsertError = result.error;
  }

  if (upsertError) {
    console.error("Device token upsert failed:", upsertError);
    throw upsertError;
  }

  const { error: pushPrefError } = await supabase
    .from("profiles")
    .update({ notif_push_enabled: true })
    .eq("id", user.id);

  if (pushPrefError) {
    console.warn("Push preference repair failed:", pushPrefError);
  }

  if (normalizedTimezone) {
    const { error: profileTimezoneError } = await supabase
      .from("profiles")
      .update({ timezone: normalizedTimezone })
      .eq("id", user.id)
      .is("timezone", null);

    if (profileTimezoneError) {
      console.warn("Profile timezone repair failed:", profileTimezoneError);
    }
  }

  return createSuccessResponse({
    message: "Device registered successfully",
    platform,
  });
}, { errorMessage: "Failed to register device" });

/**
 * DELETE /api/devices/upsert
 * Remove a device token (e.g., on logout or token refresh)
 */
export const DELETE = withAuth(async (request: NextRequest, { user, supabase }) => {
  const body = await request.json();
  const { device_token, installation_id } = body;

  if (installation_id != null &&
      (typeof installation_id !== "string" || installation_id.trim().length === 0 || installation_id.length > 200)) {
    return NextResponse.json({ success: false, error: "installation_id must be a non-empty string" }, { status: 400 });
  }

  if (!device_token && !installation_id) {
    return NextResponse.json(
      {
        success: false,
        error: "device_token is required",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const query = supabase
    .from("user_devices")
    .update({
      retired_at: new Date().toISOString(),
      retired_reason: "logout",
    } as never)
    .eq("user_id", user.id);
  const scopedQuery = installation_id
    ? query.eq("installation_id" as never, installation_id)
    : query.eq("device_token", device_token);
  const { error: deleteError } = await scopedQuery.is("retired_at" as never, null);

  if (deleteError) {
    console.error("Device token deletion failed:", deleteError);
    throw deleteError;
  }

  return createSuccessResponse({ message: "Device removed successfully" });
}, { errorMessage: "Failed to remove device" });
