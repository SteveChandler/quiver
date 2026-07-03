import type { NextRequest, NextResponse } from "next/server";
import {
  createErrorResponse,
  createSuccessResponse,
  methodNotAllowed,
  validateUuidParam,
  withBotBlockingAndRateLimit,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withNoStore } from "@/lib/surf-drops/http";
import { createSurfDropsRepository } from "@/lib/surf-drops/repository";
import { computeQrVenueScanUpdate } from "@/lib/surf-drops/service";

export const dynamic = "force-dynamic";

async function scanHandler(
  _request: NextRequest,
  context?: { params: Record<string, string> | Promise<Record<string, string>> },
): Promise<NextResponse> {
  const params = context?.params
    ? typeof context.params === "object" && "then" in context.params
      ? await context.params
      : context.params
    : {};

  const idResult = validateUuidParam(params.id, "QR venue");
  if ("error" in idResult) return idResult.error;

  const repository = createSurfDropsRepository(createSupabaseServiceRoleClient());
  const venue = await repository.findQrVenueById?.(idResult.value);
  if (!venue) {
    return createErrorResponse("QR venue not found", undefined, 404);
  }

  const updated = await repository.updateQrVenueScan?.(
    idResult.value,
    computeQrVenueScanUpdate(venue),
  );

  return withNoStore(
    createSuccessResponse({
      ok: true,
      venue: {
        id: updated?.id ?? venue.id,
        qr_scan_count: updated?.qr_scan_count ?? venue.qr_scan_count + 1,
        activated_at: updated?.activated_at ?? null,
      },
    }),
  );
}

export const POST = withBotBlockingAndRateLimit(
  scanHandler,
  { key: "public-default" },
);

export function GET(): NextResponse {
  return methodNotAllowed(["POST"]);
}
