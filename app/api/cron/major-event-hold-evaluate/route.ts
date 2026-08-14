import { z } from "zod";

import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import {
  evaluateOfficialRipCurrentHoldDiagnostics,
  type OfficialRipCurrentHoldProposal,
} from "@/lib/recommendations/major-event-hold/automatic-evaluator";
import {
  createSupabaseMajorEventHoldCacheInvalidationStore,
  invalidateMajorEventHoldTransitions,
  type MajorEventHoldCacheScope,
} from "@/lib/recommendations/major-event-hold/cache-invalidation";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ROUTE = "/api/cron/major-event-hold-evaluate";
const SOURCE_SELECT =
  "id,beach_id,valid_date,risk_level,source,fetched_at,beaches!inner(timezone)";
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const SOURCE_PAGE_SIZE = 500;
const MAX_SOURCE_ROWS = 10_000;
const STABLE_SOURCE_SCAN_ATTEMPTS = 3;
const APPEND_CONCURRENCY = 8;
const CLOCK_SKEW_MS = 5 * 60 * 1000;

const sourceRowsSchema = z.array(
  z
    .object({
      id: z.string().uuid(),
      beach_id: z.string().uuid(),
      valid_date: z.string().regex(DATE_PATTERN),
      risk_level: z.literal("high"),
      source: z.enum(["srf", "alert"]),
      fetched_at: z.string().datetime({ offset: true }),
      beaches: z.object({ timezone: z.string().nullable() }).strict(),
    })
    .strict(),
);

const appendResultSchema = z
  .array(
    z
      .object({
        record_id: z.string().uuid(),
        hold_id: z.string().uuid(),
        version: z.literal(1),
        transition: z.literal("activation"),
        status: z.literal("active"),
        region_keys: z.array(z.string()).length(0),
        scope_beach_ids: z.tuple([z.string().uuid()]),
        scope_exposure_classes: z.array(z.string()).length(0),
        protected_alternative_beach_ids: z.array(z.string()).length(0),
        event_reference: z.string(),
        valid_from: z.string().datetime({ offset: true }),
        valid_until: z.string().datetime({ offset: true }),
        affected_cohorts: z.tuple([
          z.literal("beginner"),
          z.literal("intermediate"),
          z.literal("unknown"),
        ]),
        action: z.literal("suppress_positive"),
        trigger_type: z.literal("automatic_official"),
        supporting_evidence_refs: z.tuple([z.string()]),
        automatic_policy_version: z.literal("official-rip-high.v1"),
        authorizing_operator_ref: z.null(),
        authorizing_actor: z.literal("official_automation"),
        reason_code: z.literal("official_high_rip_current"),
        effective_at: z.string().datetime({ offset: true }),
        expires_at: z.string().datetime({ offset: true }),
        supersedes_record_id: z.null(),
        idempotency_key: z.string(),
        payload_hash: z.string().regex(/^[0-9a-f]{64}$/),
        request_id: z.string().uuid(),
        created_at: z.string().datetime({ offset: true }),
      })
      .strict(),
  )
  .length(1);

type SourceRow = z.infer<typeof sourceRowsSchema>[number];

type SourceQueryResponse = { data: unknown; error: unknown };
type AppendRpcResponse = { data: unknown; error: unknown };

interface SourceQueryChain {
  select: (columns: string) => SourceQueryChain;
  eq: (column: string, value: string) => SourceQueryChain;
  in: (column: string, values: string[]) => SourceQueryChain;
  gte: (column: string, value: string) => SourceQueryChain;
  lte: (column: string, value: string) => SourceQueryChain;
  gt: (column: string, value: string) => SourceQueryChain;
  order: (column: string, options: { ascending: boolean }) => SourceQueryChain;
  limit: (limit: number) => PromiseLike<SourceQueryResponse>;
}

interface AutomationDatabaseClient {
  from: (table: "rip_current_risks") => SourceQueryChain;
  rpc: (
    name: "append_regional_recommendation_hold_transition",
    args: { p_transition: Record<string, unknown> },
  ) => PromiseLike<AppendRpcResponse>;
}

interface EvaluationCounts {
  evaluated: number;
  proposed: number;
  accepted: number;
  failed: number;
}

type SourceFetchResult =
  | { state: "ok"; rows: SourceRow[] }
  | {
      state: "error";
      errorCode:
        | "source_query_failed"
        | "source_shape_invalid"
        | "source_limit_exceeded"
        | "source_snapshot_unstable";
    };

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    },
  });
}

function safeError(errorCode: string, counts: EvaluationCounts): Response {
  return jsonResponse({ ok: false, status: "error", errorCode, counts }, 500);
}

function toMinimalTransition(
  proposal: OfficialRipCurrentHoldProposal,
): Record<string, unknown> {
  return {
    holdId: proposal.holdId,
    transition: "activation",
    triggerType: "automatic_official",
    supportingEvidenceRefs: [...proposal.supportingEvidenceRefs],
    idempotencyKey: proposal.idempotencyKey,
    requestId: proposal.holdId,
  };
}

