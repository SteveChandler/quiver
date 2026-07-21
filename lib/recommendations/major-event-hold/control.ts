import "server-only";

import { z } from "zod";

import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";
import { getDbStateCandidatesForStateSlug } from "@/lib/geo/state-routing";

import { deterministicUuidV8 } from "./identity";
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
  MajorEventHoldAction,
  MajorEventHoldExposureClass,
  MajorEventHoldReasonCode,
  MajorEventHoldTransition,
  RegionalRecommendationHoldRecord,
  SafetyCohort,
} from "./types";

const UUID_SCHEMA = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const ISO_INSTANT_SCHEMA = z.string().datetime({ offset: true });
const EVENT_REFERENCE_SCHEMA = z
  .string()
  .regex(/^(event|official|qa):[a-z0-9_]+:[A-Za-z0-9_-]{1,64}$/)
  .nullable();
const EVIDENCE_REFERENCE_SCHEMA = z
  .string()
  .regex(
    /^(official:rip_current_risks:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|qa:artifact:[A-Za-z0-9_-]{1,64})$/,
  );
const REGION_KEY_SCHEMA = z.enum(
  Object.keys(FORECAST_REGIONS) as [string, ...string[]],
);
const COHORT_SCHEMA = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "unknown",
]);
const PAGE_SIZE = 500;
const MAX_SCOPE_BEACHES = 2000;
const MAX_SCAN_ROWS = 100_000;
const STABLE_SCAN_ATTEMPTS = 3;
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const ONE_MINUTE_MS = 60 * 1000;

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

function isCanonicalCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const uniqueArray = <T extends z.ZodType<string>>(item: T, maximum: number) =>
  z
    .array(item)
    .max(maximum)
    .refine(uniqueValues, { message: "duplicate array value" });

const policyShape = {
  regionKeys: uniqueArray(REGION_KEY_SCHEMA, 64).default([]),
  scopeBeachIds: uniqueArray(UUID_SCHEMA, MAX_SCOPE_BEACHES).default([]),
  scopeExposureClasses: uniqueArray(
    z.enum(MAJOR_EVENT_HOLD_EXPOSURE_CLASSES),
    4,
  ).default([]),
  protectedAlternativeBeachIds: uniqueArray(
    UUID_SCHEMA,
    MAX_SCOPE_BEACHES,
  ).default([]),
  eventReference: EVENT_REFERENCE_SCHEMA.default(null),
  validFrom: ISO_INSTANT_SCHEMA,
  validUntil: ISO_INSTANT_SCHEMA,
  affectedCohorts: uniqueArray(COHORT_SCHEMA, 5).min(1),
  action: z.enum(MAJOR_EVENT_HOLD_ACTIONS),
  supportingEvidenceRefs: uniqueArray(EVIDENCE_REFERENCE_SCHEMA, 16).default(
    [],
  ),
};

const activateSchema = z
  .object({
    operation: z.literal("activate"),
    ...policyShape,
    reasonCode: z.literal("major_swell_manual_safety"),
  })
  .strict();

const extendSchema = z
  .object({
    operation: z.literal("extend"),
    holdId: UUID_SCHEMA,
    newValidUntil: ISO_INSTANT_SCHEMA,
    reasonCode: z.literal("major_swell_manual_safety"),
  })
  .strict();

const replaceSchema = z
  .object({
    operation: z.literal("replace"),
    holdId: UUID_SCHEMA,
    ...policyShape,
    reasonCode: z.enum([
      "major_swell_manual_safety",
      "scope_correction",
      "policy_rollback",
    ]),
  })
  .strict();

const cancelSchema = z
  .object({
    operation: z.literal("cancel"),
    holdId: UUID_SCHEMA,
    reasonCode: z.enum([
      "event_expired",
      "operator_cancelled",
      "policy_rollback",
    ]),
  })
  .strict();

const manualCommandSchema = z.discriminatedUnion("operation", [
  activateSchema,
  extendSchema,
  replaceSchema,
  cancelSchema,
]);

export type ManualHoldCommand = z.infer<typeof manualCommandSchema>;
type FullPolicyCommand = Extract<
  ManualHoldCommand,
  { operation: "activate" | "replace" }
>;

export class HoldControlError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = "HoldControlError";
    this.code = code;
    this.status = status;
  }
}

export interface BeachScopeRow {
  id: string;
  state: string | null;
  city: string | null;
  lat: number | null;
  isPrivate: boolean;
  deletedAt: string | null;
}

export interface ManualHoldTransitionPayload {
  holdId: string;
  version: number;
  transition: MajorEventHoldTransition;
  regionKeys: string[];
  scopeBeachIds: string[];
  scopeExposureClasses: MajorEventHoldExposureClass[];
  protectedAlternativeBeachIds: string[];
  eventReference: string | null;
  validFrom: string;
  validUntil: string;
  affectedCohorts: SafetyCohort[];
  action: MajorEventHoldAction;
  triggerType: "manual_operator";
  supportingEvidenceRefs: string[];
  automaticPolicyVersion: null;
  operatorUserId: string;
  authorizingActor: "admin_api";
  reasonCode: MajorEventHoldReasonCode;
  effectiveAt: string;
  expiresAt: string;
  supersedesRecordId: string | null;
  idempotencyKey: string;
  requestId: string;
}

export interface ManualHoldStore {
  loadByIdempotencyKey(
    idempotencyKey: string,
  ): Promise<RegionalRecommendationHoldRecord | null>;
  loadLatestHold(
    holdId: string,
  ): Promise<RegionalRecommendationHoldRecord | null>;
  loadOperatorRef(operatorUserId: string): Promise<string | null>;
  loadBeachPage(
    afterId: string | null,
    limit: number,
  ): Promise<{ rows: BeachScopeRow[] | null }>;
  appendTransition(
    payload: ManualHoldTransitionPayload,
  ): Promise<RegionalRecommendationHoldRecord>;
  listHoldRecords(): Promise<RegionalRecommendationHoldRecord[]>;
}

