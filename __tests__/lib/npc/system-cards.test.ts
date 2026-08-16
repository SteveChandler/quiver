/** @jest-environment node */

import {
  buildSystemCardCopy,
  type SystemCardCandidate,
  type SystemForecastSnapshot,
} from "@/lib/npc/system-cards";
import { isSystemCardBlocked } from "@/lib/npc/post-quality";
import { selectSystemCardCandidates } from "@/lib/npc/system-card-selection";
import { planSystemCardClasses, type SystemCardClass } from "@/lib/npc/system-card-types";

const AS_OF = new Date("2026-08-13T12:00:00.000Z");
const FORECAST: SystemForecastSnapshot = {
  forecastAt: "2026-08-13T11:00:00.000Z",
  waveHeightFt: 3.5,
  wavePeriodSeconds: 11,
  windSpeedKnots: 6,
  windDirection: "NW",
  tideHeightFt: 2.1,
  tideStatus: "rising",
  waterTempF: 64,
};

function candidate(
  id: string,
  allocationTier: SystemCardCandidate["allocationTier"],
): SystemCardCandidate {
  return {
    id,
    name: `Beach ${id}`,
    lat: 32,
    lon: -117,
    marketKey: `ca:market-${allocationTier}`,
    allocationTier,
    trafficWeight: 1,
  };
}

describe("Quiver Forecast system cards", () => {
  it("plans five-plus classes with at least 30% response-shaped cards", () => {
    const classes = planSystemCardClasses(70);
    const promptClasses = new Set<SystemCardClass>([
      "prompt",
      "correction_request",
      "forecast_vs_observation",
    ]);

    expect(new Set(classes).size).toBeGreaterThanOrEqual(5);
    expect(classes.filter((contentClass) => promptClasses.has(contentClass))).toHaveLength(21);
  });

  it("keeps the title distinct from the description", () => {
    for (const contentClass of planSystemCardClasses(70)) {
      const copy = buildSystemCardCopy({
        candidate: candidate("one", "proven"),
        forecast: FORECAST,
        contentClass,
      });
      expect(copy.description.toLowerCase()).not.toMatch(
        new RegExp(`^${escapeRegExp(copy.title.toLowerCase())}`),
      );
      expect(copy.title).not.toBe(copy.description);
      expect(copy.description).not.toMatch(/\b(?:I|me|my|we|our)\b/i);
    }
  });

  it("blocks exact repeats, 14-day near duplicates, and seven-day semantic claims", () => {
    const copy = buildSystemCardCopy({
      candidate: candidate("one", "proven"),
      forecast: FORECAST,
      contentClass: "forecast_summary",
    });
    const exact = {
      beachId: "one",
      contentClass: copy.contentClass,
      title: copy.title,
      description: copy.description,
      semanticClaim: copy.semanticClaim,
      createdAt: "2026-08-12T12:00:00.000Z",
    };

    expect(isSystemCardBlocked({ ...exact, createdAt: AS_OF.toISOString() }, [exact], AS_OF)).toBe(true);
    expect(isSystemCardBlocked({
      ...exact,
      title: copy.title,
      description: `${copy.description} Slightly different wording.`,
      semanticClaim: "different-claim",
      createdAt: AS_OF.toISOString(),
    }, [exact], AS_OF)).toBe(true);
    expect(isSystemCardBlocked({
      ...exact,
      title: "Another wording",
      description: "A materially different sentence",
      createdAt: AS_OF.toISOString(),
    }, [exact], AS_OF)).toBe(true);
  });

  it("keeps the simulated seven-day run under the daily and concentration caps", async () => {
    const candidates = [
      ...Array.from({ length: 7 }, (_, index) => candidate(`p${index}`, "proven")),
      ...Array.from({ length: 2 }, (_, index) => candidate(`a${index}`, "adjacent")),
      candidate("e0", "exploration"),
    ];
    let history: Array<{ beachId: string; contentClass: SystemCardClass; createdAt: string }> = [];
    const selectedByTier = new Map<string, number>();

    for (let day = 0; day < 7; day += 1) {
      const asOf = new Date(AS_OF.getTime() + day * 86400000);
      const result = await selectSystemCardCandidates({
        candidates,
        contentClasses: planSystemCardClasses(10, day * 10),
        history,
        asOf,
        sequenceOffset: day * 10,
        random: () => 0,
        selectSafeBeach: async (value) => value,
      });
      expect(result).toHaveLength(10);
      for (const card of result) {
        history.push({
          beachId: card.candidate.id,
          contentClass: card.contentClass,
          createdAt: asOf.toISOString(),
        });
        selectedByTier.set(
          card.candidate.allocationTier,
          (selectedByTier.get(card.candidate.allocationTier) ?? 0) + 1,
        );
      }
    }

    expect(selectedByTier).toEqual(new Map([
      ["proven", 49],
      ["adjacent", 14],
      ["exploration", 7],
    ]));
    expect(Math.max(...[...new Set(history.map((card) => card.beachId))].map(
      (beachId) => history.filter((card) => card.beachId === beachId).length,
    ))).toBeLessThanOrEqual(7);
    expect(Math.max(...history.filter((card) => card.createdAt === AS_OF.toISOString()).map(
      (card) => history.filter((other) => other.createdAt === card.createdAt && other.beachId === card.beachId).length,
    ))).toBeLessThanOrEqual(1);
  });

  it("never selects a held candidate when the safe selector rejects it", async () => {
    const result = await selectSystemCardCandidates({
      candidates: [candidate("held", "proven"), candidate("safe", "proven")],
      contentClasses: ["forecast_summary"],
      history: [],
      asOf: AS_OF,
      random: () => 0,
      selectSafeBeach: async (value) => value.id === "held" ? null : value,
    });

    expect(result.map(({ candidate: value }) => value.id)).toEqual(["safe"]);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
