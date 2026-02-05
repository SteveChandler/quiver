/**
 * POST /api/internal/send-welcome-email
 *
 * Sends welcome email immediately for a newly signed-up user.
 * Called from the client-side auth flow when a new user is detected.
 *
 * Auth: Requires valid user session (user can only trigger for themselves)
 * Rate Limit: authenticated-default (120/min, 5000/hr)
 *
 * Deduplication:
 * - Checks email_send_log to avoid sending duplicate welcome emails
 * - Safe to call multiple times - will no-op if already sent
 */

import { NextRequest } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { createSupabaseServerClient, createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { resend, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { generateWelcomeEmail } from "@/lib/email/templates/welcome-email";
import { getEmailTokenSecret } from "@/lib/utils/email-token";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { withRateLimit } from "@/lib/middleware/api-wrappers/rate-limit-wrapper";

export const runtime = "nodejs";

const CONTEXT_TAG = "[send-welcome-email]";
const EMAIL_TYPE = "welcome" as const;

async function handler(request: NextRequest) {
  try {
    // Verify the user is authenticated
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return createErrorResponse("Unauthorized", "Must be authenticated", 401);
    }

    // Use service role for database operations
    const serviceSupabase = await createSupabaseServiceRoleClient();

    // Check if welcome email was already sent to this user
    // Fail closed: if we can't verify, don't send (prevents duplicates)
    const { data: existingLog, error: checkError } = await serviceSupabase
      .from("email_send_log")
      .select("id")
      .eq("user_id", user.id)
      .eq("email_type", EMAIL_TYPE)
      .limit(1)
      .maybeSingle();

    if (checkError) {
      console.error(`${CONTEXT_TAG} Error checking existing log for ${user.id}:`, checkError);
      // Fail closed - if we can't check, don't risk duplicate
      // The cron job will pick up this user as a fallback
      return createErrorResponse(
        "Service Error",
        "Unable to verify email status. Please try again.",
        503
      );
    }

    if (existingLog) {
      console.log(`${CONTEXT_TAG} Welcome email already sent to ${user.id}`);
      return createSuccessResponse({ sent: false, reason: "already_sent" });
    }

    // Get user email
    const userEmail = user.email;
    if (!userEmail) {
      return createErrorResponse("Bad Request", "User has no email", 400);
    }

    // Generate and send welcome email
    const baseUrl = getBaseUrl();
    const secret = getEmailTokenSecret();

    const { subject, html, text } = await generateWelcomeEmail(
      { userId: user.id, userEmail, baseUrl },
      secret
    );

    const { error: sendError } = await resend.emails.send({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: userEmail,
      subject,
      html,
      text,
    });

    if (sendError) {
      console.error(`${CONTEXT_TAG} Failed to send to ${user.id}:`, sendError);
      return createErrorResponse("Email Error", "Failed to send welcome email", 500);
    }

    // Log the delivery
    const emailLogger = createEmailLogger(serviceSupabase, CONTEXT_TAG);
    const today = new Date().toISOString().slice(0, 10);

    await emailLogger.logDelivery({
      userId: user.id,
      emailType: EMAIL_TYPE,
      subject,
      localDate: today,
      meta: { trigger: "immediate_signup" },
    });

    console.log(`${CONTEXT_TAG} Sent welcome email to ${user.id}`);
    return createSuccessResponse({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting: authenticated users only, generous limits
export const POST = withRateLimit(handler, "authenticated-default");
