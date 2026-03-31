import { NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

/**
 * POST /api/alerts/rules/[ruleId]/disable-email
 *
 * One-click email disable from email links. Uses service role because the
 * user is not authenticated when clicking from an email.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ ruleId: string }> }
): Promise<NextResponse> {
  const { ruleId } = await params;
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
