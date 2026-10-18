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

  const partNumber = link.device_part_number ?? "";
  const mappedName = deviceNameForPartNumber(partNumber);
  const deviceName = mappedName === "Garmin watch" ? partNumber || mappedName : mappedName;
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

  const { data: confirmed, error: confirmError } = await service.from("watch_link_codes")
    .update({ user_id: user.id, device_id: device.id, confirmed_at: new Date().toISOString() })
    .eq("id", link.id).is("confirmed_at", null).select("id").maybeSingle();
  if (confirmError) throw confirmError;
  if (!confirmed) return createErrorResponse("already_confirmed", undefined, 409);

  try {
    const { error: eventError } = await service.from("user_events").insert({
      user_id: user.id,
      event_type: "garmin_link_confirmed",
      metadata: { device_id: device.id, device_name: deviceName },
    });
    if (eventError) console.warn("[garmin link] Confirmation event failed:", eventError);
  } catch (eventFailure) {
    console.warn("[garmin link] Confirmation event failed:", eventFailure);
  }
  return createSuccessResponse({ linked: true, deviceName });
}, { errorMessage: "Failed to confirm watch link code" }), "watch-link-confirm"));
