/**
 * @jest-environment node
 */

import {
  assessRarity,
  buildEventKey,
  type DayScore,
} from "@/lib/alerts/swell-rarity";

function day(
  localDate: string,
  bestScore: number,
  go = bestScore >= 70,
): DayScore {
  return { localDate, bestScore, go };
}

describe("assessRarity", () => {
  it("marks a new 30-day high as rare", () => {
    const history = Array.from({ length: 30 }, (_, index) =>
      day(`2026-08-${String(index + 1).padStart(2, "0")}`, 26 + index),
    );

    expect(assessRarity({
      peakDate: "2026-09-01",
      history,
      peakScore: 78,
      peakGo: true,
    })).toEqual({
      rare: true,
      kind: "best-in-30",
      rarityLine: "Best in 30 days",
    });
  });

  it("marks the first go after three flat days", () => {
    expect(assessRarity({
      peakDate: "2026-09-17",
      history: [
        day("2026-09-13", 72, true),
        day("2026-09-14", 22, false),
        day("2026-09-15", 18, false),
        day("2026-09-16", 31, false),
      ],
      peakScore: 70,
      peakGo: true,
    })).toEqual({
      rare: true,
      kind: "first-after-flat",
      rarityLine: "First real swell in 4 days",
    });
  });

  it("rejects an ordinary peak below a recent better day", () => {
    expect(assessRarity({
      peakDate: "2026-09-17",
      history: [
        day("2026-09-12", 74, true),
        day("2026-09-13", 62, false),
        day("2026-09-14", 55, false),
        day("2026-09-15", 61, false),
        day("2026-09-16", 58, false),
      ],
      peakScore: 70,
      peakGo: true,
    })).toEqual({ rare: false, kind: null, rarityLine: null });
  });
});

describe("buildEventKey", () => {
  it("buckets adjacent peak dates together for the same lead beach", () => {
    expect(buildEventKey({
      peakDate: "2026-09-20",
      leadBeachId: "beach-1",
    })).toBe(buildEventKey({
      peakDate: "2026-09-21",
      leadBeachId: "beach-1",
    }));
  });
});
