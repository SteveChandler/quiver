import { validateForecastValues } from "@/lib/services/forecast/forecast-validator";
import {
  estimateWaterTemperature,
  estimateAirTemperature,
} from "@/lib/services/forecast/temperature-utils";
import {
  formatPeriodSeconds,
  formatWaveFeet,
  formatFeet,
  metersToFeetString,
  extractWindSpeed,
} from "@/lib/formatters/surf-data";

describe("validateForecastValues", () => {
  const baseForecast = {
    wave_height: "3.5 ft",
    wave_period: "12s",
    swell_1_period: "14s",
  };

  it("returns valid for typical San Diego conditions", () => {
    const result = validateForecastValues(baseForecast as any);
    expect(result.isValid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("flags unusually large waves over 8ft", () => {
    const forecast = { ...baseForecast, wave_height: "10 ft" };
    const result = validateForecastValues(forecast as any);
    expect(result.isValid).toBe(false);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Unusually large waves")])
    );
  });

  it("warns about unusually small waves under 0.5ft", () => {
    const forecast = { ...baseForecast, wave_height: "0.3 ft" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Unusually small waves")])
    );
  });

  it("warns about very short wave periods under 6s", () => {
    const forecast = { ...baseForecast, wave_period: "5s" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Very short wave period")])
    );
  });

  it("warns about short swell periods under 8s", () => {
    const forecast = { ...baseForecast, swell_1_period: "7s" };
    const result = validateForecastValues(forecast as any);
    expect(result.warnings).toEqual(
      expect.arrayContaining([expect.stringContaining("Short swell period")])
    );
  });

  it("handles null/missing values gracefully", () => {
    const forecast = { wave_height: null, wave_period: null, swell_1_period: null };
    const result = validateForecastValues(forecast as any);
    expect(result.isValid).toBe(true);
  });
});

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

describe("formatPeriodSeconds", () => {
  it("returns null for null input", () => {
    expect(formatPeriodSeconds(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(formatPeriodSeconds(undefined)).toBeNull();
  });

  it("formats valid number with s suffix", () => {
    // formatPeriodSeconds delegates to formatSwellPeriod which rounds: round(12.5)=13
    expect(formatPeriodSeconds(12.5)).toBe("13s");
  });

  it("parses string input", () => {
    // formatSwellPeriod rounds: round(14.2)=14
    expect(formatPeriodSeconds("14.2")).toBe("14s");
  });

  it("rejects periods below 4s as invalid", () => {
    expect(formatPeriodSeconds(3.5)).toBeNull();
  });

  it("rejects periods above 25s as invalid", () => {
    expect(formatPeriodSeconds(26)).toBeNull();
  });

  it("returns null for non-finite values", () => {
    expect(formatPeriodSeconds(Infinity)).toBeNull();
    expect(formatPeriodSeconds(NaN)).toBeNull();
  });
});

describe("formatWaveFeet", () => {
  it("returns null for null input", () => {
    expect(formatWaveFeet(null)).toBeNull();
  });

  it("converts meters to feet with ft suffix", () => {
    expect(formatWaveFeet(1)).toBe("3.3 ft");
  });

  it("rejects negative values", () => {
    expect(formatWaveFeet(-1)).toBeNull();
  });

  it("rejects values over 10 meters as sensor glitch", () => {
    expect(formatWaveFeet(11)).toBeNull();
  });
});

describe("formatFeet", () => {
  it("returns null for null input", () => {
    expect(formatFeet(null)).toBeNull();
  });

  it("formats feet value with ft suffix", () => {
    expect(formatFeet(4.5)).toBe("4.5 ft");
  });

  it("rejects negative values", () => {
    expect(formatFeet(-1)).toBeNull();
  });
});

describe("metersToFeetString", () => {
  it("converts meters to feet string", () => {
    expect(metersToFeetString(1)).toBe("3.3 ft");
  });

  it("handles sub-foot values with decimal", () => {
    expect(metersToFeetString(0.2)).toBe("0.7 ft");
  });
});

describe("extractWindSpeed", () => {
  it("extracts number from wind speed string", () => {
    expect(extractWindSpeed("15 mph")).toBe("15 mph");
  });

  it("returns default for empty string", () => {
    expect(extractWindSpeed("")).toBe("10 mph");
  });

  it("returns default for null input", () => {
    expect(extractWindSpeed(null as any)).toBe("10 mph");
  });
});
