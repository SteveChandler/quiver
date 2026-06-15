import type { WaveHeightSourceTag } from "@/lib/utils/wave-height-source";

describe("WaveHeightSourceTag", () => {
  it("covers the supported wave height source tags", () => {
    const sourceTags: Record<WaveHeightSourceTag, true> = {
      cdip_sig: true,
      model_swell: true,
      cdip_swell: true,
      model_hs: true,
      ndbc_buoy: true,
      nowcast_anchor: true,
    };

    expect(Object.keys(sourceTags).sort()).toEqual([
      "cdip_sig",
      "cdip_swell",
      "model_hs",
      "model_swell",
      "ndbc_buoy",
      "nowcast_anchor",
    ]);
  });
});
