import { buildOpenMeteoSingleRunRequest, fetchOpenMeteoSingleRunReceipt, type PrototypeSingleRunReceipt } from "./single-run-receipt";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import { TERRAIN_BINS } from "@/types/terrain";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REASON = "provider_response_does_not_echo_run_and_completion_not_operationally_proven";
const ENDPOINT = "https://single-runs-api.open-meteo.com/v1/forecast";
const HOURLY = "swell_wave_height,swell_wave_period,swell_wave_direction,secondary_swell_wave_height,secondary_swell_wave_period,secondary_swell_wave_direction";
const UNITS = { time: "iso8601", swell_wave_height: "m", swell_wave_period: "s", swell_wave_direction: "°", secondary_swell_wave_height: "m", secondary_swell_wave_period: "s", secondary_swell_wave_direction: "°" };
const MAX_CONTENT_BYTES = 524_288;

export interface ProviderRunScope {
  sourcePointId: string;
  receipt: PrototypeSingleRunReceipt;
}

export interface ProviderRunReceiptRpcClient {
  rpc: (name: "record_swell_watch_provider_run_receipt", args: { p_scopes: Array<ProviderRunScope & { receipt: PrototypeSingleRunReceipt & { hourlyUnits: Record<string, string> } }> }) => Promise<{ data: unknown; error: { message: string } | null }>;
}

export interface StoredProviderRunReceipt {
  issuanceId: string;
  runBatchId: string;
  revisionSetId: string;
}

export type ProviderRunAcquisitionSkipReason = "latest_issuance_stale" | "latest_issuance_already_evaluated";
export type ProviderRunAcquisitionResult = StoredProviderRunReceipt | { skipped: true; reason: ProviderRunAcquisitionSkipReason; enqueued: 0 };
type StoredProviderRunState = { evaluated: boolean; stored: StoredProviderRunReceipt | null };

interface ProviderRunAcquisitionScope {
  sourcePointId: string;
  latitude: number;
  longitude: number;
}

const acquisitionScope = z.object({ sourcePointId: z.uuid(), latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180) });
const terrain = z.object({
  swell_window_center_deg: z.number().finite().min(0).lt(360),
  swell_window_halfwidth_deg: z.number().finite().positive().max(180),
  swell_access_factors: z.array(z.number().finite().min(0).max(1)).length(TERRAIN_BINS).nullish(),
  terrain_enabled: z.boolean().nullish().transform((value) => value ?? undefined),
  deepwater_decay_factor: z.number().finite().nonnegative().nullish(),
  shoaling_factors: z.object({ version: z.literal(1), type: z.literal("period_lookup"),
    buckets: z.array(z.object({ tp_min_s: z.number().finite(), tp_max_s: z.number().finite(),
      factor: z.number().finite().positive() })), calibration: z.record(z.string(), z.unknown()).optional() }).nullish(),
});

/** The caller supplies the fixed operational membership; never infer a smaller cohort from returned rows. */
export async function loadSwellWatchAcquisitionScope(
  configured: readonly { sourcePointId: string; regionKey: string }[],
  client: Pick<SupabaseClient<Database>, "from">,
): Promise<Array<ProviderRunAcquisitionScope & { regionKey: string; beach: z.infer<typeof terrain>; slug?: string | null; timezone?: string | null }>> {
  const expected = z.array(z.object({ sourcePointId: z.uuid(), regionKey: z.string().trim().min(1).max(100) }))
    .min(1).max(500).parse(configured);
  if (new Set(expected.map((scope) => scope.sourcePointId)).size !== expected.length) throw new Error("Duplicate configured source scope");
  const result = await client.from("beaches")
    .select("id,lat,lon,slug,timezone,swell_window_center_deg,swell_window_halfwidth_deg,swell_access_factors,terrain_enabled,deepwater_decay_factor,shoaling_factors", { count: "exact" })
    .in("id", expected.map((scope) => scope.sourcePointId))
    .is("deleted_at", null).eq("is_private", false).is("owner_id", null).limit(501);
  if (result.error) throw new Error(`Acquisition scope read failed: ${result.error.message}`);
  const rows = z.array(terrain.extend({ id: z.uuid(), lat: acquisitionScope.shape.latitude,
    lon: acquisitionScope.shape.longitude, slug: z.string().trim().min(1).nullish(),
    timezone: z.string().trim().min(1).nullish() })).max(500).parse(result.data);
  const byId = new Map(rows.map((row) => [row.id, row]));
  if (result.count !== expected.length || rows.length !== expected.length || byId.size !== rows.length
    || expected.some((scope) => !byId.has(scope.sourcePointId))) throw new Error("Acquisition scope differs from configured cohort");
  return expected.map((scope) => {
    const { id: _id, lat, lon, slug, timezone, ...beach } = byId.get(scope.sourcePointId)!;
    return { ...scope, latitude: lat, longitude: lon, slug, timezone, beach };
  });
}

