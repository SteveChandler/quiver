import { NextResponse, type NextRequest } from "next/server";

import {
  withBotBlockingAndRateLimit,
  withErrorHandler,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { AndroidBetaLeadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withBotBlockingAndRateLimit(
    async (request: NextRequest) => {
      const json = await request.json().catch(() => ({}));
      const parsed = AndroidBetaLeadSchema.safeParse(json);

      if (!parsed.success) {
        const field = parsed.error.issues[0]?.path[0];
        return NextResponse.json({
          success: false,
          error: field === "email" ? "invalid_email" : "invalid_input",
        });
      }

      const { email, source, surface, placement } = parsed.data;

      const supabase = await createSupabaseServiceRoleClient();
      const { error } = await (supabase as any)
        .from("android_beta_leads")
        .upsert(
          {
            email,
            source,
            surface,
            placement,
          },
          { onConflict: "email" },
        );

      if (error) {
        return NextResponse.json({ success: false, error: "save_failed" });
      }

      return NextResponse.json({ success: true });
    },
    { key: "android-beta-lead" },
  ),
  { errorMessage: "Failed to capture Android beta lead" },
);