export interface ExecuteManualHoldOptions {
  store: ManualHoldStore;
  operatorUserId: string | null;
  idempotencyKey: string | null;
  now?: Date;
}

export interface AdminHoldView {
  holdId: string;
  version: number;
  transition: MajorEventHoldTransition;
  status: "active" | "cancelled";
  lifecycle: "effective" | "scheduled";
  regionKeys: string[];
  scopeBeachIds: string[];
  scopeExposureClasses: string[];
  protectedAlternativeBeachIds: string[];
  validFrom: string;
  validUntil: string;
  affectedCohorts: SafetyCohort[];
  action: MajorEventHoldAction;
  provenance: {
    triggerType: "manual_operator" | "automatic_official";
    authorizingActor: "admin_api" | "official_automation";
  };
  reasonCode: MajorEventHoldReasonCode;
  effectiveAt: string;
  expiresAt: string;
  createdAt: string;
}

export interface ExecuteManualHoldResult {
  hold: AdminHoldView;
  outcome: "accepted";
  confirmedRecord: RegionalRecommendationHoldRecord;
}

function canonicalIso(value: string): string {
  return new Date(value).toISOString();
}

function sorted<T extends string>(values: readonly T[]): T[] {
  return [...values].sort();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseManualHoldCommand(input: unknown): ManualHoldCommand {
  if (
    isRecord(input) &&
    Array.isArray(input.scopeExposureClasses) &&
    input.scopeExposureClasses.length > 0
  ) {
    throw new HoldControlError("exposure_scope_unavailable");
  }

  const result = manualCommandSchema.safeParse(input);
  if (!result.success) throw new HoldControlError("invalid_request");

  if (
    result.data.operation === "activate" ||
    result.data.operation === "replace"
  ) {
    if (
      result.data.regionKeys.length === 0 &&
      result.data.scopeBeachIds.length === 0
    ) {
      throw new HoldControlError("invalid_request");
    }
    if (
      result.data.action === "protected_alternatives_only" &&
      result.data.protectedAlternativeBeachIds.length === 0
    ) {
      throw new HoldControlError("invalid_request");
    }

    return {
      ...result.data,
      regionKeys: sorted(result.data.regionKeys),
      scopeBeachIds: sorted(result.data.scopeBeachIds),
      scopeExposureClasses: [],
      protectedAlternativeBeachIds: sorted(
        result.data.protectedAlternativeBeachIds,
      ),
      validFrom: canonicalIso(result.data.validFrom),
      validUntil: canonicalIso(result.data.validUntil),
      affectedCohorts: sorted(result.data.affectedCohorts),
      supportingEvidenceRefs: sorted(result.data.supportingEvidenceRefs),
    };
  }

  if (result.data.operation === "extend") {
    return {
      ...result.data,
      newValidUntil: canonicalIso(result.data.newValidUntil),
    };
  }
  return result.data;
}

function validateExecutionContext(options: ExecuteManualHoldOptions): Date {
  if (
    !options.operatorUserId ||
    !UUID_SCHEMA.safeParse(options.operatorUserId).success
  ) {
    throw new HoldControlError("manual_operator_required", 403);
  }
  if (
    !options.idempotencyKey ||
    !UUID_SCHEMA.safeParse(options.idempotencyKey).success
  ) {
    throw new HoldControlError("invalid_idempotency_key");
  }
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) {
    throw new HoldControlError("invalid_request");
  }
  return now;
}

function transitionForOperation(
  operation: ManualHoldCommand["operation"],
): MajorEventHoldTransition {
  if (operation === "activate") return "activation";
  if (operation === "extend") return "extension";
  if (operation === "replace") return "replacement";
  return "cancellation";
}

function databaseIdempotencyKey(
  command: ManualHoldCommand,
  idempotencyKey: string,
): string {
  if (command.operation === "activate") {
    return `manual:activation:${idempotencyKey}`;
  }
  return `manual:${transitionForOperation(command.operation)}:${command.holdId}:${idempotencyKey}`;
}

function activationHoldId(idempotencyKey: string): string {
  return deterministicUuidV8(
    `quiver:regional-hold:manual:activation:${idempotencyKey}`,
  );
}

function manualRequestId(
  command: ManualHoldCommand,
  clientIdempotencyKey: string,
): string {
  return deterministicUuidV8(
    `quiver:regional-hold:manual:request:v1:${clientIdempotencyKey}:${JSON.stringify(command)}`,
  );
}

function assertFullPolicyWindow(
  command: FullPolicyCommand,
  now: Date,
): {
  effectiveAt: string;
  expiresAt: string;
} {
  const validFromMs = Date.parse(command.validFrom);
  const validUntilMs = Date.parse(command.validUntil);
  const nowMs = now.getTime();
  if (validUntilMs <= validFromMs || validUntilMs <= nowMs) {
    throw new HoldControlError("invalid_valid_window");
  }
  const effectiveAtMs = Math.max(nowMs, validFromMs);
  if (validUntilMs > effectiveAtMs + SEVEN_DAYS_MS) {
    throw new HoldControlError("invalid_expiry_window");
  }
  return {
    effectiveAt: new Date(effectiveAtMs).toISOString(),
    expiresAt: command.validUntil,
  };
}

function matchesRegion(row: BeachScopeRow, regionKey: string): boolean {
  const region = FORECAST_REGIONS[regionKey];
  if (!region || row.deletedAt !== null || row.state === null) return false;

  const normalizedState = row.state.toLowerCase();
  const stateMatches = region.states.some((state) =>
    getDbStateCandidatesForStateSlug(state).some(
      (candidate) => candidate.toLowerCase() === normalizedState,
    ),
  );
  if (!stateMatches) return false;

  if (
    region.cities?.length &&
    !region.cities.some(
      (city) => row.city?.toLowerCase() === city.toLowerCase(),
    )
  ) {
    return false;
  }

  if (region.latBounds && row.lat !== null) {
    if (region.latBounds.min !== undefined && row.lat < region.latBounds.min) {
      return false;
    }
    if (region.latBounds.max !== undefined && row.lat >= region.latBounds.max) {
      return false;
    }
  }
  return true;
}

