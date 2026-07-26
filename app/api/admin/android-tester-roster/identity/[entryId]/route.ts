import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { recordMandatoryRosterAudit } from "@/lib/android-tester-roster/admin-audit";
import {
  decryptTesterIdentity,
  type TesterIdentityEnvelope,
} from "@/lib/android-tester-roster/crypto";
import { loadTesterIdentityKey } from "@/lib/android-tester-roster/keys";
import { withAdminAuth } from "@/lib/middleware/api-wrappers";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

interface IdentityRow {
  key_version: number;
  iv: string;
  ciphertext: string;
  auth_tag: string;
}

export const GET = withAdminAuth(
  async (request: NextRequest, { user, supabase, params }) => {
    void request;
    const parsedEntryId = z.string().uuid().safeParse(params.entryId);
    if (!parsedEntryId.success) {
      return NextResponse.json(
        { error: "invalid_entry_id" },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const audited = await recordMandatoryRosterAudit(supabase as any, {
      actorUserId: user.id,
      entryId: parsedEntryId.data,
      action: "reveal_identity",
    });
    if (!audited) {
      return NextResponse.json(
        { error: "roster_audit_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }

    const { data, error } = await (supabase as any)
      .from("android_tester_roster_identities")
      .select("key_version, iv, ciphertext, auth_tag")
      .eq("entry_id", parsedEntryId.data)
      .maybeSingle();
    if (error) {
      return NextResponse.json(
        { error: "roster_identity_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
    if (!data) {
      return NextResponse.json(
        { error: "roster_identity_not_found" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    try {
      const row = data as IdentityRow;
      const envelope: TesterIdentityEnvelope = {
        keyVersion: row.key_version,
        iv: row.iv,
        ciphertext: row.ciphertext,
        authTag: row.auth_tag,
      };
      return NextResponse.json(
        {
          entryId: parsedEntryId.data,
          identity: decryptTesterIdentity(
            envelope,
            loadTesterIdentityKey(row.key_version),
          ),
        },
        { headers: NO_STORE_HEADERS },
      );
    } catch {
      return NextResponse.json(
        { error: "roster_identity_unavailable" },
        { status: 503, headers: NO_STORE_HEADERS },
      );
    }
  },
  { errorMessage: "Android tester roster identity reveal failed" },
);
