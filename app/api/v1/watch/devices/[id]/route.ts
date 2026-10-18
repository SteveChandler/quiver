import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isGarminWatchUserAllowed } from "@/lib/flags/garmin-watch";
import { withAuth, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";

export const runtime = "nodejs";

export const DELETE = withNoStore(withRateLimit(withAuth(async (_request, { user, supabase, params }) => {
  if (!isGarminWatchUserAllowed(user.id) || !z.uuid().safeParse(params.id).success) {
    return createErrorResponse("not_found", undefined, 404);
  }
  const { data: device, error } = await supabase.from("watch_devices")
    .select("id, user_id, revoked_at").eq("id", params.id).eq("user_id", user.id).maybeSingle();
  if (error) throw error;
  if (!device || device.user_id !== user.id || device.revoked_at) {
    return createErrorResponse("not_found", undefined, 404);
  }

  const service = createServiceRoleClient();
  const { error: updateError } = await service.from("watch_devices")
    .update({ revoked_at: new Date().toISOString(), token_hash: null })
    .eq("id", device.id).eq("user_id", user.id).is("revoked_at", null);
  if (updateError) throw updateError;
  const { error: eventError } = await service.from("user_events").insert({
    user_id: user.id, event_type: "garmin_watch_unlinked", metadata: { device_id: device.id },
  });
  if (eventError) console.warn("[garmin watch] Unlink event failed:", eventError);
  return createSuccessResponse({ unlinked: true });
}, { errorMessage: "Failed to unlink watch device" }), "authenticated-default"));
