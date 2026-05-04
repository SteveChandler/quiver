/**
 * @jest-environment node
 *
 * Unit tests for similarity-best-pick.ts — pure picker that the
 * similarity-alerts cron uses to choose the best ready-state slot across all
 * candidate beaches for a single user.
 *
 * Picker contract:
 *  - filter:  score >= scoreThreshold AND beach-local hour NOT in [rejectStart, rejectEnd]
 *  - sort:    score desc, then forecast_at asc
 *  - return:  the first eligible row or null
 *
 * The cron does the data fetch + RPC batch call and hands this picker a flat
 * array; this file owns picker correctness only.
 */

import { pickBestSimilaritySlot, type ScoredSlot } from "@/lib/alerts/similarity-best-pick";

const PT = "America/Los_Angeles";

function slot(overrides: Partial<ScoredSlot> = {}): ScoredSlot {
  return {
    beach_id: "beach-1",
    beach_name: "Test Beach",
    beach_slug: "test-beach",
    forecast_at: "2026-05-04T17:00:00Z", // 10am PT
    beach_timezone: PT,
    score: 8,
    label: "GOOD",
    reason: "Solid groundswell, light offshore",
    window_local: "Mon 10am",
    wave_height_ft: 4.5,
    wave_period_s: 11,
    ...overrides,
  };
}

const DEFAULTS = {
  scoreThreshold: 7.5,
  rejectStartHourLocal: 22,
  rejectEndHourLocal: 6,
};

