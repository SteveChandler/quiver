jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

import { jest } from "@jest/globals";

import { deterministicUuidV8 } from "@/lib/recommendations/major-event-hold/identity";

const mockCreateCacheInvalidationStore = jest.fn<(client: unknown) => unknown>(
  () => ({}),
);
const mockInvalidateMajorEventHoldTransitions =
  jest.fn<(records: unknown, options: unknown) => Promise<string[]>>();
const mockExecuteManualHoldCommand =
  jest.fn<
    typeof import("@/lib/recommendations/major-event-hold/control").executeManualHoldCommand
  >();

jest.mock("@/lib/recommendations/major-event-hold/cache-invalidation", () => ({
  createSupabaseMajorEventHoldCacheInvalidationStore: (client: unknown) =>
    mockCreateCacheInvalidationStore(client),
  invalidateMajorEventHoldTransitions: (records: unknown, options: unknown) =>
    mockInvalidateMajorEventHoldTransitions(records, options),
}));

jest.mock("@/lib/recommendations/major-event-hold/control", () => {
  const actual = jest.requireActual(
    "@/lib/recommendations/major-event-hold/control",
  );
  return {
    ...(actual as object),
    executeManualHoldCommand: (
      ...args: Parameters<typeof mockExecuteManualHoldCommand>
    ) => mockExecuteManualHoldCommand(...args),
  };
});

jest.mock("@/lib/auth/admin", () => ({
  authenticateAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(),
}));

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const IDEMPOTENCY_ID = "00000000-0000-4000-8000-000000000003";
const BEACH_ID = "00000000-0000-4000-8000-000000000006";
const HOLD_ID = "00000000-0000-8000-8000-000000000004";
const RECORD_ID = "00000000-0000-4000-8000-000000000005";

function fullPolicyBody(operation: "activate" | "replace") {
  return {
    operation,
    ...(operation === "replace" ? { holdId: HOLD_ID } : {}),
    regionKeys: [],
    scopeBeachIds: [BEACH_ID],
    scopeExposureClasses: [],
    protectedAlternativeBeachIds: [],
    eventReference: null,
    validFrom: "2026-07-19T21:00:00.000Z",
    validUntil: "2026-07-20T21:00:00.000Z",
    affectedCohorts: ["beginner"],
    action: "suppress_positive",
    supportingEvidenceRefs: [],
    reasonCode:
      operation === "activate"
        ? "major_swell_manual_safety"
        : "scope_correction",
  };
}

