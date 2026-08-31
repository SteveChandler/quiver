import { NextResponse, type NextRequest } from "next/server";

import { withRateLimit } from "@/lib/middleware/api-wrappers";
import {
  normalizeInstallAttribution,
  toCoarseDate,
} from "@/lib/install-attribution";
import {
  hashOpaqueInstallToken,
  isInstallAttributionRedemptionEnabled,
  parseInstallHandoffAttribution,
  parseOpaqueInstallToken,
} from "@/lib/install-attribution-server";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };
const TERMINAL_RESPONSE = {
  outcome: "unattributed_terminal",
  retryable: false,
  attribution: null,
} as const;
const RETRYABLE_RESPONSE = {
  outcome: "unattributed_retryable",
  retryable: true,
  attribution: null,
} as const;

interface RedeemedAttributionRow {
  source: string;
  surface: string;
  placement: string;
  campaign: string;
  created_at: string;
  expires_at: string;
  handoff_id?: string | null;
  handoff_context?: unknown;
}

function noStoreJson(body: unknown): NextResponse {
  return NextResponse.json(body, { headers: NO_STORE_HEADERS });
}

const handler = async (request: NextRequest): Promise<NextResponse> => {
  if (!isInstallAttributionRedemptionEnabled()) {
    return noStoreJson(RETRYABLE_RESPONSE);
  }

  const input = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const token = parseOpaqueInstallToken(input.token);
  const redemptionId = parseOpaqueInstallToken(input.redemptionId);

  if (!token || !redemptionId) {
    return noStoreJson(TERMINAL_RESPONSE);
  }

  const tokenHash = hashOpaqueInstallToken(token);
  const redemptionKeyHash = hashOpaqueInstallToken(redemptionId);

  try {
    const supabase = await createSupabaseServiceRoleClient();
    const { data, error } = await (supabase as any).rpc(
      "redeem_install_attribution_token",
      {
        p_token_hash: tokenHash,
        p_redemption_key_hash: redemptionKeyHash,
      },
    );

    if (error) {
      console.warn("install-attribution redemption unavailable");
      return noStoreJson(RETRYABLE_RESPONSE);
    }

    const row = (data?.[0] ?? null) as RedeemedAttributionRow | null;
    if (!row) {
      return noStoreJson(TERMINAL_RESPONSE);
    }

    const attribution = normalizeInstallAttribution({
      source: row.source,
      surface: row.surface,
      placement: row.placement,
      campaign: row.campaign,
    });
    const handoff = parseInstallHandoffAttribution(
      row.handoff_id,
      row.handoff_context,
    );
    return noStoreJson({
      outcome: "attributed",
      retryable: false,
      attribution: {
        ...attribution,
        createdOn: toCoarseDate(row.created_at),
        expiresOn: toCoarseDate(row.expires_at),
        ...(handoff ?? {}),
      },
    });
  } catch {
    console.warn("install-attribution redemption unavailable");
    return noStoreJson(RETRYABLE_RESPONSE);
  }
};

const rateLimitedHandler = withRateLimit(handler, "install-attribution-redeem");

export async function POST(request: NextRequest): Promise<NextResponse> {
  const response = await rateLimitedHandler(request);
  if (response.status === 503) {
    return noStoreJson(RETRYABLE_RESPONSE);
  }
  if (response.status === 429) {
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}
