import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  validateProductionPolicyAuthority,
  verifySwellWatchPolicy,
  type ProductionPolicyAuthority,
  type SwellWatchPolicy,
} from "./policy";

const SWELL_WATCH_PRODUCTION_SCOPE = "swell_watch_push" as const;

type SwellWatchControlState = "shadow" | "armed" | "held" | "disabled";
type SwellWatchSafetyReasonCode =
  | "static_disabled"
  | "control_unavailable"
  | "control_not_armed"
  | "authority_unavailable"
  | "authority_revoked"
  | "authority_invalid"
  | "candidate_cap_exceeded"
  | "recipient_cap_exceeded"
  | "projected_send_cap_exceeded"
  | "data_discontinuity"
  | "material_disagreement"
  | "forecast_stale"
  | "provider_failure_rate"
  | "invalid_hold_input"
  | "event_not_releasable"
  | "recipient_not_eligible"
  | "recipient_deduplicated";

export interface SwellWatchControlRecord {
  state: SwellWatchControlState;
  epoch: number;
  reasonCode: string;
}

export interface SwellWatchAuthorityRecord {
  policyHash: string;
  approvalEvidenceHash: string;
  productionScope: string;
  reviewer: string;
  notBefore: string;
  expiresAt: string;
  authorityEpoch: number;
  revokedAt: string | null;
  supersededAt: string | null;
  approvalId?: string;
}

export interface SwellWatchControlTransition {
  operation: "hold" | "reset_shadow" | "arm";
  expectedEpoch: number;
  reasonCode: string;
  idempotencyKey: string;
  operatorUserId?: string;
  systemActor?: "swell_watch_provider_monitor";
}

export interface SwellWatchSafetyStore {
  getControl: () => Promise<SwellWatchControlRecord | null>;
  getAuthority: () => Promise<SwellWatchAuthorityRecord | null>;
  transition: (
    command: SwellWatchControlTransition,
  ) => Promise<SwellWatchControlRecord>;
}

interface SwellWatchControlResolution {
  allowed: boolean;
  epoch: number | null;
  reasonCode: SwellWatchSafetyReasonCode;
}

function configuredStaticEnablement(): boolean {
  return process.env.SWELL_WATCH_PUSH_ENABLED === "true";
}

function authorityForPolicy(
  authority: SwellWatchAuthorityRecord,
): ProductionPolicyAuthority {
  return {
    policy_hash: authority.policyHash,
    approval_id: authority.approvalId ?? "approval-unavailable",
    approval_evidence_hash: authority.approvalEvidenceHash,
    production_scope: authority.productionScope,
    reviewer: authority.reviewer,
    not_before: authority.notBefore,
    expires_at: authority.expiresAt,
    authority_epoch: authority.authorityEpoch,
    revoked_at: authority.revokedAt,
    superseded_at: authority.supersededAt,
  };
}

function policyAuthorityReason(reason: string): SwellWatchSafetyReasonCode {
  if (reason.includes("revoked")) return "authority_revoked";
  if (reason.includes("unavailable")) return "authority_unavailable";
  return "authority_invalid";
}

export async function resolveSwellWatchControl(input: {
  policy: unknown;
  store: SwellWatchSafetyStore;
  staticEnabled?: boolean;
  now?: Date;
}): Promise<SwellWatchControlResolution> {
  if (!(input.staticEnabled ?? configuredStaticEnablement())) {
    return { allowed: false, epoch: null, reasonCode: "static_disabled" };
  }
  let control: SwellWatchControlRecord | null;
  let authority: SwellWatchAuthorityRecord | null;
  try {
    [control, authority] = await Promise.all([
      input.store.getControl(),
      input.store.getAuthority(),
    ]);
  } catch {
    return { allowed: false, epoch: null, reasonCode: "control_unavailable" };
  }
  if (!control || !Number.isInteger(control.epoch) || control.epoch < 0) {
    return { allowed: false, epoch: null, reasonCode: "control_unavailable" };
  }
  if (control.state !== "armed") {
    return { allowed: false, epoch: control.epoch, reasonCode: "control_not_armed" };
  }
  if (!authority) {
    return { allowed: false, epoch: control.epoch, reasonCode: "authority_unavailable" };
  }
  const validation = validateProductionPolicyAuthority(
    input.policy,
    authorityForPolicy(authority),
    { scope: SWELL_WATCH_PRODUCTION_SCOPE, now: input.now },
  );
  if (!validation.authorized) {
    return {
      allowed: false,
      epoch: control.epoch,
      reasonCode: policyAuthorityReason(validation.reason),
    };
  }
  return { allowed: true, epoch: control.epoch, reasonCode: "control_not_armed" };
}