function request(body?: object, headers: Record<string, string> = {}) {
  const normalized = new Map(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return {
    json: async () => body,
    headers: {
      get: (name: string) => normalized.get(name.toLowerCase()) ?? null,
    },
  } as never;
}

function queryResult(data: unknown) {
  const builder: Record<string, unknown> = {};
  for (const method of [
    "select",
    "eq",
    "gt",
    "is",
    "order",
    "range",
    "limit",
  ]) {
    builder[method] = jest.fn(() => builder);
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve({ data, error: null }).then(resolve);
  return builder;
}

function adminUser() {
  return {
    id: ADMIN_ID,
    email: "operator@example.com",
    aud: "authenticated",
    created_at: "2026-01-01T00:00:00.000Z",
  };
}

describe("/api/admin/recommendation-holds", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-19T20:00:00.000Z"));
    jest.resetModules();
    jest.clearAllMocks();
    mockCreateCacheInvalidationStore.mockReturnValue({});
    mockInvalidateMajorEventHoldTransitions.mockResolvedValue([]);
    const actualControl = jest.requireActual<
      typeof import("@/lib/recommendations/major-event-hold/control")
    >("@/lib/recommendations/major-event-hold/control");
    mockExecuteManualHoldCommand.mockImplementation(
      actualControl.executeManualHoldCommand as never,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it("uses the admin wrapper and makes no database call when unauthorized", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: false,
      error: "Admin access required",
      status: 403,
    });
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");

    const response = await POST(request({ operation: "cancel" }));

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("rejects user-owned admin metadata before the safety RPC", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    const { isAdmin } =
      jest.requireActual<typeof import("@/lib/auth/admin")>("@/lib/auth/admin");
    const untrustedUser = {
      ...adminUser(),
      id: "00000000-0000-4000-8000-000000000099",
      app_metadata: {},
      user_metadata: { is_admin: true, role: "admin" },
    };
    jest.mocked(authenticateAdmin).mockImplementation(async () =>
      isAdmin(untrustedUser as never)
        ? { success: true, user: untrustedUser as never }
        : {
            success: false,
            error: "Admin access required",
            status: 403,
          },
    );
    const beaches = queryResult([
      {
        id: BEACH_ID,
        state: "CA",
        city: "San Diego",
        lat: 32.8,
        is_private: false,
        deleted_at: null,
      },
    ]);
    const empty = queryResult([]);
    const rpc = jest.fn(async () => ({
      data: null,
      error: { code: "XX000", message: "must not be reached" },
    }));
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: jest.fn((table: string) => (table === "beaches" ? beaches : empty)),
      rpc,
    } as never);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");

    const response = await POST(
      request(
        {
          operation: "activate",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          scopeExposureClasses: [],
          protectedAlternativeBeachIds: [],
          eventReference: null,
          validFrom: "2026-07-19T21:00:00.000Z",
          validUntil: "2026-07-20T21:00:00.000Z",
          affectedCohorts: ["beginner"],
          action: "suppress_positive",
          supportingEvidenceRefs: [],
          reasonCode: "major_swell_manual_safety",
        },
        { "Idempotency-Key": IDEMPOTENCY_ID },
      ),
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["activation", fullPolicyBody("activate")],
    [
      "extension",
      {
        operation: "extend",
        holdId: HOLD_ID,
        newValidUntil: "2026-07-21T21:00:00.000Z",
        reasonCode: "major_swell_manual_safety",
      },
    ],
    ["replacement", fullPolicyBody("replace")],
    [
      "cancellation",
      {
        operation: "cancel",
        holdId: HOLD_ID,
        reasonCode: "operator_cancelled",
      },
    ],
  ])(
    "invalidates only after a confirmed %s and keeps the record internal",
    async (transition, body) => {
      jest.spyOn(console, "info").mockImplementation(() => undefined);
      const { authenticateAdmin } = await import("@/lib/auth/admin");
      jest.mocked(authenticateAdmin).mockResolvedValue({
        success: true,
        user: adminUser(),
      });
      const client = { from: jest.fn(), rpc: jest.fn() };
      const { createSupabaseServiceRoleClient } =
        await import("@/lib/supabase/server");
      jest
        .mocked(createSupabaseServiceRoleClient)
        .mockReturnValue(client as never);
      const confirmedRecord = {
        recordId: RECORD_ID,
        holdId: HOLD_ID,
        transition,
        regionKeys: [],
        scopeBeachIds: [BEACH_ID],
        supersedesRecordId:
          transition === "activation" ? null : "prior-record-id",
      };
      const execute = mockExecuteManualHoldCommand.mockResolvedValue({
        hold: {
          holdId: HOLD_ID,
          transition,
          reasonCode:
            transition === "cancellation"
              ? "operator_cancelled"
              : transition === "replacement"
                ? "scope_correction"
                : "major_swell_manual_safety",
        },
        outcome: "accepted",
        confirmedRecord,
      } as never);
      const { POST } =
        await import("@/app/api/admin/recommendation-holds/route");

      const response = await POST(
        request(body, { "Idempotency-Key": IDEMPOTENCY_ID }),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(execute).toHaveBeenCalledTimes(1);
      expect(mockCreateCacheInvalidationStore).toHaveBeenCalledWith(client);
      expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledWith(
        [confirmedRecord],
        { store: {} },
      );
      expect(execute.mock.invocationCallOrder[0]).toBeLessThan(
        mockInvalidateMajorEventHoldTransitions.mock.invocationCallOrder[0],
      );
      expect(payload.data).toEqual({
        hold: expect.objectContaining({ holdId: HOLD_ID, transition }),
        outcome: "accepted",
      });
      expect(JSON.stringify(payload)).not.toContain(RECORD_ID);
      expect(payload.data.confirmedRecord).toBeUndefined();
    },
  );

  it("retries invalidation for every exact idempotent replay", async () => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const client = { from: jest.fn(), rpc: jest.fn() };
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest
      .mocked(createSupabaseServiceRoleClient)
      .mockReturnValue(client as never);
    const confirmedRecord = {
      recordId: RECORD_ID,
      holdId: HOLD_ID,
      transition: "activation",
      regionKeys: [],
      scopeBeachIds: [BEACH_ID],
      supersedesRecordId: null,
    };
    mockExecuteManualHoldCommand.mockResolvedValue({
      hold: {
        holdId: HOLD_ID,
        transition: "activation",
        reasonCode: "major_swell_manual_safety",
      },
      outcome: "accepted",
      confirmedRecord,
    } as never);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");
    const replayRequest = () =>
      request(fullPolicyBody("activate"), {
        "Idempotency-Key": IDEMPOTENCY_ID,
      });

    expect((await POST(replayRequest())).status).toBe(200);
    expect((await POST(replayRequest())).status).toBe(200);
    expect(mockInvalidateMajorEventHoldTransitions).toHaveBeenCalledTimes(2);
  });

  it("returns cache_invalidation_failed after persistence without rollback or record exposure", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const client = { from: jest.fn(), rpc: jest.fn() };
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest
      .mocked(createSupabaseServiceRoleClient)
      .mockReturnValue(client as never);
    mockExecuteManualHoldCommand.mockResolvedValue({
      hold: {
        holdId: HOLD_ID,
        transition: "activation",
        reasonCode: "major_swell_manual_safety",
      },
      outcome: "accepted",
      confirmedRecord: {
        recordId: RECORD_ID,
        holdId: HOLD_ID,
        transition: "activation",
        regionKeys: [],
        scopeBeachIds: [BEACH_ID],
        supersedesRecordId: null,
      },
    } as never);
    mockInvalidateMajorEventHoldTransitions.mockRejectedValue(
      new Error("cache unavailable"),
    );
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");

    const response = await POST(
      request(fullPolicyBody("activate"), {
        "Idempotency-Key": IDEMPOTENCY_ID,
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      success: false,
      error: { code: "cache_invalidation_failed" },
    });
    expect(JSON.stringify(payload)).not.toContain(RECORD_ID);
    expect(error).toHaveBeenCalledWith(
      "recommendation_hold_admin",
      expect.objectContaining({ outcome: "cache_invalidation_failed" }),
    );
  });

  it("rejects missing idempotency and client-owned automatic provenance without an RPC", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const rpc = jest.fn();
    const client = { rpc, from: jest.fn() };
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest
      .mocked(createSupabaseServiceRoleClient)
      .mockReturnValue(client as never);
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");

    const missingHeader = await POST(
      request({
        operation: "activate",
        regionKeys: [],
        scopeBeachIds: [BEACH_ID],
        scopeExposureClasses: [],
        protectedAlternativeBeachIds: [],
        eventReference: null,
        validFrom: "2026-07-19T21:00:00.000Z",
        validUntil: "2026-07-20T21:00:00.000Z",
        affectedCohorts: ["beginner"],
        action: "suppress_positive",
        supportingEvidenceRefs: [],
        reasonCode: "major_swell_manual_safety",
      }),
    );
    expect(missingHeader.status).toBe(400);

    const forbidden = await POST(
      request(
        {
          operation: "activate",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          scopeExposureClasses: [],
          protectedAlternativeBeachIds: [],
          eventReference: null,
          validFrom: "2026-07-19T21:00:00.000Z",
          validUntil: "2026-07-20T21:00:00.000Z",
          affectedCohorts: ["beginner"],
          action: "suppress_positive",
          supportingEvidenceRefs: [],
          reasonCode: "major_swell_manual_safety",
          triggerType: "automatic_official",
        },
        { "Idempotency-Key": IDEMPOTENCY_ID },
      ),
    );
    expect(forbidden.status).toBe(400);
    expect(await forbidden.json()).toMatchObject({
      success: false,
      error: { code: "invalid_request" },
    });
    expect(rpc).not.toHaveBeenCalled();
    expect(error).toHaveBeenLastCalledWith("recommendation_hold_admin", {
      requestId: expect.any(String),
      holdId: null,
      transition: null,
      reasonCode: null,
      outcome: "invalid_request",
    });
  });

  it("returns a fixed safe response and logs no body, evidence, operator identity, or cookie", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const record = {
      record_id: "00000000-0000-4000-8000-000000000005",
      hold_id: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
      version: 1,
      transition: "activation",
      status: "active",
      region_keys: [],
      scope_beach_ids: [BEACH_ID],
      scope_exposure_classes: [],
      protected_alternative_beach_ids: [],
      event_reference: "event:major_swell:sensitive-event",
      valid_from: "2026-07-19T21:00:00.000Z",
      valid_until: "2026-07-20T21:00:00.000Z",
      affected_cohorts: ["beginner"],
      action: "suppress_positive",
      trigger_type: "manual_operator",
      supporting_evidence_refs: ["qa:artifact:sensitive-evidence"],
      automatic_policy_version: null,
      authorizing_operator_ref: "00000000-0000-4000-8000-000000000002",
      authorizing_actor: "admin_api",
      reason_code: "major_swell_manual_safety",
      effective_at: "2026-07-19T21:00:00.000Z",
      expires_at: "2026-07-20T21:00:00.000Z",
      supersedes_record_id: null,
      idempotency_key: `manual:activation:${IDEMPOTENCY_ID}`,
      payload_hash: "a".repeat(64),
      request_id: IDEMPOTENCY_ID,
      created_at: "2026-07-19T20:00:01.000Z",
    };
    const beaches = queryResult([
      {
        id: BEACH_ID,
        state: "CA",
        city: "San Diego",
        lat: 32.8,
        is_private: true,
        deleted_at: null,
      },
    ]);
    const empty = queryResult([]);
    const from = jest.fn((table: string) =>
      table === "beaches" ? beaches : empty,
    );
    const rpc = jest.fn(
      async (
        _name: string,
        parameters: { p_transition: { requestId: string } },
      ) => ({
        data: [
          {
            ...record,
            request_id: parameters.p_transition.requestId,
          },
        ],
        error: null,
      }),
    );
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest
      .mocked(createSupabaseServiceRoleClient)
      .mockReturnValue({ from, rpc } as never);
    const info = jest
      .spyOn(console, "info")
      .mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");

    const response = await POST(
      request(
        {
          operation: "activate",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          scopeExposureClasses: [],
          protectedAlternativeBeachIds: [],
          eventReference: "event:major_swell:sensitive-event",
          validFrom: "2026-07-19T21:00:00.000Z",
          validUntil: "2026-07-20T21:00:00.000Z",
          affectedCohorts: ["beginner"],
          action: "suppress_positive",
          supportingEvidenceRefs: ["qa:artifact:sensitive-evidence"],
          reasonCode: "major_swell_manual_safety",
        },
        {
          "Idempotency-Key": IDEMPOTENCY_ID,
          Cookie: "super-secret-cookie",
          "X-Request-ID": "00000000-0000-4000-8000-000000000099",
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body).toMatchObject({
      success: true,
      data: {
        outcome: "accepted",
        hold: {
          holdId: record.hold_id,
          provenance: {
            triggerType: "manual_operator",
            authorizingActor: "admin_api",
          },
        },
      },
    });
    expect(info).toHaveBeenCalledWith("recommendation_hold_admin", {
      requestId: "00000000-0000-4000-8000-000000000099",
      holdId: record.hold_id,
      transition: "activation",
      reasonCode: "major_swell_manual_safety",
      outcome: "accepted",
    });
    const output = JSON.stringify({ body, logs: info.mock.calls });
    for (const secret of [
      "sensitive-evidence",
      "sensitive-event",
      ADMIN_ID,
      "operator@example.com",
      "super-secret-cookie",
      record.authorizing_operator_ref,
      record.record_id,
      record.payload_hash,
    ]) {
      expect(output).not.toContain(secret);
    }
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("logs safe parsed context when a valid append fails", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const beaches = queryResult([
      {
        id: BEACH_ID,
        state: "CA",
        city: "San Diego",
        lat: 32.8,
        is_private: false,
        deleted_at: null,
      },
    ]);
    const empty = queryResult([]);
    const rpc = jest.fn(async () => ({
      data: null,
      error: { code: "XX000", message: "secret backend detail" },
    }));
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: jest.fn((table: string) => (table === "beaches" ? beaches : empty)),
      rpc,
    } as never);
    const error = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const { POST } = await import("@/app/api/admin/recommendation-holds/route");
    const traceId = "00000000-0000-4000-8000-000000000099";

    const response = await POST(
      request(
        {
          operation: "activate",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          scopeExposureClasses: [],
          protectedAlternativeBeachIds: [],
          eventReference: "event:major_swell:secret-event",
          validFrom: "2026-07-19T21:00:00.000Z",
          validUntil: "2026-07-20T21:00:00.000Z",
          affectedCohorts: ["beginner"],
          action: "suppress_positive",
          supportingEvidenceRefs: ["qa:artifact:secret-evidence"],
          reasonCode: "major_swell_manual_safety",
        },
        {
          "Idempotency-Key": IDEMPOTENCY_ID,
          Cookie: "secret-cookie",
          "X-Request-ID": traceId,
        },
      ),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(error).toHaveBeenCalledWith("recommendation_hold_admin", {
      requestId: traceId,
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
      transition: "activation",
      reasonCode: "major_swell_manual_safety",
      outcome: "append_failed",
    });
    expect(mockInvalidateMajorEventHoldTransitions).not.toHaveBeenCalled();
    const output = JSON.stringify({
      body: await response.json(),
      logs: error.mock.calls,
    });
    for (const secret of [
      "secret-event",
      "secret-evidence",
      "secret-cookie",
      ADMIN_ID,
      "operator@example.com",
      "secret backend detail",
    ]) {
      expect(output).not.toContain(secret);
    }
  });

  it("returns only the fixed safe admin view from GET", async () => {
    const { authenticateAdmin } = await import("@/lib/auth/admin");
    jest.mocked(authenticateAdmin).mockResolvedValue({
      success: true,
      user: adminUser(),
    });
    const sensitiveRecord = {
      record_id: "00000000-0000-4000-8000-000000000005",
      hold_id: "00000000-0000-8000-8000-000000000004",
      version: 1,
      transition: "activation",
      status: "active",
      region_keys: ["san-diego"],
      scope_beach_ids: [BEACH_ID],
      scope_exposure_classes: [],
      protected_alternative_beach_ids: [],
      event_reference: "event:major_swell:secret-event",
      valid_from: "2026-07-19T19:00:00.000Z",
      valid_until: "2026-07-20T21:00:00.000Z",
      affected_cohorts: ["beginner"],
      action: "suppress_positive",
      trigger_type: "manual_operator",
      supporting_evidence_refs: ["qa:artifact:secret-evidence"],
      automatic_policy_version: null,
      authorizing_operator_ref: "00000000-0000-4000-8000-000000000002",
      authorizing_actor: "admin_api",
      reason_code: "major_swell_manual_safety",
      effective_at: "2026-07-19T19:00:00.000Z",
      expires_at: "2026-07-20T21:00:00.000Z",
      supersedes_record_id: null,
      idempotency_key: `manual:activation:${IDEMPOTENCY_ID}`,
      payload_hash: "b".repeat(64),
      request_id: IDEMPOTENCY_ID,
      created_at: "2026-07-19T19:00:01.000Z",
    };
    const query = queryResult([sensitiveRecord]);
    const { createSupabaseServiceRoleClient } =
      await import("@/lib/supabase/server");
    jest.mocked(createSupabaseServiceRoleClient).mockReturnValue({
      from: jest.fn(() => query),
      rpc: jest.fn(),
    } as never);
    const { GET } = await import("@/app/api/admin/recommendation-holds/route");

    const response = await GET(request(undefined, { Cookie: "secret-cookie" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const body = await response.json();
    expect(body.data.holds).toEqual([
      expect.objectContaining({
        holdId: sensitiveRecord.hold_id,
        lifecycle: "effective",
        provenance: {
          triggerType: "manual_operator",
          authorizingActor: "admin_api",
        },
      }),
    ]);
    const serialized = JSON.stringify(body);
    for (const secret of [
      "secret-event",
      "secret-evidence",
      "secret-cookie",
      sensitiveRecord.record_id,
      sensitiveRecord.authorizing_operator_ref,
      sensitiveRecord.payload_hash,
      sensitiveRecord.idempotency_key,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
