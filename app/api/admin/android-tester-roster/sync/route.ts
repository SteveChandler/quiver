import { NextResponse, type NextRequest } from "next/server";

import { recordMandatoryRosterAudit } from "@/lib/android-tester-roster/admin-audit";
import { syncAndroidTesterRoster } from "@/lib/android-tester-roster/sync";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

export const POST = withAdminAuth(
  async (request: NextRequest, { user, supabase }) => {
    void request;
    const audited = await recordMandatoryRosterAudit(supabase as any, {
      actorUserId: user.id,
      action: "sync",
    });
    if (!audited) {
      return NextResponse.json(
        { error: "roster_audit_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    try {
      const result = await syncAndroidTesterRoster({
        actorUserId: user.id,
        supabase: supabase as any,
      });
      return NextResponse.json(
        { result },
        { headers: NO_STORE_HEADERS },
      );
    } catch {
      return NextResponse.json(
        { error: "roster_sync_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
  },
  { errorMessage: "Android tester roster sync failed" },
);