export function evaluateSwellWatchSafety(input: {
  policy: unknown;
  candidateCount: number;
  recipientCount: number;
  projectedSendCount: number | null;
  hasDiscontinuousData: boolean;
  hasMaterialDisagreement: boolean;
  stale: boolean;
  providerFailures: { samples: number; failures: number } | null;
}): { reasonCode: SwellWatchSafetyReasonCode | null; missingMetrics: string[] } {
  const policy = input.policy as SwellWatchPolicy;
  const values = verifySwellWatchPolicy(policy) ? policy.policy_values : null;
  const numericInput = [
    input.candidateCount,
    input.recipientCount,
    ...(input.projectedSendCount === null ? [] : [input.projectedSendCount]),
    ...(input.providerFailures === null ? [] : [input.providerFailures.samples, input.providerFailures.failures]),
  ].every((value) => Number.isFinite(value) && value >= 0);
  const reasonCode: SwellWatchSafetyReasonCode | null =
    !numericInput
      ? "invalid_hold_input"
      : !values
        ? "authority_invalid"
        : input.candidateCount > values.volume_caps.maximum_candidates_per_region
      ? "candidate_cap_exceeded"
      : input.recipientCount > values.volume_caps.maximum_recipients_per_event
        ? "recipient_cap_exceeded"
        : input.projectedSendCount !== null && input.projectedSendCount > values.volume_caps.maximum_projected_sends_per_window
          ? "projected_send_cap_exceeded"
          : input.hasDiscontinuousData
            ? "data_discontinuity"
            : input.hasMaterialDisagreement
              ? "material_disagreement"
              : input.stale
                ? "forecast_stale"
                : input.providerFailures !== null && input.providerFailures.samples >= values.provider_failure_hold.minimum_samples &&
                    input.providerFailures.failures / input.providerFailures.samples > values.provider_failure_hold.maximum_failure_rate
                  ? "provider_failure_rate"
                  : null;
  return { reasonCode, missingMetrics: [
    ...(input.projectedSendCount === null ? ["projected_send_window"] : []),
    ...(input.providerFailures === null ? ["delivery_health"] : []),
  ] };
}

export async function evaluateSwellWatchHolds(input: {
  policy: unknown;
  store: SwellWatchSafetyStore;
  expectedEpoch: number;
  idempotencyKey: string;
  candidateCount: number;
  recipientCount: number;
  projectedSendCount: number;
  hasDiscontinuousData: boolean;
  hasMaterialDisagreement: boolean;
  stale: boolean;
  providerFailures: { samples: number; failures: number };
  operatorUserId?: string;
}): Promise<{ held: boolean; reasonCode: SwellWatchSafetyReasonCode | null }> {
  const safety = evaluateSwellWatchSafety(input);
  const reasonCode = safety.missingMetrics.length ? "invalid_hold_input" : safety.reasonCode;
  if (!reasonCode) return { held: false, reasonCode: null };
  await input.store.transition({
    operation: "hold",
    expectedEpoch: input.expectedEpoch,
    reasonCode,
    idempotencyKey: input.idempotencyKey,
    operatorUserId: input.operatorUserId,
    systemActor: input.operatorUserId ? undefined : "swell_watch_provider_monitor",
  });
  return { held: true, reasonCode };
}

