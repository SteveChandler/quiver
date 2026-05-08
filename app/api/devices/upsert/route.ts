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
  const { platform, device_token, app_version, os_version, expo_sdk, timezone } = body;

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

  // Phase 5l: optional device metadata. Each capped at 32 chars to keep
  // dashboard/log payloads small. Bad values fail loudly rather than silently
  // truncating.
  for (const [field, value] of [
    ["app_version", app_version],
    ["os_version", os_version],
    ["expo_sdk", expo_sdk],
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
      if (value.length > 32) {
        return NextResponse.json(
          {
            success: false,
            error: `${field} exceeds maximum length of 32 characters`,
            timestamp: new Date().toISOString(),
          },
          { status: 400 }
        );
      }
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
  if (app_version !== undefined) upsertRow.app_version = app_version ?? null;
  if (os_version !== undefined) upsertRow.os_version = os_version ?? null;
  if (expo_sdk !== undefined) upsertRow.expo_sdk = expo_sdk ?? null;
  if (normalizedTimezone) upsertRow.timezone = normalizedTimezone;

  const { error: upsertError } = await supabase
    .from("user_devices")
    .upsert(upsertRow as never, {
      onConflict: "user_id,device_token",
    });

  if (upsertError) {
    console.error("Device token upsert failed:", upsertError);
    throw upsertError;
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
  const { device_token } = body;

  if (!device_token) {
    return NextResponse.json(
      {
        success: false,
        error: "device_token is required",
        timestamp: new Date().toISOString(),
      },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("user_devices")
    .delete()
    .eq("user_id", user.id)
    .eq("device_token", device_token);

  if (deleteError) {
    console.error("Device token deletion failed:", deleteError);
    throw deleteError;
  }

  return createSuccessResponse({ message: "Device removed successfully" });
}, { errorMessage: "Failed to remove device" });
