import { swellFieldLayerIds, swellFieldLayerOrder } from "../swell-field/layer-plan";

describe("swell field layer plan", () => {
  const particles = ["quiver-swell-field-s1", "quiver-swell-field-s2"];

  it("puts the dark-stage dim layer before particles and tears down every layer", () => {
    const darkOrder = swellFieldLayerOrder("quiver-swell-field", particles, "dark");
    expect(darkOrder).toEqual([
      "quiver-swell-field-stage-dim",
      "quiver-swell-field",
      ...particles,
    ]);
    expect(swellFieldLayerIds("quiver-swell-field", particles)).toEqual(darkOrder);
  });

  it("omits the dim layer on the light stage", () => {
    expect(swellFieldLayerOrder("quiver-swell-field", particles, "light")).toEqual([
      "quiver-swell-field",
      ...particles,
    ]);
  });
});
