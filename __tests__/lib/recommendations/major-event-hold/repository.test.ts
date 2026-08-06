import { resolveMajorEventHolds } from "@/lib/recommendations/major-event-hold/repository";
import type { MajorEventHoldCandidate } from "@/lib/recommendations/major-event-hold/types";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const BEACH_A = "11111111-1111-4111-8111-111111111111";
const BEACH_B = "22222222-2222-4222-8222-222222222222";
const CASE_BEACH_ID = "abcdefab-cdef-4abc-8def-abcdefabcdef";

const candidates: MajorEventHoldCandidate[] = [
  {
    candidateId: "later-a",
    beachId: BEACH_A,
    startsAt: "2026-07-20T00:00:00.000Z",
    endsAt: "2026-07-20T03:00:00.000Z",
  },
  {
    candidateId: "early-b",
    beachId: BEACH_B,
    startsAt: "2026-07-19T15:00:00.000Z",
    endsAt: "2026-07-19T17:00:00.000Z",
  },
  {
    candidateId: "duplicate-beach-a",
    beachId: BEACH_A,
    startsAt: "2026-07-19T18:00:00.000Z",
    endsAt: "2026-07-19T20:00:00.000Z",
  },
];

const rpcRow = {
  record_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  hold_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  version: 1,
  transition: "activation",
  status: "active",
  region_keys: [],
  scope_beach_ids: [BEACH_A, BEACH_B],
  scope_exposure_classes: [],
  protected_alternative_beach_ids: [],
  event_reference: "event:major_swell:hurricane_swell_2026",
  valid_from: "2026-07-19T07:00:00.000Z",
  valid_until: "2026-07-20T07:00:00.000Z",
  affected_cohorts: ["beginner", "intermediate", "unknown"],
  action: "suppress_positive",
  trigger_type: "manual_operator",
  supporting_evidence_refs: ["qa:artifact:forecast_review_2026"],
  automatic_policy_version: null,
  authorizing_operator_ref: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  authorizing_actor: "admin_api",
  reason_code: "major_swell_manual_safety",
  effective_at: "2026-07-19T10:00:00.000Z",
  expires_at: "2026-07-20T07:00:00.000Z",
  supersedes_record_id: null,
  idempotency_key: "manual:major-swell:2026-07-19",
  payload_hash: "a".repeat(64),
  request_id: "request:major-swell-2026",
  created_at: "2026-07-19T10:00:00.000Z",
};

function makeClient(data: unknown, error: unknown = null) {
  return {
    rpc: jest.fn().mockResolvedValue({ data, error }),
  };
}

const diagnosticContext = {
  candidateCount: 3,
  beachCount: 2,
  asOf: "2026-07-19T12:00:00.000Z",
};

function expectSanitizedDiagnosticPayload(payload: unknown): void {
  expect(payload).toEqual(expect.any(Object));

  for (const [key, value] of Object.entries(
    payload as Record<string, unknown>,
  )) {
    if (key !== "issues") {
      expect(["number", "string"]).toContain(typeof value);
      continue;
    }

    expect(Array.isArray(value)).toBe(true);
    for (const issue of value as unknown[]) {
      expect(issue).toEqual(expect.any(Object));
      expect(Object.keys(issue as Record<string, unknown>).sort()).toEqual([
        "message",
        "path",
      ]);
      const { message, path } = issue as {
        message: unknown;
        path: unknown;
      };
      expect(typeof message).toBe("string");
      expect(Array.isArray(path)).toBe(true);
      for (const segment of path as unknown[]) {
        expect(["number", "string"]).toContain(typeof segment);
      }
    }
  }
}

function expectDiagnostic(
  consoleErrorSpy: jest.SpyInstance,
  tag: string,
  payload: unknown,
): void {
  expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
  const [actualTag, actualPayload] = consoleErrorSpy.mock.calls[0];
  expect(actualTag).toBe(tag);
  expect(actualPayload).toEqual(payload);
  expectSanitizedDiagnosticPayload(actualPayload);
}