async function loadAllBeaches(
  store: ManualHoldStore,
): Promise<BeachScopeRow[]> {
  try {
    for (let attempt = 0; attempt < STABLE_SCAN_ATTEMPTS; attempt += 1) {
      const first = await scanBeachCatalog(store);
      const second = await scanBeachCatalog(store);
      if (beachCatalogsEqual(first, second)) {
        return second.filter((row) => row.deletedAt === null);
      }
    }
  } catch (error) {
    if (
      error instanceof HoldControlError &&
      error.code === "beach_scope_unavailable"
    ) {
      throw error;
    }
    throw new HoldControlError("beach_scope_unavailable", 503);
  }
  throw new HoldControlError("beach_scope_unavailable", 503);
}

async function scanBeachCatalog(
  store: ManualHoldStore,
): Promise<BeachScopeRow[]> {
  const rows: BeachScopeRow[] = [];
  let afterId: string | null = null;
  for (;;) {
    const page = await store.loadBeachPage(afterId, PAGE_SIZE);
    if (!Array.isArray(page.rows) || page.rows.length > PAGE_SIZE) {
      throw new HoldControlError("beach_scope_unavailable", 503);
    }
    let previousId = afterId;
    for (const row of page.rows) {
      if (
        !UUID_SCHEMA.safeParse(row.id).success ||
        (previousId !== null && row.id <= previousId)
      ) {
        throw new HoldControlError("beach_scope_unavailable", 503);
      }
      rows.push(row);
      previousId = row.id;
      if (rows.length > MAX_SCAN_ROWS) {
        throw new HoldControlError("beach_scope_unavailable", 503);
      }
    }
    if (page.rows.length < PAGE_SIZE) return rows;
    afterId = page.rows[page.rows.length - 1].id;
  }
}

function beachCatalogsEqual(
  left: readonly BeachScopeRow[],
  right: readonly BeachScopeRow[],
): boolean {
  return (
    left.length === right.length &&
    left.every((row, index) => {
      const other = right[index];
      return (
        other !== undefined &&
        row.id === other.id &&
        row.state === other.state &&
        row.city === other.city &&
        row.lat === other.lat &&
        row.isPrivate === other.isPrivate &&
        row.deletedAt === other.deletedAt
      );
    })
  );
}

async function resolvePolicyScope(
  command: FullPolicyCommand,
  store: ManualHoldStore,
): Promise<string[]> {
  const beaches = await loadAllBeaches(store);
  const byId = new Map(beaches.map((row) => [row.id, row]));
  for (const beachId of [
    ...command.scopeBeachIds,
    ...command.protectedAlternativeBeachIds,
  ]) {
    if (!byId.has(beachId)) throw new HoldControlError("unknown_beach");
  }

  const resolved = new Set(command.scopeBeachIds);
  for (const regionKey of command.regionKeys) {
    const matches = beaches.filter((row) => matchesRegion(row, regionKey));
    if (matches.length === 0) throw new HoldControlError("empty_region");
    for (const row of matches) resolved.add(row.id);
  }

  const scopeBeachIds = sorted([...resolved]);
  if (scopeBeachIds.length === 0) throw new HoldControlError("empty_region");
  if (scopeBeachIds.length > MAX_SCOPE_BEACHES) {
    throw new HoldControlError("scope_too_large");
  }
  return scopeBeachIds;
}

function isActiveAndUnexpired(
  record: RegionalRecommendationHoldRecord,
  now: Date,
): boolean {
  return (
    record.status === "active" && Date.parse(record.expiresAt) > now.getTime()
  );
}

function requireLatestActive(
  record: RegionalRecommendationHoldRecord | null,
  now: Date,
): RegionalRecommendationHoldRecord {
  if (!record) throw new HoldControlError("hold_not_found", 404);
  if (!isActiveAndUnexpired(record, now)) {
    throw new HoldControlError("hold_not_active", 409);
  }
  return record;
}

