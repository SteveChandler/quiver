import "server-only";

import { z } from "zod";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

import { parseMajorEventHoldCandidate } from "./evaluator";
import {
  MAJOR_EVENT_HOLD_ACTIONS,
  MAJOR_EVENT_HOLD_AUTHORIZING_ACTORS,
  MAJOR_EVENT_HOLD_EXPOSURE_CLASSES,
  MAJOR_EVENT_HOLD_REASON_CODES,
  MAJOR_EVENT_HOLD_STATUSES,
  MAJOR_EVENT_HOLD_TRANSITIONS,
  MAJOR_EVENT_HOLD_TRIGGER_TYPES,
} from "./types";
import type {
  MajorEventHoldCandidate,
  MajorEventHoldProvenance,
  MajorEventHoldResolution,
  RegionalRecommendationHoldRecord,
  ResolvedMajorEventHold,
} from "./types";

const REGION_KEY_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const EVENT_REFERENCE_PATTERN =
  /^(event|official|qa):[a-z0-9_]+:[A-Za-z0-9_-]{1,64}$/;
const SUPPORTING_EVIDENCE_REFERENCE_PATTERN =
  /^(official:rip_current_risks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|qa:artifact:[A-Za-z0-9_-]{1,64})$/;
const AUTOMATIC_POLICY_VERSION_PATTERN = /^[a-z0-9._-]{1,64}$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9:_-]{1,160}$/;
const PAYLOAD_HASH_PATTERN = /^[0-9a-f]{64}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9:_-]{1,96}$/;
const SEVEN_DAYS_MILLISECONDS = 7 * 24 * 60 * 60 * 1000;
const UUID_SCHEMA = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());

function hasUniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

