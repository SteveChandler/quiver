import { classifyWaveHeight } from "@/components/learn/figures/wave-height-classification";

describe("classifyWaveHeight", () => {
  it("converts significant height into face-height and Hawaiian ranges", () => {
    expect(classifyWaveHeight(3)).toMatchObject({
      significantHeightFt: 3,
      faceHeightMinFt: 4.5,
      faceHeightMaxFt: 6,
      hawaiianHeightMinFt: 2.25,
      hawaiianHeightMaxFt: 3,
    });
  });

  it("clamps the visual scale to the supported 0.5–8 foot range", () => {
    expect(classifyWaveHeight(0).significantHeightFt).toBe(0.5);
    expect(classifyWaveHeight(12).significantHeightFt).toBe(8);
    expect(classifyWaveHeight(0).t).toBe(0);
    expect(classifyWaveHeight(12).t).toBe(1);
  });
});
