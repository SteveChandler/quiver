import {
  applyFeedbackHeightCalibration,
  type FeedbackHeightCalibrationCandidate,
} from "../feedback-height-calibration";

const now = new Date("2026-07-24T03:00:00.000Z");
const candidate: FeedbackHeightCalibrationCandidate = {
  id: "candidate-1",
  beach_id: "beach-1",
  status: "active_temp",
  offset_ft: 0.5,
  sample_count: 5,
  unique_user_count: 3,
  activated_at: "2026-07-23T03:00:00.000Z",
  expires_at: "2026-08-06T03:00:00.000Z",
};

describe("temporary feedback height calibration", () => {
  it("applies a bounded active candidate after the caller's current height", () => {
    expect(
      applyFeedbackHeightCalibration({
        heightFt: 3.5,
        rawDisplayLabel: "3-4ft",
        forecastAt: "2026-07-24T06:00:00.000Z",
        candidate,
        enabled: true,
        now,
      }),
    ).toEqual({
      heightFt: 3,
      applied: true,
      candidateId: "candidate-1",
      offsetFt: 0.5,
    });
  });

  it.each([
    ["flag off", { enabled: false }],
    [
      "expired",
      {
        candidate: {
          ...candidate,
          expires_at: "2026-07-24T02:59:59.000Z",
        },
      },
    ],
    [
      "shadow",
      {
        candidate: {
          ...candidate,
          status: "shadow",
        } as unknown as FeedbackHeightCalibrationCandidate,
      },
    ],
    [
      "rejected",
      {
        candidate: {
          ...candidate,
          status: "rejected",
        } as unknown as FeedbackHeightCalibrationCandidate,
      },
    ],
    [
      "manual hold",
      {
        candidate: {
          ...candidate,
          status: "manual_hold",
        } as unknown as FeedbackHeightCalibrationCandidate,
      },
    ],
    [
      "stale forecast",
      { forecastAt: "2026-07-24T00:00:00.000Z" },
    ],
    ["Flat", { heightFt: 0, rawDisplayLabel: "Flat" }],
    ["null height", { heightFt: Number.NaN, rawDisplayLabel: null }],
  ])("does not apply for %s", (_label, overrides) => {
    const result = applyFeedbackHeightCalibration({
      heightFt: 3.5,
      rawDisplayLabel: "3-4ft",
      forecastAt: "2026-07-24T06:00:00.000Z",
      candidate,
      enabled: true,
      now,
      ...overrides,
    });

    expect(result.applied).toBe(false);
    expect(result.candidateId).toBeNull();
    expect(result.offsetFt).toBeNull();
  });

  it("clamps the final height at zero without creating waves from Flat", () => {
    const lowered = applyFeedbackHeightCalibration({
      heightFt: 0.25,
      rawDisplayLabel: "0.25ft",
      forecastAt: "2026-07-24T06:00:00.000Z",
      candidate,
      enabled: true,
      now,
    });
    const flat = applyFeedbackHeightCalibration({
      heightFt: 0,
      rawDisplayLabel: "Flat",
      forecastAt: "2026-07-24T06:00:00.000Z",
      candidate: { ...candidate, offset_ft: -0.5 },
      enabled: true,
      now,
    });

    expect(lowered.heightFt).toBe(0);
    expect(flat.heightFt).toBe(0);
    expect(flat.applied).toBe(false);
  });

  it("rejects out-of-contract offsets", () => {
    const result = applyFeedbackHeightCalibration({
      heightFt: 3,
      rawDisplayLabel: "3ft",
      forecastAt: "2026-07-24T06:00:00.000Z",
      candidate: { ...candidate, offset_ft: 0.75 },
      enabled: true,
      now,
    });

    expect(result.applied).toBe(false);
  });
});