function canonicalAppendResult(
  data: unknown,
  proposal: OfficialRipCurrentHoldProposal,
  responseTime: Date,
): z.infer<typeof appendResultSchema>[number] | null {
  const parsed = appendResultSchema.safeParse(data);
  if (!parsed.success) return null;

  const [row] = parsed.data;
  const effectiveAt = Date.parse(row.effective_at);
  const validFrom = Date.parse(proposal.validFrom);
  const validUntil = Date.parse(proposal.validUntil);
  const latestEffectiveAt = Math.max(
    validFrom,
    responseTime.getTime() + CLOCK_SKEW_MS,
  );
  const matches =
    row.hold_id === proposal.holdId &&
    row.scope_beach_ids[0] === proposal.scopeBeachIds[0] &&
    row.event_reference === proposal.supportingEvidenceRefs[0] &&
    Date.parse(row.valid_from) === Date.parse(proposal.validFrom) &&
    Date.parse(row.valid_until) === Date.parse(proposal.validUntil) &&
    row.affected_cohorts.join(",") === proposal.affectedCohorts.join(",") &&
    row.action === proposal.action &&
    row.trigger_type === proposal.triggerType &&
    row.automatic_policy_version === proposal.automaticPolicyVersion &&
    effectiveAt >= validFrom &&
    effectiveAt < validUntil &&
    effectiveAt <= latestEffectiveAt &&
    Date.parse(row.expires_at) === Date.parse(proposal.expiresAt) &&
    row.idempotency_key === proposal.idempotencyKey &&
    row.request_id === proposal.requestId &&
    row.supporting_evidence_refs[0] === proposal.supportingEvidenceRefs[0];
  return matches ? row : null;
}

async function scanSourceRows(
  client: AutomationDatabaseClient,
  freshnessStart: string,
  freshnessEnd: string,
): Promise<SourceFetchResult> {
  const rows: SourceRow[] = [];
  let afterId: string | null = null;

  while (true) {
    let result: SourceQueryResponse;
    try {
      let query = client
        .from("rip_current_risks")
        .select(SOURCE_SELECT)
        .eq("risk_level", "high")
        .in("source", ["srf", "alert"])
        .gte("fetched_at", freshnessStart)
        .lte("fetched_at", freshnessEnd);
      if (afterId !== null) {
        query = query.gt("id", afterId);
      }
      result = await query
        .order("id", { ascending: true })
        .limit(SOURCE_PAGE_SIZE);
    } catch {
      return { state: "error", errorCode: "source_query_failed" };
    }

    if (result.error) {
      return { state: "error", errorCode: "source_query_failed" };
    }
    const parsed = sourceRowsSchema.safeParse(result.data);
    if (!parsed.success || parsed.data.length > SOURCE_PAGE_SIZE) {
      return { state: "error", errorCode: "source_shape_invalid" };
    }

    let previousId = afterId;
    for (const row of parsed.data) {
      if (previousId !== null && row.id <= previousId) {
        return { state: "error", errorCode: "source_shape_invalid" };
      }
      previousId = row.id;
    }

    if (rows.length + parsed.data.length > MAX_SOURCE_ROWS) {
      return { state: "error", errorCode: "source_limit_exceeded" };
    }

    rows.push(...parsed.data);
    if (parsed.data.length < SOURCE_PAGE_SIZE) {
      return { state: "ok", rows };
    }
    afterId = parsed.data[parsed.data.length - 1].id;
  }
}

