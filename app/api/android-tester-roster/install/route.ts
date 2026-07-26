import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

import { InstallEvidenceSchema } from "@/lib/android-tester-roster/operational-evidence";
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
    const parsed = InstallEvidenceSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return noStoreJson(
        { outcome: "terminal_invalid", retryable: false },
        400,
      );
    }

    const { attribution } = parsed.data;
    const serviceRole = await createSupabaseServiceRoleClient();
    const { data, error } = await (serviceRole as any).rpc(
      "record_android_tester_roster_install",
      {
        p_user_id: user.id,
        p_native_install_id: parsed.data.nativeInstallId,
        p_idempotency_key_hash: createHash("sha256")
          .update(parsed.data.idempotencyKey)
          .digest("hex"),
        p_source: attribution.source,
        p_surface: attribution.surface,
        p_placement: attribution.placement,
        p_campaign: attribution.campaign,
        p_created_on: attribution.createdOn,
        p_expires_on: attribution.expiresOn,
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
    errorMessage: "Android tester install evidence failed",
  },
);