function arraysEqual(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function recordMatchesCommand(
  record: RegionalRecommendationHoldRecord,
  command: ManualHoldCommand,
  holdId: string,
  idempotencyKey: string,
  requestId: string,
): boolean {
  if (
    record.holdId !== holdId ||
    record.idempotencyKey !== idempotencyKey ||
    record.requestId !== requestId ||
    record.triggerType !== "manual_operator" ||
    record.authorizingActor !== "admin_api" ||
    record.automaticPolicyVersion !== null ||
    record.transition !== transitionForOperation(command.operation) ||
    record.reasonCode !== command.reasonCode
  ) {
    return false;
  }

  if (command.operation === "extend") {
    return record.validUntil === command.newValidUntil;
  }
  if (command.operation === "cancel") return record.status === "cancelled";

  return (
    arraysEqual(record.regionKeys, command.regionKeys) &&
    command.scopeBeachIds.every((beachId) =>
      record.scopeBeachIds.includes(beachId),
    ) &&
    record.scopeExposureClasses.length === 0 &&
    arraysEqual(
      record.protectedAlternativeBeachIds,
      command.protectedAlternativeBeachIds,
    ) &&
    record.eventReference === command.eventReference &&
    record.validFrom === command.validFrom &&
    record.validUntil === command.validUntil &&
    arraysEqual(record.affectedCohorts, command.affectedCohorts) &&
    record.action === command.action &&
    arraysEqual(
      record.supportingEvidenceRefs,
      command.supportingEvidenceRefs,
    ) &&
    record.expiresAt === command.validUntil
  );
}

function toAdminHoldView(
  record: RegionalRecommendationHoldRecord,
  now: Date,
): AdminHoldView {
  return {
    holdId: record.holdId,
    version: record.version,
    transition: record.transition,
    status: record.status,
    lifecycle:
      Date.parse(record.effectiveAt) > now.getTime()
        ? "scheduled"
        : "effective",
    regionKeys: [...record.regionKeys],
    scopeBeachIds: [...record.scopeBeachIds],
    scopeExposureClasses: [...record.scopeExposureClasses],
    protectedAlternativeBeachIds: [...record.protectedAlternativeBeachIds],
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    affectedCohorts: [...record.affectedCohorts],
    action: record.action,
    provenance: {
      triggerType: record.triggerType,
      authorizingActor: record.authorizingActor,
    },
    reasonCode: record.reasonCode,
    effectiveAt: record.effectiveAt,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
  };
}

function acceptedResult(
  record: RegionalRecommendationHoldRecord,
  now: Date,
): ExecuteManualHoldResult {
  return {
    hold: toAdminHoldView(record, now),
    outcome: "accepted",
    confirmedRecord: record,
  };
}

function commonPayload(
  command: ManualHoldCommand,
  options: ExecuteManualHoldOptions,
  holdId: string,
  version: number,
  transition: MajorEventHoldTransition,
  idempotencyKey: string,
  requestId: string,
  fields: Pick<
    ManualHoldTransitionPayload,
    | "regionKeys"
    | "scopeBeachIds"
    | "scopeExposureClasses"
    | "protectedAlternativeBeachIds"
    | "eventReference"
    | "validFrom"
    | "validUntil"
    | "affectedCohorts"
    | "action"
    | "supportingEvidenceRefs"
    | "effectiveAt"
    | "expiresAt"
    | "supersedesRecordId"
  >,
): ManualHoldTransitionPayload {
  return {
    holdId,
    version,
    transition,
    ...fields,
    triggerType: "manual_operator",
    automaticPolicyVersion: null,
    operatorUserId: options.operatorUserId as string,
    authorizingActor: "admin_api",
    reasonCode: command.reasonCode,
    idempotencyKey,
    requestId,
  };
}

function replayPayload(
  record: RegionalRecommendationHoldRecord,
  operatorUserId: string,
): ManualHoldTransitionPayload {
  return {
    holdId: record.holdId,
    version: record.version,
    transition: record.transition,
    regionKeys: [...record.regionKeys],
    scopeBeachIds: [...record.scopeBeachIds],
    scopeExposureClasses: [...record.scopeExposureClasses],
    protectedAlternativeBeachIds: [...record.protectedAlternativeBeachIds],
    eventReference: record.eventReference,
    validFrom: record.validFrom,
    validUntil: record.validUntil,
    affectedCohorts: [...record.affectedCohorts],
    action: record.action,
    triggerType: "manual_operator",
    supportingEvidenceRefs: [...record.supportingEvidenceRefs],
    automaticPolicyVersion: null,
    operatorUserId,
    authorizingActor: "admin_api",
    reasonCode: record.reasonCode,
    effectiveAt: record.effectiveAt,
    expiresAt: record.expiresAt,
    supersedesRecordId: record.supersedesRecordId,
    idempotencyKey: record.idempotencyKey,
    requestId: record.requestId as string,
  };
}

async function buildPayload(
  command: ManualHoldCommand,
  options: ExecuteManualHoldOptions,
  now: Date,
  holdId: string,
  idempotencyKey: string,
  requestId: string,
): Promise<ManualHoldTransitionPayload> {
  if (command.operation === "activate" || command.operation === "replace") {
    const times = assertFullPolicyWindow(command, now);
    const scopeBeachIds = await resolvePolicyScope(command, options.store);
    let version = 1;
    let supersedesRecordId: string | null = null;
    if (command.operation === "replace") {
      const latest = requireLatestActive(
        await options.store.loadLatestHold(command.holdId),
        now,
      );
      version = latest.version + 1;
      supersedesRecordId = latest.recordId;
    }
    return commonPayload(
      command,
      options,
      holdId,
      version,
      transitionForOperation(command.operation),
      idempotencyKey,
      requestId,
      {
        regionKeys: [...command.regionKeys],
        scopeBeachIds,
        scopeExposureClasses: [],
        protectedAlternativeBeachIds: [...command.protectedAlternativeBeachIds],
        eventReference: command.eventReference,
        validFrom: command.validFrom,
        validUntil: command.validUntil,
        affectedCohorts: [...command.affectedCohorts],
        action: command.action,
        supportingEvidenceRefs: [...command.supportingEvidenceRefs],
        effectiveAt: times.effectiveAt,
        expiresAt: times.expiresAt,
        supersedesRecordId,
      },
    );
  }

  const latest = requireLatestActive(
    await options.store.loadLatestHold(command.holdId),
    now,
  );
  if (command.operation === "extend") {
    const newValidUntilMs = Date.parse(command.newValidUntil);
    if (
      newValidUntilMs <= Date.parse(latest.validUntil) ||
      newValidUntilMs <= now.getTime()
    ) {
      throw new HoldControlError("invalid_valid_window");
    }
    const effectiveAtMs = Math.max(
      now.getTime(),
      Date.parse(latest.effectiveAt),
    );
    if (
      newValidUntilMs <= effectiveAtMs ||
      newValidUntilMs > effectiveAtMs + SEVEN_DAYS_MS
    ) {
      throw new HoldControlError("invalid_expiry_window");
    }
    return commonPayload(
      command,
      options,
      command.holdId,
      latest.version + 1,
      "extension",
      idempotencyKey,
      requestId,
      {
        regionKeys: [...latest.regionKeys],
        scopeBeachIds: [...latest.scopeBeachIds],
        scopeExposureClasses: [...latest.scopeExposureClasses],
        protectedAlternativeBeachIds: [...latest.protectedAlternativeBeachIds],
        eventReference: latest.eventReference,
        validFrom: latest.validFrom,
        validUntil: command.newValidUntil,
        affectedCohorts: [...latest.affectedCohorts],
        action: latest.action,
        supportingEvidenceRefs: [...latest.supportingEvidenceRefs],
        effectiveAt: new Date(effectiveAtMs).toISOString(),
        expiresAt: command.newValidUntil,
        supersedesRecordId: latest.recordId,
      },
    );
  }

  const expiresAtMs = Math.min(
    Date.parse(latest.expiresAt),
    now.getTime() + ONE_MINUTE_MS,
  );
  if (expiresAtMs <= now.getTime()) {
    throw new HoldControlError("hold_not_active", 409);
  }
  return commonPayload(
    command,
    options,
    command.holdId,
    latest.version + 1,
    "cancellation",
    idempotencyKey,
    requestId,
    {
      regionKeys: [...latest.regionKeys],
      scopeBeachIds: [...latest.scopeBeachIds],
      scopeExposureClasses: [...latest.scopeExposureClasses],
      protectedAlternativeBeachIds: [...latest.protectedAlternativeBeachIds],
      eventReference: latest.eventReference,
      validFrom: latest.validFrom,
      validUntil: latest.validUntil,
      affectedCohorts: [...latest.affectedCohorts],
      action: latest.action,
      supportingEvidenceRefs: [...latest.supportingEvidenceRefs],
      effectiveAt: now.toISOString(),
      expiresAt: new Date(expiresAtMs).toISOString(),
      supersedesRecordId: latest.recordId,
    },
  );
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message.toLowerCase();
  if (isRecord(error) && typeof error.message === "string") {
    return error.message.toLowerCase();
  }
  return "";
}

function replayAppendError(error: unknown): HoldControlError {
  if (error instanceof HoldControlError) return error;
  const message = errorText(error);
  if (message.includes("idempotency") || message.includes("23505")) {
    return new HoldControlError("idempotency_collision", 409);
  }
  return new HoldControlError("append_failed", 503);
}

export async function executeManualHoldCommand(
  input: unknown,
  options: ExecuteManualHoldOptions,
): Promise<ExecuteManualHoldResult> {
  const now = validateExecutionContext(options);
  const command = parseManualHoldCommand(input);
  const stableId = UUID_SCHEMA.parse(options.idempotencyKey);
  const normalizedOptions: ExecuteManualHoldOptions = {
    ...options,
    operatorUserId: UUID_SCHEMA.parse(options.operatorUserId),
    idempotencyKey: stableId,
  };
  const holdId =
    command.operation === "activate"
      ? activationHoldId(stableId)
      : command.holdId;
  const idempotencyKey = databaseIdempotencyKey(command, stableId);
  const requestIdentity = manualRequestId(command, stableId);

  const existing =
    await normalizedOptions.store.loadByIdempotencyKey(idempotencyKey);
  if (existing) {
    if (
      !recordMatchesCommand(
        existing,
        command,
        holdId,
        idempotencyKey,
        requestIdentity,
      )
    ) {
      throw new HoldControlError("idempotency_collision", 409);
    }
    const currentOperatorRef = await normalizedOptions.store.loadOperatorRef(
      normalizedOptions.operatorUserId as string,
    );
    if (
      currentOperatorRef !== null &&
      currentOperatorRef !== existing.authorizingOperatorRef
    ) {
      throw new HoldControlError("idempotency_collision", 409);
    }
    if (currentOperatorRef === existing.authorizingOperatorRef) {
      return acceptedResult(existing, now);
    }

    try {
      const verified = await normalizedOptions.store.appendTransition(
        replayPayload(existing, normalizedOptions.operatorUserId as string),
      );
      return acceptedResult(verified, now);
    } catch (error) {
      throw replayAppendError(error);
    }
  }

  const payload = await buildPayload(
    command,
    normalizedOptions,
    now,
    holdId,
    idempotencyKey,
    requestIdentity,
  );
  try {
    const appended = await normalizedOptions.store.appendTransition(payload);
    return acceptedResult(appended, now);
  } catch (error) {
    const message = errorText(error);
    if (message.includes("idempotency") || message.includes("23505")) {
      const concurrent =
        await normalizedOptions.store.loadByIdempotencyKey(idempotencyKey);
      if (
        concurrent &&
        recordMatchesCommand(
          concurrent,
          command,
          holdId,
          idempotencyKey,
          requestIdentity,
        )
      ) {
        const currentOperatorRef =
          await normalizedOptions.store.loadOperatorRef(
            normalizedOptions.operatorUserId as string,
          );
        if (currentOperatorRef === concurrent.authorizingOperatorRef) {
          return acceptedResult(concurrent, now);
        }
        if (currentOperatorRef === null) {
          try {
            const verified = await normalizedOptions.store.appendTransition(
              replayPayload(
                concurrent,
                normalizedOptions.operatorUserId as string,
              ),
            );
            return acceptedResult(verified, now);
          } catch (error) {
            throw replayAppendError(error);
          }
        }
      }
      throw new HoldControlError("idempotency_collision", 409);
    }
    if (
      message.includes("supersede") ||
      message.includes("latest hold version") ||
      message.includes("hold chain")
    ) {
      throw new HoldControlError("hold_changed_retry", 409);
    }
    throw new HoldControlError("append_failed", 503);
  }
}

async function loadStableHoldRecords(
  store: ManualHoldStore,
): Promise<RegionalRecommendationHoldRecord[]> {
  try {
    for (let attempt = 0; attempt < STABLE_SCAN_ATTEMPTS; attempt += 1) {
      const first = await store.listHoldRecords();
      const second = await store.listHoldRecords();
      if (
        Array.isArray(first) &&
        Array.isArray(second) &&
        first.length <= MAX_SCAN_ROWS &&
        second.length <= MAX_SCAN_ROWS &&
        JSON.stringify(first) === JSON.stringify(second)
      ) {
        return second;
      }
    }
  } catch {
    throw new HoldControlError("hold_state_unavailable", 503);
  }
  throw new HoldControlError("hold_state_unavailable", 503);
}

export async function listAdminHoldViews(options: {
  store: ManualHoldStore;
  now?: Date;
}): Promise<AdminHoldView[]> {
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime()))
    throw new HoldControlError("invalid_request");
  const records = await loadStableHoldRecords(options.store);
  const chains = new Map<string, RegionalRecommendationHoldRecord[]>();
  for (const record of records) {
    const chain = chains.get(record.holdId) ?? [];
    chain.push(record);
    chains.set(record.holdId, chain);
  }

  const visible: RegionalRecommendationHoldRecord[] = [];
  for (const chain of chains.values()) {
    const effective = chain
      .filter((record) => Date.parse(record.effectiveAt) <= now.getTime())
      .sort((left, right) => right.version - left.version)[0];
    if (
      effective?.status === "active" &&
      Date.parse(effective.expiresAt) > now.getTime()
    ) {
      visible.push(effective);
    }
    const scheduled = chain
      .filter(
        (record) =>
          Date.parse(record.effectiveAt) > now.getTime() &&
          Date.parse(record.expiresAt) > now.getTime(),
      )
      .sort((left, right) => {
        const effectiveAtDifference =
          Date.parse(left.effectiveAt) - Date.parse(right.effectiveAt);
        return effectiveAtDifference === 0
          ? right.version - left.version
          : effectiveAtDifference;
      });
    let highestEffectiveVersion = effective?.version ?? 0;
    for (const record of scheduled) {
      if (record.version <= highestEffectiveVersion) continue;
      visible.push(record);
      highestEffectiveVersion = record.version;
    }
  }

  return visible
    .sort((left, right) =>
      left.effectiveAt === right.effectiveAt
        ? left.holdId.localeCompare(right.holdId)
        : left.effectiveAt.localeCompare(right.effectiveAt),
    )
    .map((record) => toAdminHoldView(record, now));
}