const resolvedHoldRowSchema = z
  .object({
    record_id: UUID_SCHEMA,
    hold_id: UUID_SCHEMA,
    version: z.number().int().positive(),
    transition: z.enum(MAJOR_EVENT_HOLD_TRANSITIONS),
    status: z.enum(MAJOR_EVENT_HOLD_STATUSES),
    region_keys: z.array(z.string().regex(REGION_KEY_PATTERN)).max(64),
    scope_beach_ids: z.array(UUID_SCHEMA).min(1).max(2000),
    scope_exposure_classes: z
      .array(z.enum(MAJOR_EVENT_HOLD_EXPOSURE_CLASSES))
      .max(4),
    protected_alternative_beach_ids: z.array(UUID_SCHEMA).max(2000),
    event_reference: z.string().regex(EVENT_REFERENCE_PATTERN).nullable(),
    valid_from: z.string().datetime({ offset: true }),
    valid_until: z.string().datetime({ offset: true }),
    affected_cohorts: z
      .array(
        z.enum(["beginner", "intermediate", "advanced", "expert", "unknown"]),
      )
      .min(1)
      .max(5),
    action: z.enum(MAJOR_EVENT_HOLD_ACTIONS),
    trigger_type: z.enum(MAJOR_EVENT_HOLD_TRIGGER_TYPES),
    supporting_evidence_refs: z
      .array(z.string().regex(SUPPORTING_EVIDENCE_REFERENCE_PATTERN))
      .max(16),
    automatic_policy_version: z
      .string()
      .regex(AUTOMATIC_POLICY_VERSION_PATTERN)
      .nullable(),
    authorizing_operator_ref: UUID_SCHEMA.nullable(),
    authorizing_actor: z.enum(MAJOR_EVENT_HOLD_AUTHORIZING_ACTORS),
    reason_code: z.enum(MAJOR_EVENT_HOLD_REASON_CODES),
    effective_at: z.string().datetime({ offset: true }),
    expires_at: z.string().datetime({ offset: true }),
    supersedes_record_id: UUID_SCHEMA.nullable(),
    idempotency_key: z.string().regex(IDEMPOTENCY_KEY_PATTERN),
    payload_hash: z.string().regex(PAYLOAD_HASH_PATTERN),
    request_id: z.string().regex(REQUEST_ID_PATTERN).nullable(),
    created_at: z.string().datetime({ offset: true }),
  })
  .strict()
  .superRefine((row, context) => {
    const effectiveAt = Date.parse(row.effective_at);
    const expiresAt = Date.parse(row.expires_at);
    if (Date.parse(row.valid_until) <= Date.parse(row.valid_from)) {
      context.addIssue({
        code: "custom",
        message: "invalid valid-time window",
      });
    }
    if (
      expiresAt <= effectiveAt ||
      expiresAt > effectiveAt + SEVEN_DAYS_MILLISECONDS
    ) {
      context.addIssue({ code: "custom", message: "invalid expiry window" });
    }
    if (!hasUniqueValues(row.region_keys)) {
      context.addIssue({ code: "custom", message: "duplicate region scope" });
    }
    if (!hasUniqueValues(row.scope_beach_ids)) {
      context.addIssue({ code: "custom", message: "duplicate beach scope" });
    }
    if (!hasUniqueValues(row.scope_exposure_classes)) {
      context.addIssue({ code: "custom", message: "duplicate exposure scope" });
    }
    if (!hasUniqueValues(row.protected_alternative_beach_ids)) {
      context.addIssue({
        code: "custom",
        message: "duplicate protected beach",
      });
    }
    if (!hasUniqueValues(row.affected_cohorts)) {
      context.addIssue({ code: "custom", message: "duplicate cohort scope" });
    }
    if (!hasUniqueValues(row.supporting_evidence_refs)) {
      context.addIssue({
        code: "custom",
        message: "duplicate evidence reference",
      });
    }

    const isActivation = row.transition === "activation";
    if (
      (isActivation &&
        (row.version !== 1 || row.supersedes_record_id !== null)) ||
      (!isActivation && (row.version <= 1 || row.supersedes_record_id === null))
    ) {
      context.addIssue({ code: "custom", message: "invalid transition chain" });
    }
    if (
      (row.transition === "cancellation" && row.status !== "cancelled") ||
      (row.transition !== "cancellation" && row.status !== "active")
    ) {
      context.addIssue({
        code: "custom",
        message: "invalid transition status",
      });
    }
    if (
      row.action === "protected_alternatives_only" &&
      row.protected_alternative_beach_ids.length === 0
    ) {
      context.addIssue({
        code: "custom",
        message: "missing protected alternative",
      });
    }

    if (row.trigger_type === "manual_operator") {
      if (
        row.authorizing_operator_ref === null ||
        row.automatic_policy_version !== null ||
        row.authorizing_actor !== "admin_api"
      ) {
        context.addIssue({
          code: "custom",
          message: "invalid manual provenance",
        });
      }
      return;
    }

    const officialReference = row.supporting_evidence_refs[0];
    if (
      row.transition !== "activation" ||
      row.status !== "active" ||
      row.version !== 1 ||
      row.supersedes_record_id !== null ||
      row.action !== "suppress_positive" ||
      row.scope_beach_ids.length !== 1 ||
      row.region_keys.length !== 0 ||
      row.scope_exposure_classes.length !== 0 ||
      row.protected_alternative_beach_ids.length !== 0 ||
      row.affected_cohorts.join(",") !== "beginner,intermediate,unknown" ||
      row.supporting_evidence_refs.length !== 1 ||
      !officialReference?.startsWith("official:rip_current_risks:") ||
      row.event_reference !== officialReference ||
      row.automatic_policy_version !== "official-rip-high.v1" ||
      row.authorizing_operator_ref !== null ||
      row.authorizing_actor !== "official_automation" ||
      row.reason_code !== "official_high_rip_current"
    ) {
      context.addIssue({
        code: "custom",
        message: "invalid official provenance",
      });
    }
  });

interface ResolverRpcArguments {
  p_as_of: string;
  p_beach_ids: string[];
  p_window_start: string;
  p_window_end: string;
}

