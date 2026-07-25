import { NextResponse, type NextRequest } from "next/server";

import {
  withBotBlockingAndRateLimit,
  withErrorHandler,
} from "@/lib/middleware/api-wrappers";
import { sendAndroidBetaInstructionsEmail } from "@/lib/mailer/android-beta";
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

      const { email, source, surface, placement, sessionId } = parsed.data;
      const leadPayload: {
        email: string;
        source: string;
        surface: string;
        placement: string;
        session_id?: string;
      } = {
        email,
        source,
        surface,
        placement,
      };

      if (sessionId) {
        leadPayload.session_id = sessionId;
      }

      const supabase = await createSupabaseServiceRoleClient();
      const { error } = await (supabase as any)
        .from("android_beta_leads")
        .upsert(leadPayload, { onConflict: "email" });

      if (error) {
        return NextResponse.json({ success: false, error: "save_failed" });
      }

      if (sessionId) {
        const emailDomain = email.split("@")[1] ?? "unknown";
        const { error: eventError } = await (supabase as any)
          .from("user_events")
          .insert({
            session_id: sessionId,
            event_type: "android_lead_captured",
            metadata: {
              cta_family: "android_waitlist",
              platform: "android",
              destination_type: "lead_capture",
              destination_status: "email_captured",
              email_domain: emailDomain,
              source,
              surface,
              placement,
            },
          });

        if (eventError) {
          console.warn(
            "android-beta/leads: failed to record android_lead_captured event:",
            eventError,
          );
        }
      }

      let emailSent = false;
      const claimedAt = new Date().toISOString();
      const { data: emailClaim, error: claimError } = await (supabase as any)
        .from("android_beta_leads")
        .update({ instructions_sent_at: claimedAt })
        .eq("email", email)
        .is("instructions_sent_at", null)
        .select("email")
        .maybeSingle();

      if (claimError) {
        return NextResponse.json({ success: false, error: "save_failed" });
      }

      if (emailClaim) {
        const emailResult = await sendAndroidBetaInstructionsEmail(email);
        emailSent = emailResult.success;
        if (!emailResult.success) {
          const { error: resetError } = await (supabase as any)
            .from("android_beta_leads")
            .update({ instructions_sent_at: null })
            .eq("email", email)
            .eq("instructions_sent_at", claimedAt);

          if (resetError) {
            console.warn(
              "android-beta/leads: failed to reset instructions email claim:",
              resetError,
            );
          }

          console.warn(
            "android-beta/leads: failed to send beta instructions email:",
            emailResult.error,
          );
        }
      }

      return NextResponse.json({
        success: true,
        emailSent,
      });
    },
    { key: "android-beta-lead" },
  ),
  { errorMessage: "Failed to capture Android beta lead" },
);
