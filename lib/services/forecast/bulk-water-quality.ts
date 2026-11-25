import "server-only";

import {
  resolveWaterQualityHolds,
  type WaterQualityHoldClient,
} from "@/lib/recommendations/major-event-hold/water-quality";
import {
  surfCallWaterQuality,
  type SurfCallWaterQuality,
} from "@/lib/services/surf-call/water-quality-notice";

const BULK_WATER_QUALITY_TIMEOUT_MS = 2_500;
const BULK_CANDIDATE_DURATION_MS = 3 * 60 * 60 * 1000;

export type BulkWaterQuality = Record<string, SurfCallWaterQuality>;

interface ResolveBulkWaterQualityOptions {
  client?: WaterQualityHoldClient;
  timeoutMs?: number;
  signal?: AbortSignal;
}

/**
 * The map's per-beach water-quality notice. It runs the live resolver that
 * `/api/surf/call` runs, not the bulk RPC snapshot: the snapshot has no rain
 * events or County streak history, so it would drop rain notices that Beach
 * Detail shows.
 *
 * Returns null when nothing is known (read error, timeout, abort). A beach
 * whose status is not known (unresolved read, stale County feed) is left out
 * unless the read still found its notice, as `/api/surf/call` shows it, so a
 * client never reads a missing status as clean water. A clean beach maps to
 * null.
 */
export async function resolveBulkWaterQuality(
  beachIds: readonly string[],
  at: Date,
  options: ResolveBulkWaterQualityOptions = {},
): Promise<BulkWaterQuality | null> {
  if (beachIds.length === 0) return {};
  const startsAt = at.toISOString();
  const endsAt = new Date(at.getTime() + BULK_CANDIDATE_DURATION_MS).toISOString();
  const candidates = beachIds.map((beachId) => ({
    candidateId: `bulk-water-quality:${beachId}`,
    beachId,
    startsAt,
    endsAt,
  }));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: (() => void) | undefined;
  // The notice is optional, so a slow read or a request past its deadline skips it.
  const timeout = new Promise<"timeout" | "aborted">((resolve) => {
    timer = setTimeout(() => resolve("timeout"), options.timeoutMs ?? BULK_WATER_QUALITY_TIMEOUT_MS);
    onAbort = () => resolve("aborted");
    if (options.signal?.aborted) onAbort();
    else options.signal?.addEventListener("abort", onAbort, { once: true });
  });
  // Only the read is caught; a fault in the mapping below still fails the request.
  const read = resolveWaterQualityHolds(candidates, options.client ? { client: options.client } : {})
    .catch((error: unknown) => {
      console.error("[forecast-bulk:water-quality-error]", error);
      return "error" as const;
    });
  const resolution = await Promise.race([read, timeout]).finally(() => {
    clearTimeout(timer);
    if (onAbort) options.signal?.removeEventListener("abort", onAbort);
  });
  if (resolution === "timeout") {
    console.warn("[forecast-bulk:water-quality-timeout]", { beachCount: beachIds.length });
    return null;
  }
  if (resolution === "error" || resolution === "aborted") return null;
  const unverified = new Set((resolution.unverifiedBeachIds ?? []).map((id) => id.toLowerCase()));
  const result: BulkWaterQuality = {};
  for (const beachId of beachIds) {
    const notice = surfCallWaterQuality(resolution, beachId);
    const known = resolution.state === "resolved" && !unverified.has(beachId.toLowerCase());
    if (notice !== null || known) result[beachId] = notice;
  }
  return result;
}
