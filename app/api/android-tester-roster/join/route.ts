import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  decryptTesterIdentity,
  type TesterIdentityEnvelope,
} from "@/lib/android-tester-roster/crypto";
import { loadTesterIdentityKey } from "@/lib/android-tester-roster/keys";
import { withAuth } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

const JoinSchema = z
  .object({
    nativeInstallId: z.string().uuid(),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  })
  .strict();

interface JoinCandidateRow {
  entry_id: string;
  key_version: number;
  iv: string;
  ciphertext: string;
  auth_tag: string;
}

interface JoinContextRow {
  snapshot_complete: boolean;
  already_linked: boolean;
  candidates: JoinCandidateRow[] | null;
}

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

const PENDING_RESPONSE = {
  outcome: "pending_retryable",
  retryable: true,
} as const;
const LINKED_RESPONSE = {
  outcome: "linked",
  retryable: false,
} as const;

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const parsed = JoinSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return noStoreJson(
        { outcome: "terminal_invalid", retryable: false },
        400,
      );
    }
    const idempotencyKeyHash = createHash("sha256")
      .update(parsed.data.idempotencyKey)
      .digest("hex");
    const serviceRole = await createSupabaseServiceRoleClient();
    const { data: contextData, error: contextError } = await (
      serviceRole as any
    ).rpc("get_android_tester_roster_join_context", {
      p_user_id: user.id,
      p_idempotency_key_hash: idempotencyKeyHash,
    });
    if (contextError) {
      return noStoreJson(
        { outcome: "pending_retryable", retryable: true },
        503,
      );
    }

    const joinContext = (contextData?.[0] ?? null) as JoinContextRow | null;
    if (joinContext?.already_linked) {
      return noStoreJson(LINKED_RESPONSE);
    }
    if (!user.email) {
      return noStoreJson(PENDING_RESPONSE);
    }
    if (!joinContext?.snapshot_complete) {
      return noStoreJson(PENDING_RESPONSE);
    }

    const authenticatedEmail = user.email.trim().toLowerCase();
    let matchedEntryId: string | null = null;
    try {
      for (const candidate of joinContext.candidates ?? []) {
        const envelope: TesterIdentityEnvelope = {
          keyVersion: candidate.key_version,
          iv: candidate.iv,
          ciphertext: candidate.ciphertext,
          authTag: candidate.auth_tag,
        };
        const identity = decryptTesterIdentity(
          envelope,
          loadTesterIdentityKey(candidate.key_version),
        );
        if (identity.email.trim().toLowerCase() === authenticatedEmail) {
          matchedEntryId = candidate.entry_id;
          break;
        }
      }
    } catch {
      return noStoreJson(
        { outcome: "pending_retryable", retryable: true },
        503,
      );
    }

    if (!matchedEntryId) {
      return noStoreJson(PENDING_RESPONSE);
    }

    const { data: linkData, error: linkError } = await (
      serviceRole as any
    ).rpc("link_android_tester_roster_account", {
      p_entry_id: matchedEntryId,
      p_user_id: user.id,
      p_native_install_id: parsed.data.nativeInstallId,
      p_idempotency_key_hash: idempotencyKeyHash,
    });
    if (linkError) {
      return noStoreJson(
        { outcome: "pending_retryable", retryable: true },
        503,
      );
    }

    const outcome = (linkData?.[0]?.outcome ?? null) as string | null;
    if (outcome === "linked" || outcome === "same_key_retry") {
      return noStoreJson(LINKED_RESPONSE);
    }
    if (outcome === "pending_retryable") {
      return noStoreJson(PENDING_RESPONSE);
    }
    return noStoreJson({
      outcome: "terminal_invalid",
      retryable: false,
    });
  },
  {
    authErrorMessage: "Authentication required",
    errorMessage: "Android tester roster join failed",
  },
);
