import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { recordMandatoryRosterAudit } from "@/lib/android-tester-roster/admin-audit";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};
const PlayEvidenceSchema = z
  .object({
    entryId: z.string().uuid(),
    status: z.enum(["observed", "not_observed"]),
    observedAt: z.string().datetime({ offset: true }),
    evidenceCode: z.literal("play_console_membership_review"),
    evidenceReferenceId: z.string().uuid(),
  })
  .strict();

export const POST = withAdminAuth(
  async (request: NextRequest, { user, supabase }) => {
    const parsed = PlayEvidenceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json(
        { error: "invalid_play_evidence" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const audited = await recordMandatoryRosterAudit(supabase as any, {
      actorUserId: user.id,
      entryId: parsed.data.entryId,
      action: "record_play_evidence",
    });
    if (!audited) {
      return NextResponse.json(
        { error: "roster_audit_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const { data, error } = await (supabase as any).rpc(
      "record_android_tester_roster_stage",
      {
        p_actor_user_id: user.id,
        p_entry_id: parsed.data.entryId,
        p_stage: "play_opt_in",
        p_status: parsed.data.status,
        p_source: "manual_google_play_console",
        p_observed_at: parsed.data.observedAt,
        p_confidence: "manual",
        p_evidence: {
          code: parsed.data.evidenceCode,
          referenceId: parsed.data.evidenceReferenceId,
        },
      },
    );
    if (error) {
      return NextResponse.json(
        { error: "play_evidence_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    return NextResponse.json(
      { success: true, stageId: data },
      { headers: NO_STORE_HEADERS },
    );
  },
  { errorMessage: "Android tester Play evidence failed" },
);