const rawHoldRowSchema = z
  .object({
    record_id: UUID_SCHEMA,
    hold_id: UUID_SCHEMA,
    version: z.number().int().positive(),
    transition: z.enum(MAJOR_EVENT_HOLD_TRANSITIONS),
    status: z.enum(MAJOR_EVENT_HOLD_STATUSES),
    region_keys: z
      .array(z.string().regex(/^[a-z0-9][a-z0-9_-]{0,63}$/))
      .max(64),
    scope_beach_ids: z.array(UUID_SCHEMA).min(1).max(MAX_SCOPE_BEACHES),
    scope_exposure_classes: z
      .array(z.enum(MAJOR_EVENT_HOLD_EXPOSURE_CLASSES))
      .max(4),
    protected_alternative_beach_ids: z
      .array(UUID_SCHEMA)
      .max(MAX_SCOPE_BEACHES),
    event_reference: EVENT_REFERENCE_SCHEMA,
    valid_from: ISO_INSTANT_SCHEMA,
    valid_until: ISO_INSTANT_SCHEMA,
    affected_cohorts: z.array(COHORT_SCHEMA).min(1).max(5),
    action: z.enum(MAJOR_EVENT_HOLD_ACTIONS),
    trigger_type: z.enum(MAJOR_EVENT_HOLD_TRIGGER_TYPES),
    supporting_evidence_refs: z.array(EVIDENCE_REFERENCE_SCHEMA).max(16),
    automatic_policy_version: z
      .string()
      .regex(/^[a-z0-9._-]{1,64}$/)
      .nullable(),
    authorizing_operator_ref: UUID_SCHEMA.nullable(),
    authorizing_actor: z.enum(MAJOR_EVENT_HOLD_AUTHORIZING_ACTORS),
    reason_code: z.enum(MAJOR_EVENT_HOLD_REASON_CODES),
    effective_at: ISO_INSTANT_SCHEMA,
    expires_at: ISO_INSTANT_SCHEMA,
    supersedes_record_id: UUID_SCHEMA.nullable(),
    idempotency_key: z.string().regex(/^[A-Za-z0-9:_-]{1,160}$/),
    payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
    request_id: z
      .string()
      .regex(/^[A-Za-z0-9:_-]{1,96}$/)
      .nullable(),
    created_at: ISO_INSTANT_SCHEMA,
  })
  .strict()
  .superRefine((row, context) => {
    const issue = (message: string): void => {
      context.addIssue({ code: "custom", message });
    };
    const arrays = [
      row.region_keys,
      row.scope_beach_ids,
      row.scope_exposure_classes,
      row.protected_alternative_beach_ids,
      row.affected_cohorts,
      row.supporting_evidence_refs,
    ];
    if (arrays.some((values) => !uniqueValues(values)))
      issue("duplicate values");

    const activation = row.transition === "activation";
    if (
      (activation &&
        (row.version !== 1 || row.supersedes_record_id !== null)) ||
      (!activation && (row.version <= 1 || row.supersedes_record_id === null))
    ) {
      issue("invalid transition chain");
    }
    if (
      (row.transition === "cancellation" && row.status !== "cancelled") ||
      (row.transition !== "cancellation" && row.status !== "active")
    ) {
      issue("invalid transition status");
    }

    const validFrom = Date.parse(row.valid_from);
    const validUntil = Date.parse(row.valid_until);
    const effectiveAt = Date.parse(row.effective_at);
    const expiresAt = Date.parse(row.expires_at);
    if (
      validUntil <= validFrom ||
      expiresAt <= effectiveAt ||
      expiresAt > effectiveAt + SEVEN_DAYS_MS
    ) {
      issue("invalid time window");
    }
    if (
      row.action === "protected_alternatives_only" &&
      row.protected_alternative_beach_ids.length === 0
    ) {
      issue("missing protected alternative");
    }

    if (row.trigger_type === "manual_operator") {
      if (
        row.authorizing_operator_ref === null ||
        row.authorizing_actor !== "admin_api" ||
        row.automatic_policy_version !== null
      ) {
        issue("invalid manual provenance");
      }
      const allowedReason =
        row.transition === "activation" || row.transition === "extension"
          ? row.reason_code === "major_swell_manual_safety"
          : row.transition === "replacement"
            ? [
                "major_swell_manual_safety",
                "scope_correction",
                "policy_rollback",
              ].includes(row.reason_code)
            : [
                "event_expired",
                "operator_cancelled",
                "policy_rollback",
              ].includes(row.reason_code);
      if (!allowedReason) issue("invalid manual reason");
      if (!row.request_id || !UUID_SCHEMA.safeParse(row.request_id).success) {
        issue("invalid manual request identity");
      }
      const idempotencyParts = row.idempotency_key.split(":");
      const clientIdentity =
        row.transition === "activation" &&
        idempotencyParts.length === 3 &&
        idempotencyParts[0] === "manual" &&
        idempotencyParts[1] === "activation"
          ? idempotencyParts[2]
          : row.transition !== "activation" &&
              idempotencyParts.length === 4 &&
              idempotencyParts[0] === "manual" &&
              idempotencyParts[1] === row.transition &&
              idempotencyParts[2] === row.hold_id
            ? idempotencyParts[3]
            : null;
      if (
        clientIdentity === null ||
        !UUID_SCHEMA.safeParse(clientIdentity).success
      ) {
        issue("invalid manual idempotency identity");
      }
      return;
    }

    const officialReference = row.supporting_evidence_refs[0];
    const automaticKeyPrefix = `auto:official_rip_high:v1:${row.scope_beach_ids[0]}:`;
    const automaticDate = row.idempotency_key.startsWith(automaticKeyPrefix)
      ? row.idempotency_key.slice(automaticKeyPrefix.length)
      : "";
    if (
      row.transition !== "activation" ||
      row.status !== "active" ||
      row.version !== 1 ||
      row.supersedes_record_id !== null ||
      row.region_keys.length !== 0 ||
      row.scope_beach_ids.length !== 1 ||
      row.scope_exposure_classes.length !== 0 ||
      row.protected_alternative_beach_ids.length !== 0 ||
      row.event_reference !== officialReference ||
      row.affected_cohorts.join(",") !== "beginner,intermediate,unknown" ||
      row.action !== "suppress_positive" ||
      row.supporting_evidence_refs.length !== 1 ||
      !officialReference?.startsWith("official:rip_current_risks:") ||
      row.automatic_policy_version !== "official-rip-high.v1" ||
      row.authorizing_operator_ref !== null ||
      row.authorizing_actor !== "official_automation" ||
      row.reason_code !== "official_high_rip_current" ||
      row.request_id !== row.hold_id ||
      !isCanonicalCivilDate(automaticDate)
    ) {
      issue("invalid official provenance");
    }
  });