function sourceSnapshotsEqual(left: SourceRow[], right: SourceRow[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((row, index) => {
    const other = right[index];
    return (
      row.id === other.id &&
      row.beach_id === other.beach_id &&
      row.valid_date === other.valid_date &&
      row.risk_level === other.risk_level &&
      row.source === other.source &&
      row.fetched_at === other.fetched_at &&
      row.beaches.timezone === other.beaches.timezone
    );
  });
}

async function fetchSourceRows(
  client: AutomationDatabaseClient,
  freshnessStart: string,
  freshnessEnd: string,
): Promise<SourceFetchResult> {
  for (let attempt = 0; attempt < STABLE_SOURCE_SCAN_ATTEMPTS; attempt += 1) {
    const first = await scanSourceRows(client, freshnessStart, freshnessEnd);
    if (first.state === "error") return first;

    const second = await scanSourceRows(client, freshnessStart, freshnessEnd);
    if (second.state === "error") return second;

    if (sourceSnapshotsEqual(first.rows, second.rows)) {
      return second;
    }
  }

  return { state: "error", errorCode: "source_snapshot_unstable" };
}

async function appendProposal(
  client: AutomationDatabaseClient,
  proposal: OfficialRipCurrentHoldProposal,
): Promise<MajorEventHoldCacheScope | null> {
  try {
    const result = await client.rpc.call(
      client,
      "append_regional_recommendation_hold_transition",
      { p_transition: toMinimalTransition(proposal) },
    );
    if (result.error) return null;
    const row = canonicalAppendResult(result.data, proposal, new Date());
    if (!row) return null;
    return {
      recordId: row.record_id,
      holdId: row.hold_id,
      transition: row.transition,
      regionKeys: [...row.region_keys],
      scopeBeachIds: [...row.scope_beach_ids],
      supersedesRecordId: row.supersedes_record_id,
    };
  } catch {
    return null;
  }
}

async function appendProposals(
  client: AutomationDatabaseClient,
  proposals: OfficialRipCurrentHoldProposal[],
): Promise<{ acceptedRecords: MajorEventHoldCacheScope[]; failed: number }> {
  const outcomes = new Array<MajorEventHoldCacheScope | null>(proposals.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < proposals.length) {
      const index = nextIndex;
      nextIndex += 1;
      outcomes[index] = await appendProposal(client, proposals[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(APPEND_CONCURRENCY, proposals.length) }, () =>
      worker(),
    ),
  );
  const acceptedRecords = outcomes.filter(
    (record): record is MajorEventHoldCacheScope => record !== null,
  );
  return {
    acceptedRecords,
    failed: proposals.length - acceptedRecords.length,
  };
}

async function runEnabledEvaluation(): Promise<Response> {
  const emptyCounts: EvaluationCounts = {
    evaluated: 0,
    proposed: 0,
    accepted: 0,
    failed: 0,
  };
  const now = new Date();
  const freshnessStart = new Date(now.getTime() - 12 * 60 * 60 * 1000);
  const freshnessEnd = new Date(now.getTime() + CLOCK_SKEW_MS);

  let client: AutomationDatabaseClient;
  let sourceResult: SourceFetchResult;
  try {
    client =
      createSupabaseServiceRoleClient() as unknown as AutomationDatabaseClient;
    sourceResult = await fetchSourceRows(
      client,
      freshnessStart.toISOString(),
      freshnessEnd.toISOString(),
    );
  } catch {
    return safeError("source_query_failed", emptyCounts);
  }

  if (sourceResult.state === "error") {
    return safeError(sourceResult.errorCode, emptyCounts);
  }

  const rows = sourceResult.rows.map((row) => ({
    id: row.id,
    beach_id: row.beach_id,
    valid_date: row.valid_date,
    risk_level: row.risk_level,
    source: row.source,
    fetched_at: row.fetched_at,
    beach_timezone: row.beaches.timezone,
  }));
  const diagnostics = evaluateOfficialRipCurrentHoldDiagnostics({ rows, now });
  const { proposals } = diagnostics;
  const counts: EvaluationCounts = {
    evaluated: rows.length,
    proposed: proposals.length,
    accepted: 0,
    failed: 0,
  };

  const appendCounts = await appendProposals(client, proposals);
  counts.accepted = appendCounts.acceptedRecords.length;
  counts.failed = appendCounts.failed;

  if (appendCounts.acceptedRecords.length > 0) {
    try {
      await invalidateMajorEventHoldTransitions(appendCounts.acceptedRecords, {
        store: createSupabaseMajorEventHoldCacheInvalidationStore(client),
      });
    } catch {
      return safeError("cache_invalidation_failed", counts);
    }
  }

  if (diagnostics.invalidMetadataCount > 0) {
    return safeError("source_metadata_invalid", counts);
  }
  if (counts.failed > 0) {
    return safeError("append_failed", counts);
  }
  return jsonResponse(await withCronOutcome(
    {
      job: ROUTE,
      unit: "holds_evaluated",
      expectedMin: 1,
      getProduced: (value) => value.counts.evaluated,
      legitimatelyZero: (value) =>
        value.counts.evaluated === 0
          ? { reason: "No fresh high-risk rip-current source rows were available" }
          : undefined,
    },
    async () => ({ ok: true, status: "completed", counts }),
  ));
}

const observedEnabledEvaluation = withObservedCron(
  ROUTE,
  async (_request: Request) => runEnabledEvaluation(),
);

export async function GET(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return jsonResponse(
      { ok: false, status: "unauthorized", errorCode: "unauthorized" },
      401,
    );
  }

  if (process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED !== "true") {
    return jsonResponse(await withCronOutcome(
      {
        job: ROUTE,
        unit: "holds_evaluated",
        expectedMin: 1,
        getProduced: (value) => value.counts.evaluated,
        legitimatelyZero: () => ({ reason: "MAJOR_EVENT_HOLD_AUTOMATION_ENABLED is not true" }),
      },
      async () => ({
        ok: true,
        status: "disabled",
        counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
      }),
    ));
  }

  return observedEnabledEvaluation(request);
}
