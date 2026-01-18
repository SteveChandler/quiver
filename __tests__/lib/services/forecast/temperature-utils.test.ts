import {
  estimateWaterTemperature,
  estimateAirTemperature,
} from "@/lib/services/forecast/temperature-utils";

describe("estimateWaterTemperature", () => {
  it("returns temperature string with °F suffix", () => {
    const result = estimateWaterTemperature(32.7, new Date("2024-07-15"));
    expect(result).toMatch(/^\d+°F$/);
  });

  it("is warmer in summer months", () => {
    const summer = estimateWaterTemperature(32.7, new Date("2024-07-15"));
    const winter = estimateWaterTemperature(32.7, new Date("2024-01-15"));
    const summerTemp = parseInt(summer);
    const winterTemp = parseInt(winter);
    expect(summerTemp).toBeGreaterThan(winterTemp);
  });

  it("uses 65°F as base for California coast", () => {
    // Spring equinox should be close to base
    const spring = estimateWaterTemperature(32.7, new Date("2024-03-21"));
    const temp = parseInt(spring);
    expect(temp).toBeGreaterThanOrEqual(60);
    expect(temp).toBeLessThanOrEqual(70);
  });
});

describe("estimateAirTemperature", () => {
  it("returns temperature string with °F suffix", () => {
    const result = estimateAirTemperature(32.7, new Date("2024-07-15"));
    expect(result).toMatch(/^\d+°F$/);
  });

  it("is warmer in summer months", () => {
    const summer = estimateAirTemperature(32.7, new Date("2024-07-15"));
    const winter = estimateAirTemperature(32.7, new Date("2024-01-15"));
    const summerTemp = parseInt(summer);
    const winterTemp = parseInt(winter);
    expect(summerTemp).toBeGreaterThan(winterTemp);
  });

  it("air temperature is generally warmer than water", () => {
    const date = new Date("2024-07-15");
    const airTemp = parseInt(estimateAirTemperature(32.7, date));
    const waterTemp = parseInt(estimateWaterTemperature(32.7, date));
    expect(airTemp).toBeGreaterThanOrEqual(waterTemp);
  });
});
