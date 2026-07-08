/**
 * Hero-ranking scenario matrix — runs all 16 OB / PB / Crystal fixtures
 * through the real discovery scoring engine and asserts that `rerankHero`
 * lifts the expected hero to position 0.
 *
 * Coverage gate for Task 5: a passing run here is the acceptance signal
 * that the heroWindowScore re-rank produces the documented behavior across
 * the canonical / PB-wins / OB-despite-tide / personalization scenarios.
 */
import { rerankHero } from "@/lib/services/discovery/hero-ranking";

import { buildRecsFromFixture } from "./__fixtures__/build-recs";
import { scenarioMatrix } from "./__fixtures__/scenario-matrix";

// Freeze "now" at the fixture date so the windowSelector doesn't filter all
// forecasts as past times after UTC rolls over. Fixtures are scoped to
// 2026-05-01 (see scenario-matrix.ts dateBase). Without this, the suite
// silently flips red the moment the day rolls.
const FIXTURE_NOW = new Date("2026-05-01T08:00:00Z");

describe("hero-ranking scenario matrix", () => {
  beforeAll(() => {
    jest.useFakeTimers({
      doNotFake: ["nextTick", "setImmediate", "queueMicrotask"],
    });
    jest.setSystemTime(FIXTURE_NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });


  describe.each(scenarioMatrix.map((fx) => [fx.name, fx] as const))(
    "%s",
    (_name, fx) => {
      it(`hero=${fx.expectedHero}`, () => {
        const recs = buildRecsFromFixture(fx);
        expect(recs.length).toBeGreaterThan(0);
        const { reranked } = rerankHero(recs);
        expect(reranked[0]?.beach.slug).toBe(fx.expectedHero);
      });
    },
  );
});
