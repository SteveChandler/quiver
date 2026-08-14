import { readFileSync } from "fs";

jest.mock("@/lib/cron/outcome", () => ({
  withCronOutcome: jest.fn(async (_options: unknown, handler: () => Promise<unknown>) => handler()),
}));

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockGte = jest.fn();
const mockLte = jest.fn();
const mockGt = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockCacheInvalidationStore = {};
const mockCreateCacheInvalidationStore = jest.fn<unknown, [unknown]>(
  () => mockCacheInvalidationStore,
);
const mockInvalidateMajorEventHoldTransitions = jest.fn<
  Promise<string[]>,
  [unknown, unknown]
>();

jest.mock("@/lib/middleware/api-wrappers", () => ({
  validateCronRequest: jest.fn(),
}));

jest.mock("@/lib/cron/observability", () => ({
  withObservedCron: jest.fn((_route: string, handler: unknown) => handler),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

jest.mock("@/lib/recommendations/major-event-hold/cache-invalidation", () => ({
  createSupabaseMajorEventHoldCacheInvalidationStore: (client: unknown) =>
    mockCreateCacheInvalidationStore(client),
  invalidateMajorEventHoldTransitions: (records: unknown, options: unknown) =>
    mockInvalidateMajorEventHoldTransitions(records, options),
}));

import { GET } from "@/app/api/cron/major-event-hold-evaluate/route";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

const mockValidateCronRequest = jest.mocked(validateCronRequest);
const mockCreateServiceClient = jest.mocked(createSupabaseServiceRoleClient);

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";
const SOURCE_ROW = {
  id: ROW_ID,
  beach_id: BEACH_ID,
  valid_date: "2026-07-17",
  risk_level: "high",
  source: "srf",
  fetched_at: "2026-07-17T19:00:00.000Z",
  beaches: { timezone: "America/Los_Angeles" },
};

function indexedUuid(prefix: string, index: number): string {
  return `${prefix}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

function buildSourceRow(
  index: number,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...SOURCE_ROW,
    id: indexedUuid("30000000", index),
    beach_id: indexedUuid("40000000", index),
    ...overrides,
  };
}

function buildCanonicalAppendRow(
  transition: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const idempotencyParts = String(transition.idempotencyKey).split(":");
  const beachId = idempotencyParts[3];
  const evidenceReference = (transition.supportingEvidenceRefs as string[])[0];
  return {
    record_id: "33333333-3333-4333-8333-333333333333",
    hold_id: transition.holdId,
    version: 1,
    transition: "activation",
    status: "active",
    region_keys: [],
    scope_beach_ids: [beachId],
    scope_exposure_classes: [],
    protected_alternative_beach_ids: [],
    event_reference: evidenceReference,
    valid_from: "2026-07-17T07:00:00.000Z",
    valid_until: "2026-07-18T07:00:00.000Z",
    affected_cohorts: ["beginner", "intermediate", "unknown"],
    action: "suppress_positive",
    trigger_type: "automatic_official",
    supporting_evidence_refs: transition.supportingEvidenceRefs,
    automatic_policy_version: "official-rip-high.v1",
    authorizing_operator_ref: null,
    authorizing_actor: "official_automation",
    reason_code: "official_high_rip_current",
    effective_at: "2026-07-17T20:00:00.000Z",
    expires_at: "2026-07-18T07:00:00.000Z",
    supersedes_record_id: null,
    idempotency_key: transition.idempotencyKey,
    payload_hash: "a".repeat(64),
    request_id: transition.requestId,
    created_at: "2026-07-17T20:00:00.000Z",
    ...overrides,
  };
}

const queryChain = {
  select: mockSelect,
  eq: mockEq,
  in: mockIn,
  gte: mockGte,
  lte: mockLte,
  gt: mockGt,
  order: mockOrder,
  limit: mockLimit,
};
const mockClient = { from: mockFrom, rpc: mockRpc };

function makeRequest(): Request {
  return new Request("http://localhost/api/cron/major-event-hold-evaluate", {
    headers: { authorization: "Bearer cron-secret" },
  });
}

describe("major event hold evaluation cron", () => {
  beforeAll(() => {
    jest.useFakeTimers();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    jest.setSystemTime(new Date("2026-07-17T20:00:00.000Z"));
    process.env.CRON_SECRET = "cron-secret";
    process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED = "true";
    mockValidateCronRequest.mockReturnValue(true);
    mockCreateServiceClient.mockReturnValue(mockClient as never);
    mockFrom.mockReturnValue(queryChain);
    mockSelect.mockReturnValue(queryChain);
    mockEq.mockReturnValue(queryChain);
    mockIn.mockReturnValue(queryChain);
    mockGte.mockReturnValue(queryChain);
    mockLte.mockReturnValue(queryChain);
    mockGt.mockReturnValue(queryChain);
    mockOrder.mockReturnValue(queryChain);
    mockLimit.mockResolvedValue({ data: [SOURCE_ROW], error: null });
    mockCreateCacheInvalidationStore.mockReturnValue(
      mockCacheInvalidationStore,
    );
    mockInvalidateMajorEventHoldTransitions.mockResolvedValue([]);
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) =>
        Promise.resolve({
          data: [buildCanonicalAppendRow(args.p_transition)],
          error: null,
        }),
    );
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  afterEach(() => {
    delete process.env.CRON_SECRET;
    delete process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED;
  });

  it("rejects unauthorized requests before any client or data call", async () => {
    mockValidateCronRequest.mockReturnValue(false);

    const response = await GET(makeRequest());

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      ok: false,
      status: "unauthorized",
      errorCode: "unauthorized",
    });
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([undefined, "false", "", "TRUE", " true ", "invalid"])(
    "keeps automation disabled for %p with zero client or data calls",
    async (flag) => {
      if (flag === undefined) {
        delete process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED;
      } else {
        process.env.MAJOR_EVENT_HOLD_AUTOMATION_ENABLED = flag;
      }

      const response = await GET(makeRequest());

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({
        ok: true,
        status: "disabled",
        counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
      });
      expect(mockCreateServiceClient).not.toHaveBeenCalled();
      expect(mockFrom).not.toHaveBeenCalled();
      expect(mockRpc).not.toHaveBeenCalled();
    },
  );

  it("queries only official high rows with beach timezone and appends the exact minimal tuple", async () => {
    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 1, proposed: 1, accepted: 1, failed: 0 },
    });
    expect(mockFrom).toHaveBeenCalledWith("rip_current_risks");
    expect(mockSelect).toHaveBeenCalledWith(
      "id,beach_id,valid_date,risk_level,source,fetched_at,beaches!inner(timezone)",
    );
    expect(mockEq).toHaveBeenCalledWith("risk_level", "high");
    expect(mockIn).toHaveBeenCalledWith("source", ["srf", "alert"]);
    expect(mockGte).toHaveBeenCalledWith(
      "fetched_at",
      "2026-07-17T08:00:00.000Z",
    );
    expect(mockLte).toHaveBeenCalledWith(
      "fetched_at",
      "2026-07-17T20:05:00.000Z",
    );
    expect(mockOrder).toHaveBeenCalledWith("id", { ascending: true });
    expect(mockLimit).toHaveBeenCalledWith(500);
    expect(mockLimit).toHaveBeenCalledTimes(2);
    expect(mockGt).not.toHaveBeenCalled();

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, rpcArguments] = mockRpc.mock.calls[0];
    expect(rpcName).toBe("append_regional_recommendation_hold_transition");
    const transition = rpcArguments.p_transition;
    expect(Object.keys(transition).sort()).toEqual(
      [
        "holdId",
        "idempotencyKey",
        "requestId",
        "supportingEvidenceRefs",
        "transition",
        "triggerType",
      ].sort(),
    );
    expect(transition).toEqual({
      holdId: expect.any(String),
      transition: "activation",
      triggerType: "automatic_official",
      supportingEvidenceRefs: [`official:rip_current_risks:${ROW_ID}`],
      idempotencyKey: `auto:official_rip_high:v1:${BEACH_ID}:2026-07-17`,
      requestId: expect.any(String),
    });
    expect(transition.requestId).toBe(transition.holdId);
    expect(mockRpc.mock.instances[0]).toBe(mockClient);
    expect(mockCreateCacheInvalidationStore).toHaveBeenCalledWith(mockClient);
    expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledWith(
      [
        {
          recordId: "33333333-3333-4333-8333-333333333333",
          holdId: transition.holdId,
          transition: "activation",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          supersedesRecordId: null,
        },
      ],
      { store: mockCacheInvalidationStore },
    );
    expect(mockRpc.mock.invocationCallOrder[0]).toBeLessThan(
      mockInvalidateMajorEventHoldTransitions.mock.invocationCallOrder[0],
    );
    expect(JSON.stringify(payload)).not.toContain(ROW_ID);
    expect(JSON.stringify(payload)).not.toContain("America/Los_Angeles");
  });

  it("does not initialize invalidation when no proposal is accepted", async () => {
    mockLimit.mockResolvedValue({ data: [], error: null });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockCreateCacheInvalidationStore).not.toHaveBeenCalled();
    expect(mockInvalidateMajorEventHoldTransitions).not.toHaveBeenCalled();
  });

  it("accepts an idempotent later-run replay with the stored earlier effective time", async () => {
    jest.setSystemTime(new Date("2026-07-17T21:00:00.000Z"));

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 1, proposed: 1, accepted: 1, failed: 0 },
    });
    expect(mockRpc).toHaveBeenCalledTimes(1);
  });

  it("accepts a fresh same-day append within the response clock-skew bound", async () => {
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) =>
        Promise.resolve({
          data: [
            buildCanonicalAppendRow(args.p_transition, {
              effective_at: "2026-07-17T20:00:01.000Z",
            }),
          ],
          error: null,
        }),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 1, proposed: 1, accepted: 1, failed: 0 },
    });
  });

  it("requires an exact valid-from effective time for a future-day append", async () => {
    mockLimit.mockResolvedValue({
      data: [{ ...SOURCE_ROW, valid_date: "2026-07-18" }],
      error: null,
    });
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) =>
        Promise.resolve({
          data: [
            buildCanonicalAppendRow(args.p_transition, {
              valid_from: "2026-07-18T07:00:00.000Z",
              valid_until: "2026-07-19T07:00:00.000Z",
              effective_at: "2026-07-18T07:00:00.001Z",
              expires_at: "2026-07-19T07:00:00.000Z",
            }),
          ],
          error: null,
        }),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "append_failed",
      counts: { evaluated: 1, proposed: 1, accepted: 0, failed: 1 },
    });
  });

  it("fetches an empty sentinel page after an exact 500-row boundary", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) =>
      buildSourceRow(index, { beach_id: BEACH_ID }),
    );
    mockLimit
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: [], error: null });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 500, proposed: 1, accepted: 1, failed: 0 },
    });
    expect(mockGt.mock.calls).toEqual([
      ["id", firstPage[firstPage.length - 1].id],
      ["id", firstPage[firstPage.length - 1].id],
    ]);
    expect(mockLimit).toHaveBeenCalledTimes(4);
  });

  it("accumulates rows across more than one source page", async () => {
    const firstPage = Array.from({ length: 500 }, (_, index) =>
      buildSourceRow(index, { beach_id: BEACH_ID }),
    );
    const secondBeachId = "99999999-9999-4999-8999-999999999999";
    mockLimit
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({
        data: [buildSourceRow(501, { beach_id: secondBeachId })],
        error: null,
      })
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({
        data: [buildSourceRow(501, { beach_id: secondBeachId })],
        error: null,
      });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 501, proposed: 2, accepted: 2, failed: 0 },
    });
    expect(mockGt.mock.calls).toEqual([
      ["id", firstPage[firstPage.length - 1].id],
      ["id", firstPage[firstPage.length - 1].id],
    ]);
    expect(mockLimit).toHaveBeenCalledTimes(4);
  });

  it("retries keyset scans across insert and update page-boundary shifts", async () => {
    const page = Array.from({ length: 500 }, (_, index) =>
      buildSourceRow(index, { beach_id: BEACH_ID }),
    );
    const inserted = buildSourceRow(900, {
      id: "10000000-0000-4000-8000-000000000000",
      beach_id: BEACH_ID,
    });
    const finalBefore = buildSourceRow(901, {
      id: "90000000-0000-4000-8000-000000000000",
      beach_id: BEACH_ID,
      fetched_at: "2026-07-17T18:30:00.000Z",
    });
    const finalAfter = {
      ...finalBefore,
      source: "alert",
      fetched_at: "2026-07-17T19:30:00.000Z",
    };
    const before = [...page, finalBefore];
    const after = [inserted, ...page, finalAfter];
    let afterId: string | null = null;
    let scan = -1;
    let activeCatalog = before;
    mockFrom.mockImplementation(() => {
      afterId = null;
      return queryChain;
    });
    mockGt.mockImplementation((_column: string, id: string) => {
      afterId = id;
      return queryChain;
    });
    mockLimit.mockImplementation(async (_limit: number) => {
      if (afterId === null) {
        scan += 1;
        activeCatalog = scan === 0 ? before : after;
      } else if (scan === 0) {
        activeCatalog = after;
      }
      const cursor = afterId;
      return {
        data: activeCatalog
          .filter((row) => cursor === null || String(row.id) > cursor)
          .slice(0, 500),
        error: null,
      };
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 502, proposed: 1, accepted: 1, failed: 0 },
    });
    expect(mockLimit).toHaveBeenCalledTimes(8);
  });

  it("fails closed when complete source scans never stabilize", async () => {
    let scan = 0;
    mockLimit.mockImplementation(async () => {
      const rows =
        scan % 2 === 0 ? [SOURCE_ROW] : [SOURCE_ROW, buildSourceRow(1)];
      scan += 1;
      return { data: rows, error: null };
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "source_snapshot_unstable",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(mockLimit).toHaveBeenCalledTimes(6);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails safely when a later source page fails", async () => {
    const fullPage = Array.from({ length: 500 }, (_, index) =>
      buildSourceRow(index, { beach_id: BEACH_ID }),
    );
    mockLimit
      .mockResolvedValueOnce({ data: fullPage, error: null })
      .mockResolvedValueOnce({
        data: null,
        error: { message: `leak official:rip_current_risks:${ROW_ID}` },
      });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      ok: false,
      status: "error",
      errorCode: "source_query_failed",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(JSON.stringify(payload)).not.toContain(ROW_ID);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("fails safely rather than truncating beyond the 10,000-row bound", async () => {
    let page = 0;
    mockLimit.mockImplementation(async () => {
      const start = page * 500;
      page += 1;
      return {
        data: Array.from({ length: 500 }, (_, index) =>
          buildSourceRow(start + index, { beach_id: BEACH_ID }),
        ),
        error: null,
      };
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "source_limit_exceeded",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(mockLimit).toHaveBeenCalledTimes(21);
    expect(mockGt).toHaveBeenCalledTimes(20);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns a stable safe source-query failure", async () => {
    mockLimit.mockResolvedValue({
      data: null,
      error: { message: `leak official:rip_current_risks:${ROW_ID}` },
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      ok: false,
      status: "error",
      errorCode: "source_query_failed",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(JSON.stringify(payload)).not.toContain(ROW_ID);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("returns a stable safe shape failure without appending", async () => {
    mockLimit.mockResolvedValue({
      data: [{ ...SOURCE_ROW, beaches: { timezone: 17 } }],
      error: null,
    });

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "source_shape_invalid",
      counts: { evaluated: 0, proposed: 0, accepted: 0, failed: 0 },
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it.each([
    ["missing timezone", { beaches: { timezone: null } }],
    ["invalid timezone", { beaches: { timezone: "Not/A_Zone" } }],
    ["unconstructable local window", { valid_date: "2026-02-30" }],
  ])(
    "appends valid proposals then fails safely for %s metadata",
    async (_label, invalidOverrides) => {
      const validRow = buildSourceRow(10);
      const invalidRow = { ...SOURCE_ROW, ...invalidOverrides };
      mockLimit.mockResolvedValue({
        data: [validRow, invalidRow].sort((left, right) =>
          String(left.id).localeCompare(String(right.id)),
        ),
        error: null,
      });

      const response = await GET(makeRequest());
      const payload = await response.json();

      expect(response.status).toBe(500);
      expect(payload).toEqual({
        ok: false,
        status: "error",
        errorCode: "source_metadata_invalid",
        counts: { evaluated: 2, proposed: 1, accepted: 1, failed: 0 },
      });
      expect(mockRpc).toHaveBeenCalledTimes(1);
      expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(payload)).not.toContain(ROW_ID);
      expect(JSON.stringify(payload)).not.toContain("Not/A_Zone");
      expect(JSON.stringify(payload)).not.toContain(
        "official:rip_current_risks",
      );
    },
  );

  it("attempts every append with concurrency above one and at most eight", async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      buildSourceRow(index),
    );
    mockLimit.mockResolvedValue({ data: rows, error: null });
    let active = 0;
    let maxActive = 0;
    let releaseGate: () => void = () => {
      throw new Error("append gate was not initialized");
    };
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve;
    });
    mockRpc.mockImplementation(
      async (
        _name: string,
        args: { p_transition: Record<string, unknown> },
      ) => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await gate;
        active -= 1;
        return {
          data: [buildCanonicalAppendRow(args.p_transition)],
          error: null,
        };
      },
    );

    const responsePromise = GET(makeRequest());
    for (let index = 0; index < 10; index += 1) {
      await Promise.resolve();
    }

    expect(mockRpc).toHaveBeenCalledTimes(8);
    expect(maxActive).toBeGreaterThan(1);
    expect(maxActive).toBeLessThanOrEqual(8);
    releaseGate();
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 12, proposed: 12, accepted: 12, failed: 0 },
    });
    expect(mockRpc).toHaveBeenCalledTimes(12);
    expect(maxActive).toBe(8);
  });

  it("returns stable safe append counts and never leaks evidence on RPC failure", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: `failed official:rip_current_risks:${ROW_ID}` },
    });

    const response = await GET(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      ok: false,
      status: "error",
      errorCode: "append_failed",
      counts: { evaluated: 1, proposed: 1, accepted: 0, failed: 1 },
    });
    expect(JSON.stringify(payload)).not.toContain(ROW_ID);
    expect(JSON.stringify(payload)).not.toContain("official:rip_current_risks");
    expect(mockInvalidateMajorEventHoldTransitions).not.toHaveBeenCalled();
  });

  it("invalidates accepted records even when another append fails", async () => {
    const failedBeachId = "99999999-9999-4999-8999-999999999999";
    mockLimit.mockResolvedValue({
      data: [SOURCE_ROW, buildSourceRow(2, { beach_id: failedBeachId })].sort(
        (left, right) => String(left.id).localeCompare(String(right.id)),
      ),
      error: null,
    });
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) => {
        const beachId = String(args.p_transition.idempotencyKey).split(":")[3];
        return Promise.resolve(
          beachId === failedBeachId
            ? { data: null, error: { message: "append failed" } }
            : {
                data: [buildCanonicalAppendRow(args.p_transition)],
                error: null,
              },
        );
      },
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "append_failed",
      counts: { evaluated: 2, proposed: 2, accepted: 1, failed: 1 },
    });
    expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledTimes(1);
    expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledWith(
      [expect.objectContaining({ scopeBeachIds: [BEACH_ID] })],
      { store: mockCacheInvalidationStore },
    );
  });

  it("reports post-persistence invalidation failure with accepted and failed counts", async () => {
    const failedBeachId = "99999999-9999-4999-8999-999999999999";
    mockLimit.mockResolvedValue({
      data: [SOURCE_ROW, buildSourceRow(2, { beach_id: failedBeachId })].sort(
        (left, right) => String(left.id).localeCompare(String(right.id)),
      ),
      error: null,
    });
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) => {
        const beachId = String(args.p_transition.idempotencyKey).split(":")[3];
        return Promise.resolve(
          beachId === failedBeachId
            ? { data: null, error: { message: "append failed" } }
            : {
                data: [buildCanonicalAppendRow(args.p_transition)],
                error: null,
              },
        );
      },
    );
    mockInvalidateMajorEventHoldTransitions.mockRejectedValue(
      new Error("cache unavailable"),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "cache_invalidation_failed",
      counts: { evaluated: 2, proposed: 2, accepted: 1, failed: 1 },
    });
    expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["null", () => null],
    ["empty", () => []],
    [
      "multiple",
      (transition: Record<string, unknown>) => [
        buildCanonicalAppendRow(transition),
        buildCanonicalAppendRow(transition, {
          record_id: "44444444-4444-4444-8444-444444444444",
        }),
      ],
    ],
  ])("rejects a %s append result", async (_label, buildData) => {
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) =>
        Promise.resolve({ data: buildData(args.p_transition), error: null }),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      ok: false,
      status: "error",
      errorCode: "append_failed",
      counts: { evaluated: 1, proposed: 1, accepted: 0, failed: 1 },
    });
  });

  it.each([
    ["hold id", { hold_id: "99999999-9999-4999-8999-999999999999" }],
    ["idempotency key", { idempotency_key: "wrong:key" }],
    ["request id", { request_id: "99999999-9999-4999-8999-999999999999" }],
    ["evidence", { supporting_evidence_refs: ["qa:artifact:wrong"] }],
    ["region scope", { region_keys: ["california"] }],
    [
      "beach scope",
      { scope_beach_ids: ["99999999-9999-4999-8999-999999999999"] },
    ],
    ["exposure scope", { scope_exposure_classes: ["protected"] }],
    [
      "protected alternatives",
      {
        protected_alternative_beach_ids: [
          "99999999-9999-4999-8999-999999999999",
        ],
      },
    ],
    ["event reference", { event_reference: "qa:artifact:wrong" }],
    ["valid from", { valid_from: "2026-07-17T08:00:00.000Z" }],
    ["valid until", { valid_until: "2026-07-18T08:00:00.000Z" }],
    ["cohorts", { affected_cohorts: ["beginner", "unknown"] }],
    ["action", { action: "protected_alternatives_only" }],
    ["trigger", { trigger_type: "manual_operator" }],
    ["version", { version: 2 }],
    ["status", { status: "cancelled" }],
    ["policy", { automatic_policy_version: "official-rip-high.v2" }],
    [
      "operator",
      { authorizing_operator_ref: "99999999-9999-4999-8999-999999999999" },
    ],
    ["authorizing actor", { authorizing_actor: "admin_api" }],
    ["reason", { reason_code: "operator_cancelled" }],
    [
      "effective at beyond the response clock-skew bound",
      { effective_at: "2026-07-17T20:05:00.001Z" },
    ],
    [
      "effective at before the valid window",
      { effective_at: "2026-07-17T06:59:59.999Z" },
    ],
    ["expires at", { expires_at: "2026-07-18T08:00:00.000Z" }],
    [
      "superseded record",
      { supersedes_record_id: "99999999-9999-4999-8999-999999999999" },
    ],
    ["payload hash", { payload_hash: "not-a-sha256" }],
    ["record id format", { record_id: "not-a-uuid" }],
    ["created-at format", { created_at: "not-a-timestamp" }],
    ["unknown extra field", { unexpected_evidence: "leak" }],
  ])(
    "rejects an append result with mismatched %s",
    async (_label, overrides) => {
      mockRpc.mockImplementation(
        (_name: string, args: { p_transition: Record<string, unknown> }) =>
          Promise.resolve({
            data: [buildCanonicalAppendRow(args.p_transition, overrides)],
            error: null,
          }),
      );

      const response = await GET(makeRequest());

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({
        ok: false,
        status: "error",
        errorCode: "append_failed",
        counts: { evaluated: 1, proposed: 1, accepted: 0, failed: 1 },
      });
    },
  );

  it("accepts equivalent database timestamp offsets in the canonical append row", async () => {
    mockRpc.mockImplementation(
      (_name: string, args: { p_transition: Record<string, unknown> }) =>
        Promise.resolve({
          data: [
            buildCanonicalAppendRow(args.p_transition, {
              valid_from: "2026-07-17T00:00:00.000-07:00",
              valid_until: "2026-07-18T00:00:00.000-07:00",
              effective_at: "2026-07-17T13:00:00.000-07:00",
              expires_at: "2026-07-18T00:00:00.000-07:00",
            }),
          ],
          error: null,
        }),
    );

    const response = await GET(makeRequest());

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      status: "completed",
      counts: { evaluated: 1, proposed: 1, accepted: 1, failed: 0 },
    });
  });

  it("uses node dynamic no-store and observed-cron patterns", async () => {
    const source = readFileSync(
      "app/api/cron/major-event-hold-evaluate/route.ts",
      "utf8",
    );
    const response = await GET(makeRequest());

    expect(source).toContain('export const runtime = "nodejs"');
    expect(source).toContain('export const dynamic = "force-dynamic"');
    expect(source).toContain("export const revalidate = 0");
    expect(source).toContain("export const maxDuration = 300");
    expect(source).toContain("withObservedCron");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
