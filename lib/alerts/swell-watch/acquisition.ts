import { z } from "zod";
import { randomUUID } from "node:crypto";
import { acquireProviderRunReceipts, loadSwellWatchAcquisitionScope } from "./provider-run-store";

const PROVIDER_PHASE_BUDGET_MS = 180_000;
const PROVIDER_REQUEST_TIMEOUT_MS = 20_000;

export const acquisitionConfig = z.object({
  policy: z.unknown().optional(),
  cohort: z.array(z.object({ sourcePointId: z.uuid(), regionKey: z.string().trim().min(1).max(100) }).strict())
    .min(1).max(500).refine((scopes) => new Set(scopes.map((scope) => scope.sourcePointId)).size === scopes.length),
}).strict();

export type SwellWatchAcquisitionStage =
  | "collection_lease"
  | "acquisition_scope"
  | "provider_fetch"
  | "receipt_storage"
  | "lease_release";

export async function acquireSwellWatchCohort(
  cohort: z.infer<typeof acquisitionConfig>["cohort"],
  client: Parameters<typeof loadSwellWatchAcquisitionScope>[1],
  onStage?: (stage: SwellWatchAcquisitionStage) => void,
): Promise<Awaited<ReturnType<typeof acquireProviderRunReceipts>>
  | { skipped: true; reason: "collection_in_progress"; enqueued: 0 }> {
  const leaseClient = client as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const owner = randomUUID();
  const providerDeadline = Date.now() + PROVIDER_PHASE_BUDGET_MS;
  onStage?.("collection_lease");
  const lease = await leaseClient.rpc("try_acquire_swell_watch_collection_lease", { p_owner: owner });
  if (lease.error || typeof lease.data !== "boolean") throw new Error("Collection lease unavailable");
  if (!lease.data) return { skipped: true, reason: "collection_in_progress", enqueued: 0 };
  try {
    onStage?.("acquisition_scope");
    const scopes = await loadSwellWatchAcquisitionScope(cohort, client);
    const fetcher: Parameters<typeof acquireProviderRunReceipts>[1] = async (url, init) => {
      const remaining = providerDeadline - Date.now();
      if (remaining <= 0) throw new Error("provider budget exceeded");
      const timeout = Math.min(PROVIDER_REQUEST_TIMEOUT_MS, remaining);
      const signal = AbortSignal.timeout(timeout);
      try {
        return await fetch(url, { ...init, signal, cache: "no-store" });
      } catch (error) {
        if (Date.now() >= providerDeadline || signal.aborted && timeout === remaining) {
          throw new Error("provider budget exceeded");
        }
        throw error;
      }
    };
    onStage?.("provider_fetch");
    return await acquireProviderRunReceipts({ latestAvailableAt: new Date(), forecastDays: 7, scopes }, fetcher, {
        rpc: async (_name, args) => {
          onStage?.("receipt_storage");
          return await leaseClient.rpc("record_leased_swell_watch_provider_run_receipt", { ...args, p_owner: owner });
        },
      });
  } finally {
    try {
      const released = await leaseClient.rpc("release_swell_watch_collection_lease", { p_owner: owner });
      if (released.error || typeof released.data !== "boolean") throw new Error("Collection lease release unavailable");
    } catch (releaseError) {
      onStage?.("lease_release");
      throw releaseError;
    }
  }
}
