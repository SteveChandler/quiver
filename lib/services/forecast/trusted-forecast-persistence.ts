/**
 * Persistence client for the single trusted-forecast build RPC
 * (Phase 21, MFA-06 / D-18 through D-21).
 *
 * `public.persist_trusted_forecast_build` writes decisions, first-write
 * snapshots, slot applications, alerts and — last, in the same transaction —
 * the immutable build receipt. Adjusted heights may reach a user only once that
 * receipt is in hand, so this module's whole job is classifying what came back:
 *
 *  1. receipt returned and matching                  -> adjusted output allowed
 *  2. receipt returned but counts/versions differ    -> retriable throw
 *  3. definite structured rejection (not uniqueness) -> baseline may be served
 *  4. uniqueness collision                           -> reconcile, never baseline
 *  5. transport ambiguity                            -> reconcile
 *  6. reconciliation finds a matching durable receipt-> adjusted output allowed
 *  7. reconciliation finds nothing or a mismatch     -> retriable throw
 *  8. reconciliation itself unreadable               -> retriable throw
 *
 * If classification is uncertain, it is ambiguous. Nothing here logs or returns
 * source ranges, URLs, hashes, evidence or internal identifiers: statuses and
 * counts only.
 */

import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type {
  TrustedForecastAlertPayload,
  TrustedForecastApplicationPayload,
  TrustedForecastDecisionPayload,
} from "./trusted-forecast-adjustment";
import type { DisplayPredictionRow } from "./log-display-prediction";

export const TRUSTED_FORECAST_BUILD_SCHEMA_VERSION =
  "trusted-forecast-build-v1";

export const PERSIST_TRUSTED_FORECAST_BUILD_RPC =
  "persist_trusted_forecast_build";
export const GET_TRUSTED_FORECAST_BUILD_RECEIPT_RPC =
  "get_trusted_forecast_build_receipt";

/** Max `buildKey` length accepted by the RPC's own contract check. */
const MAX_BUILD_KEY_LENGTH = 200;

/**
 * Postgres error codes that mean the database definitely rejected the payload
 * and definitely wrote nothing. Baseline output stays byte-identical, so
 * serving it is safe.
 *
 * `23505` is deliberately absent: a unique violation means another writer may
 * already hold the durable row this build is about, which is reconciliation,
 * not a safe baseline.
 */
const DEFINITE_REJECTION_CODES: ReadonlySet<string> = new Set([
  "22023", // invalid_parameter_value — every contract check in the RPC
  "22P02", // invalid_text_representation — a malformed uuid/date in the payload
  "23502", // not_null_violation
  "23503", // foreign_key_violation
  "23514", // check_violation
  "42501", // insufficient_privilege — nothing was written
  "42883", // undefined_function
  "PGRST202", // PostgREST: RPC not exposed (migration not applied yet)
  "PGRST203", // PostgREST: ambiguous overload — no write happened
]);

const UNIQUENESS_CODE = "23505";

export interface TrustedForecastBuildReceipt {
  readonly buildKey: string;
  readonly payloadSha256: string;
  readonly schemaVersion: string;
  readonly policyVersion: string;
  readonly expectedDecisionCount: number;
  readonly expectedApplicationCount: number;
  readonly expectedAlertCount: number;
  readonly expectedSnapshotCount: number;
  readonly insertedDecisionCount: number;
  readonly reusedDecisionCount: number;
  readonly insertedApplicationCount: number;
  readonly reusedApplicationCount: number;
  readonly insertedAlertCount: number;
  readonly reusedAlertCount: number;
  readonly insertedSnapshotCount: number;
  readonly reusedSnapshotCount: number;
  readonly durableAlertCount: number;
}

