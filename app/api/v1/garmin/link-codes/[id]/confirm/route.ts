import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";
import { deviceNameForPartNumber } from "@/lib/watch/link-codes";

export const runtime = "nodejs";

export const POST = withNoStore(withRateLimit(withAuth(async (_request, { user, params }) => {
  if (!isGarminWatchUserAllowed(user.id) || !/^\d{6}$/.test(params.id)) {
    return createErrorResponse("not_found", undefined, 404);
  }

  const service = createServiceRoleClient();
  const { data: link, error } = await service.from("watch_link_codes")
    .select("id, code, device_uid, device_part_number, app_version, expires_at, confirmed_at")
    .eq("code", params.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (!link || Date.parse(link.expires_at) <= Date.now()) {
    return createErrorResponse("not_found", undefined, 404);
  }
  if (link.confirmed_at) return createErrorResponse("already_confirmed", undefined, 409);

  const confirmedAt = new Date().toISOString();
  const { data: confirmed, error: confirmError } = await service.from("watch_link_codes")
    .update({ user_id: user.id, confirmed_at: confirmedAt }).eq("id", link.id)
    .is("confirmed_at", null).gt("expires_at", confirmedAt).select("id").maybeSingle();
  if (confirmError) throw confirmError;
  if (!confirmed) {
    const { data: current, error: currentError } = await service.from("watch_link_codes")
      .select("confirmed_at, expires_at").eq("id", link.id).maybeSingle();
    if (currentError) throw currentError;
    if (!current || Date.parse(current.expires_at) <= Date.now()) {
      return createErrorResponse("not_found", undefined, 404);
    }
    return createErrorResponse("already_confirmed", undefined, 409);
  }

  const partNumber = link.device_part_number ?? "";
  const mappedName = deviceNameForPartNumber(partNumber);
  const deviceName = mappedName === "Garmin watch" ? partNumber || mappedName : mappedName;
  let deviceId: string;
  try {
    const { data: device, error: deviceError } = await service.from("watch_devices").upsert({
      user_id: user.id,
      device_uid: link.device_uid,
      device_part_number: partNumber,
      device_name: deviceName,
      app_version: link.app_version,
      revoked_at: null,
      token_hash: null,
    }, { onConflict: "user_id,device_uid" }).select("id").single();
    if (deviceError || !device) throw deviceError ?? new Error("Failed to link watch device");
    deviceId = device.id;

    // deviceUid is client-asserted; its app-scoped, hard-to-guess value is acceptable for the tiny allowlist.
    const { error: revokeError } = await service.from("watch_devices")
      .update({ revoked_at: new Date().toISOString(), token_hash: null })
      .eq("device_uid", link.device_uid).neq("user_id", user.id).is("revoked_at", null);
    if (revokeError) throw revokeError;

    const { data: bound, error: bindError } = await service.from("watch_link_codes")
      .update({ device_id: deviceId }).eq("id", link.id).eq("user_id", user.id)
      .eq("confirmed_at", confirmedAt).select("id").maybeSingle();
    if (bindError || !bound) throw bindError ?? new Error("Failed to bind watch link code");
  } catch (deviceFailure) {
    try {
      const { error: rollbackError } = await service.from("watch_link_codes")
        .update({ confirmed_at: null, user_id: null, device_id: null }).eq("id", link.id)
        .eq("user_id", user.id).eq("confirmed_at", confirmedAt).is("claimed_at", null);
      if (rollbackError) console.warn("[garmin link] Confirmation rollback failed:", rollbackError);
    } catch (rollbackFailure) {
      console.warn("[garmin link] Confirmation rollback failed:", rollbackFailure);
    }
    throw deviceFailure;
  }

  try {
    const { error: eventError } = await service.from("user_events").insert({
      user_id: user.id,
      event_type: "garmin_link_confirmed",
      metadata: { device_id: deviceId, device_name: deviceName },
    });
    if (eventError) console.warn("[garmin link] Confirmation event failed:", eventError);
  } catch (eventFailure) {
    console.warn("[garmin link] Confirmation event failed:", eventFailure);
  }
  return createSuccessResponse({ linked: true, deviceName });
}, { errorMessage: "Failed to confirm watch link code" }), "watch-link-confirm"));
