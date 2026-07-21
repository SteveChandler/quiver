import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";
import {
  createSupabaseManualHoldStore,
  executeManualHoldCommand,
  HoldControlError,
  listAdminHoldViews,
  parseManualHoldCommand,
  type ManualHoldStore,
} from "@/lib/recommendations/major-event-hold/control";
import { deterministicUuidV8 } from "@/lib/recommendations/major-event-hold/identity";
import type { RegionalRecommendationHoldRecord } from "@/lib/recommendations/major-event-hold/types";
import {
  callAdminApi,
  type CliOptions,
  type RecommendationHoldCliDependencies,
} from "@/scripts/recommendation-hold";

const NOW = new Date("2026-07-19T20:00:00.000Z");
const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const OPERATOR_REF = "00000000-0000-4000-8000-000000000002";
const IDEMPOTENCY_ID = "00000000-0000-4000-8000-000000000003";
const HOLD_ID = "00000000-0000-8000-8000-000000000004";
const RECORD_ID = "00000000-0000-4000-8000-000000000005";
const BEACH_ID = "00000000-0000-4000-8000-000000000006";
const SECOND_BEACH_ID = "00000000-0000-4000-8000-000000000007";
const PROTECTED_BEACH_ID = "00000000-0000-4000-8000-000000000008";

const policy = {
  regionKeys: [] as string[],
  scopeBeachIds: [BEACH_ID],
  scopeExposureClasses: [] as string[],
  protectedAlternativeBeachIds: [] as string[],
  eventReference: "event:major_swell:california_2026_07",
  validFrom: "2026-07-19T21:00:00.000Z",
  validUntil: "2026-07-21T21:00:00.000Z",
  affectedCohorts: ["beginner", "intermediate", "unknown"] as const,
  action: "suppress_positive" as const,
  supportingEvidenceRefs: ["qa:artifact:swell-review-2026-07"],
};

const activation = {
  operation: "activate" as const,
  ...policy,
  reasonCode: "major_swell_manual_safety" as const,
};

function manualRequestId(
  command: unknown = activation,
  clientId: string = IDEMPOTENCY_ID,
): string {
  const canonical = parseManualHoldCommand(command);
  return deterministicUuidV8(
    `quiver:regional-hold:manual:request:v1:${clientId.toLowerCase()}:${JSON.stringify(canonical)}`,
  );
}

type ManualRecord = Extract<
  RegionalRecommendationHoldRecord,
  { triggerType: "manual_operator" }
>;

function record(overrides: Partial<ManualRecord> = {}): ManualRecord {
  return {
    recordId: RECORD_ID,
    holdId: HOLD_ID,
    version: 1,
    transition: "activation",
    status: "active",
    regionKeys: [],
    scopeBeachIds: [BEACH_ID],
    scopeExposureClasses: [],
    protectedAlternativeBeachIds: [],
    eventReference: policy.eventReference,
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    affectedCohorts: [...policy.affectedCohorts],
    action: policy.action,
    triggerType: "manual_operator",
    supportingEvidenceRefs: [...policy.supportingEvidenceRefs],
    automaticPolicyVersion: null,
    authorizingOperatorRef: OPERATOR_REF,
    authorizingActor: "admin_api",
    reasonCode: "major_swell_manual_safety",
    effectiveAt: policy.validFrom,
    expiresAt: policy.validUntil,
    supersedesRecordId: null,
    idempotencyKey: `manual:activation:${IDEMPOTENCY_ID}`,
    payloadHash: "a".repeat(64),
    requestId: manualRequestId(),
    createdAt: "2026-07-19T20:00:01.000Z",
    ...overrides,
  };
}

function beach(
  id: string,
  overrides: Partial<{
    state: string | null;
    city: string | null;
    lat: number | null;
    isPrivate: boolean;
    deletedAt: string | null;
  }> = {},
) {
  return {
    id,
    state: "CA",
    city: "San Diego",
    lat: 32.8,
    isPrivate: false,
    deletedAt: null,
    ...overrides,
  };
}