const scopeResult = z.object({ providerBatchId: z.uuid(), evaluationId: z.string(),
  issuedAt: z.string().datetime({ offset: true }), scopeHash: z.string().regex(/^[a-f0-9]{64}$/),
  expectedComponentCount: z.number().int().positive(),
  scopes: z.array(acquisitionScope.extend({ forecastDays: z.number().int().min(1).max(7) })).min(1).max(500) });

export async function loadAttestedProviderRunScope(
  input: { providerBatchId: string; forecastDays: number; scopes: readonly ProviderRunAcquisitionScope[] },
  client: { rpc: (name: "read_swell_watch_run_scope", args: { p_provider_batch_id: string }) => PromiseLike<{
    data: unknown; error: { message: string } | null;
  }> },
): Promise<z.infer<typeof scopeResult>> {
  const expected = z.object({ providerBatchId: z.uuid(), forecastDays: z.number().int().min(1).max(7),
    scopes: z.array(acquisitionScope).min(1).max(500) }).parse(input);
  const byId = new Map(expected.scopes.map((scope) => [scope.sourcePointId, scope]));
  if (byId.size !== expected.scopes.length) throw new Error("Duplicate expected source scope");
  const result = await client.rpc("read_swell_watch_run_scope", { p_provider_batch_id: expected.providerBatchId });
  if (result.error) throw new Error(`Run scope read failed: ${result.error.message}`);
  const scope = scopeResult.parse(result.data);
  if (scope.providerBatchId !== expected.providerBatchId
    || !scope.evaluationId.startsWith("genuine_completed:")
    || !z.uuid().safeParse(scope.evaluationId.slice("genuine_completed:".length)).success
    || Date.parse(scope.issuedAt) % (6 * 3_600_000) !== 0
    || scope.scopes.length !== expected.scopes.length
    || new Set(scope.scopes.map((item) => item.sourcePointId)).size !== scope.scopes.length
    || scope.expectedComponentCount !== expected.forecastDays * 48 * expected.scopes.length
    || scope.scopes.some((item) => item.forecastDays !== expected.forecastDays
      || item.latitude !== byId.get(item.sourcePointId)?.latitude
      || item.longitude !== byId.get(item.sourcePointId)?.longitude)) {
    throw new Error("Frozen run scope differs from expected coverage");
  }
  return scope;
}

