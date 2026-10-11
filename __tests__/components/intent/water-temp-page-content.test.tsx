import { getWaterTempSourceDescription } from "@/components/intent/water-temp-page-content";

describe("water temperature source copy", () => {
  it.each([
    ["ndbc", "Water temperature refreshed hourly from a NOAA buoy reading."],
    ["ioos", "Water temperature refreshed hourly from an observed station reading."],
    ["coops", "Water temperature refreshed hourly from an observed station reading."],
    ["latitude", "Water temperature refreshed hourly from a latitude-based estimate."],
    [null, "Water temperature refreshed hourly; reading source unavailable."],
  ] as const)("describes %s accurately", (source, expected) => {
    expect(getWaterTempSourceDescription(source)).toBe(expected);
  });
});