describe("pickBestSimilaritySlot", () => {
  it("rejects scores below threshold (no pick)", () => {
    const slots: ScoredSlot[] = [
      slot({ score: 6.9, forecast_at: "2026-05-04T17:00:00Z" }),
      slot({ score: 5.0, forecast_at: "2026-05-04T18:00:00Z" }),
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).toBeNull();
  });

  // Plan V4 fix F2: SCORE_THRESHOLD raised 7→7.5. Pin the exact boundary so
  // a future regression to 7.0 surfaces as a unit failure.
  it("threshold=7.5 boundary: 7.4 rejected, 7.5 accepted", () => {
    const tooLow = pickBestSimilaritySlot({
      scoredSlots: [slot({ score: 7.4, forecast_at: "2026-05-04T17:00:00Z" })],
      ...DEFAULTS,
    });
    expect(tooLow).toBeNull();

    const exactly = pickBestSimilaritySlot({
      scoredSlots: [slot({ score: 7.5, forecast_at: "2026-05-04T17:00:00Z" })],
      ...DEFAULTS,
    });
    expect(exactly).not.toBeNull();
    expect(exactly!.score).toBe(7.5);
  });

  it("returns the highest-scoring ready slot", () => {
    const slots: ScoredSlot[] = [
      slot({ score: 7.5, forecast_at: "2026-05-04T17:00:00Z" }),
      slot({ score: 9.2, forecast_at: "2026-05-04T18:00:00Z", label: "EPIC" }),
      slot({ score: 8.0, forecast_at: "2026-05-04T19:00:00Z" }),
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).not.toBeNull();
    expect(pick!.score).toBe(9.2);
    expect(pick!.label).toBe("EPIC");
  });

  it("tie-breaks by earliest forecast_at when scores are equal", () => {
    const slots: ScoredSlot[] = [
      slot({ score: 8.5, forecast_at: "2026-05-05T17:00:00Z" }),
      slot({ score: 8.5, forecast_at: "2026-05-04T17:00:00Z" }), // earlier
      slot({ score: 8.5, forecast_at: "2026-05-04T22:00:00Z" }),
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).not.toBeNull();
    expect(pick!.forecast_at).toBe("2026-05-04T17:00:00Z");
  });

  it("rejects forecast_at falling in user-local 22:00-06:00 window", () => {
    // 03:00 PT == 10:00 UTC (PDT, UTC-7)
    const threeAmPT = slot({
      score: 9.5,
      forecast_at: "2026-05-04T10:00:00Z",
      beach_timezone: PT,
    });
    // 23:00 PT same day == 06:00 UTC next day (still in night window)
    const elevenPmPT = slot({
      score: 9.4,
      forecast_at: "2026-05-05T06:00:00Z",
      beach_timezone: PT,
    });
    // 10:00 PT == 17:00 UTC — a valid daytime slot
    const tenAmPT = slot({
      score: 7.5,
      forecast_at: "2026-05-04T17:00:00Z",
      beach_timezone: PT,
    });

    const pick = pickBestSimilaritySlot({
      scoredSlots: [threeAmPT, elevenPmPT, tenAmPT],
      ...DEFAULTS,
    });
    expect(pick).not.toBeNull();
    // The 9.5 and 9.4 are both in the rejected window; 7.5 daytime wins.
    expect(pick!.forecast_at).toBe("2026-05-04T17:00:00Z");
    expect(pick!.score).toBe(7.5);
  });

  it("returns null when every above-threshold slot is in the rejected nighttime window", () => {
    const slots: ScoredSlot[] = [
      slot({ score: 9.5, forecast_at: "2026-05-04T10:00:00Z", beach_timezone: PT }), // 03:00 PT
      slot({ score: 8.0, forecast_at: "2026-05-04T11:00:00Z", beach_timezone: PT }), // 04:00 PT
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).toBeNull();
  });

  it("non-ready slots are filtered by caller; picker treats missing beach metadata defensively", () => {
    // Validate that when a caller provides only ready slots, picker behaves
    // correctly. Non-ready filtering is upstream — but score=0 / null score
    // sentinels should never produce a pick.
    const slots: ScoredSlot[] = [
      slot({ score: 0, forecast_at: "2026-05-04T17:00:00Z" }),
      slot({ score: NaN, forecast_at: "2026-05-04T18:00:00Z" }),
      slot({ score: 8.5, forecast_at: "2026-05-04T19:00:00Z" }),
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).not.toBeNull();
    expect(pick!.score).toBe(8.5);
  });

  it("handles a caller-pre-filtered candidate list (water-quality closures excluded)", () => {
    // Caller drops closure beaches before scoring. Picker just sees what it sees.
    const slots: ScoredSlot[] = [
      slot({
        beach_id: "beach-clean",
        beach_name: "Clean Beach",
        beach_slug: "clean-beach",
        score: 8.0,
        forecast_at: "2026-05-04T17:00:00Z",
      }),
    ];

    const pick = pickBestSimilaritySlot({ scoredSlots: slots, ...DEFAULTS });
    expect(pick).not.toBeNull();
    expect(pick!.beach_id).toBe("beach-clean");
  });

  it("handles empty input", () => {
    expect(pickBestSimilaritySlot({ scoredSlots: [], ...DEFAULTS })).toBeNull();
  });

  it("respects beach-specific timezones for the night-rejection check", () => {
    // 03:00 ET == 07:00 UTC (EDT, UTC-4)
    // 00:00 PT == 07:00 UTC (PDT, UTC-7)
    // Same UTC instant; both ET (03:00) and PT (00:00) land in night window
    // for those slots. We seed a separate clean daytime PT slot so the picker
    // has at least one valid candidate, and verify it wins.
    const sameUtc = "2026-05-04T07:00:00Z";

    const etSlot = slot({
      beach_id: "beach-east",
      beach_timezone: "America/New_York",
      score: 9.0,
      forecast_at: sameUtc, // 03:00 ET — REJECTED
    });
    const ptNight = slot({
      beach_id: "beach-west-night",
      beach_timezone: PT,
      score: 8.0,
      forecast_at: sameUtc, // 00:00 PT — REJECTED
    });
    const ptDaytime = slot({
      beach_id: "beach-west-day",
      beach_timezone: PT,
      score: 7.5,
      forecast_at: "2026-05-04T17:00:00Z", // 10:00 PT — accepted
    });

    const pick = pickBestSimilaritySlot({
      scoredSlots: [etSlot, ptNight, ptDaytime],
      ...DEFAULTS,
    });
    expect(pick).not.toBeNull();
    expect(pick!.beach_id).toBe("beach-west-day");
  });
});