describe("major-event hold repository", () => {
  it("uses one RPC for sorted unique beaches and the complete half-open window", async () => {
    const client = makeClient([rpcRow]);
    const resolution = await resolveMajorEventHolds(candidates, {
      client,
      asOf: new Date("2026-07-19T12:00:00.000Z"),
    });

    expect(client.rpc).toHaveBeenCalledTimes(1);
    expect(client.rpc).toHaveBeenCalledWith(
      "resolve_active_regional_recommendation_holds",
      {
        p_as_of: "2026-07-19T12:00:00.000Z",
        p_beach_ids: [BEACH_A, BEACH_B],
        p_window_start: "2026-07-19T15:00:00.000Z",
        p_window_end: "2026-07-20T03:00:00.000Z",
      },
    );
    expect(resolution).toEqual({
      state: "resolved",
      holds: [
        {
          recordId: rpcRow.record_id,
          holdId: rpcRow.hold_id,
          version: 1,
          status: "active",
          scopeBeachIds: [BEACH_A, BEACH_B],
          validFrom: rpcRow.valid_from,
          validUntil: rpcRow.valid_until,
          affectedCohorts: ["beginner", "intermediate", "unknown"],
          action: "suppress_positive",
          expiresAt: rpcRow.expires_at,
        },
      ],
    });
    expect(JSON.stringify(resolution)).not.toMatch(
      /evidence|operator|payload_hash|forecast_review/i,
    );
  });

  it("canonicalizes UUID casing at both sides of the resolver boundary", async () => {
    const client = makeClient([
      {
        ...rpcRow,
        record_id: rpcRow.record_id.toUpperCase(),
        hold_id: rpcRow.hold_id.toUpperCase(),
        scope_beach_ids: [CASE_BEACH_ID.toUpperCase()],
        authorizing_operator_ref: rpcRow.authorizing_operator_ref.toUpperCase(),
      },
    ]);

    const resolution = await resolveMajorEventHolds(
      [{ ...candidates[0], beachId: CASE_BEACH_ID.toUpperCase() }],
      {
        client,
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      },
    );

    expect(client.rpc).toHaveBeenCalledWith(
      "resolve_active_regional_recommendation_holds",
      expect.objectContaining({ p_beach_ids: [CASE_BEACH_ID] }),
    );
    expect(resolution).toEqual({
      state: "resolved",
      holds: [
        expect.objectContaining({
          recordId: rpcRow.record_id,
          holdId: rpcRow.hold_id,
          scopeBeachIds: [CASE_BEACH_ID],
        }),
      ],
    });
  });

  it("logs a sanitized diagnostic when the RPC returns an error", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const rawError = {
      message: "database unavailable",
      code: "08006",
      details: { connection: "primary" },
    };

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client: makeClient([], rawError),
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:rpc-error]",
        {
          ...diagnosticContext,
          error: rawError.message,
          code: rawError.code,
        },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("logs a sanitized diagnostic for a non-array RPC response", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const rawResponse = { rows: [rpcRow] };

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client: makeClient(rawResponse),
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:invalid-response-shape]",
        diagnosticContext,
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("logs sanitized validation issues for an invalid hold row", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const invalidRow = { ...rpcRow, version: 0 };

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client: makeClient([invalidRow]),
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:invalid-hold-row]",
        {
          ...diagnosticContext,
          issues: expect.arrayContaining([
            expect.objectContaining({
              path: ["version"],
              message: expect.any(String),
            }),
          ]),
        },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("logs sanitized identifiers when a hold is invalidated", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const invalidatedRow = {
      ...rpcRow,
      scope_exposure_classes: ["fully_exposed"],
    };

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client: makeClient([invalidatedRow]),
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:hold-invalidated]",
        {
          ...diagnosticContext,
          recordId: rpcRow.record_id,
          holdId: rpcRow.hold_id,
        },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("logs a sanitized hold ID for duplicate resolver rows", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client: makeClient([
          rpcRow,
          {
            ...rpcRow,
            record_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          },
        ]),
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:duplicate-hold-ids]",
        {
          ...diagnosticContext,
          holdId: rpcRow.hold_id,
        },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("logs a sanitized diagnostic when resolution throws", async () => {
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const thrownError = Object.assign(new Error("network failure"), {
      raw: { response: "do not log" },
    });
    const client = {
      rpc: jest.fn().mockRejectedValue(thrownError),
    };

    try {
      const resolution = await resolveMajorEventHolds(candidates, {
        client,
        asOf: new Date(diagnosticContext.asOf),
      });

      expect(resolution).toEqual({ state: "unresolved", holds: [] });
      expectDiagnostic(
        consoleErrorSpy,
        "[major-event-hold:repository:resolution-threw]",
        {
          ...diagnosticContext,
          error: thrownError.message,
        },
      );
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it.each([
    [
      "non-array payload",
      {},
      null,
      /\[major-event-hold:repository:invalid-response-shape\]/,
    ],
    [
      "RPC error",
      [],
      { message: "database unavailable" },
      /\[major-event-hold:repository:rpc-error\]/,
    ],
    [
      "malformed row",
      [{ ...rpcRow, version: 0 }],
      null,
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ],
    [
      "non-active status",
      [{ ...rpcRow, status: "cancelled" }],
      null,
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ],
    [
      "duplicate cohort scope",
      [{ ...rpcRow, affected_cohorts: ["beginner", "beginner"] }],
      null,
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ],
    [
      "duplicate beach scope",
      [{ ...rpcRow, scope_beach_ids: [BEACH_A, BEACH_A] }],
      null,
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ],
    [
      "unresolvable exposure scope",
      [{ ...rpcRow, scope_exposure_classes: ["fully_exposed"] }],
      null,
      /\[major-event-hold:repository:hold-invalidated\]/,
    ],
    [
      "expiry beyond seven days",
      [{ ...rpcRow, expires_at: "2026-07-27T10:00:00.001Z" }],
      null,
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ],
  ])("returns unresolved for %s", async (_name, data, error, errorTag) => {
    const client = makeClient(data, error);
    await expect(
      resolveMajorEventHolds(candidates, {
        client,
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ state: "unresolved", holds: [] });
    expectConsoleErrors([errorTag]);
  });

  it("returns unresolved when the RPC throws", async () => {
    const client = {
      rpc: jest.fn().mockRejectedValue(new Error("network failure")),
    };
    await expect(
      resolveMajorEventHolds(candidates, {
        client,
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ state: "unresolved", holds: [] });
    expectConsoleErrors([
      /\[major-event-hold:repository:resolution-threw\]/,
    ]);
  });

  it("rejects duplicate hold IDs as an impossible resolver shape", async () => {
    const client = makeClient([
      rpcRow,
      {
        ...rpcRow,
        record_id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      },
    ]);
    await expect(
      resolveMajorEventHolds(candidates, {
        client,
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ state: "unresolved", holds: [] });
    expectConsoleErrors([
      /\[major-event-hold:repository:duplicate-hold-ids\]/,
    ]);
  });

  it.each([
    ["missing trigger", { ...rpcRow, trigger_type: undefined }],
    ["unknown reason", { ...rpcRow, reason_code: "operator_guess" }],
    [
      "unsafe evidence",
      { ...rpcRow, supporting_evidence_refs: ["https://example.com/raw"] },
    ],
    [
      "invalid manual provenance",
      { ...rpcRow, authorizing_operator_ref: null },
    ],
    ["unknown field", { ...rpcRow, raw_evidence: "secret" }],
  ])("rejects a complete RPC row with %s", async (_name, row) => {
    const client = makeClient([row]);
    await expect(
      resolveMajorEventHolds(candidates, {
        client,
        asOf: new Date("2026-07-19T12:00:00.000Z"),
      }),
    ).resolves.toEqual({ state: "unresolved", holds: [] });
    expectConsoleErrors([
      /\[major-event-hold:repository:invalid-hold-row\]/,
    ]);
  });

  it("does not call the RPC for an invalid candidate", async () => {
    const client = makeClient([]);
    const resolution = await resolveMajorEventHolds(
      [{ ...candidates[0], beachId: "not-a-uuid" }],
      { client },
    );
    expect(resolution).toEqual({ state: "unresolved", holds: [] });
    expect(client.rpc).not.toHaveBeenCalled();
  });

  it("keeps the Supabase RPC method bound to its client", async () => {
    const client = {
      expectedName: "resolve_active_regional_recommendation_holds",
      rpc(this: { expectedName: string }, name: string) {
        if (name !== this.expectedName) throw new Error("unbound RPC client");
        return Promise.resolve({ data: [], error: null });
      },
    };

    await expect(
      resolveMajorEventHolds(candidates, { client }),
    ).resolves.toEqual({
      state: "resolved",
      holds: [],
    });
  });
});