/** All scopes are fixed and validated before I/O; a failed fetch cannot shrink a batch. */
export async function acquireProviderRunReceipts(
  input: { forecastDays: number; scopes: readonly ProviderRunAcquisitionScope[] } &
    ({ runUtc: string } | { latestAvailableAt: Date }),
  fetcher: Parameters<typeof fetchOpenMeteoSingleRunReceipt>[1],
  client: ProviderRunReceiptRpcClient,
): Promise<ProviderRunAcquisitionResult> {
  const { forecastDays } = input;
  const scopes = input.scopes.map(({ sourcePointId, latitude, longitude }) => ({ sourcePointId, latitude, longitude }));
  if (!scopes.length || scopes.length > 500 || new Set(scopes.map(({ sourcePointId }) => sourcePointId)).size !== scopes.length || scopes.some(({ sourcePointId }) => !UUID.test(sourcePointId))) throw new Error("Provider acquisition scope is invalid");
  if (scopes.some((scope) => !acquisitionScope.safeParse(scope).success)) throw new Error("Provider acquisition coordinates are invalid");
  if (!Number.isInteger(forecastDays) || forecastDays < 1 || forecastDays > 7) throw new Error("Provider acquisition horizon is invalid");
  let runUtc: string;
  let extraRuns: string[] = [];
  let existingLatest: StoredProviderRunReceipt | null = null;
  if ("runUtc" in input) runUtc = input.runUtc;
  else {
    const now = input.latestAvailableAt.getTime();
    if (!Number.isFinite(now)) throw new Error("Provider acquisition time is invalid");
    const response = await fetcher("https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json", { method: "GET", redirect: "error" });
    if (response.status !== 200) throw new Error("Provider availability read unsuccessful");
    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > 16_384) throw new Error("Provider availability response exceeds limit");
    const timestamp = z.number().int().nonnegative().max(8_640_000_000_000);
    const metadata = z.object({ last_run_initialisation_time: timestamp,
      last_run_modification_time: timestamp, last_run_availability_time: timestamp,
      update_interval_seconds: z.literal(21_600), temporal_resolution_seconds: z.literal(3600) }).parse(JSON.parse(raw));
    const issued = metadata.last_run_initialisation_time;
    const available = metadata.last_run_availability_time;
    if (issued % 21_600 !== 0 || metadata.last_run_modification_time < issued
      || available < metadata.last_run_modification_time || available * 1000 + 600_000 > now) {
      throw new Error("Provider run is not ready after replication delay");
    }
    runUtc = new Date(issued * 1000).toISOString().slice(0, 16) + "Z";
    if (now > issued * 1000 + 12 * 3_600_000) return { skipped: true, reason: "latest_issuance_stale", enqueued: 0 };
    const canReadStoredRuns = typeof (client as unknown as { from?: unknown }).from === "function";
    const candidatesToRead = [runUtc, ...[1, 2].map((hours) =>
      new Date(issued * 1000 - hours * 6 * 3_600_000).toISOString().slice(0, 16) + "Z")];
    const states = canReadStoredRuns ? await readStoredProviderRunStates(candidatesToRead, client) : new Map();
    const latestState = states.get(runUtc);
    if (latestState?.evaluated) return { skipped: true, reason: "latest_issuance_already_evaluated", enqueued: 0 };
    existingLatest = latestState?.stored ?? null;
    const candidates = [1, 2].map((hours) => new Date(issued * 1000 - hours * 6 * 3_600_000).toISOString().slice(0, 16) + "Z")
      .filter((candidate) => Date.parse(candidate) <= issued * 1000)
      .filter((candidate) => !states.has(candidate))
      .sort((left, right) => Date.parse(left) - Date.parse(right));
    extraRuns = canReadStoredRuns ? candidates.slice(0, 2) : [];
  }
  const acquireOne = async (requestedRunUtc: string): Promise<StoredProviderRunReceipt> => {
    scopes.forEach(({ latitude, longitude }) => buildOpenMeteoSingleRunRequest({ latitude, longitude, runUtc: requestedRunUtc, forecastDays }));
    const receipts: ProviderRunScope[] = [];
    for (const { sourcePointId, latitude, longitude } of scopes) {
      receipts.push({ sourcePointId, receipt: await fetchOpenMeteoSingleRunReceipt({ latitude, longitude, runUtc: requestedRunUtc, forecastDays }, fetcher, sourcePointId) });
    }
    return storePrototypeSingleRunReceipts(receipts, client);
  };
  for (const requestedRunUtc of extraRuns) await acquireOne(requestedRunUtc);
  return existingLatest ?? acquireOne(runUtc);
}

export async function readStoredProviderRunStates(
  runUtcs: readonly string[],
  client: unknown,
): Promise<Map<string, StoredProviderRunState>> {
  const reader = client as { from?: (table: string) => {
    select: (columns: string) => { in: (column: string, values: readonly string[]) => { limit: (count: number) => PromiseLike<{ data: unknown; error: unknown }> } };
  } };
  if (typeof reader.from !== "function" || !runUtcs.length) return new Map();
  try {
    const result = await reader.from("swell_watch_provider_run_issuances").select(
      "id,run_utc,swell_watch_provider_run_batches(id,swell_watch_provider_run_revision_sets(id,revision_number),swell_watch_provider_run_completed_batches(id,swell_watch_study_evaluations(status)))",
    ).in("run_utc", runUtcs).limit(100);
    if (result.error || !Array.isArray(result.data)) return new Map();
    const states = new Map<string, StoredProviderRunState>();
    for (const row of result.data) {
      if (!row || typeof row !== "object" || typeof (row as { run_utc?: unknown }).run_utc !== "string") continue;
      const issuance = row as { id?: unknown; run_utc: string; swell_watch_provider_run_batches?: unknown };
      const batches = Array.isArray(issuance.swell_watch_provider_run_batches) ? issuance.swell_watch_provider_run_batches : [];
      const batch = batches.find((value) => value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string") as {
        id: string; swell_watch_provider_run_revision_sets?: unknown; swell_watch_provider_run_completed_batches?: unknown;
      } | undefined;
      const revisionSets = Array.isArray(batch?.swell_watch_provider_run_revision_sets) ? batch.swell_watch_provider_run_revision_sets : [];
      const revisionSet = revisionSets.filter((value) => value && typeof value === "object" && typeof (value as { id?: unknown }).id === "string")
        .sort((left, right) => Number((right as { revision_number?: unknown }).revision_number) - Number((left as { revision_number?: unknown }).revision_number))[0] as { id: string } | undefined;
      const completed = Array.isArray(batch?.swell_watch_provider_run_completed_batches) ? batch.swell_watch_provider_run_completed_batches : [];
      const evaluations = completed.flatMap((value) => value && typeof value === "object" && Array.isArray((value as { swell_watch_study_evaluations?: unknown }).swell_watch_study_evaluations)
        ? (value as { swell_watch_study_evaluations: unknown[] }).swell_watch_study_evaluations : []);
      states.set(issuance.run_utc, { evaluated: evaluations.some((value) => value && typeof value === "object" && (value as { status?: unknown }).status === "evaluated"),
        stored: typeof issuance.id === "string" && batch && revisionSet ? { issuanceId: issuance.id, runBatchId: batch.id, revisionSetId: revisionSet.id } : null });
    }
    return states;
  } catch {
    return new Map();
  }
}

