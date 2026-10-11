import { NextResponse } from "next/server";
import { DEFAULT_SECURITY_HEADERS } from "@/lib/api-utils";

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const FORECAST_BULK_MAX_INFLIGHT = positiveInteger(process.env.FORECAST_BULK_MAX_INFLIGHT, 8);
export const FORECAST_BULK_MAX_INFLIGHT_PER_IP = positiveInteger(process.env.FORECAST_BULK_MAX_INFLIGHT_PER_IP, 3);
// Leave time to respond before the native client's 15-second timeout.
export const FORECAST_BULK_DEADLINE_MS = positiveInteger(process.env.FORECAST_BULK_DEADLINE_MS, 12_000);

type ShedReason = "inflight_global" | "inflight_ip" | "deadline";
type BulkForecastSlot =
  | { release: () => void; reason: null }
  | { release: null; reason: "inflight_global" | "inflight_ip" };

let inflight = 0;
const inflightByIp = new Map<string, number>();

export function acquireBulkForecastSlot(ip: string, beachCount: number): BulkForecastSlot {
  const ipInflight = inflightByIp.get(ip) ?? 0;
  const reason = inflight >= FORECAST_BULK_MAX_INFLIGHT
    ? "inflight_global"
    : ipInflight >= FORECAST_BULK_MAX_INFLIGHT_PER_IP ? "inflight_ip" : null;
  if (reason) {
    console.warn("[forecast-bulk:shed]", { reason, ip, beachCount, inflight, ipInflight });
    return { release: null, reason };
  }

  inflight += 1;
  inflightByIp.set(ip, ipInflight + 1);
  return {
    reason: null,
    release: (): void => {
      inflight -= 1;
      const remaining = (inflightByIp.get(ip) ?? 1) - 1;
      if (remaining === 0) inflightByIp.delete(ip);
      else inflightByIp.set(ip, remaining);
    },
  };
}

export function bulkForecastShedResponse(reason: ShedReason): NextResponse {
  const retryAfter = reason === "deadline" ? 5 : 2;
  return NextResponse.json({
    success: false,
    error: reason === "deadline" ? "Forecast request timed out" : "Too many concurrent forecast requests",
    reason,
    retryAfter,
    timestamp: new Date().toISOString(),
  }, {
    status: reason === "deadline" ? 503 : 429,
    headers: { ...DEFAULT_SECURITY_HEADERS, "Retry-After": String(retryAfter) },
  });
}
