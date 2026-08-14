import { filterBeachesByWaterQualityHolds } from "@/supabase/functions/bluesky-auto-post/water-quality-filter";

describe("Bluesky water-quality beach filter", () => {
  it("removes held beaches before a social post can score or select them", () => {
    const beaches = [{ id: "held" }, { id: "safe" }];

    expect(
      filterBeachesByWaterQualityHolds(beaches, [{ beach_id: "HELD" }]),
    ).toEqual([{ id: "safe" }]);
  });

  it("fails closed for malformed hold data", () => {
    expect(
      filterBeachesByWaterQualityHolds([{ id: "safe" }], [{ id: "held" }]),
    ).toBeNull();
  });
});