function rawRecord(overrides: Record<string, unknown> = {}) {
  const source = record();
  return {
    record_id: source.recordId,
    hold_id: source.holdId,
    version: source.version,
    transition: source.transition,
    status: source.status,
    region_keys: source.regionKeys,
    scope_beach_ids: source.scopeBeachIds,
    scope_exposure_classes: source.scopeExposureClasses,
    protected_alternative_beach_ids: source.protectedAlternativeBeachIds,
    event_reference: source.eventReference,
    valid_from: source.validFrom,
    valid_until: source.validUntil,
    affected_cohorts: source.affectedCohorts,
    action: source.action,
    trigger_type: source.triggerType,
    supporting_evidence_refs: source.supportingEvidenceRefs,
    automatic_policy_version: source.automaticPolicyVersion,
    authorizing_operator_ref: source.authorizingOperatorRef,
    authorizing_actor: source.authorizingActor,
    reason_code: source.reasonCode,
    effective_at: source.effectiveAt,
    expires_at: source.expiresAt,
    supersedes_record_id: source.supersedesRecordId,
    idempotency_key: source.idempotencyKey,
    payload_hash: source.payloadHash,
    request_id: source.requestId,
    created_at: source.createdAt,
    ...overrides,
  };
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

const CLI_BASE_URL = "https://admin.example.test";
const CLI_RESPONSE_URL = `${CLI_BASE_URL}/api/admin/recommendation-holds`;
const CLI_TRACE_ID = "00000000-0000-4000-8000-000000000091";
const EXPECTED_ACTIVATION_HOLD_ID = deterministicUuidV8(
  `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
);

function cliHoldView(overrides: Record<string, unknown> = {}) {
  return {
    holdId: HOLD_ID,
    version: 2,
    transition: "cancellation",
    status: "cancelled",
    lifecycle: "effective",
    regionKeys: [],
    scopeBeachIds: [BEACH_ID],
    scopeExposureClasses: [],
    protectedAlternativeBeachIds: [],
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    affectedCohorts: [...policy.affectedCohorts],
    action: policy.action,
    provenance: {
      triggerType: "manual_operator",
      authorizingActor: "admin_api",
    },
    reasonCode: "operator_cancelled",
    effectiveAt: NOW.toISOString(),
    expiresAt: "2026-07-19T20:01:00.000Z",
    createdAt: "2026-07-19T20:00:01.000Z",
    ...overrides,
  };
}

function cliMutationSuccess(
  requestId: string,
  holdOverrides: Record<string, unknown> = {},
) {
  return {
    success: true,
    data: {
      outcome: "accepted",
      hold: cliHoldView(holdOverrides),
    },
    requestId,
  };
}

function cliFullPolicyHoldView(
  transition: "activation" | "replacement",
  overrides: Record<string, unknown> = {},
) {
  return cliHoldView({
    holdId: transition === "activation" ? EXPECTED_ACTIVATION_HOLD_ID : HOLD_ID,
    version: transition === "activation" ? 1 : 2,
    transition,
    status: "active",
    lifecycle: "scheduled",
    regionKeys: [...policy.regionKeys],
    scopeBeachIds: [...policy.scopeBeachIds],
    scopeExposureClasses: [...policy.scopeExposureClasses],
    protectedAlternativeBeachIds: [...policy.protectedAlternativeBeachIds],
    validFrom: policy.validFrom,
    validUntil: policy.validUntil,
    affectedCohorts: [...policy.affectedCohorts],
    action: policy.action,
    reasonCode:
      transition === "activation"
        ? "major_swell_manual_safety"
        : "scope_correction",
    ...overrides,
  });
}

function cliHttpResponse(
  body: unknown,
  options: {
    status?: number;
    url?: string;
    redirected?: boolean;
    contentType?: string;
  } = {},
): Response {
  const response = new Response(
    typeof body === "string" ? body : JSON.stringify(body),
    {
      status: options.status ?? 200,
      headers: {
        "Content-Type": options.contentType ?? "application/json",
      },
    },
  );
  Object.defineProperties(response, {
    url: { value: options.url ?? CLI_RESPONSE_URL },
    redirected: { value: options.redirected ?? false },
  });
  return response;
}

function makeStore(overrides: Partial<ManualHoldStore> = {}): ManualHoldStore {
  return {
    loadByIdempotencyKey: jest.fn().mockResolvedValue(null),
    loadLatestHold: jest.fn().mockResolvedValue(null),
    loadOperatorRef: jest.fn().mockResolvedValue(OPERATOR_REF),
    loadBeachPage: jest.fn().mockResolvedValue({
      rows: [
        beach(BEACH_ID),
        beach(SECOND_BEACH_ID),
        beach(PROTECTED_BEACH_ID),
      ],
    }),
    appendTransition: jest.fn().mockImplementation(async (payload) =>
      record({
        holdId: payload.holdId,
        version: payload.version,
        transition: payload.transition,
        status: payload.transition === "cancellation" ? "cancelled" : "active",
        regionKeys: payload.regionKeys,
        scopeBeachIds: payload.scopeBeachIds,
        scopeExposureClasses: payload.scopeExposureClasses,
        protectedAlternativeBeachIds: payload.protectedAlternativeBeachIds,
        eventReference: payload.eventReference,
        validFrom: payload.validFrom,
        validUntil: payload.validUntil,
        affectedCohorts: payload.affectedCohorts,
        action: payload.action,
        supportingEvidenceRefs: payload.supportingEvidenceRefs,
        reasonCode: payload.reasonCode,
        effectiveAt: payload.effectiveAt,
        expiresAt: payload.expiresAt,
        supersedesRecordId: payload.supersedesRecordId,
        idempotencyKey: payload.idempotencyKey,
        requestId: payload.requestId,
      }),
    ),
    listHoldRecords: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe("manual recommendation hold control", () => {
  it("derives a stable RFC UUIDv8 from a SHA-256 digest", () => {
    const first = deterministicUuidV8("stable-input");
    const second = deterministicUuidV8("stable-input");

    expect(first).toBe(second);
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(deterministicUuidV8("different-input")).not.toBe(first);
  });

  it("pins the canonical manual activation request fingerprint", () => {
    expect(manualRequestId()).toBe("cacb6421-7115-800e-9bbd-c25fc4515b0b");
  });

  it("uses strict operation schemas and rejects client-owned provenance", () => {
    for (const forbidden of [
      "version",
      "supersedesRecordId",
      "triggerType",
      "automaticPolicyVersion",
      "authorizingActor",
      "operatorUserId",
      "requestId",
      "holdId",
      "notes",
      "source",
      "url",
    ]) {
      expect(() =>
        parseManualHoldCommand({ ...activation, [forbidden]: "forbidden" }),
      ).toThrow("invalid_request");
    }
  });

  it("accepts only exact configured region slugs", () => {
    for (const regionKey of Object.keys(FORECAST_REGIONS)) {
      expect(
        parseManualHoldCommand({
          ...activation,
          regionKeys: [regionKey],
          scopeBeachIds: [],
        }).operation,
      ).toBe("activate");
    }
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        regionKeys: [Object.keys(FORECAST_REGIONS)[0].toUpperCase()],
        scopeBeachIds: [],
      }),
    ).toThrow("invalid_request");
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        regionKeys: ["not-a-region"],
        scopeBeachIds: [],
      }),
    ).toThrow("invalid_request");
  });

  it("rejects unsupported exposure scope instead of pretending to enforce it", () => {
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        scopeExposureClasses: ["protected"],
      }),
    ).toThrow("exposure_scope_unavailable");
  });

  it("requires a scope, validates protected alternatives, and canonicalizes arrays", async () => {
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        regionKeys: [],
        scopeBeachIds: [],
      }),
    ).toThrow("invalid_request");
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        action: "protected_alternatives_only",
        protectedAlternativeBeachIds: [],
      }),
    ).toThrow("invalid_request");
    expect(() =>
      parseManualHoldCommand({
        ...activation,
        affectedCohorts: ["unknown", "unknown"],
      }),
    ).toThrow("invalid_request");

    const store = makeStore();
    await executeManualHoldCommand(
      {
        ...activation,
        scopeBeachIds: [SECOND_BEACH_ID, BEACH_ID],
        affectedCohorts: ["unknown", "beginner"],
        supportingEvidenceRefs: [
          "qa:artifact:z-review",
          "qa:artifact:a-review",
        ],
      },
      {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );

    expect(store.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
        affectedCohorts: ["beginner", "unknown"],
        supportingEvidenceRefs: [
          "qa:artifact:a-review",
          "qa:artifact:z-review",
        ],
      }),
    );
  });

  it("canonicalizes UUID inputs before scope resolution and persistence", async () => {
    const uppercaseBeachId = "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA";
    const uppercaseOperatorId = "BBBBBBBB-BBBB-4BBB-8BBB-BBBBBBBBBBBB";
    const uppercaseIdempotencyId = "CCCCCCCC-CCCC-4CCC-8CCC-CCCCCCCCCCCC";
    const store = makeStore({
      loadBeachPage: jest.fn().mockResolvedValue({
        rows: [beach(uppercaseBeachId.toLowerCase())],
      }),
    });

    await executeManualHoldCommand(
      {
        ...activation,
        scopeBeachIds: [uppercaseBeachId],
      },
      {
        store,
        operatorUserId: uppercaseOperatorId,
        idempotencyKey: uppercaseIdempotencyId,
        now: NOW,
      },
    );

    expect(store.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeBeachIds: [uppercaseBeachId.toLowerCase()],
        operatorUserId: uppercaseOperatorId.toLowerCase(),
        idempotencyKey: `manual:activation:${uppercaseIdempotencyId.toLowerCase()}`,
        requestId: manualRequestId(
          { ...activation, scopeBeachIds: [uppercaseBeachId] },
          uppercaseIdempotencyId,
        ),
      }),
    );
  });

  it("resolves state aliases, cities and latitude bounds, retains null-lat/private beaches, and dedupes overlaps", async () => {
    const northernId = "00000000-0000-4000-8000-000000000011";
    const nullLatId = "00000000-0000-4000-8000-000000000012";
    const deletedId = "00000000-0000-4000-8000-000000000013";
    const wrongCityId = "00000000-0000-4000-8000-000000000014";
    const store = makeStore({
      loadBeachPage: jest.fn().mockResolvedValue({
        rows: [
          beach(BEACH_ID, {
            state: "California",
            city: "san diego",
            lat: 34.9999,
            isPrivate: true,
          }),
          beach(northernId, { state: "CA", city: "San Diego", lat: 35 }),
          beach(nullLatId, { state: "ca", city: "Oceanside", lat: null }),
          beach(deletedId, { deletedAt: "2026-01-01T00:00:00.000Z" }),
          beach(wrongCityId, { city: "Sacramento", lat: 36 }),
        ],
      }),
    });

    await executeManualHoldCommand(
      {
        ...activation,
        regionKeys: ["san-diego", "southern-california"],
        scopeBeachIds: [],
      },
      {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );

    expect(store.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        regionKeys: ["san-diego", "southern-california"],
        scopeBeachIds: [BEACH_ID, northernId, nullLatId].sort(),
      }),
    );
  });

  it("fails closed for empty regions, unknown explicit beaches, incomplete pages, and >2000 resolved beaches", async () => {
    const cases: Array<[string, ManualHoldStore, object]> = [
      [
        "empty_region",
        makeStore({ loadBeachPage: jest.fn().mockResolvedValue({ rows: [] }) }),
        { ...activation, regionKeys: ["san-diego"], scopeBeachIds: [] },
      ],
      [
        "beach_scope_unavailable",
        makeStore({
          loadBeachPage: jest.fn().mockResolvedValue({ rows: null }),
        }),
        activation,
      ],
      [
        "unknown_beach",
        makeStore({
          loadBeachPage: jest
            .fn()
            .mockResolvedValue({ rows: [beach(PROTECTED_BEACH_ID)] }),
        }),
        activation,
      ],
      [
        "scope_too_large",
        (() => {
          const catalog = Array.from({ length: 2001 }, (_, index) =>
            beach(`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
          );
          return makeStore({
            loadBeachPage: jest
              .fn()
              .mockImplementation(
                async (afterId: string | null, limit: number) => ({
                  rows: catalog
                    .filter((row) => afterId === null || row.id > afterId)
                    .slice(0, limit),
                }),
              ),
          });
        })(),
        {
          ...activation,
          regionKeys: ["southern-california"],
          scopeBeachIds: [],
        },
      ],
    ];

    for (const [code, store, input] of cases) {
      await expect(
        executeManualHoldCommand(input, {
          store,
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        }),
      ).rejects.toMatchObject({ code });
      expect(store.appendTransition).not.toHaveBeenCalled();
    }
  });

  it("paginates deterministically until a short page", async () => {
    const page = Array.from({ length: 500 }, (_, index) =>
      beach(`10000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );
    const finalBeach = beach("20000000-0000-4000-8000-000000000000");
    const catalog = [...page, finalBeach];
    const store = makeStore({
      loadBeachPage: jest
        .fn()
        .mockImplementation(async (afterId: string | null, limit: number) => ({
          rows: catalog
            .filter((row) => afterId === null || row.id > afterId)
            .slice(0, limit),
        })),
    });

    await executeManualHoldCommand(
      { ...activation, regionKeys: ["southern-california"], scopeBeachIds: [] },
      {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );

    expect(store.loadBeachPage).toHaveBeenNthCalledWith(1, null, 500);
    expect(store.loadBeachPage).toHaveBeenNthCalledWith(
      2,
      page[page.length - 1].id,
      500,
    );
    expect(store.loadBeachPage).toHaveBeenNthCalledWith(3, null, 500);
    expect(store.loadBeachPage).toHaveBeenNthCalledWith(
      4,
      page[page.length - 1].id,
      500,
    );
  });

  it("retries a keyset catalog scan after an insert and soft-delete boundary shift", async () => {
    const page = Array.from({ length: 500 }, (_, index) =>
      beach(`10000000-0000-4000-8000-${String(index).padStart(12, "0")}`),
    );
    const inserted = beach("05000000-0000-4000-8000-000000000000");
    const finalBeach = beach("20000000-0000-4000-8000-000000000000");
    const deletedId = page[250].id;
    const before = [...page, finalBeach];
    const after = [
      inserted,
      ...page.filter((row) => row.id !== deletedId),
      finalBeach,
    ];
    let scan = -1;
    let activeCatalog = before;
    const loadBeachPage = jest.fn(
      async (afterId: string | null, limit: number) => {
        if (afterId === null) {
          scan += 1;
          activeCatalog = scan === 0 ? before : after;
        } else if (scan === 0) {
          activeCatalog = after;
        }
        return {
          rows: activeCatalog
            .filter((row) => afterId === null || row.id > afterId)
            .slice(0, limit),
        };
      },
    );
    const store = makeStore({ loadBeachPage });

    await executeManualHoldCommand(
      { ...activation, regionKeys: ["southern-california"], scopeBeachIds: [] },
      {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );

    expect(loadBeachPage).toHaveBeenCalledTimes(8);
    expect(store.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        scopeBeachIds: expect.arrayContaining([inserted.id, finalBeach.id]),
      }),
    );
    const payload = jest.mocked(store.appendTransition).mock.calls[0][0];
    expect(payload.scopeBeachIds).toHaveLength(after.length);
    expect(payload.scopeBeachIds).not.toContain(deletedId);
  });

  it("fails closed when repeated catalog scans never stabilize", async () => {
    let scan = 0;
    const loadBeachPage = jest.fn(async () => {
      const rows =
        scan % 2 === 0
          ? [beach(BEACH_ID)]
          : [beach(BEACH_ID), beach(SECOND_BEACH_ID)];
      scan += 1;
      return { rows };
    });
    const store = makeStore({ loadBeachPage });

    await expect(
      executeManualHoldCommand(activation, {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "beach_scope_unavailable", status: 503 });
    expect(loadBeachPage).toHaveBeenCalledTimes(6);
    expect(store.appendTransition).not.toHaveBeenCalled();
  });

  it("requires an authenticated operator and a UUID idempotency key", async () => {
    await expect(
      executeManualHoldCommand(activation, {
        store: makeStore(),
        operatorUserId: null,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "manual_operator_required" });
    await expect(
      executeManualHoldCommand(activation, {
        store: makeStore(),
        operatorUserId: ADMIN_ID,
        idempotencyKey: "not-a-uuid",
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "invalid_idempotency_key" });
  });

  it("builds a manual activation with server-owned provenance and stable request identity", async () => {
    const store = makeStore();
    const result = await executeManualHoldCommand(activation, {
      store,
      operatorUserId: ADMIN_ID,
      idempotencyKey: IDEMPOTENCY_ID,
      now: NOW,
    });

    const expectedHoldId = deterministicUuidV8(
      `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
    );
    expect(store.appendTransition).toHaveBeenCalledWith({
      holdId: expectedHoldId,
      version: 1,
      transition: "activation",
      regionKeys: [],
      scopeBeachIds: [BEACH_ID],
      scopeExposureClasses: [],
      protectedAlternativeBeachIds: [],
      eventReference: policy.eventReference,
      validFrom: policy.validFrom,
      validUntil: policy.validUntil,
      affectedCohorts: [...policy.affectedCohorts].sort(),
      action: "suppress_positive",
      triggerType: "manual_operator",
      supportingEvidenceRefs: policy.supportingEvidenceRefs,
      automaticPolicyVersion: null,
      operatorUserId: ADMIN_ID,
      authorizingActor: "admin_api",
      reasonCode: "major_swell_manual_safety",
      effectiveAt: policy.validFrom,
      expiresAt: policy.validUntil,
      supersedesRecordId: null,
      idempotencyKey: `manual:activation:${IDEMPOTENCY_ID}`,
      requestId: manualRequestId(),
    });
    expect(result).toEqual({
      hold: expect.objectContaining({ holdId: expectedHoldId }),
      outcome: "accepted",
      confirmedRecord: expect.objectContaining({
        recordId: RECORD_ID,
        holdId: expectedHoldId,
        transition: "activation",
      }),
    });
  });

  it("preserves the complete immutable snapshot for extension and cancellation", async () => {
    const latest = record({
      regionKeys: ["san-diego"],
      scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
      scopeExposureClasses: ["protected"],
      protectedAlternativeBeachIds: [PROTECTED_BEACH_ID],
      action: "protected_alternatives_only",
      eventReference: "event:major_swell:preserve_me",
      supportingEvidenceRefs: ["qa:artifact:private-evidence"],
      validFrom: "2026-07-19T19:00:00.000Z",
      validUntil: "2026-07-21T19:00:00.000Z",
      effectiveAt: "2026-07-19T19:00:00.000Z",
      expiresAt: "2026-07-21T19:00:00.000Z",
    });
    const extensionStore = makeStore({
      loadLatestHold: jest.fn().mockResolvedValue(latest),
    });

    await executeManualHoldCommand(
      {
        operation: "extend",
        holdId: HOLD_ID,
        newValidUntil: "2026-07-22T19:00:00.000Z",
        reasonCode: "major_swell_manual_safety",
      },
      {
        store: extensionStore,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );
    expect(extensionStore.loadBeachPage).not.toHaveBeenCalled();
    expect(extensionStore.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        version: 2,
        supersedesRecordId: RECORD_ID,
        transition: "extension",
        regionKeys: latest.regionKeys,
        scopeBeachIds: latest.scopeBeachIds,
        scopeExposureClasses: latest.scopeExposureClasses,
        protectedAlternativeBeachIds: latest.protectedAlternativeBeachIds,
        eventReference: latest.eventReference,
        supportingEvidenceRefs: latest.supportingEvidenceRefs,
        validFrom: latest.validFrom,
        validUntil: "2026-07-22T19:00:00.000Z",
      }),
    );

    const cancellationStore = makeStore({
      loadLatestHold: jest.fn().mockResolvedValue(latest),
    });
    await executeManualHoldCommand(
      {
        operation: "cancel",
        holdId: HOLD_ID,
        reasonCode: "operator_cancelled",
      },
      {
        store: cancellationStore,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );
    expect(cancellationStore.loadBeachPage).not.toHaveBeenCalled();
    expect(cancellationStore.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transition: "cancellation",
        regionKeys: latest.regionKeys,
        scopeBeachIds: latest.scopeBeachIds,
        scopeExposureClasses: latest.scopeExposureClasses,
        eventReference: latest.eventReference,
        supportingEvidenceRefs: latest.supportingEvidenceRefs,
        effectiveAt: NOW.toISOString(),
        expiresAt: "2026-07-19T20:01:00.000Z",
      }),
    );
  });

  it("re-resolves a replacement snapshot and keeps version ownership server-side", async () => {
    const latest = record();
    const store = makeStore({
      loadLatestHold: jest.fn().mockResolvedValue(latest),
      loadBeachPage: jest
        .fn()
        .mockResolvedValue({ rows: [beach(SECOND_BEACH_ID)] }),
    });

    await executeManualHoldCommand(
      {
        operation: "replace",
        holdId: HOLD_ID,
        ...policy,
        scopeBeachIds: [SECOND_BEACH_ID],
        reasonCode: "scope_correction",
      },
      {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      },
    );

    expect(store.loadBeachPage).toHaveBeenCalled();
    expect(store.appendTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        transition: "replacement",
        version: 2,
        supersedesRecordId: RECORD_ID,
        scopeBeachIds: [SECOND_BEACH_ID],
        reasonCode: "scope_correction",
      }),
    );
  });

  it("rejects expired chains, non-extending windows, and windows beyond seven days", async () => {
    const expired = record({ expiresAt: "2026-07-19T19:59:59.999Z" });
    await expect(
      executeManualHoldCommand(
        {
          operation: "cancel",
          holdId: HOLD_ID,
          reasonCode: "operator_cancelled",
        },
        {
          store: makeStore({
            loadLatestHold: jest.fn().mockResolvedValue(expired),
          }),
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "hold_not_active" });

    await expect(
      executeManualHoldCommand(
        {
          operation: "extend",
          holdId: HOLD_ID,
          newValidUntil: policy.validUntil,
          reasonCode: "major_swell_manual_safety",
        },
        {
          store: makeStore({
            loadLatestHold: jest.fn().mockResolvedValue(record()),
          }),
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_valid_window" });

    const futureEffective = record({
      validUntil: "2026-07-19T21:00:00.000Z",
      effectiveAt: "2026-07-19T23:00:00.000Z",
      expiresAt: "2026-07-20T23:00:00.000Z",
    });
    await expect(
      executeManualHoldCommand(
        {
          operation: "extend",
          holdId: HOLD_ID,
          newValidUntil: "2026-07-19T22:00:00.000Z",
          reasonCode: "major_swell_manual_safety",
        },
        {
          store: makeStore({
            loadLatestHold: jest.fn().mockResolvedValue(futureEffective),
          }),
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_expiry_window" });

    expect(() =>
      parseManualHoldCommand({
        ...activation,
        validFrom: NOW.toISOString(),
        validUntil: "2026-07-27T20:00:00.001Z",
      }),
    ).not.toThrow();
    await expect(
      executeManualHoldCommand(
        {
          ...activation,
          validFrom: NOW.toISOString(),
          validUntil: "2026-07-27T20:00:00.001Z",
        },
        {
          store: makeStore(),
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "invalid_expiry_window" });
  });

  it("returns an exact replay, rejects a semantic collision, and maps an append version race", async () => {
    const existing = record({
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
    });
    const replayStore = makeStore({
      loadByIdempotencyKey: jest.fn().mockResolvedValue(existing),
      loadBeachPage: jest.fn().mockRejectedValue(new Error("catalog changed")),
    });
    await expect(
      executeManualHoldCommand(activation, {
        store: replayStore,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).resolves.toEqual({
      hold: expect.any(Object),
      outcome: "accepted",
      confirmedRecord: existing,
    });
    expect(replayStore.appendTransition).not.toHaveBeenCalled();
    expect(replayStore.loadBeachPage).not.toHaveBeenCalled();

    const wrongOperatorStore = makeStore({
      loadByIdempotencyKey: jest.fn().mockResolvedValue(existing),
      loadOperatorRef: jest
        .fn()
        .mockResolvedValue("00000000-0000-4000-8000-000000000099"),
    });
    await expect(
      executeManualHoldCommand(activation, {
        store: wrongOperatorStore,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "idempotency_collision" });

    await expect(
      executeManualHoldCommand(
        { ...activation, validUntil: "2026-07-22T21:00:00.000Z" },
        {
          store: replayStore,
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "idempotency_collision" });

    const expandedExisting = record({
      holdId: existing.holdId,
      regionKeys: ["san-diego"],
      scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
    });
    const changedScopeStore = makeStore({
      loadByIdempotencyKey: jest.fn().mockResolvedValue(expandedExisting),
      loadBeachPage: jest.fn().mockResolvedValue({
        rows: [
          beach(BEACH_ID),
          beach(SECOND_BEACH_ID, { state: "OR", city: "Portland" }),
        ],
      }),
    });
    await expect(
      executeManualHoldCommand(
        {
          ...activation,
          regionKeys: ["san-diego"],
          scopeBeachIds: [],
        },
        {
          store: changedScopeStore,
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "idempotency_collision" });
    expect(changedScopeStore.loadBeachPage).not.toHaveBeenCalled();

    const raceStore = makeStore({
      loadLatestHold: jest.fn().mockResolvedValue(record()),
      appendTransition: jest
        .fn()
        .mockRejectedValue(
          new Error("transition must supersede the latest hold version"),
        ),
    });
    await expect(
      executeManualHoldCommand(
        {
          operation: "cancel",
          holdId: HOLD_ID,
          reasonCode: "operator_cancelled",
        },
        {
          store: raceStore,
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        },
      ),
    ).rejects.toMatchObject({ code: "hold_changed_retry" });
  });

  it("rereads a concurrent idempotency collision and accepts only an exact replay", async () => {
    const existing = record({
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
    });
    const loadByIdempotencyKey = jest
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing);
    const store = makeStore({
      loadByIdempotencyKey,
      appendTransition: jest
        .fn()
        .mockRejectedValue(new Error("hold idempotency collision")),
    });

    await expect(
      executeManualHoldCommand(activation, {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).resolves.toMatchObject({ outcome: "accepted" });
    expect(loadByIdempotencyKey).toHaveBeenCalledTimes(2);
  });

  it("uses the append RPC to verify the operator when a concurrent replay has no readable opaque mapping", async () => {
    const existing = record({
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
    });
    const appendTransition = jest
      .fn()
      .mockRejectedValueOnce(new Error("hold idempotency collision"))
      .mockResolvedValueOnce(existing);
    const store = makeStore({
      loadByIdempotencyKey: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
      loadOperatorRef: jest.fn().mockResolvedValue(null),
      appendTransition,
    });

    await expect(
      executeManualHoldCommand(activation, {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).resolves.toMatchObject({ outcome: "accepted" });
    expect(appendTransition).toHaveBeenCalledTimes(2);
    expect(appendTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        operatorUserId: ADMIN_ID,
        idempotencyKey: existing.idempotencyKey,
        version: existing.version,
      }),
    );
  });

  it.each(["pre-read", "concurrent"])(
    "maps an exact %s replay RPC outage to a retryable append failure",
    async (phase) => {
      const existing = record({
        holdId: deterministicUuidV8(
          `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
        ),
      });
      const appendTransition =
        phase === "pre-read"
          ? jest.fn().mockRejectedValue(new Error("network unavailable"))
          : jest
              .fn()
              .mockRejectedValueOnce(new Error("hold idempotency collision"))
              .mockRejectedValueOnce(new Error("network unavailable"));
      const store = makeStore({
        loadByIdempotencyKey:
          phase === "pre-read"
            ? jest.fn().mockResolvedValue(existing)
            : jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(existing),
        loadOperatorRef: jest.fn().mockResolvedValue(null),
        appendTransition,
      });

      await expect(
        executeManualHoldCommand(activation, {
          store,
          operatorUserId: ADMIN_ID,
          idempotencyKey: IDEMPOTENCY_ID,
          now: NOW,
        }),
      ).rejects.toMatchObject({ code: "append_failed", status: 503 });
    },
  );

  it("preserves a typed hold-state failure from replay verification", async () => {
    const existing = record({
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
    });
    const store = makeStore({
      loadByIdempotencyKey: jest.fn().mockResolvedValue(existing),
      loadOperatorRef: jest.fn().mockResolvedValue(null),
      appendTransition: jest
        .fn()
        .mockRejectedValue(new HoldControlError("hold_state_unavailable", 503)),
    });

    await expect(
      executeManualHoldCommand(activation, {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).rejects.toMatchObject({ code: "hold_state_unavailable", status: 503 });
  });

  it("accepts an identical concurrent region replay after the catalog union changes", async () => {
    const regionCommand = {
      ...activation,
      regionKeys: ["san-diego"],
      scopeBeachIds: [],
    };
    const existing = record({
      holdId: deterministicUuidV8(
        `quiver:regional-hold:manual:activation:${IDEMPOTENCY_ID}`,
      ),
      regionKeys: ["san-diego"],
      scopeBeachIds: [BEACH_ID, SECOND_BEACH_ID],
      requestId: manualRequestId(regionCommand),
    });
    const store = makeStore({
      loadByIdempotencyKey: jest
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing),
      loadBeachPage: jest.fn().mockResolvedValue({
        rows: [
          beach(BEACH_ID),
          beach(SECOND_BEACH_ID, { state: "OR", city: "Portland" }),
        ],
      }),
      appendTransition: jest
        .fn()
        .mockRejectedValue(new Error("hold idempotency collision")),
    });

    await expect(
      executeManualHoldCommand(regionCommand, {
        store,
        operatorUserId: ADMIN_ID,
        idempotencyKey: IDEMPOTENCY_ID,
        now: NOW,
      }),
    ).resolves.toMatchObject({ outcome: "accepted" });
    expect(store.appendTransition).toHaveBeenCalledTimes(1);
  });

  it("uses a receiver-bound append RPC and exposes no update/delete methods", async () => {
    const client = {
      marker: "bound",
      rpc: jest.fn(function (
        this: { marker: string },
        name: string,
        args: unknown,
      ) {
        if (this.marker !== "bound") throw new Error("lost receiver");
        expect(name).toBe("append_regional_recommendation_hold_transition");
        expect(args).toEqual({ p_transition: expect.any(Object) });
        return Promise.resolve({ data: [rawRecord()], error: null });
      }),
      from: jest.fn(),
    };
    const store = createSupabaseManualHoldStore(client);

    await expect(
      store.appendTransition({
        holdId: HOLD_ID,
        version: 1,
        transition: "activation",
        regionKeys: [],
        scopeBeachIds: [BEACH_ID],
        scopeExposureClasses: [],
        protectedAlternativeBeachIds: [],
        eventReference: policy.eventReference,
        validFrom: policy.validFrom,
        validUntil: policy.validUntil,
        affectedCohorts: [...policy.affectedCohorts],
        action: policy.action,
        triggerType: "manual_operator",
        supportingEvidenceRefs: policy.supportingEvidenceRefs,
        automaticPolicyVersion: null,
        operatorUserId: ADMIN_ID,
        authorizingActor: "admin_api",
        reasonCode: "major_swell_manual_safety",
        effectiveAt: policy.validFrom,
        expiresAt: policy.validUntil,
        supersedesRecordId: null,
        idempotencyKey: `manual:activation:${IDEMPOTENCY_ID}`,
        requestId: manualRequestId(),
      }),
    ).resolves.toMatchObject({ recordId: RECORD_ID });
    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect("update" in store).toBe(false);
    expect("delete" in store).toBe(false);
  });

  it("rejects an individually valid append row that differs from the submitted payload", async () => {
    const client = {
      rpc: jest.fn().mockResolvedValue({
        data: [rawRecord({ scope_beach_ids: [SECOND_BEACH_ID] })],
        error: null,
      }),
      from: jest.fn(),
    };
    const store = createSupabaseManualHoldStore(client);

    await expect(
      store.appendTransition({
        holdId: HOLD_ID,
        version: 1,
        transition: "activation",
        regionKeys: [],
        scopeBeachIds: [BEACH_ID],
        scopeExposureClasses: [],
        protectedAlternativeBeachIds: [],
        eventReference: policy.eventReference,
        validFrom: policy.validFrom,
        validUntil: policy.validUntil,
        affectedCohorts: [...policy.affectedCohorts],
        action: policy.action,
        triggerType: "manual_operator",
        supportingEvidenceRefs: policy.supportingEvidenceRefs,
        automaticPolicyVersion: null,
        operatorUserId: ADMIN_ID,
        authorizingActor: "admin_api",
        reasonCode: "major_swell_manual_safety",
        effectiveAt: policy.validFrom,
        expiresAt: policy.validUntil,
        supersedesRecordId: null,
        idempotencyKey: `manual:activation:${IDEMPOTENCY_ID}`,
        requestId: manualRequestId(),
      }),
    ).rejects.toMatchObject({ code: "hold_state_unavailable", status: 503 });
  });

  it.each([
    ["chain", { version: 2 }],
    ["status", { status: "cancelled" }],
    ["duplicates", { scope_beach_ids: [BEACH_ID, BEACH_ID] }],
    [
      "window",
      {
        effective_at: "2026-07-21T22:00:00.000Z",
        expires_at: "2026-07-21T21:00:00.000Z",
      },
    ],
    ["idempotency", { idempotency_key: "contains spaces" }],
    [
      "idempotency shape",
      {
        idempotency_key: `manual:replacement:${HOLD_ID}:${IDEMPOTENCY_ID}`,
      },
    ],
    ["provenance", { authorizing_operator_ref: null }],
  ])(
    "rejects an invalid raw %s row before it enters control logic",
    async (_label, overrides) => {
      const client = {
        rpc: jest.fn().mockResolvedValue({
          data: [rawRecord(overrides)],
          error: null,
        }),
        from: jest.fn(),
      };
      const store = createSupabaseManualHoldStore(client);

      await expect(
        store.appendTransition({
          holdId: HOLD_ID,
          version: 1,
          transition: "activation",
          regionKeys: [],
          scopeBeachIds: [BEACH_ID],
          scopeExposureClasses: [],
          protectedAlternativeBeachIds: [],
          eventReference: policy.eventReference,
          validFrom: policy.validFrom,
          validUntil: policy.validUntil,
          affectedCohorts: [...policy.affectedCohorts],
          action: policy.action,
          triggerType: "manual_operator",
          supportingEvidenceRefs: policy.supportingEvidenceRefs,
          automaticPolicyVersion: null,
          operatorUserId: ADMIN_ID,
          authorizingActor: "admin_api",
          reasonCode: "major_swell_manual_safety",
          effectiveAt: policy.validFrom,
          expiresAt: policy.validUntil,
          supersedesRecordId: null,
          idempotencyKey: `manual:activation:${IDEMPOTENCY_ID}`,
          requestId: manualRequestId(),
        }),
      ).rejects.toMatchObject({ code: "hold_state_unavailable" });
    },
  );

  it("accepts an official automatic row whose positive-offset local date differs from the UTC hold start date", async () => {
    const autoHoldId = "30000000-0000-8000-8000-000000000001";
    const autoBeachId = "30000000-0000-4000-8000-000000000002";
    const riskId = "30000000-0000-4000-8000-000000000003";
    const officialReference = `official:rip_current_risks:${riskId}`;
    const automaticRow = {
      ...rawRecord(),
      hold_id: autoHoldId,
      region_keys: [],
      scope_beach_ids: [autoBeachId],
      protected_alternative_beach_ids: [],
      event_reference: officialReference,
      valid_from: "2026-07-18T14:00:00.000Z",
      valid_until: "2026-07-19T14:00:00.000Z",
      affected_cohorts: ["beginner", "intermediate", "unknown"],
      action: "suppress_positive",
      trigger_type: "automatic_official",
      supporting_evidence_refs: [officialReference],
      automatic_policy_version: "official-rip-high.v1",
      authorizing_operator_ref: null,
      authorizing_actor: "official_automation",
      reason_code: "official_high_rip_current",
      effective_at: "2026-07-18T14:00:00.000Z",
      expires_at: "2026-07-19T14:00:00.000Z",
      idempotency_key: `auto:official_rip_high:v1:${autoBeachId}:2026-07-19`,
      request_id: autoHoldId,
    };
    const client = {
      rpc: jest.fn(),
      from: jest.fn(() => queryResult([automaticRow])),
    };
    const store = createSupabaseManualHoldStore(client);

    await expect(
      store.loadByIdempotencyKey(automaticRow.idempotency_key),
    ).resolves.toMatchObject({
      triggerType: "automatic_official",
      scopeBeachIds: [autoBeachId],
    });
  });

  it("lists only effective or scheduled latest records through a fixed safe view", async () => {
    const future = record({
      recordId: "00000000-0000-4000-8000-000000000021",
      holdId: "00000000-0000-8000-8000-000000000022",
      effectiveAt: "2026-07-20T20:00:00.000Z",
      expiresAt: "2026-07-21T20:00:00.000Z",
    });
    const oldVersion = record({
      version: 1,
      effectiveAt: "2026-07-19T18:00:00.000Z",
    });
    const latestVersion = record({
      recordId: "00000000-0000-4000-8000-000000000023",
      version: 2,
      transition: "extension",
      supersedesRecordId: RECORD_ID,
      effectiveAt: "2026-07-19T19:00:00.000Z",
    });
    const scheduledReplacement = record({
      recordId: "00000000-0000-4000-8000-000000000026",
      version: 3,
      transition: "replacement",
      supersedesRecordId: latestVersion.recordId,
      effectiveAt: "2026-07-20T19:00:00.000Z",
      expiresAt: "2026-07-21T19:00:00.000Z",
    });
    const cancelledActivation = record({
      holdId: "00000000-0000-8000-8000-000000000024",
      recordId: "00000000-0000-4000-8000-000000000025",
      effectiveAt: "2026-07-19T21:00:00.000Z",
    });
    const cancelled = record({
      holdId: cancelledActivation.holdId,
      status: "cancelled",
      transition: "cancellation",
      version: 2,
      supersedesRecordId: cancelledActivation.recordId,
      effectiveAt: "2026-07-19T19:00:00.000Z",
    });
    const store = makeStore({
      listHoldRecords: jest
        .fn()
        .mockResolvedValue([
          oldVersion,
          latestVersion,
          scheduledReplacement,
          future,
          cancelledActivation,
          cancelled,
        ]),
    });

    const views = await listAdminHoldViews({ store, now: NOW });

    expect(views).toHaveLength(3);
    expect(views).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          holdId: HOLD_ID,
          version: 2,
          lifecycle: "effective",
        }),
        expect.objectContaining({
          holdId: HOLD_ID,
          version: 3,
          lifecycle: "scheduled",
        }),
        expect.objectContaining({
          holdId: future.holdId,
          lifecycle: "scheduled",
        }),
      ]),
    );
    const serialized = JSON.stringify(views);
    for (const secret of [
      "recordId",
      "supersedesRecordId",
      "eventReference",
      "supportingEvidenceRefs",
      "authorizingOperatorRef",
      "automaticPolicyVersion",
      "idempotencyKey",
      "requestId",
      "payloadHash",
      "private-evidence",
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("lists only scheduled records that can become the highest effective version", async () => {
    const shadowedHoldId = "00000000-0000-8000-8000-000000000030";
    const shadowedV1 = record({
      holdId: shadowedHoldId,
      recordId: "00000000-0000-4000-8000-000000000031",
      effectiveAt: "2026-07-19T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const shadowedV2 = record({
      holdId: shadowedHoldId,
      recordId: "00000000-0000-4000-8000-000000000032",
      version: 2,
      transition: "extension",
      supersedesRecordId: shadowedV1.recordId,
      effectiveAt: "2026-07-20T20:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const shadowedV3 = record({
      holdId: shadowedHoldId,
      recordId: "00000000-0000-4000-8000-000000000033",
      version: 3,
      transition: "replacement",
      supersedesRecordId: shadowedV2.recordId,
      effectiveAt: "2026-07-20T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });

    const sequentialHoldId = "00000000-0000-8000-8000-000000000034";
    const sequentialV1 = record({
      holdId: sequentialHoldId,
      recordId: "00000000-0000-4000-8000-000000000035",
      effectiveAt: "2026-07-19T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const sequentialV2 = record({
      holdId: sequentialHoldId,
      recordId: "00000000-0000-4000-8000-000000000036",
      version: 2,
      transition: "extension",
      supersedesRecordId: sequentialV1.recordId,
      effectiveAt: "2026-07-20T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const sequentialV3 = record({
      holdId: sequentialHoldId,
      recordId: "00000000-0000-4000-8000-000000000037",
      version: 3,
      transition: "replacement",
      supersedesRecordId: sequentialV2.recordId,
      effectiveAt: "2026-07-20T20:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const store = makeStore({
      listHoldRecords: jest
        .fn()
        .mockResolvedValue([
          shadowedV2,
          sequentialV3,
          shadowedV1,
          sequentialV1,
          shadowedV3,
          sequentialV2,
        ]),
    });

    const views = await listAdminHoldViews({ store, now: NOW });

    expect(
      views
        .filter((view) => view.holdId === shadowedHoldId)
        .map((view) => view.version),
    ).toEqual([1, 3]);
    expect(
      views
        .filter((view) => view.holdId === sequentialHoldId)
        .map((view) => view.version),
    ).toEqual([1, 2, 3]);
  });

  it("retries append-only hold scans until two complete snapshots match", async () => {
    const current = record({
      effectiveAt: "2026-07-19T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const appended = record({
      holdId: "00000000-0000-8000-8000-000000000041",
      recordId: "00000000-0000-4000-8000-000000000042",
      effectiveAt: "2026-07-20T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const listHoldRecords = jest
      .fn()
      .mockResolvedValueOnce([current])
      .mockResolvedValue([current, appended]);
    const store = makeStore({ listHoldRecords });

    const views = await listAdminHoldViews({ store, now: NOW });

    expect(listHoldRecords).toHaveBeenCalledTimes(4);
    expect(views.map((view) => view.holdId)).toEqual(
      expect.arrayContaining([current.holdId, appended.holdId]),
    );
  });

  it("fails closed when append-only hold scans never stabilize", async () => {
    const current = record({
      effectiveAt: "2026-07-19T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    const appended = record({
      holdId: "00000000-0000-8000-8000-000000000043",
      recordId: "00000000-0000-4000-8000-000000000044",
      effectiveAt: "2026-07-20T19:00:00.000Z",
      expiresAt: "2026-07-22T20:00:00.000Z",
    });
    let scan = 0;
    const listHoldRecords = jest.fn(async () => {
      const rows = scan % 2 === 0 ? [current] : [current, appended];
      scan += 1;
      return rows;
    });
    const store = makeStore({ listHoldRecords });

    await expect(listAdminHoldViews({ store, now: NOW })).rejects.toMatchObject(
      { code: "hold_state_unavailable", status: 503 },
    );
    expect(listHoldRecords).toHaveBeenCalledTimes(6);
  });

  it("keeps the CLI on the HTTP admin boundary and never prints the cookie", () => {
    const source = readFileSync(
      join(process.cwd(), "scripts/recommendation-hold.ts"),
      "utf8",
    );

    expect(source).toContain("QUIVER_ADMIN_COOKIE");
    expect(source).toMatch(/\bCookie:\s*adminCookie/);
    expect(source).toContain('"Idempotency-Key"');
    expect(source).toContain('"X-Request-ID"');
    expect(source).toContain("crypto.randomUUID()");
    expect(source).toContain("list-active");
    expect(source).toContain("activate");
    expect(source).toContain("extend");
    expect(source).toContain("replace");
    expect(source).toContain("cancel");
    expect(source).not.toMatch(/from ["'][^"']*supabase/i);
    expect(source).not.toMatch(/console\.(?:log|error)\([^\n]*adminCookie/);
  });

  it("handles direct-entry argument errors without printing a stack", () => {
    const { QUIVER_ADMIN_COOKIE: _cookie, ...environment } = process.env;
    const result = spawnSync(
      process.execPath,
      ["--import", "tsx", "scripts/recommendation-hold.ts"],
      {
        cwd: process.cwd(),
        encoding: "utf8",
        env: environment,
      },
    );

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr.trim()).toMatch(/^Usage: recommendation-hold\.ts /);
    expect(result.stderr).not.toContain(" at ");
    expect(result.stderr).not.toContain("control.test.ts");
  });

  it("does not retry a permanent CLI 4xx response", async () => {
    const fetchImpl = jest.fn(async () =>
      cliHttpResponse({ error: { code: "invalid_request" } }, { status: 400 }),
    );
    const log = jest.fn();
    const options: CliOptions = {
      command: "cancel",
      body: { holdId: HOLD_ID, reasonCode: "operator_cancelled" },
      idempotencyKey: IDEMPOTENCY_ID,
      retries: 3,
    };
    const dependencies: RecommendationHoldCliDependencies = {
      adminCookie: "secret-cookie",
      baseUrl: CLI_BASE_URL,
      fetchImpl,
      randomUUID: jest.fn(() => "00000000-0000-4000-8000-000000000091"),
      log,
    };

    await expect(callAdminApi(options, dependencies)).rejects.toThrow(
      /^Admin API returned 400$/,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-cookie");
  });

  it("reuses the idempotency key and rotates the trace ID across retryable CLI attempts", async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(cliHttpResponse("temporary", { status: 503 }))
      .mockResolvedValueOnce(
        cliHttpResponse(
          cliMutationSuccess("00000000-0000-4000-8000-000000000092"),
        ),
      );
    const traceIds = [
      "00000000-0000-4000-8000-000000000091",
      "00000000-0000-4000-8000-000000000092",
    ];
    const log = jest.fn();
    const dependencies: RecommendationHoldCliDependencies = {
      adminCookie: "secret-cookie",
      baseUrl: CLI_BASE_URL,
      fetchImpl,
      randomUUID: jest.fn(() => traceIds.shift() as string),
      log,
    };

    await callAdminApi(
      {
        command: "cancel",
        body: { holdId: HOLD_ID, reasonCode: "operator_cancelled" },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 2,
      },
      dependencies,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstHeaders = fetchImpl.mock.calls[0][1].headers as Record<
      string,
      string
    >;
    const secondHeaders = fetchImpl.mock.calls[1][1].headers as Record<
      string,
      string
    >;
    expect(firstHeaders["Idempotency-Key"]).toBe(IDEMPOTENCY_ID);
    expect(secondHeaders["Idempotency-Key"]).toBe(IDEMPOTENCY_ID);
    expect(firstHeaders["X-Request-ID"]).not.toBe(
      secondHeaders["X-Request-ID"],
    );
    expect(firstHeaders.Cookie).toBe("secret-cookie");
    expect(fetchImpl.mock.calls[0][1].redirect).toBe("manual");
    expect(JSON.stringify(log.mock.calls)).not.toContain("secret-cookie");
  });

  it("aborts a stalled CLI response body and retries with the same idempotency key", async () => {
    const fetchImpl = jest
      .fn<Promise<Response>, [string, RequestInit]>()
      .mockImplementationOnce(async (_url, init) => {
        const signal = init.signal;
        if (!signal) throw new Error("missing attempt deadline");
        const response = cliHttpResponse(cliMutationSuccess(CLI_TRACE_ID));
        Object.defineProperty(response, "text", {
          value: async (): Promise<string> => {
            await new Promise<void>((_resolve, reject) => {
              const rejectOnAbort = (): void => reject(new Error("aborted"));
              if (signal.aborted) {
                rejectOnAbort();
                return;
              }
              signal.addEventListener("abort", rejectOnAbort, { once: true });
            });
            throw new Error("unreachable");
          },
        });
        return response;
      })
      .mockResolvedValueOnce(
        cliHttpResponse(
          cliMutationSuccess("00000000-0000-4000-8000-000000000092"),
        ),
      );
    const traceIds = [
      "00000000-0000-4000-8000-000000000091",
      "00000000-0000-4000-8000-000000000092",
    ];
    const dependencies = {
      adminCookie: "secret-cookie",
      baseUrl: CLI_BASE_URL,
      fetchImpl,
      randomUUID: jest.fn(() => traceIds.shift() as string),
      log: jest.fn(),
      attemptTimeoutMs: 5,
    } as RecommendationHoldCliDependencies & { attemptTimeoutMs: number };

    await callAdminApi(
      {
        command: "cancel",
        body: { holdId: HOLD_ID, reasonCode: "operator_cancelled" },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 1,
      },
      dependencies,
    );

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const firstInit = fetchImpl.mock.calls[0][1];
    const secondInit = fetchImpl.mock.calls[1][1];
    expect(firstInit.signal).toMatchObject({ aborted: true });
    expect(secondInit.signal).toMatchObject({ aborted: false });
    expect(secondInit.signal).not.toBe(firstInit.signal);
    expect(firstInit.headers).toMatchObject({
      "Idempotency-Key": IDEMPOTENCY_ID,
    });
    expect(secondInit.headers).toMatchObject({
      "Idempotency-Key": IDEMPOTENCY_ID,
    });
  });

  it.each([
    [
      "HTML",
      cliHttpResponse("<html>sign in</html>", {
        contentType: "text/html",
      }),
    ],
    ["success false", cliHttpResponse({ success: false })],
    ["malformed JSON", cliHttpResponse("{not-json")],
    ["malformed shape", cliHttpResponse({ success: true })],
    [
      "mismatched request ID",
      cliHttpResponse(
        cliMutationSuccess("00000000-0000-4000-8000-000000000092"),
      ),
    ],
  ])(
    "rejects a 2xx %s mutation response without retrying",
    async (_case, response) => {
      const fetchImpl = jest.fn(async () => response);
      const log = jest.fn();

      await expect(
        callAdminApi(
          {
            command: "cancel",
            body: { holdId: HOLD_ID, reasonCode: "operator_cancelled" },
            idempotencyKey: IDEMPOTENCY_ID,
            retries: 3,
          },
          {
            adminCookie: "secret-cookie",
            baseUrl: CLI_BASE_URL,
            fetchImpl,
            randomUUID: () => CLI_TRACE_ID,
            log,
          },
        ),
      ).rejects.toThrow("invalid mutation response");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledTimes(1);
      expect(JSON.stringify(log.mock.calls)).not.toContain("sign in");
      expect(JSON.stringify(log.mock.calls)).not.toContain("success");
    },
  );

  it.each([
    {
      name: "activation hold identity",
      options: {
        command: "activate",
        body: { ...policy, reasonCode: "major_swell_manual_safety" },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 3,
      } satisfies CliOptions,
      hold: cliFullPolicyHoldView("activation", { holdId: HOLD_ID }),
    },
    {
      name: "extension expiry",
      options: {
        command: "extend",
        body: {
          holdId: HOLD_ID,
          newValidUntil: "2026-07-22T21:00:00.000Z",
          reasonCode: "major_swell_manual_safety",
        },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 3,
      } satisfies CliOptions,
      hold: cliHoldView({
        version: 2,
        transition: "extension",
        status: "active",
        reasonCode: "major_swell_manual_safety",
        validUntil: "2026-07-23T21:00:00.000Z",
      }),
    },
    {
      name: "replacement action",
      options: {
        command: "replace",
        body: {
          ...policy,
          holdId: HOLD_ID,
          reasonCode: "scope_correction",
        },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 3,
      } satisfies CliOptions,
      hold: cliFullPolicyHoldView("replacement", {
        action: "protected_alternatives_only",
        protectedAlternativeBeachIds: [PROTECTED_BEACH_ID],
      }),
    },
    {
      name: "replacement scope",
      options: {
        command: "replace",
        body: {
          ...policy,
          holdId: HOLD_ID,
          reasonCode: "scope_correction",
        },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 3,
      } satisfies CliOptions,
      hold: cliFullPolicyHoldView("replacement", {
        scopeBeachIds: [SECOND_BEACH_ID],
      }),
    },
    {
      name: "replacement cohorts",
      options: {
        command: "replace",
        body: {
          ...policy,
          holdId: HOLD_ID,
          reasonCode: "scope_correction",
        },
        idempotencyKey: IDEMPOTENCY_ID,
        retries: 3,
      } satisfies CliOptions,
      hold: cliFullPolicyHoldView("replacement", {
        affectedCohorts: ["expert"],
      }),
    },
  ])(
    "rejects a 2xx response with mismatched $name",
    async ({ options, hold }) => {
      const fetchImpl = jest.fn(async () =>
        cliHttpResponse({
          success: true,
          data: { outcome: "accepted", hold },
          requestId: CLI_TRACE_ID,
        }),
      );

      await expect(
        callAdminApi(options, {
          adminCookie: "secret-cookie",
          baseUrl: CLI_BASE_URL,
          fetchImpl,
          randomUUID: () => CLI_TRACE_ID,
          log: jest.fn(),
        }),
      ).rejects.toThrow("invalid mutation response");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it("accepts a matching activation response with the deterministic hold identity", async () => {
    const fetchImpl = jest.fn(async () =>
      cliHttpResponse({
        success: true,
        data: {
          outcome: "accepted",
          hold: cliFullPolicyHoldView("activation"),
        },
        requestId: CLI_TRACE_ID,
      }),
    );

    await expect(
      callAdminApi(
        {
          command: "activate",
          body: { ...policy, reasonCode: "major_swell_manual_safety" },
          idempotencyKey: IDEMPOTENCY_ID,
          retries: 0,
        },
        {
          adminCookie: "secret-cookie",
          baseUrl: CLI_BASE_URL,
          fetchImpl,
          randomUUID: () => CLI_TRACE_ID,
          log: jest.fn(),
        },
      ),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "redirected",
      cliHttpResponse(cliMutationSuccess(CLI_TRACE_ID), {
        redirected: true,
      }),
    ],
    [
      "cross-origin",
      cliHttpResponse(cliMutationSuccess(CLI_TRACE_ID), {
        url: "https://login.example.test/api/admin/recommendation-holds",
      }),
    ],
  ])(
    "rejects an untrusted %s response without retrying",
    async (_case, response) => {
      const fetchImpl = jest.fn(async () => response);

      await expect(
        callAdminApi(
          {
            command: "cancel",
            body: { holdId: HOLD_ID, reasonCode: "operator_cancelled" },
            idempotencyKey: IDEMPOTENCY_ID,
            retries: 3,
          },
          {
            adminCookie: "secret-cookie",
            baseUrl: CLI_BASE_URL,
            fetchImpl,
            randomUUID: () => CLI_TRACE_ID,
            log: jest.fn(),
          },
        ),
      ).rejects.toThrow("untrusted Admin API response");
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    "http://admin.example.test",
    "not a url",
    "https://operator:secret@admin.example.test",
  ])(
    "rejects an unsafe CLI base URL before sending the cookie: %s",
    async (baseUrl) => {
      const fetchImpl = jest.fn(async () =>
        cliHttpResponse({ success: false }),
      );

      await expect(
        callAdminApi(
          {
            command: "list-active",
            body: null,
            idempotencyKey: null,
            retries: 3,
          },
          {
            adminCookie: "secret-cookie",
            baseUrl,
            fetchImpl,
            randomUUID: () => CLI_TRACE_ID,
            log: jest.fn(),
          },
        ),
      ).rejects.toThrow(
        "QUIVER_ADMIN_BASE_URL must be an HTTPS origin or loopback HTTP URL",
      );
      expect(fetchImpl).not.toHaveBeenCalled();
    },
  );

  it("allows loopback HTTP for local CLI operation", async () => {
    const loopbackUrl = "http://127.0.0.1:3000";
    const payload = {
      success: true,
      data: { holds: [] },
      requestId: CLI_TRACE_ID,
    };
    const fetchImpl = jest.fn(async () =>
      cliHttpResponse(payload, {
        url: `${loopbackUrl}/api/admin/recommendation-holds`,
      }),
    );

    await expect(
      callAdminApi(
        {
          command: "list-active",
          body: null,
          idempotencyKey: null,
          retries: 0,
        },
        {
          adminCookie: "secret-cookie",
          baseUrl: loopbackUrl,
          fetchImpl,
          randomUUID: () => CLI_TRACE_ID,
          log: jest.fn(),
        },
      ),
    ).resolves.toBeUndefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("accepts only a strict list response and logs the validated payload", async () => {
    const payload = {
      success: true,
      data: { holds: [cliHoldView()] },
      requestId: CLI_TRACE_ID,
    };
    const fetchImpl = jest.fn(async () => cliHttpResponse(payload));
    const log = jest.fn();

    await callAdminApi(
      {
        command: "list-active",
        body: null,
        idempotencyKey: null,
        retries: 0,
      },
      {
        adminCookie: "secret-cookie",
        baseUrl: CLI_BASE_URL,
        fetchImpl,
        randomUUID: () => CLI_TRACE_ID,
        log,
      },
    );

    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(JSON.stringify(payload));
  });
});
