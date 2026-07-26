import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { OperationalEvidenceSchema } from "@/lib/android-tester-roster/operational-evidence";
import { withAuth } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, must-revalidate",
};

function noStoreJson(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, {
    status,
    headers: NO_STORE_HEADERS,
  });
}

export const POST = withAuth(
  async (request: NextRequest, { user }) => {
    const parsed = OperationalEvidenceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return noStoreJson(
        { outcome: "terminal_invalid", retryable: false },
        400,
      );
    }

    const serviceRole = await createSupabaseServiceRoleClient();
    const { data, error } = await (serviceRole as any).rpc(
      "record_android_tester_roster_first_open",
      {
        p_user_id: user.id,
        p_native_install_id: parsed.data.nativeInstallId,
        p_idempotency_key_hash: createHash("sha256")
          .update(parsed.data.idempotencyKey)
          .digest("hex"),
      },
    );
    if (error) {
      return noStoreJson(
        { outcome: "pending_retryable", retryable: true },
        503,
      );
    }

    const outcome = (data?.[0]?.outcome ?? null) as string | null;
    if (outcome === "observed" || outcome === "same_key_retry") {
      return noStoreJson({ outcome: "observed", retryable: false });
    }
    if (outcome === "pending_retryable") {
      return noStoreJson({
        outcome: "pending_retryable",
        retryable: true,
      });
    }
    return noStoreJson({
      outcome: "terminal_invalid",
      retryable: false,
    });
  },
  {
    authErrorMessage: "Authentication required",
    errorMessage: "Android tester first-open evidence failed",
  },
);
