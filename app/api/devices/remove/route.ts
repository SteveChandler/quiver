/**
 * POST /api/devices/remove
 * Native compatibility route — called by unregisterPushNotifications() on sign-out.
 *
 * The native client sends only `{ platform }` (no token), so this removes all
 * user_devices rows for the given user_id + platform. Privacy on sign-out takes
 * priority over preserving same-account pushes on another device of the same
 * platform; the user can re-register on next launch.
 *
 * When a `device_token` is provided, the deletion is scoped to that exact token.
 */

import type { NextRequest } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  withAuth,
} from "@/lib/middleware/api-wrappers";

const VALID_PLATFORMS = ["ios", "android", "web"] as const;

type DevicePlatform = (typeof VALID_PLATFORMS)[number];

interface RemoveDeviceRequestBody {
  platform?: unknown;
  device_token?: unknown;
  installation_id?: unknown;
}

function isValidPlatform(value: unknown): value is DevicePlatform {
  return typeof value === "string" && VALID_PLATFORMS.includes(value as DevicePlatform);
}

async function parseRemoveDeviceRequestBody(
  request: NextRequest,
): Promise<RemoveDeviceRequestBody> {
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {};
    }

    return body as RemoveDeviceRequestBody;
  } catch {
    return {};
  }
}

export const POST = withAuth(async (request: NextRequest, { user, supabase }) => {
  const body = await parseRemoveDeviceRequestBody(request);
  const { platform, device_token, installation_id } = body;

  if (!platform) {
    return createErrorResponse("platform is required", undefined, 400);
  }

  if (!isValidPlatform(platform)) {
    return createErrorResponse(
      'Invalid platform. Must be "ios", "android", or "web"',
      undefined,
      400,
    );
  }

  if (device_token != null && typeof device_token !== "string") {
    return createErrorResponse("device_token must be a string", undefined, 400);
  }
  if (
    installation_id != null &&
    (typeof installation_id !== "string" ||
      installation_id.trim().length === 0 ||
      installation_id.length > 200)
  ) {
    return createErrorResponse(
      "installation_id must be a non-empty string",
      undefined,
      400,
    );
  }

  if (installation_id != null) {
    const { error } = await supabase
      .from("user_devices")
      .update({ retired_at: new Date().toISOString(), retired_reason: "logout" } as never)
      .eq("user_id", user.id)
      .eq("installation_id" as never, installation_id)
      .is("retired_at" as never, null);
    if (error) throw error;
  } else if (device_token != null) {
    // Token-scoped removal
    const { error } = await supabase
      .from("user_devices")
      .update({ retired_at: new Date().toISOString(), retired_reason: "logout" } as never)
      .eq("user_id", user.id)
      .eq("platform", platform)
      .eq("device_token", device_token)
      .is("retired_at" as never, null);

    if (error) {
      console.error("Device token removal failed:", error);
      throw error;
    }
  } else {
    // Platform-scoped retirement (legacy sign-out path — exact installation is
    // unknowable, so do not claim the legacy physical invariant is solved).
    const { error } = await supabase
      .from("user_devices")
      .update({ retired_at: new Date().toISOString(), retired_reason: "logout_platform_legacy" } as never)
      .eq("user_id", user.id)
      .eq("platform", platform)
      .is("retired_at" as never, null);

    if (error) {
      console.error("Device platform removal failed:", error);
      throw error;
    }
  }

  return createSuccessResponse({ message: "Device removed successfully", platform });
}, { errorMessage: "Failed to remove device" });