const RECEIPT_ROW = z.object({
  build_key: z.string().min(1),
  payload_sha256: z.string().regex(/^[0-9a-f]{64}$/),
  schema_version: z.string().min(1),
  policy_version: z.string().min(1),
  expected_decision_count: z.number().int().nonnegative(),
  expected_application_count: z.number().int().nonnegative(),
  expected_alert_count: z.number().int().nonnegative(),
  expected_snapshot_count: z.number().int().nonnegative(),
  inserted_decision_count: z.number().int().nonnegative(),
  reused_decision_count: z.number().int().nonnegative(),
  inserted_application_count: z.number().int().nonnegative(),
  reused_application_count: z.number().int().nonnegative(),
  inserted_alert_count: z.number().int().nonnegative(),
  reused_alert_count: z.number().int().nonnegative(),
  inserted_snapshot_count: z.number().int().nonnegative(),
  reused_snapshot_count: z.number().int().nonnegative(),
  durable_alert_count: z.number().int().nonnegative(),
});

function toReceipt(row: unknown): TrustedForecastBuildReceipt | null {
  const parsed = RECEIPT_ROW.safeParse(row);
  if (!parsed.success) return null;
  const value = parsed.data;
  return {
    buildKey: value.build_key,
    payloadSha256: value.payload_sha256,
    schemaVersion: value.schema_version,
    policyVersion: value.policy_version,
    expectedDecisionCount: value.expected_decision_count,
    expectedApplicationCount: value.expected_application_count,
    expectedAlertCount: value.expected_alert_count,
    expectedSnapshotCount: value.expected_snapshot_count,
    insertedDecisionCount: value.inserted_decision_count,
    reusedDecisionCount: value.reused_decision_count,
    insertedApplicationCount: value.inserted_application_count,
    reusedApplicationCount: value.reused_application_count,
    insertedAlertCount: value.inserted_alert_count,
    reusedAlertCount: value.reused_alert_count,
    insertedSnapshotCount: value.inserted_snapshot_count,
    reusedSnapshotCount: value.reused_snapshot_count,
    durableAlertCount: value.durable_alert_count,
  };
}

/** Exactly the keys `persist_trusted_forecast_build` accepts at the top level. */
export interface TrustedForecastBuildPayload {
  readonly schemaVersion: string;
  readonly policyVersion: string;
  readonly buildKey: string;
  readonly buildAnchorAt: string;
  readonly decisions: readonly TrustedForecastDecisionPayload[];
  readonly applications: readonly TrustedForecastApplicationPayload[];
  readonly alerts: readonly TrustedForecastAlertPayload[];
  readonly snapshots: readonly Record<string, unknown>[];
  readonly expectedDecisionCount: number;
  readonly expectedApplicationCount: number;
  readonly expectedAlertCount: number;
  readonly expectedSnapshotCount: number;
}

export type TrustedForecastPersistenceErrorCode =
  | "ambiguous_commit_unresolved"
  | "receipt_mismatch"
  | "receipt_unreadable"
  | "receipt_missing";

/**
 * A build whose durable outcome is unknown. Retriable by definition: the caller
 * must neither serve adjusted output nor claim baseline is correct.
 */
export class TrustedForecastPersistenceError extends Error {
  readonly code: TrustedForecastPersistenceErrorCode;
  readonly retriable = true as const;

  constructor(code: TrustedForecastPersistenceErrorCode, detail?: string) {
    super(
      detail === undefined
        ? `trusted forecast build ${code}`
        : `trusted forecast build ${code}: ${detail}`,
    );
    this.name = "TrustedForecastPersistenceError";
    this.code = code;
  }
}

export interface RpcResult {
  readonly data: unknown;
  readonly error: {
    readonly code?: string | null;
    readonly message?: string | null;
  } | null;
}

/** Injectable so the transport matrix is exercised without a live database. */
export interface TrustedForecastPersistenceStore {
  persistBuild(payload: TrustedForecastBuildPayload): Promise<RpcResult>;
  loadReceipt(buildKey: string): Promise<RpcResult>;
}

type TrustedForecastSupabaseClient = SupabaseClient<Database>;

