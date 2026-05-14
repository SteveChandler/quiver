import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { verifyDisableToken } from "@/lib/alerts/email-token";
import { getBaseUrl } from "@/lib/mailer/client";
import { renderEmailActionPage } from "@/lib/email/html-response";

/**
 * GET /api/alerts/rules/[ruleId]/disable-email
 * POST /api/alerts/rules/[ruleId]/disable-email
 *
 * One-click email disable from email links. Uses service role because the
 * user is not authenticated when clicking from an email.
 * Requires a valid HMAC token in the query string to prevent unauthorized access.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
): Promise<Response> {
  return disableEmailForRule(request, params);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
): Promise<Response> {
  return disableEmailForRule(request, params);
}

async function disableEmailForRule(
  request: Request,
  params: Promise<{ ruleId: string }>
): Promise<Response> {
  const { ruleId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const baseUrl = getBaseUrl();

  if (!token || !verifyDisableToken(ruleId, token)) {
    return renderEmailActionPage({
      title: "Invalid Link",
      message: "This alert rule link is invalid or expired.",
      isError: true,
      buttonUrl: baseUrl,
    });
  }

  const supabase = await createSupabaseServiceRoleClient();

  const { error } = await (supabase as any)
    .from("alert_rules")
    .update({ notify_email: false })
    .eq("id", ruleId);

  if (error) {
    return renderEmailActionPage({
      title: "Could Not Disable Alert",
      message: "We could not update that alert rule. Please try again from Quiver.",
      isError: true,
      buttonUrl: baseUrl,
    });
  }

  return renderEmailActionPage({
    title: "Alert Email Disabled",
    message: "This rule will no longer send email alerts.",
    buttonText: "Manage Alerts",
    buttonUrl: `${baseUrl}/settings`,
  });
}
