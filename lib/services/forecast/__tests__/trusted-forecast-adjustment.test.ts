import {
  buildTrustedForecastDecisions,
  isTrustedForecastAdjustmentEnabled,
  type TrustedExternalForecastRow,
  type TrustedForecastSlot,
} from "../trusted-forecast-adjustment";

const now = new Date("2026-07-27T12:00:00.000Z");
const validStart = "2026-07-27T07:00:00.000Z";
const validEnd = "2026-07-28T07:00:00.000Z";

function source(
  overrides: Partial<TrustedExternalForecastRow> = {},
): TrustedExternalForecastRow {
  return {
    id: "source-1",
    provider: "wavecast",
    source_scope: "spot",
    source_key: "trestles",
    beach_id: "beach-1",
    issued_at: "2026-07-27T08:00:00.000Z",
    valid_start: validStart,
    valid_end: validEnd,
    min_face_ft: 4,
    max_face_ft: 5,
    ...overrides,
  };
}

function slots(values: number[]): TrustedForecastSlot[] {
  return values.map((baselineHeightFt, index) => ({
    index,
    forecastAt: new Date(
      Date.parse(validStart) + index * 3 * 60 * 60 * 1000,
    ).toISOString(),
    baselineHeightFt,
    rangeSpread: null,
  }));
}

describe("trusted forecast adjustment decisions", () => {
  beforeEach(() => {
    delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
  });

  afterEach(() => {
    delete process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED;
    delete process.env.TRUSTED_FORECAST_MAX_ISSUE_AGE_HOURS;
  });

  it("defaults on and preserves an explicit false kill switch", () => {
    expect(isTrustedForecastAdjustmentEnabled()).toBe(true);

    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "FALSE";
    expect(isTrustedForecastAdjustmentEnabled()).toBe(false);
  });

  it("raises a low daily maximum toward the trusted range by the 0.5 ft cap", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source()],
      slots: slots([2.5, 3, 2.75]),
      now,
    });

    expect(decisions).toHaveLength(1);
    expect(decisions[0]).toMatchObject({
      status: "applied",
      baselineMaxFt: 3,
      signedDistanceFt: -1,
      offsetFt: -0.5,
      slotIndexes: [0, 1, 2],
    });
  });

  it("lowers a high daily maximum and rounds to quarter feet", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source({ min_face_ft: 3, max_face_ft: 4.25 })],
      slots: slots([4.8]),
      now,
    });

    expect(decisions[0]).toMatchObject({
      offsetFt: 0.25,
      status: "applied",
    });
    expect(decisions[0].signedDistanceFt).toBeCloseTo(0.55, 8);
  });

  it("does nothing inside the trusted range or inside the dead band", () => {
    const inside = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source()],
      slots: slots([4.5]),
      now,
    });
    const near = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source()],
      slots: slots([3.75]),
      now,
    });

    expect(inside[0]).toMatchObject({ status: "noop", offsetFt: 0 });
    expect(near[0]).toMatchObject({ status: "noop", offsetFt: 0 });
  });

  it("prefers spot rows over regional rows from the same provider", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [
        source(),
        source({
          id: "regional-1",
          source_scope: "regional",
          min_face_ft: 1,
          max_face_ft: 2,
        }),
      ],
      slots: slots([3]),
      now,
    });

    expect(decisions[0]).toMatchObject({
      trustedMinFaceFt: 4,
      trustedMaxFaceFt: 5,
      offsetFt: -0.5,
      evidenceIds: ["source-1"],
    });
  });

  it("uses the latest issue instead of blending it with superseded guidance", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [
        source({
          id: "old-issue",
          issued_at: "2026-07-27T07:00:00.000Z",
          min_face_ft: 1,
          max_face_ft: 2,
        }),
        source({
          id: "new-issue",
          issued_at: "2026-07-27T10:00:00.000Z",
          min_face_ft: 4,
          max_face_ft: 5,
        }),
      ],
      slots: slots([3]),
      now,
    });

    expect(decisions[0]).toMatchObject({
      trustedMinFaceFt: 4,
      trustedMaxFaceFt: 5,
      evidenceIds: ["new-issue"],
      offsetFt: -0.5,
    });
  });

  it("blocks materially conflicting independent providers", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [
        source(),
        source({
          id: "nws-1",
          provider: "nws",
          source_scope: "regional",
          source_key: "hawaii-srf",
          min_face_ft: 7,
          max_face_ft: 8,
        }),
      ],
      slots: slots([3]),
      now,
    });

    expect(decisions[0]).toMatchObject({
      status: "conflict",
      offsetFt: 0,
      evidenceIds: ["nws-1", "source-1"],
    });
  });

  it("rejects stale issues and supports an explicit kill switch", () => {
    process.env.TRUSTED_FORECAST_MAX_ISSUE_AGE_HOURS = "6";
    const stale = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source({ issued_at: "2026-07-26T00:00:00.000Z" })],
      slots: slots([3]),
      now,
    });
    process.env.TRUSTED_FORECAST_ADJUSTMENTS_ENABLED = "false";
    const disabled = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [source()],
      slots: slots([3]),
      now,
    });

    expect(stale).toEqual([]);
    expect(disabled).toEqual([]);
  });

  it("fails closed on future-dated or malformed issues", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: [
        source({ issued_at: "2026-07-28T12:00:00.000Z" }),
        source({ id: "bad-range", min_face_ft: 6, max_face_ft: 5 }),
      ],
      slots: slots([3]),
      now,
    });

    expect(decisions).toEqual([]);
  });

  it("fails closed on a malformed source collection", () => {
    const decisions = buildTrustedForecastDecisions({
      beachId: "beach-1",
      sources: {} as TrustedExternalForecastRow[],
      slots: slots([3]),
      now,
    });

    expect(decisions).toEqual([]);
  });
});
