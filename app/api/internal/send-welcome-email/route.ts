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
  withAuth,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import type { AuthenticatedContext } from "@/lib/middleware/api-wrappers/types";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail, MAIL_FROM, MAIL_REPLY_TO, getBaseUrl } from "@/lib/mailer/client";
import { generateWelcomeEmail } from "@/lib/mailer/welcome-email";
import { createEmailLogger } from "@/lib/services/email-logging-service";
import { generateEmailUnsubscribeToken } from "@/lib/alerts/email-token";

export const runtime = "nodejs";

const CONTEXT_TAG = "[send-welcome-email]";
const EMAIL_TYPE = "welcome" as const;

// Auth accepts both paths on purpose. Web calls this from the SSR cookie
// session right after signup; native calls it from `useFinalizeOnboarding`
// with a Bearer token once the home beach is committed. Before that, native
// signups received no welcome email at all — the cron backstop only covers
// unconfirmed-24h and no-home-beach-48h, so a user who onboarded cleanly on
// iOS fell through every case.
async function handler(request: NextRequest, { user }: AuthenticatedContext) {
  try {
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

    // Immediate-signup path may race the profile insert, so tolerate a null read.
    let homeBeachName: string | null = null;
    let homeBeachSlug: string | null = null;
    const { data: profile } = await serviceSupabase
      .from("profiles")
      .select("home_beach_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.home_beach_id) {
      const { data: beach } = await serviceSupabase
        .from("beaches")
        .select("name, slug")
        .eq("id", profile.home_beach_id)
        .maybeSingle();
      if (beach?.name && beach?.slug) {
        homeBeachName = beach.name;
        homeBeachSlug = beach.slug;
      }
    }

    const messageInstanceId = crypto.randomUUID();
    const { subject, react, text } = await generateWelcomeEmail({
      baseUrl,
      homeBeachName,
      homeBeachSlug,
      messageInstanceId,
    });

    const unsubscribeToken = generateEmailUnsubscribeToken(user.id);
    const unsubscribeUrl =
      `${baseUrl}/api/alerts/unsubscribe-email?user_id=${user.id}` +
      `&token=${unsubscribeToken}`;

    const { data: sendData, error: sendError } = await sendEmail({
      from: MAIL_FROM,
      replyTo: MAIL_REPLY_TO,
      to: userEmail,
      subject,
      react,
      text,
      unsubscribeUrl,
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
      resendMessageId: sendData?.id,
      localDate: today,
      meta: {
        trigger: "immediate_signup",
        message_instance_id: messageInstanceId,
      },
    });

    console.log(`${CONTEXT_TAG} Sent welcome email to ${user.id}`);
    return createSuccessResponse({ sent: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Apply rate limiting: authenticated users only, generous limits
export const POST = withRateLimit(withAuth(handler), "authenticated-default");