const beachRowSchema = z
  .object({
    id: UUID_SCHEMA,
    state: z.string().nullable(),
    city: z.string().nullable(),
    lat: z.number().nullable(),
    is_private: z.boolean().nullable(),
    deleted_at: ISO_INSTANT_SCHEMA.nullable(),
  })
  .strict();

const HOLD_COLUMNS = [
  "record_id",
  "hold_id",
  "version",
  "transition",
  "status",
  "region_keys",
  "scope_beach_ids",
  "scope_exposure_classes",
  "protected_alternative_beach_ids",
  "event_reference",
  "valid_from",
  "valid_until",
  "affected_cohorts",
  "action",
  "trigger_type",
  "supporting_evidence_refs",
  "automatic_policy_version",
  "authorizing_operator_ref",
  "authorizing_actor",
  "reason_code",
  "effective_at",
  "expires_at",
  "supersedes_record_id",
  "idempotency_key",
  "payload_hash",
  "request_id",
  "created_at",
].join(",");

interface QueryResult {
  data: unknown;
  error?: { message?: string; code?: string } | null;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  gt(column: string, value: string): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder;
  range(from: number, to: number): QueryBuilder;
  limit(count: number): QueryBuilder;
}

interface SupabaseManualHoldClient {
  from: unknown;
  rpc: unknown;
}

