import { NextResponse, type NextRequest } from "next/server";

import { recordMandatoryRosterAudit } from "@/lib/android-tester-roster/admin-audit";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export const GET = withAdminAuth(
  async (request: NextRequest, { user, supabase }) => {
    void request;
    const audited = await recordMandatoryRosterAudit(supabase as any, {
      actorUserId: user.id,
      action: "read_summary",
    });
    if (!audited) {
      return NextResponse.json(
        { error: "roster_audit_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const { data, error } = await (supabase as any).rpc(
      "get_android_tester_roster_summary",
    );
    if (error) {
      return NextResponse.json(
        { error: "roster_summary_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { summary: data ?? {} },
      { headers: NO_STORE_HEADERS },
    );
  },
  { errorMessage: "Android tester roster summary failed" },
);
