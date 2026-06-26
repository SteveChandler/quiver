import {
  HOW_THE_CALL_WORKS_FACTORS,
  MAP_FIELD_GUIDE_FACTORS,
} from "@/lib/surf/how-the-call-works";

describe("how-the-call-works teaching model", () => {
  it("keeps the ordered factors Quiver weighs", () => {
    expect(HOW_THE_CALL_WORKS_FACTORS.map((factor) => factor.id)).toEqual([
      "buoy",
      "wind",
      "tide",
      "terrain",
      "skill",
      "verdict",
    ]);

    for (const factor of HOW_THE_CALL_WORKS_FACTORS) {
      expect(factor.explainerLabel.length).toBeGreaterThan(0);
      expect(factor.description.length).toBeGreaterThan(0);
    }
  });

  it("keeps the map field guide sourced from buoy wind and tide factors", () => {
    expect(MAP_FIELD_GUIDE_FACTORS.map((factor) => factor.id)).toEqual([
      "buoy",
      "wind",
      "tide",
    ]);
    expect(MAP_FIELD_GUIDE_FACTORS[0]?.mapLearning.headline).toBe(
      "Start with the buoy before trusting the spot number."
    );
    expect(MAP_FIELD_GUIDE_FACTORS[1]?.mapLearning.call).toBe(
      "Upgrade light offshore mornings. Downgrade afternoon onshore flow unless the spot has cliffs, kelp, or angle protection."
    );
    expect(MAP_FIELD_GUIDE_FACTORS[2]?.mapLearning.metrics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Window",
          value: "Dawn",
          helper: "Pair the tide change with the cleanest wind.",
        }),
      ])
    );
  });
});
