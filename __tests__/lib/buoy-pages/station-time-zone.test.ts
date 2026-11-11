/** @jest-environment node */
import { stationTimeZone } from "@/lib/buoy-pages/station-page-data";

describe("station time zone", () => {
  it("uses the country's clock where an offshore position resolves to a nautical zone", () => {
    // Valencia buoy and K1 resolve to Etc/GMT and Etc/GMT+1.
    expect(stationTimeZone({ lat: 39.5198, lon: 0.1993, country_code: "ES" })).toBe("Europe/Madrid");
    expect(stationTimeZone({ lat: 48.701, lon: -12.401, country_code: "GB" })).toBe("Europe/London");
    // Coastal positions keep their own zone (Canary Islands, Martinique).
    expect(stationTimeZone({ lat: 28.0, lon: -15.8, country_code: "ES" })).toBe("Atlantic/Canary");
    expect(stationTimeZone({ lat: 14.5481, lon: -61.0969, country_code: "MQ" })).toBe("America/Martinique");
    // Other countries keep the nautical zone.
    expect(stationTimeZone({ lat: 30, lon: -60, country_code: null })).toMatch(/^Etc\//);
  });
});
