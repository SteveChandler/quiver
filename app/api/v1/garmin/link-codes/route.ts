import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { createErrorResponse, createSuccessResponse } from "@/lib/api-utils";
import { isGarminWatchEnabled } from "@/lib/flags/garmin-watch";
import { withErrorHandler, withNoStore, withRateLimit } from "@/lib/middleware/api-wrappers";
import { createServiceRoleClient } from "@/lib/supabase";
import { generateSecret, hashSecret } from "@/lib/watch/device-token";

export const runtime = "nodejs";
const schema = z.object({
  deviceUid: z.string().min(1).max(64),
  partNumber: z.string().min(1).max(32),
  appVersion: z.string().min(1).max(16),
});

export const POST = withNoStore(withErrorHandler(withRateLimit(async (request) => {
  if (!isGarminWatchEnabled()) return createErrorResponse("not_found", undefined, 404);
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return createErrorResponse("invalid_request", undefined, 400);

  const service = createServiceRoleClient();
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 10 * 60_000).toISOString();
    const { error: cleanupError } = await service.from("watch_link_codes").delete()
      .eq("code", code).is("confirmed_at", null).lt("expires_at", now.toISOString());
    if (cleanupError) throw cleanupError;

    const linkId = randomUUID();
    const pollSecret = generateSecret();
    const { error } = await service.from("watch_link_codes").insert({
      id: linkId,
      code,
      poll_secret_hash: hashSecret(pollSecret),
      device_uid: parsed.data.deviceUid,
      device_part_number: parsed.data.partNumber,
      app_version: parsed.data.appVersion,
      expires_at: expiresAt,
    });
    if (!error) return createSuccessResponse({ code, linkId, pollSecret, expiresAt }, 201);
    if (error.code !== "23505") throw error;
  }
  throw new Error("Failed to allocate watch link code");
}, "watch-link-code"), { errorMessage: "Failed to create watch link code" }));