interface ResolverRpcResponse {
  data: unknown;
  error: unknown;
}

type ResolverRpc = (
  name: "resolve_active_regional_recommendation_holds",
  arguments_: ResolverRpcArguments,
) => PromiseLike<ResolverRpcResponse>;

export interface MajorEventHoldRpcClient {
  rpc: unknown;
}

export interface ResolveMajorEventHoldsOptions {
  client?: MajorEventHoldRpcClient;
  asOf?: Date;
}

const UNRESOLVED: MajorEventHoldResolution = {
  state: "unresolved",
  holds: [],
};

function toProvenance(
  row: z.infer<typeof resolvedHoldRowSchema>,
): MajorEventHoldProvenance {
  if (
    row.trigger_type === "manual_operator" &&
    row.authorizing_operator_ref !== null
  ) {
    return {
      triggerType: row.trigger_type,
      automaticPolicyVersion: null,
      authorizingOperatorRef: row.authorizing_operator_ref,
      authorizingActor: "admin_api",
    };
  }
  if (
    row.trigger_type === "automatic_official" &&
    row.automatic_policy_version === "official-rip-high.v1"
  ) {
    return {
      triggerType: row.trigger_type,
      automaticPolicyVersion: row.automatic_policy_version,
      authorizingOperatorRef: null,
      authorizingActor: "official_automation",
    };
  }
  throw new Error("invalid hold provenance");
}

function toApplicationHoldRecord(
  row: z.infer<typeof resolvedHoldRowSchema>,
): RegionalRecommendationHoldRecord {
  return {
    recordId: row.record_id,
    holdId: row.hold_id,
    version: row.version,
    transition: row.transition,
    status: row.status,
    regionKeys: [...row.region_keys],
    scopeBeachIds: [...row.scope_beach_ids],
    scopeExposureClasses: [...row.scope_exposure_classes],
    protectedAlternativeBeachIds: [...row.protected_alternative_beach_ids],
    eventReference: row.event_reference,
    validFrom: row.valid_from,
    validUntil: row.valid_until,
    affectedCohorts: [...row.affected_cohorts],
    action: row.action,
    supportingEvidenceRefs: [...row.supporting_evidence_refs],
    reasonCode: row.reason_code,
    effectiveAt: row.effective_at,
    expiresAt: row.expires_at,
    supersedesRecordId: row.supersedes_record_id,
    idempotencyKey: row.idempotency_key,
    payloadHash: row.payload_hash,
    requestId: row.request_id,
    createdAt: row.created_at,
    ...toProvenance(row),
  };
}

function toResolvedHold(
  record: RegionalRecommendationHoldRecord,
): ResolvedMajorEventHold {
  return {
    recordId: record.recordId,
    holdId: record.holdId,
    version: record.version,
    status: record.status,
    scopeBeachIds: [...record.scopeBeachIds],
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    affectedCohorts: [...record.affectedCohorts],
    action: record.action,
    expiresAt: record.expiresAt,
  };
}

function parseCandidates(
  candidates: readonly unknown[],
): MajorEventHoldCandidate[] | null {
  const parsed = candidates.map(parseMajorEventHoldCandidate);
  return parsed.every(
    (candidate): candidate is MajorEventHoldCandidate => candidate !== null,
  )
    ? parsed
    : null;
}