/** The database rechecks current owner attestation; acquisition never calls this itself. */
export async function completeAttestedProviderRun(
  stored: StoredProviderRunReceipt,
  client: { rpc: (name: "complete_swell_watch_provider_run_receipt", args: { p_revision_set_id: string }) => Promise<{ data: unknown; error: { message: string } | null }> },
): Promise<{ providerBatchId: string; evaluationId: string }> {
  if (![stored.issuanceId, stored.runBatchId, stored.revisionSetId].every((value) => UUID.test(value))) throw new Error("Provider completion identity is invalid");
  const { data, error } = await client.rpc("complete_swell_watch_provider_run_receipt", { p_revision_set_id: stored.revisionSetId });
  if (error) throw new Error(`Provider completion failed: ${error.message}`);
  const row = resultRow(data);
  if (typeof row.provider_batch_id !== "string" || !UUID.test(row.provider_batch_id) || row.evaluation_id !== `genuine_completed:${stored.runBatchId}`) throw new Error("Provider completion returned an invalid identity");
  return { providerBatchId: row.provider_batch_id, evaluationId: row.evaluation_id as string };
}

function validReceipt(receipt: PrototypeSingleRunReceipt): void {
  const request = receipt.requested.canonicalRequest;
  if (Buffer.byteLength(receipt.rawResponse,"utf8") > MAX_CONTENT_BYTES || Buffer.byteLength(receipt.canonicalSemanticPayload,"utf8") > MAX_CONTENT_BYTES) throw new Error("Provider run receipt content exceeds the durable limit");
  const parsed = new URL(request.url);
  const days = Number(parsed.searchParams.get("forecast_days"));
  const run = receipt.requested.runUtc;
  const expected = `${ENDPOINT}?latitude=${parsed.searchParams.get("latitude")}&longitude=${parsed.searchParams.get("longitude")}&models=ncep_gfswave016&hourly=${encodeURIComponent(HOURLY)}&run=${encodeURIComponent(run.slice(0, -1))}&cell_selection=sea&timezone=UTC&forecast_days=${days}`;
  if (receipt.qualification.status !== "prototype_unqualified" || receipt.qualification.reason !== REASON || receipt.schemaVersion !== "open-meteo-single-runs-receipt.v1" || receipt.parserVersion !== "open-meteo-single-runs-receipt.v1" || request.method !== "GET" || request.requestedRunUtc !== run || request.url !== expected || receipt.requested.model !== "ncep_gfswave016" || receipt.requested.transportProvider !== "open_meteo_single_runs" || receipt.requested.upstreamModelProvider !== "ncep" || !Number.isInteger(days) || days < 1 || days > 7) throw new Error("Provider run receipt scope is invalid");
  const requestedLatitude = Number(parsed.searchParams.get("latitude"));
  const requestedLongitude = Number(parsed.searchParams.get("longitude"));
  const latitudeDelta = (receipt.selectedGrid.latitude - requestedLatitude) * Math.PI / 180;
  const longitudeDelta = (((receipt.selectedGrid.longitude - requestedLongitude + 540) % 360) - 180) * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(requestedLatitude * Math.PI / 180) * Math.cos(receipt.selectedGrid.latitude * Math.PI / 180) * Math.sin(longitudeDelta / 2) ** 2;
  const gridDistanceKm = 6_371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  if (receipt.selectedGrid.policy.status !== "prototype_local_mapping_policy" || receipt.selectedGrid.policy.maxDistanceKm !== 30 || receipt.selectedGrid.policy.providerGuarantee || !Number.isFinite(requestedLatitude) || !Number.isFinite(requestedLongitude) || !Number.isFinite(receipt.selectedGrid.latitude) || receipt.selectedGrid.latitude < -90 || receipt.selectedGrid.latitude > 90 || !Number.isFinite(receipt.selectedGrid.longitude) || receipt.selectedGrid.longitude < -180 || receipt.selectedGrid.longitude > 180 || !Number.isFinite(receipt.selectedGrid.elevationM) || !Number.isFinite(receipt.selectedGrid.distanceFromRequestedKm) || gridDistanceKm > 30 || Math.abs(gridDistanceKm - receipt.selectedGrid.distanceFromRequestedKm) > 0.001 || !/^[a-f0-9]{64}$/.test(receipt.rawResponseSha256) || !/^[a-f0-9]{64}$/.test(receipt.revisionHash)) throw new Error("Provider run receipt provenance is invalid");
  if (receipt.observations.length !== days * 24) throw new Error("Provider run receipt scope is incomplete");
  receipt.observations.forEach((observation, index) => {
    const expectedSlot = new Date(Date.parse(run) + index * 3_600_000).toISOString().slice(0, 16);
    if (observation.providerForecastAt !== expectedSlot || observation.forecastAtUtc !== `${expectedSlot}Z` || observation.timeProvenance.field !== "time" || observation.timeProvenance.timezone !== "UTC" || observation.components.length !== 2 || observation.components[0].sourceSlot !== "s1" || observation.components[1].sourceSlot !== "s2") throw new Error("Provider run receipt slots are invalid");
    observation.components.forEach((component) => {
      if (component.unavailableReason !== undefined) {
        if (component.unavailableReason !== "provider_zero_tuple" || component.heightM !== 0 || component.periodS !== 0 || component.directionDeg !== 0) throw new Error("Provider run receipt unavailable values are invalid");
        return;
      }
      if (!Number.isFinite(component.heightM) || component.heightM < 0 || !Number.isFinite(component.periodS) || component.periodS <= 0 || !Number.isFinite(component.directionDeg) || component.directionDeg < 0 || component.directionDeg >= 360) throw new Error("Provider run receipt values are invalid");
    });
  });
}