function table(client: SupabaseManualHoldClient, name: string): QueryBuilder {
  const from = client.from as (name: string) => QueryBuilder;
  return from.call(client, name);
}

function parseRawHoldRow(value: unknown): RegionalRecommendationHoldRecord {
  const row = rawHoldRowSchema.safeParse(value);
  if (!row.success) throw new HoldControlError("hold_state_unavailable", 503);
  const parsed = row.data;
  const common = {
    recordId: parsed.record_id,
    holdId: parsed.hold_id,
    version: parsed.version,
    transition: parsed.transition,
    status: parsed.status,
    regionKeys: [...parsed.region_keys],
    scopeBeachIds: [...parsed.scope_beach_ids],
    scopeExposureClasses: [...parsed.scope_exposure_classes],
    protectedAlternativeBeachIds: [...parsed.protected_alternative_beach_ids],
    eventReference: parsed.event_reference,
    validFrom: canonicalIso(parsed.valid_from),
    validUntil: canonicalIso(parsed.valid_until),
    affectedCohorts: [...parsed.affected_cohorts],
    action: parsed.action,
    supportingEvidenceRefs: [...parsed.supporting_evidence_refs],
    reasonCode: parsed.reason_code,
    effectiveAt: canonicalIso(parsed.effective_at),
    expiresAt: canonicalIso(parsed.expires_at),
    supersedesRecordId: parsed.supersedes_record_id,
    idempotencyKey: parsed.idempotency_key,
    payloadHash: parsed.payload_hash,
    requestId: parsed.request_id,
    createdAt: canonicalIso(parsed.created_at),
  };

  if (parsed.trigger_type === "manual_operator") {
    if (
      parsed.authorizing_operator_ref === null ||
      parsed.authorizing_actor !== "admin_api" ||
      parsed.automatic_policy_version !== null
    ) {
      throw new HoldControlError("hold_state_unavailable", 503);
    }
    return {
      ...common,
      triggerType: "manual_operator",
      automaticPolicyVersion: null,
      authorizingOperatorRef: parsed.authorizing_operator_ref,
      authorizingActor: "admin_api",
    };
  }

  if (
    parsed.authorizing_operator_ref !== null ||
    parsed.authorizing_actor !== "official_automation" ||
    parsed.automatic_policy_version !== "official-rip-high.v1"
  ) {
    throw new HoldControlError("hold_state_unavailable", 503);
  }
  return {
    ...common,
    triggerType: "automatic_official",
    automaticPolicyVersion: "official-rip-high.v1",
    authorizingOperatorRef: null,
    authorizingActor: "official_automation",
  };
}