export async function resolveMajorEventHolds(
  candidates: readonly unknown[],
  options: ResolveMajorEventHoldsOptions = {},
): Promise<MajorEventHoldResolution> {
  if (candidates.length === 0) return { state: "resolved", holds: [] };

  const parsedCandidates = parseCandidates(candidates);
  const asOf = options.asOf ?? new Date();
  if (parsedCandidates === null || !Number.isFinite(asOf.getTime())) {
    return UNRESOLVED;
  }

  const beachIds = [
    ...new Set(parsedCandidates.map(({ beachId }) => beachId)),
  ].sort();
  const startsAt = parsedCandidates.map(({ startsAt }) => startsAt);
  const endsAt = parsedCandidates.map(({ endsAt }) => endsAt);
  const windowStart = startsAt.reduce((earliest, value) =>
    Date.parse(value) < Date.parse(earliest) ? value : earliest,
  );
  const windowEnd = endsAt.reduce((latest, value) =>
    Date.parse(value) > Date.parse(latest) ? value : latest,
  );
  const diagnostics = {
    candidateCount: parsedCandidates.length,
    beachCount: beachIds.length,
    asOf: asOf.toISOString(),
  };

  try {
    const client = options.client ?? createSupabaseServiceRoleClient();
    const rpc = client.rpc as ResolverRpc;
    const { data, error } = await rpc.call(
      client,
      "resolve_active_regional_recommendation_holds",
      {
        p_as_of: asOf.toISOString(),
        p_beach_ids: beachIds,
        p_window_start: windowStart,
        p_window_end: windowEnd,
      },
    );
    if (error !== null && error !== undefined) {
      const rpcError =
        typeof error === "object"
          ? (error as { code?: unknown; message?: unknown })
          : null;
      console.error("[major-event-hold:repository:rpc-error]", {
        ...diagnostics,
        error:
          typeof rpcError?.message === "string"
            ? rpcError.message
            : String(error),
        code: typeof rpcError?.code === "string" ? rpcError.code : undefined,
      });
      return UNRESOLVED;
    }
    if (!Array.isArray(data)) {
      console.error(
        "[major-event-hold:repository:invalid-response-shape]",
        diagnostics,
      );
      return UNRESOLVED;
    }

    const records: RegionalRecommendationHoldRecord[] = [];
    const holds: ResolvedMajorEventHold[] = [];
    for (const row of data) {
      const parsedRow = resolvedHoldRowSchema.safeParse(row);
      if (!parsedRow.success) {
        console.error("[major-event-hold:repository:invalid-hold-row]", {
          ...diagnostics,
          issues: parsedRow.error.issues.map(({ path, message }) => ({
            path,
            message,
          })),
        });
        return UNRESOLVED;
      }
      const record = toApplicationHoldRecord(parsedRow.data);
      records.push(record);
      holds.push(toResolvedHold(record));
    }
    const asOfMilliseconds = asOf.getTime();
    const windowStartMilliseconds = Date.parse(windowStart);
    const windowEndMilliseconds = Date.parse(windowEnd);
    const requestedBeachIds = new Set(beachIds);
    if (
      holds.some((hold, index) => {
        const record = records[index];
        const invalidated =
          record.status !== "active" ||
          record.scopeExposureClasses.length !== 0 ||
          Date.parse(record.effectiveAt) > asOfMilliseconds ||
          Date.parse(hold.expiresAt) <= asOfMilliseconds ||
          Date.parse(hold.validFrom) >= windowEndMilliseconds ||
          Date.parse(hold.validUntil) <= windowStartMilliseconds ||
          !hold.scopeBeachIds.some((beachId) => requestedBeachIds.has(beachId));
        if (invalidated) {
          console.error("[major-event-hold:repository:hold-invalidated]", {
            ...diagnostics,
            recordId: record.recordId,
            holdId: hold.holdId,
          });
        }
        return invalidated;
      })
    ) {
      return UNRESOLVED;
    }
    const holdIds = holds.map(({ holdId }) => holdId);
    if (new Set(holdIds).size !== holdIds.length) {
      const duplicateHoldId = holdIds.find(
        (holdId, index) => holdIds.indexOf(holdId) !== index,
      );
      console.error("[major-event-hold:repository:duplicate-hold-ids]", {
        ...diagnostics,
        holdId: duplicateHoldId,
      });
      return UNRESOLVED;
    }

    return { state: "resolved", holds };
  } catch (error) {
    console.error("[major-event-hold:repository:resolution-threw]", {
      ...diagnostics,
      error: error instanceof Error ? error.message : String(error),
    });
    return UNRESOLVED;
  }
}