export function createTrustedForecastPersistenceStore(
  createClient: () => TrustedForecastSupabaseClient,
): TrustedForecastPersistenceStore {
  return {
    async persistBuild(payload) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        PERSIST_TRUSTED_FORECAST_BUILD_RPC as never,
        { p_payload: payload } as never,
      );
      return { data, error };
    },
    async loadReceipt(buildKey) {
      const supabase = createClient();
      const { data, error } = await supabase.rpc(
        GET_TRUSTED_FORECAST_BUILD_RECEIPT_RPC as never,
        { p_build_key: buildKey } as never,
      );
      return { data, error };
    },
  };
}

export type TrustedForecastPersistenceOutcome =
  | {
      readonly kind: "receipt";
      readonly receipt: TrustedForecastBuildReceipt;
      /** True when the receipt came from reconciliation, not the first call. */
      readonly reconciled: boolean;
    }
  | {
      readonly kind: "definite_rejection";
      /** Error code only — never the database message, which quotes payload values. */
      readonly code: string;
    };

/**
 * Deterministic per build. Reconciliation depends on a retry of the same build
 * producing the same key, and the RPC's advisory lock is taken on it.
 */
export function trustedForecastBuildKey(args: {
  readonly beachId: string;
  readonly buildAnchorAt: Date;
  readonly policyVersion: string;
}): string {
  const key = `tf:${args.policyVersion}:${args.beachId}:${args.buildAnchorAt.toISOString()}`;
  return key.length > MAX_BUILD_KEY_LENGTH
    ? key.slice(0, MAX_BUILD_KEY_LENGTH)
    : key;
}

function rowsFrom(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data === null || data === undefined) return [];
  return [data];
}

/**
 * The equality the caller can actually assert.
 *
 * `payload_sha256` is computed inside the database from its own canonical form
 * precisely so a caller-supplied hash is impossible, which also means this
 * process cannot recompute it. The hash comparison is therefore delegated to
 * the only party that can make it — see `reconcile` below, which re-invokes the
 * RPC so the database compares its stored hash against a freshly canonicalized
 * payload and raises `23505` if they differ.
 */
function receiptMatchesPayload(
  receipt: TrustedForecastBuildReceipt,
  payload: TrustedForecastBuildPayload,
): boolean {
  return (
    receipt.buildKey === payload.buildKey &&
    receipt.schemaVersion === payload.schemaVersion &&
    receipt.policyVersion === payload.policyVersion &&
    receipt.expectedDecisionCount === payload.expectedDecisionCount &&
    receipt.expectedApplicationCount === payload.expectedApplicationCount &&
    receipt.expectedAlertCount === payload.expectedAlertCount &&
    receipt.expectedSnapshotCount === payload.expectedSnapshotCount &&
    receipt.insertedDecisionCount + receipt.reusedDecisionCount ===
      payload.expectedDecisionCount &&
    receipt.insertedApplicationCount + receipt.reusedApplicationCount ===
      payload.expectedApplicationCount &&
    receipt.insertedAlertCount + receipt.reusedAlertCount ===
      payload.expectedAlertCount &&
    receipt.insertedSnapshotCount + receipt.reusedSnapshotCount ===
      payload.expectedSnapshotCount
  );
}

function singleReceipt(data: unknown): TrustedForecastBuildReceipt | null {
  const rows = rowsFrom(data);
  if (rows.length !== 1) return null;
  return toReceipt(rows[0]);
}

/**
 * Reconcile a build whose outcome is unknown: read the durable receipt, then
 * have the database itself confirm the stored canonical hash belongs to THIS
 * payload by replaying the idempotent RPC once.
 */