function rowsFromResult(result: QueryResult): unknown[] {
  if (result.error || !Array.isArray(result.data)) {
    throw new HoldControlError("hold_state_unavailable", 503);
  }
  return result.data;
}

function manualRecordMatchesPayload(
  record: RegionalRecommendationHoldRecord,
  payload: ManualHoldTransitionPayload,
): boolean {
  return (
    record.triggerType === "manual_operator" &&
    record.authorizingActor === "admin_api" &&
    record.automaticPolicyVersion === null &&
    record.holdId === payload.holdId &&
    record.version === payload.version &&
    record.transition === payload.transition &&
    record.status ===
      (payload.transition === "cancellation" ? "cancelled" : "active") &&
    arraysEqual(record.regionKeys, payload.regionKeys) &&
    arraysEqual(record.scopeBeachIds, payload.scopeBeachIds) &&
    arraysEqual(record.scopeExposureClasses, payload.scopeExposureClasses) &&
    arraysEqual(
      record.protectedAlternativeBeachIds,
      payload.protectedAlternativeBeachIds,
    ) &&
    record.eventReference === payload.eventReference &&
    record.validFrom === canonicalIso(payload.validFrom) &&
    record.validUntil === canonicalIso(payload.validUntil) &&
    arraysEqual(record.affectedCohorts, payload.affectedCohorts) &&
    record.action === payload.action &&
    arraysEqual(
      record.supportingEvidenceRefs,
      payload.supportingEvidenceRefs,
    ) &&
    record.reasonCode === payload.reasonCode &&
    record.effectiveAt === canonicalIso(payload.effectiveAt) &&
    record.expiresAt === canonicalIso(payload.expiresAt) &&
    record.supersedesRecordId === payload.supersedesRecordId &&
    record.idempotencyKey === payload.idempotencyKey &&
    record.requestId === payload.requestId
  );
}

export function createSupabaseManualHoldStore(
  client: SupabaseManualHoldClient,
): ManualHoldStore {
  return {
    async loadByIdempotencyKey(idempotencyKey) {
      const result = await table(client, "regional_recommendation_holds")
        .select(HOLD_COLUMNS)
        .eq("idempotency_key", idempotencyKey)
        .limit(1);
      const rows = rowsFromResult(result);
      return rows[0] === undefined ? null : parseRawHoldRow(rows[0]);
    },

    async loadLatestHold(holdId) {
      const result = await table(client, "regional_recommendation_holds")
        .select(HOLD_COLUMNS)
        .eq("hold_id", holdId)
        .order("version", { ascending: false })
        .limit(1);
      const rows = rowsFromResult(result);
      return rows[0] === undefined ? null : parseRawHoldRow(rows[0]);
    },

    async loadOperatorRef() {
      // P0-A1 intentionally denies service-role reads of identity mappings;
      // the append RPC verifies the operator on the replay fallback instead.
      return null;
    },

    async loadBeachPage(afterId, limit) {
      let query = table(client, "beaches")
        .select("id,state,city,lat,is_private,deleted_at")
        .is("deleted_at", null)
        .order("id", { ascending: true })
        .limit(limit);
      if (afterId !== null) query = query.gt("id", afterId);
      const result = await query;
      const rows = rowsFromResult(result).map((value) => {
        const parsed = beachRowSchema.safeParse(value);
        if (!parsed.success) {
          throw new HoldControlError("beach_scope_unavailable", 503);
        }
        return {
          id: parsed.data.id,
          state: parsed.data.state,
          city: parsed.data.city,
          lat: parsed.data.lat,
          isPrivate: parsed.data.is_private ?? false,
          deletedAt: parsed.data.deleted_at,
        };
      });
      return { rows };
    },

    async appendTransition(payload) {
      const rpc = client.rpc as (
        name: string,
        parameters: { p_transition: ManualHoldTransitionPayload },
      ) => PromiseLike<QueryResult>;
      const result = await rpc.call(
        client,
        "append_regional_recommendation_hold_transition",
        { p_transition: payload },
      );
      if (result.error) {
        throw new Error(
          `${result.error.code ?? "rpc_error"}:${result.error.message ?? "append failed"}`,
        );
      }
      const rows = rowsFromResult(result);
      if (rows.length !== 1) throw new HoldControlError("append_failed", 503);
      const record = parseRawHoldRow(rows[0]);
      if (!manualRecordMatchesPayload(record, payload)) {
        throw new HoldControlError("hold_state_unavailable", 503);
      }
      return record;
    },

    async listHoldRecords() {
      const records: RegionalRecommendationHoldRecord[] = [];
      let afterRecordId: string | null = null;
      for (;;) {
        let query = table(client, "regional_recommendation_holds")
          .select(HOLD_COLUMNS)
          .order("record_id", { ascending: true })
          .limit(PAGE_SIZE);
        if (afterRecordId !== null) {
          query = query.gt("record_id", afterRecordId);
        }
        const result = await query;
        const rows = rowsFromResult(result);
        if (rows.length > PAGE_SIZE) {
          throw new HoldControlError("hold_state_unavailable", 503);
        }
        const parsedRows = rows.map(parseRawHoldRow);
        let previousRecordId = afterRecordId;
        for (const record of parsedRows) {
          if (
            previousRecordId !== null &&
            record.recordId <= previousRecordId
          ) {
            throw new HoldControlError("hold_state_unavailable", 503);
          }
          records.push(record);
          previousRecordId = record.recordId;
          if (records.length > MAX_SCAN_ROWS) {
            throw new HoldControlError("hold_state_unavailable", 503);
          }
        }
        if (rows.length < PAGE_SIZE) break;
        afterRecordId = parsedRows[parsedRows.length - 1].recordId;
      }
      return records;
    },
  };
}
