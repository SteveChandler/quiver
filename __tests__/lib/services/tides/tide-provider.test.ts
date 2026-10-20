import {
  getTideProviderForCountry,
  hasNoaaTideCoverage,
} from "@/lib/services/tides/tide-provider";

describe("tide provider by country", () => {
  it("keeps US, legacy omitted-country and Mexico beaches on NOAA CO-OPS", () => {
    expect(getTideProviderForCountry("USA")).toBe("noaa_coops");
    expect(getTideProviderForCountry(undefined)).toBe("noaa_coops");
    expect(getTideProviderForCountry(null)).toBe("noaa_coops");
    expect(getTideProviderForCountry("")).toBe("noaa_coops");
    // Baja Norte reads San Diego by design and Baja Sur carries FES2022 constants.
    expect(getTideProviderForCountry("Mexico")).toBe("noaa_coops");
  });

  it("has no provider for Canada until an explicit CHS binding exists (#717)", () => {
    expect(getTideProviderForCountry("Canada")).toBe("unavailable");
    expect(getTideProviderForCountry(" canada ")).toBe("unavailable");
    expect(getTideProviderForCountry("CA")).toBe("unavailable");
    expect(hasNoaaTideCoverage({ country: "Canada" })).toBe(false);
  });

  it("treats a beach row without a country field as US", () => {
    expect(hasNoaaTideCoverage({})).toBe(true);
    expect(hasNoaaTideCoverage({ country: "USA" })).toBe(true);
  });
});
