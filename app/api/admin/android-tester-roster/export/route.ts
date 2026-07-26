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
      action: "export_non_pii",
    });
    if (!audited) {
      return NextResponse.json(
        { error: "roster_audit_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const { data, error } = await (supabase as any).rpc(
      "export_android_tester_roster_non_pii",
    );
    if (error) {
      return NextResponse.json(
        { error: "roster_export_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { rows: data ?? [] },
      { headers: NO_STORE_HEADERS },
    );
  },
  { errorMessage: "Android tester roster export failed" },
);
