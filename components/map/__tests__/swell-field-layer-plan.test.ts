import { swellFieldLayerIds } from "../swell-field/layer-plan";

describe("swell field layer plan", () => {
  const particles = ["quiver-swell-field-s1", "quiver-swell-field-s2"];

  it("puts the dark-stage dim layer before particles and tears down every layer", () => {
    expect(swellFieldLayerIds("quiver-swell-field", particles)).toEqual([
      "quiver-swell-field-stage-dim",
      "quiver-swell-field",
      ...particles,
    ]);
  });
});
