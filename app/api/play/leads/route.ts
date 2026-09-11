import { NextResponse, type NextRequest } from "next/server";

import { BREAKS } from "@/lib/play";
import { withAuth, withBotBlockingAndRateLimit, withErrorHandler, type OptionalAuthContext } from "@/lib/middleware/api-wrappers";
import { sendPlayOutsideEmail } from "@/lib/mailer/play-outside";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { PlayLeadSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export const POST = withErrorHandler(
  withBotBlockingAndRateLimit(
    withAuth(
      async (request: NextRequest, { user }: OptionalAuthContext) => {
        const parsed = PlayLeadSchema.safeParse(await request.json().catch(() => ({})));
        if (!parsed.success) {
          const field = parsed.error.issues[0]?.path[0];
          return NextResponse.json({ success: false, error: field === "email" ? "invalid_email" : field === "consent" ? "consent_required" : "invalid_input" });
        }

        const { email, phone, breakSlug, breakName, heatTotal, challengeCode, sessionId } = parsed.data;
        if (phone && !email && process.env.PLAY_SMS_ENABLED !== "true") {
          return NextResponse.json({ success: false, error: "sms_unavailable" });
        }

        const supabase = await createSupabaseServiceRoleClient();
        const { error: saveError } = await (supabase as any).from("play_leads").upsert(
          {
            ...(email ? { email } : { phone }),
            consent_marketing: true,
            consented_at: new Date().toISOString(),
            break_slug: breakSlug,
            heat_total: heatTotal,
            challenge_code: challengeCode,
            ...(sessionId ? { session_id: sessionId } : {}),
          },
          { onConflict: email ? "email" : "phone" },
        );
        if (saveError) return NextResponse.json({ success: false, error: "save_failed" });

        if (!user && sessionId) {
          const { error: eventError } = await (supabase as any).from("user_events").insert({
            session_id: sessionId,
            event_type: "play_lead_captured",
            metadata: {
              cta_family: "play_outside",
              break_slug: breakSlug,
              heat_total: heatTotal,
              destination_type: "lead_capture",
              destination_status: email ? "email_captured" : "phone_captured",
            },
          });
          if (eventError) console.warn("play/leads: failed to record lead event:", eventError);
        }

        if (!email) return NextResponse.json({ success: true, emailSent: false });

        const claimedAt = new Date().toISOString();
        const { data: emailClaim, error: claimError } = await (supabase as any)
          .from("play_leads")
          .update({ forecast_email_sent_at: claimedAt })
          .eq("email", email)
          .is("forecast_email_sent_at", null)
          .select("email")
          .maybeSingle();
        if (claimError) return NextResponse.json({ success: false, error: "save_failed" });
        if (!emailClaim) return NextResponse.json({ success: true, emailSent: false });

        const breakUrl = BREAKS.find((definition) => definition.beachSlug === breakSlug)?.beachPath ?? "/beaches";
        const emailResult = await sendPlayOutsideEmail({ email, breakName, heatTotal, breakUrl });
        if (!emailResult.success) console.warn("play/leads: failed to send forecast email:", emailResult.error);
        return NextResponse.json({ success: true, emailSent: emailResult.success });
      },
      { optional: true },
    ),
    { key: "public-default" },
  ),
  { errorMessage: "Failed to capture OUTSIDE lead" },
);
