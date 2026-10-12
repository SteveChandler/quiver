import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";
import { getClientIdentifier } from "@/lib/middleware/api-wrappers/rate-limit-wrapper";
import type { RouteContext, RouteHandler } from "@/lib/middleware/api-wrappers/types";

// Native use-map-beaches.ts fans out four batches per pan; leave room for overlap.
export const FORECAST_BULK_MAX_INFLIGHT = 16;
export const FORECAST_BULK_MAX_INFLIGHT_PER_IP = 6;
// Leave time to respond before the native client's 15-second timeout.
export const FORECAST_BULK_DEADLINE_MS = 12_000;

let inflight = 0;
const inflightByIp = new Map<string, number>();

export function withBulkForecastSlot(handler: RouteHandler): RouteHandler {
  return async (request: NextRequest, context?: RouteContext): Promise<NextResponse> => {
    const ip = getClientIdentifier(request);
    const ipInflight = inflightByIp.get(ip) ?? 0;
    const reason = inflight >= FORECAST_BULK_MAX_INFLIGHT
      ? "inflight_global"
      : ipInflight >= FORECAST_BULK_MAX_INFLIGHT_PER_IP ? "inflight_ip" : null;
    if (reason) {
      const beachCount = request.nextUrl.searchParams.get("beachIds")?.split(",").filter((id) => id.trim()).length ?? 0;
      console.warn("[forecast-bulk:shed]", { reason, ip, beachCount, inflight, ipInflight });
      return bulkForecastShedResponse(reason);
    }
    inflight += 1;
    inflightByIp.set(ip, ipInflight + 1);
    try {
      return await handler(request, context);
    } finally {
      inflight -= 1;
      const remaining = (inflightByIp.get(ip) ?? 1) - 1;
      if (remaining === 0) inflightByIp.delete(ip);
      else inflightByIp.set(ip, remaining);
    }
  };
}

export function bulkForecastShedResponse(reason: "inflight_global" | "inflight_ip" | "deadline"): NextResponse {
  const retryAfter = reason === "deadline" ? 5 : 2;
  return NextResponse.json({
    success: false, reason, retryAfter, timestamp: new Date().toISOString(),
    error: reason === "deadline" ? "Forecast request timed out" : "Too many concurrent forecast requests",
  }, { status: reason === "deadline" ? 503 : 429,
    headers: { ...DEFAULT_SECURITY_HEADERS, "Retry-After": String(retryAfter) },
  });
}
