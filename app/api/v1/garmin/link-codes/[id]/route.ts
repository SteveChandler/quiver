import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isGarminWatchEnabled } from "@/lib/flags/garmin-watch";
import { withErrorHandler, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";
import { generateSecret, hashSecret } from "@/lib/watch/device-token";

export const runtime = "nodejs";

export const GET = withNoStore(withErrorHandler(withRateLimit(async (request, context) => {
  if (!isGarminWatchEnabled()) return createErrorResponse("not_found", undefined, 404);
  const { id } = context?.params ? await context.params : { id: "" };
  if (!z.uuid().safeParse(id).success) return createErrorResponse("not_found", undefined, 404);
  const pollSecret = new URL(request.url).searchParams.get("pollSecret");
  if (!pollSecret) return createErrorResponse("not_found", undefined, 404);

  const service = createServiceRoleClient();
  const { data: link, error } = await service.from("watch_link_codes")
    .select("id, expires_at, confirmed_at, claimed_at, device_id, user_id")
    .eq("id", id).eq("poll_secret_hash", hashSecret(pollSecret)).maybeSingle();
  if (error) throw error;
  if (!link) return createErrorResponse("not_found", undefined, 404);
  if (!link.confirmed_at && Date.parse(link.expires_at) <= Date.now()) {
    return createErrorResponse("expired", undefined, 410);
  }
  if (!link.confirmed_at) return createSuccessResponse({ status: "pending" });
  if (link.claimed_at) return createSuccessResponse({ status: "claimed" });
  if (!link.device_id || !link.user_id) throw new Error("Confirmed watch link has no device");

  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await service.from("watch_link_codes")
    .update({ claimed_at: claimedAt }).eq("id", id).is("claimed_at", null).select("id").maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) return createSuccessResponse({ status: "claimed" });

  try {
    const deviceToken = generateSecret();
    const { data: device, error: tokenError } = await service.from("watch_devices")
      .update({ token_hash: hashSecret(deviceToken) }).eq("id", link.device_id)
      .eq("user_id", link.user_id).is("revoked_at", null).select("id").maybeSingle();
    if (tokenError) throw tokenError;
    if (!device) throw new Error("Watch device unavailable for claim");
    return createSuccessResponse({ status: "linked", deviceToken });
  } catch (claimFailure) {
    const { error: rollbackError } = await service.from("watch_link_codes")
      .update({ claimed_at: null }).eq("id", id).eq("claimed_at", claimedAt);
    if (rollbackError) console.warn("[garmin link] Claim rollback failed:", rollbackError);
    throw claimFailure;
  }
}, "public-default"), { errorMessage: "Failed to poll watch link code" }));
