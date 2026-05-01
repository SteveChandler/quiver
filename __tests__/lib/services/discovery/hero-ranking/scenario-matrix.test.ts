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

describe("hero-ranking scenario matrix", () => {
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
