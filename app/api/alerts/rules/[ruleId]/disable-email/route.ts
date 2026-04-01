import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { verifyDisableToken } from "@/lib/alerts/email-token";

/**
 * POST /api/alerts/rules/[ruleId]/disable-email
 *
 * One-click email disable from email links. Uses service role because the
 * user is not authenticated when clicking from an email.
 * Requires a valid HMAC token in the query string to prevent unauthorized access.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
): Promise<NextResponse> {
  const { ruleId } = await params;
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token || !verifyDisableToken(ruleId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 403 });
  }

  const supabase = await createSupabaseServiceRoleClient();

  const { error } = await (supabase as any)
    .from("alert_rules")
    .update({ notify_email: false })
    .eq("id", ruleId);

  if (error) {
    return NextResponse.json({ error: "Failed to disable" }, { status: 500 });
  }

  return NextResponse.redirect(
    new URL(
      "/settings/notifications?alert_disabled=true",
      process.env.NEXT_PUBLIC_APP_URL || "https://quiversurf.app"
    )
  );
}
