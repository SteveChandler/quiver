import { NextResponse, type NextRequest } from "next/server";

import {
  withBotBlockingAndRateLimit,
  withErrorHandler,
} from "@/lib/middleware/api-wrappers";
import {
  normalizeInstallAttribution,
  toCoarseDate,
} from "@/lib/install-attribution";
import {
  buildPlayStoreInstallUrl,
  createOpaqueInstallToken,
  hashOpaqueInstallToken,
  isInstallAttributionIssuanceEnabled,
  parseInstallHandoffAttribution,
} from "@/lib/install-attribution-server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { ANDROID_PLAY_STORE_LISTING_URL } from "@/lib/constants/app-store";

export const dynamic = "force-dynamic";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

const handler = async (request: NextRequest): Promise<NextResponse> => {
  if (!isInstallAttributionIssuanceEnabled()) {
    return NextResponse.json(
      {
        success: true,
        storeUrl: ANDROID_PLAY_STORE_LISTING_URL,
        attributionEnabled: false,
      },
      { headers: NO_STORE_HEADERS },
    );
  }

  const input = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const attribution = normalizeInstallAttribution(input);
  const handoff = parseInstallHandoffAttribution(
    input.handoffId,
    input.handoffContext,
  );
  const token = createOpaqueInstallToken();
  const tokenHash = hashOpaqueInstallToken(token);
  const expiresAt = new Date(Date.now() + THIRTY_DAYS_MS).toISOString();
  const supabase = await createSupabaseServiceRoleClient();
  const { error } = await (supabase as any)
    .from("install_attribution_tokens")
    .insert({
      token_hash: tokenHash,
      ...attribution,
      ...(handoff
        ? {
            handoff_id: handoff.handoffId,
            handoff_context: handoff.handoffContext,
          }
        : {}),
      expires_at: expiresAt,
    });

  if (error) {
    return NextResponse.json(
      { success: false, error: "issuance_unavailable" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }

  const { error: auditError } = await (supabase as any)
    .from("install_attribution_audit")
    .insert({
      token_hash_prefix: tokenHash.slice(0, 12),
      action: "issue",
      outcome: "issued",
    });
  if (auditError) {
    console.warn("install-attribution issue audit unavailable");
  }

  return NextResponse.json(
    {
      success: true,
      storeUrl: buildPlayStoreInstallUrl(token),
      expiresOn: toCoarseDate(expiresAt),
    },
    { headers: NO_STORE_HEADERS },
  );
};

export const POST = withErrorHandler(
  withBotBlockingAndRateLimit(handler, "install-attribution-issue"),
);
