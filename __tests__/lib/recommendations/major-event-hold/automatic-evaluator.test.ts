import {
  evaluateOfficialRipCurrentHoldDiagnostics,
  evaluateOfficialRipCurrentHolds,
} from "@/lib/recommendations/major-event-hold/automatic-evaluator";

const NOW = new Date("2026-07-17T20:00:00.000Z");
const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const ROW_ID = "22222222-2222-4222-8222-222222222222";

function buildRiskRow(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: ROW_ID,
    beach_id: BEACH_ID,
    valid_date: "2026-07-17",
    risk_level: "high",
    source: "srf",
    fetched_at: "2026-07-17T19:00:00.000Z",
    beach_timezone: "America/Los_Angeles",
    ...overrides,
  };
}

describe("evaluateOfficialRipCurrentHolds", () => {
  it("creates a deterministic proposal for fresh official high risk", () => {
    const proposals = evaluateOfficialRipCurrentHolds({
      rows: [buildRiskRow()],
      now: NOW,
    });

    expect(proposals).toEqual([
      expect.objectContaining({
        beachId: BEACH_ID,
        validDate: "2026-07-17",
        transition: "activation",
        triggerType: "automatic_official",
        automaticPolicyVersion: "official-rip-high.v1",
        scopeBeachIds: [BEACH_ID],
        affectedCohorts: ["beginner", "intermediate", "unknown"],
        action: "suppress_positive",
        supportingEvidenceRefs: [`official:rip_current_risks:${ROW_ID}`],
        validFrom: "2026-07-17T07:00:00.000Z",
        validUntil: "2026-07-18T07:00:00.000Z",
        effectiveAt: NOW.toISOString(),
        expiresAt: "2026-07-18T07:00:00.000Z",
        idempotencyKey: `auto:official_rip_high:v1:${BEACH_ID}:2026-07-17`,
      }),
    ]);
    expect(proposals[0].holdId).toBe("41a325c4-cb8c-8109-a574-18c5a419268b");
    expect(proposals[0].requestId).toBe(proposals[0].holdId);
  });

  it.each([
    ["derived source", { source: "derived" }],
    ["moderate risk", { risk_level: "moderate" }],
    ["low risk", { risk_level: "low" }],
    ["stale fetch", { fetched_at: "2026-07-17T07:59:59.999Z" }],
    ["too-far future fetch", { fetched_at: "2026-07-17T20:05:00.001Z" }],
    ["past local date", { valid_date: "2026-07-16" }],
    ["too-distant local date", { valid_date: "2026-07-20" }],
    ["missing timezone", { beach_timezone: null }],
    ["invalid timezone", { beach_timezone: "Not/A_Zone" }],
    [
      "fixed-offset timezone",
      { beach_timezone: "+04:00", valid_date: "2026-07-18" },
    ],
    ["malformed row UUID", { id: "not-a-uuid" }],
    ["malformed date", { valid_date: "2026-02-30" }],
    ["malformed timestamp", { fetched_at: "not-a-timestamp" }],
    ["QA-shaped extra input", { supportingEvidenceRefs: ["qa:artifact:test"] }],
  ])("rejects %s", (_label, overrides) => {
    expect(
      evaluateOfficialRipCurrentHolds({
        rows: [buildRiskRow(overrides)],
        now: NOW,
      }),
    ).toEqual([]);
  });

  it.each(["2026-07-17T08:00:00.000Z", "2026-07-17T20:05:00.000Z"])(
    "accepts the inclusive freshness boundary %s",
    (fetchedAt) => {
      const proposals = evaluateOfficialRipCurrentHolds({
        rows: [buildRiskRow({ fetched_at: fetchedAt })],
        now: NOW,
      });

      expect(proposals).toHaveLength(1);
    },
  );

  it.each(["HST", "CST6CDT"])(
    "accepts the runtime-valid named tzdb identifier %s",
    (timezone) => {
      const proposals = evaluateOfficialRipCurrentHolds({
        rows: [buildRiskRow({ beach_timezone: timezone })],
        now: NOW,
      });

      expect(proposals).toHaveLength(1);
    },
  );

  it("diagnoses only fresh official-high metadata failures", () => {
    const diagnostics = evaluateOfficialRipCurrentHoldDiagnostics({
      rows: [
        buildRiskRow(),
        buildRiskRow({ beach_timezone: null }),
        buildRiskRow({ beach_timezone: "Not/A_Zone" }),
        buildRiskRow({ valid_date: "2026-02-30" }),
        buildRiskRow({ risk_level: "moderate", beach_timezone: null }),
        buildRiskRow({ source: "derived", beach_timezone: null }),
        buildRiskRow({
          beach_timezone: null,
          fetched_at: "2026-07-17T07:59:59.999Z",
        }),
        buildRiskRow({ valid_date: "2026-07-20" }),
      ],
      now: NOW,
    });

    expect(diagnostics).toEqual({
      proposals: expect.arrayContaining([
        expect.objectContaining({ beachId: BEACH_ID }),
      ]),
      invalidMetadataCount: 3,
    });
    expect(diagnostics.proposals).toHaveLength(1);
    expect(
      evaluateOfficialRipCurrentHolds({ rows: [buildRiskRow()], now: NOW }),
    ).toEqual(diagnostics.proposals);
  });

  it("interprets valid_date in the beach civil day rather than UTC", () => {
    const now = new Date("2026-07-18T06:30:00.000Z");
    const proposals = evaluateOfficialRipCurrentHolds({
      rows: [
        buildRiskRow({
          source: "alert",
          fetched_at: "2026-07-18T06:00:00.000Z",
          valid_date: "2026-07-17",
        }),
      ],
      now,
    });

    expect(proposals).toEqual([
      expect.objectContaining({
        validFrom: "2026-07-17T07:00:00.000Z",
        validUntil: "2026-07-18T07:00:00.000Z",
        effectiveAt: now.toISOString(),
      }),
    ]);
  });

  it("uses validFrom as effectiveAt for a future local date", () => {
    const proposals = evaluateOfficialRipCurrentHolds({
      rows: [buildRiskRow({ valid_date: "2026-07-19" })],
      now: NOW,
    });

    expect(proposals[0]).toMatchObject({
      validFrom: "2026-07-19T07:00:00.000Z",
      effectiveAt: "2026-07-19T07:00:00.000Z",
    });
  });

  it.each([
    {
      label: "spring-forward",
      now: "2026-03-08T10:00:00.000Z",
      validDate: "2026-03-08",
      fetchedAt: "2026-03-08T09:00:00.000Z",
      validFrom: "2026-03-08T08:00:00.000Z",
      validUntil: "2026-03-09T07:00:00.000Z",
      durationHours: 23,
    },
    {
      label: "fall-back",
      now: "2026-11-01T10:00:00.000Z",
      validDate: "2026-11-01",
      fetchedAt: "2026-11-01T09:00:00.000Z",
      validFrom: "2026-11-01T07:00:00.000Z",
      validUntil: "2026-11-02T08:00:00.000Z",
      durationHours: 25,
    },
  ])("preserves the $durationHours-hour $label civil day", (fixture) => {
    const [proposal] = evaluateOfficialRipCurrentHolds({
      rows: [
        buildRiskRow({
          valid_date: fixture.validDate,
          fetched_at: fixture.fetchedAt,
        }),
      ],
      now: new Date(fixture.now),
    });

    expect(proposal).toMatchObject({
      validFrom: fixture.validFrom,
      validUntil: fixture.validUntil,
    });
    expect(
      (Date.parse(proposal.validUntil) - Date.parse(proposal.validFrom)) /
        (60 * 60 * 1000),
    ).toBe(fixture.durationHours);
  });

  it("deduplicates beach/date rows by freshest fetch and a stable row-id tie-break", () => {
    const olderId = "33333333-3333-4333-8333-333333333333";
    const tieWinnerId = "11111111-1111-4111-8111-111111111112";
    const tieLoserId = "44444444-4444-4444-8444-444444444444";
    const proposals = evaluateOfficialRipCurrentHolds({
      rows: [
        buildRiskRow({ id: olderId, fetched_at: "2026-07-17T18:00:00.000Z" }),
        buildRiskRow({ id: tieLoserId }),
        buildRiskRow({ id: tieWinnerId }),
      ],
      now: NOW,
    });

    expect(proposals).toHaveLength(1);
    expect(proposals[0].supportingEvidenceRefs).toEqual([
      `official:rip_current_risks:${tieWinnerId}`,
    ]);
  });

  it("sorts proposals by beach and date", () => {
    const secondBeach = "99999999-9999-4999-8999-999999999999";
    const proposals = evaluateOfficialRipCurrentHolds({
      rows: [
        buildRiskRow({ beach_id: secondBeach, valid_date: "2026-07-18" }),
        buildRiskRow({ valid_date: "2026-07-18" }),
        buildRiskRow(),
      ],
      now: NOW,
    });

    expect(
      proposals.map(({ beachId, validDate }) => [beachId, validDate]),
    ).toEqual([
      [BEACH_ID, "2026-07-17"],
      [BEACH_ID, "2026-07-18"],
      [secondBeach, "2026-07-18"],
    ]);
  });

  it("uses deterministic distinct RFC UUIDv8 hold identities", () => {
    const [first] = evaluateOfficialRipCurrentHolds({
      rows: [buildRiskRow()],
      now: NOW,
    });
    const [retry] = evaluateOfficialRipCurrentHolds({
      rows: [buildRiskRow({ id: "55555555-5555-4555-8555-555555555555" })],
      now: NOW,
    });
    const [differentDate] = evaluateOfficialRipCurrentHolds({
      rows: [buildRiskRow({ valid_date: "2026-07-18" })],
      now: NOW,
    });

    expect(retry.holdId).toBe(first.holdId);
    expect(differentDate.holdId).not.toBe(first.holdId);
    expect(first.holdId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("returns no proposals for an invalid now value or non-array rows", () => {
    expect(
      evaluateOfficialRipCurrentHolds({ rows: null, now: NOW } as never),
    ).toEqual([]);
    expect(
      evaluateOfficialRipCurrentHolds({
        rows: [buildRiskRow()],
        now: new Date(NaN),
      }),
    ).toEqual([]);
  });
});