export async function validateSwellWatchRelease(input: {
  policy: unknown;
  store: SwellWatchSafetyStore;
  staticEnabled?: boolean;
  now?: Date;
  event: { stable: boolean; actionable: boolean; forecastAt: string };
  recipient: {
    relationshipActive: boolean;
    preferencesEnabled: boolean;
    activeDevice: boolean;
    dedupeAvailable: boolean;
  };
}): Promise<SwellWatchControlResolution> {
  const control = await resolveSwellWatchControl(input);
  if (!control.allowed) return control;
  if (!input.event.stable || !input.event.actionable) {
    return { ...control, allowed: false, reasonCode: "event_not_releasable" };
  }
  const forecastAt = Date.parse(input.event.forecastAt);
  const now = (input.now ?? new Date()).getTime();
  const policy = input.policy as SwellWatchPolicy;
  const maximumForecastAgeHours = verifySwellWatchPolicy(policy)
    ? policy.policy_values.staleness.maximum_forecast_age_hours
    : Number.NaN;
  if (!Number.isFinite(maximumForecastAgeHours) || !Number.isFinite(forecastAt) || !Number.isFinite(now) || now - forecastAt > maximumForecastAgeHours * 60 * 60 * 1000) {
    return { ...control, allowed: false, reasonCode: "forecast_stale" };
  }
  if (!input.recipient.relationshipActive || !input.recipient.preferencesEnabled || !input.recipient.activeDevice) {
    return { ...control, allowed: false, reasonCode: "recipient_not_eligible" };
  }
  if (!input.recipient.dedupeAvailable) {
    return { ...control, allowed: false, reasonCode: "recipient_deduplicated" };
  }
  return control;
}

type RpcClient = Pick<SupabaseClient, "rpc">;

function parseControl(value: unknown): SwellWatchControlRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    !["disabled", "shadow", "armed", "held"].includes(String(row.state)) ||
    typeof row.epoch !== "number" ||
    !Number.isInteger(row.epoch) ||
    typeof row.reason_code !== "string"
  ) return null;
  return { state: row.state as SwellWatchControlState, epoch: row.epoch, reasonCode: row.reason_code };
}

function parseAuthority(value: unknown): SwellWatchAuthorityRecord | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const fields = ["policy_hash", "approval_evidence_hash", "production_scope", "reviewer", "not_before", "expires_at"];
  if (fields.some((field) => typeof row[field] !== "string") || !Number.isInteger(row.authority_epoch)) return null;
  return {
    policyHash: row.policy_hash as string,
    approvalEvidenceHash: row.approval_evidence_hash as string,
    productionScope: row.production_scope as string,
    reviewer: row.reviewer as string,
    notBefore: row.not_before as string,
    expiresAt: row.expires_at as string,
    authorityEpoch: row.authority_epoch as number,
    revokedAt: typeof row.revoked_at === "string" ? row.revoked_at : null,
    supersededAt: typeof row.superseded_at === "string" ? row.superseded_at : null,
    approvalId: typeof row.approval_id === "string" ? row.approval_id : undefined,
  };
}

export function createSupabaseSwellWatchSafetyStore(client: RpcClient): SwellWatchSafetyStore {
  return {
    async getControl() {
      const result = await client.rpc("swell_watch_get_automation_control" as never);
      if (result.error) throw new Error("swell watch control lookup failed");
      return parseControl(Array.isArray(result.data) ? result.data[0] : result.data);
    },
    async getAuthority() {
      const result = await client.rpc("swell_watch_get_production_authority" as never);
      if (result.error) throw new Error("swell watch authority lookup failed");
      return parseAuthority(Array.isArray(result.data) ? result.data[0] : result.data);
    },
    async transition(command) {
      const result = await client.rpc("transition_swell_watch_automation_control" as never, {
        p_operation: command.operation,
        p_expected_epoch: command.expectedEpoch,
        p_reason_code: command.reasonCode,
        p_idempotency_key: command.idempotencyKey,
        p_actor_user_id: command.operatorUserId,
        p_system_actor: command.systemActor ?? null,
      } as never);
      if (result.error) throw new Error("swell watch control transition failed");
      const control = parseControl(Array.isArray(result.data) ? result.data[0] : result.data);
      if (!control) throw new Error("swell watch control transition returned invalid state");
      return control;
    },
  };
}

export async function executeSwellWatchControlCommand(
  command: SwellWatchControlTransition,
  store: SwellWatchSafetyStore,
): Promise<SwellWatchControlRecord> {
  return store.transition(command);
}
