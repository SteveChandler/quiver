import { z } from "zod";
import { randomUUID } from "node:crypto";
import { acquireProviderRunReceipts, loadSwellWatchAcquisitionScope } from "./provider-run-store";

export const acquisitionConfig = z.object({
  policy: z.unknown().optional(),
  cohort: z.array(z.object({ sourcePointId: z.uuid(), regionKey: z.string().trim().min(1).max(100) }).strict())
    .min(1).max(500).refine((scopes) => new Set(scopes.map((scope) => scope.sourcePointId)).size === scopes.length),
}).strict();

export async function acquireSwellWatchCohort(
  cohort: z.infer<typeof acquisitionConfig>["cohort"],
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
): Promise<Awaited<ReturnType<typeof acquireProviderRunReceipts>>
  | { skipped: true; reason: "collection_in_progress"; enqueued: 0 }> {
  const leaseClient = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const owner = randomUUID();
  const lease = await leaseClient.rpc("try_acquire_swell_watch_collection_lease", { p_owner: owner });
  if (lease.error || typeof lease.data !== "boolean") throw new Error("Collection lease unavailable");
  if (!lease.data) return { skipped: true, reason: "collection_in_progress", enqueued: 0 };
  try {
    const scopes = await loadSwellWatchAcquisitionScope(cohort, client);
    const signal = AbortSignal.timeout(240_000);
    return await acquireProviderRunReceipts({ latestAvailableAt: new Date(), forecastDays: 7, scopes },
      (url, init) => fetch(url, { ...init, signal, cache: "no-store" }), {
        rpc: async (_name, args) => await leaseClient.rpc("record_leased_swell_watch_provider_run_receipt", { ...args, p_owner: owner }),
      });
  } finally {
    const released = await leaseClient.rpc("release_swell_watch_collection_lease", { p_owner: owner });
    if (released.error || typeof released.data !== "boolean") throw new Error("Collection lease release unavailable");
  }
}
