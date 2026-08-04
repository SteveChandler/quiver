import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { verifyEmailUnsubscribeToken } from "@/lib/alerts/email-token";
import { getBaseUrl } from "@/lib/mailer/client";
import { renderEmailActionPage } from "@/lib/email/html-response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/alerts/unsubscribe-email
 *
 * Public one-click email unsubscribe from alert emails. The HMAC token is
 * scoped to the user id, so the user does not need an authenticated web session.
 */
export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const userId = url.searchParams.get("user_id");
  const token = url.searchParams.get("token");
  const emailType = url.searchParams.get("email_type");
  const baseUrl = getBaseUrl();

  if (!userId || !token || !verifyEmailUnsubscribeToken(userId, token)) {
    return renderEmailActionPage({
      title: "Invalid Link",
      message: "This unsubscribe link is invalid or expired.",
      isError: true,
      buttonUrl: baseUrl,
    });
  }

  const supabase = await createSupabaseServiceRoleClient();
  const updates =
    emailType === "session_prompt"
      ? { notif_session_prompt_email: false }
      : { notif_email_enabled: false };
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    return renderEmailActionPage({
      title: "Could Not Unsubscribe",
      message: "We could not update your email settings. Please try again from Quiver.",
      isError: true,
      buttonUrl: baseUrl,
    });
  }

  return renderEmailActionPage({
    title: emailType === "session_prompt" ? "Session Prompt Emails Off" : "Email Notifications Off",
    message:
      emailType === "session_prompt"
        ? "Quiver will stop sending this type of email to this account."
        : "Quiver will stop sending email notifications to this account.",
    buttonText: "Manage Alerts",
    buttonUrl: `${baseUrl}/settings`,
  });
}