function resultRow(data: unknown): Record<string, unknown> {
  if (Array.isArray(data) && data.length !== 1) throw new Error("Provider run receipt storage returned an invalid result");
  const row = Array.isArray(data) ? data[0] : data;
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error("Provider run receipt storage returned an invalid result");
  return row as Record<string, unknown>;
}

export async function storePrototypeSingleRunReceipts(scopes: ProviderRunScope[], client: ProviderRunReceiptRpcClient): Promise<StoredProviderRunReceipt> {
  if (!scopes.length || new Set(scopes.map(({ sourcePointId }) => sourcePointId)).size !== scopes.length || scopes.some(({ sourcePointId }) => !UUID.test(sourcePointId))) throw new Error("Provider run receipt source scope is invalid");
  const run = scopes[0].receipt.requested.runUtc;
  if (scopes.some(({ receipt }) => receipt.requested.runUtc !== run)) throw new Error("Provider run receipt batch must contain one run");
  scopes.forEach(({ receipt }) => validReceipt(receipt));
  const payload = scopes.map(({ sourcePointId, receipt }) => ({ sourcePointId, receipt: { ...receipt, hourlyUnits: UNITS } }));
  const { data, error } = await client.rpc("record_swell_watch_provider_run_receipt", { p_scopes: payload });
  if (error) throw new Error(`Provider run receipt storage failed: ${error.message}`);
  const row = resultRow(data);
  if (![row.issuance_id, row.run_batch_id, row.revision_set_id].every((value) => typeof value === "string" && UUID.test(value))) throw new Error("Provider run receipt storage returned an invalid result");
  return { issuanceId: row.issuance_id as string, runBatchId: row.run_batch_id as string, revisionSetId: row.revision_set_id as string };
}
