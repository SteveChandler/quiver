"use server";

import { z } from "zod";

import { makeAuthenticatedAction } from "@/lib/server-action-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const registerPayloadSchema = z.object({
  token: z.string().min(10, "Push token looks invalid"),
  platform: z.enum(["ios", "android", "web"]),
  appVersion: z.string().max(64).optional(),
  device: z.string().max(128).optional(),
});

export const registerPushDevice = makeAuthenticatedAction(
  async (user, _supabase, payload: z.infer<typeof registerPayloadSchema>) => {
    const data = registerPayloadSchema.parse(payload);
    const supabaseAdmin = await createSupabaseServiceRoleClient();

    const { error } = await supabaseAdmin
      .from("push_devices")
      .upsert(
        {
          user_id: user.id,
          token: data.token,
          platform: data.platform,
          app_version: data.appVersion ?? null,
          device: data.device ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "token" }
      );

    if (error) {
      throw new Error(error.message || "Failed to register device token");
    }

    return { token: data.token };
  }
);