async function reconcile(
  store: TrustedForecastPersistenceStore,
  payload: TrustedForecastBuildPayload,
  cause: string,
): Promise<TrustedForecastPersistenceOutcome> {
  let lookup: RpcResult;
  try {
    lookup = await store.loadReceipt(payload.buildKey);
  } catch {
    throw new TrustedForecastPersistenceError("receipt_unreadable", cause);
  }
  if (lookup.error) {
    throw new TrustedForecastPersistenceError("receipt_unreadable", cause);
  }

  const rows = rowsFrom(lookup.data);
  if (rows.length === 0) {
    throw new TrustedForecastPersistenceError("receipt_missing", cause);
  }
  const receipt = rows.length === 1 ? toReceipt(rows[0]) : null;
  if (receipt === null || !receiptMatchesPayload(receipt, payload)) {
    throw new TrustedForecastPersistenceError("receipt_mismatch", cause);
  }

  // Counts and versions agree. The content hash is database-owned, so replay
  // the idempotent RPC exactly once and let the database compare it: an
  // identical payload returns the same receipt, a divergent one raises 23505.
  let replay: RpcResult;
  try {
    replay = await store.persistBuild(payload);
  } catch {
    throw new TrustedForecastPersistenceError(
      "ambiguous_commit_unresolved",
      cause,
    );
  }
  if (replay.error) {
    throw new TrustedForecastPersistenceError("receipt_mismatch", cause);
  }
  const replayed = singleReceipt(replay.data);
  if (replayed === null || !receiptMatchesPayload(replayed, payload)) {
    throw new TrustedForecastPersistenceError("receipt_mismatch", cause);
  }
  if (replayed.payloadSha256 !== receipt.payloadSha256) {
    throw new TrustedForecastPersistenceError("receipt_mismatch", cause);
  }

  return { kind: "receipt", receipt: replayed, reconciled: true };
}

/**
 * Commit one complete build. The only success that authorizes adjusted output
 * is a matching receipt.
 */
export async function persistTrustedForecastBuild(args: {
  readonly store: TrustedForecastPersistenceStore;
  readonly payload: TrustedForecastBuildPayload;
}): Promise<TrustedForecastPersistenceOutcome> {
  const { store, payload } = args;

  let result: RpcResult;
  try {
    result = await store.persistBuild(payload);
  } catch (cause) {
    // A thrown transport error (timeout, reset, abort, no response) says
    // nothing about whether the transaction committed.
    return reconcile(
      store,
      payload,
      cause instanceof Error ? cause.name : "transport_exception",
    );
  }

  if (result.error) {
    const code = result.error.code ?? "";
    if (code === UNIQUENESS_CODE) {
      // Decision, slot and build-key collisions all land here. Another writer
      // may already hold the durable row, so baseline is not safe.
      return reconcile(store, payload, `sqlstate_${UNIQUENESS_CODE}`);
    }
    if (DEFINITE_REJECTION_CODES.has(code)) {
      return { kind: "definite_rejection", code };
    }
    // Unclassifiable failure. Uncertainty is ambiguity.
    return reconcile(store, payload, code === "" ? "unclassified" : code);
  }

  const receipt = singleReceipt(result.data);
  if (receipt === null) {
    // A success with no parseable receipt row is exactly the "missing response"
    // case: the transaction may well have committed.
    return reconcile(store, payload, "unparseable_receipt");
  }
  if (!receiptMatchesPayload(receipt, payload)) {
    throw new TrustedForecastPersistenceError(
      "receipt_mismatch",
      "returned receipt",
    );
  }
  return { kind: "receipt", receipt, reconciled: false };
}

/**
 * Map a buffered first-write snapshot row onto the RPC's snapshot column
 * contract. Only `wave_height_om_m` needs renaming; every other key is already
 * the `ml_predictions_log` column name.
 */
export function toTrustedForecastSnapshotPayload(
  row: DisplayPredictionRow,
): Record<string, unknown> {
  const { wave_height_om_m: waveHeightOm, model_version: modelVersion, ...rest } =
    row;
  return {
    ...rest,
    wave_height_om: waveHeightOm,
    model_version: modelVersion ?? row.display_source,
  };
}
