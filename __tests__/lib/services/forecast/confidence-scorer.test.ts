import {
  calculateConfidenceScore,
  confidenceToDecimal,
  decimalToConfidence,
  calculateConfidenceFromForecastRow,
} from "@/lib/services/forecast/confidence-scorer";

describe("forecast confidence-scorer", () => {
  test("adds correct data-source bonuses (CDIP supersedes wave model)", () => {
    const cdip = calculateConfidenceScore({
      hasWaveData: true,
      hasTideData: true,
      hasWeatherData: true,
      hasBuoyData: true,
      hasCDIPData: true,
      forecastHoursAhead: 0,
    });

    // Base 50 + CDIP 25 + tide 15 + weather 10 + buoy 15 = 115 -> clamped to 100
    expect(cdip).toBe(100);

    const waveModel = calculateConfidenceScore({
      hasWaveData: true,
      hasTideData: true,
      hasWeatherData: true,
      hasBuoyData: true,
      hasCDIPData: false,
      forecastHoursAhead: 0,
    });

    // Base 50 + wave 20 + tide 15 + weather 10 + buoy 15 = 110 -> clamped to 100
    expect(waveModel).toBe(100);
  });

  test("applies CDIP time penalty curve: 0.3/hr capped at 20", () => {
    const score = calculateConfidenceScore({
      hasWaveData: true,
      hasTideData: false,
      hasWeatherData: false,
      hasBuoyData: false,
      hasCDIPData: true,
      forecastHoursAhead: 100,
    });

    // Base 50 + CDIP 25 = 75; penalty min(20, 100*0.3=30) => 20; 75-20=55
    expect(score).toBe(55);
  });

  test("applies non-CDIP time penalty curve: 0.5/hr capped at 30", () => {
    const score = calculateConfidenceScore({
      hasWaveData: true,
      hasTideData: false,
      hasWeatherData: false,
      hasBuoyData: false,
      hasCDIPData: false,
      forecastHoursAhead: 100,
    });

    // Base 50 + wave 20 = 70; penalty min(30, 100*0.5=50) => 30; 70-30=40
    expect(score).toBe(40);
  });

  test("rounds to an integer and clamps to 0-100", () => {
    const score = calculateConfidenceScore({
      hasWaveData: false,
      hasTideData: false,
      hasWeatherData: false,
      hasBuoyData: false,
      hasCDIPData: false,
      forecastHoursAhead: 7,
    });

    expect(Number.isInteger(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe("scale conversion utilities", () => {
  describe("confidenceToDecimal", () => {
    test("converts 0-100 scale to 0-1 scale", () => {
      expect(confidenceToDecimal(75)).toBe(0.75);
      expect(confidenceToDecimal(100)).toBe(1);
      expect(confidenceToDecimal(0)).toBe(0);
      expect(confidenceToDecimal(50)).toBe(0.5);
    });

    test("clamps values outside 0-100 range", () => {
      expect(confidenceToDecimal(150)).toBe(1);
      expect(confidenceToDecimal(-50)).toBe(0);
    });
  });

  describe("decimalToConfidence", () => {
    test("converts 0-1 scale to 0-100 scale", () => {
      expect(decimalToConfidence(0.75)).toBe(75);
      expect(decimalToConfidence(1)).toBe(100);
      expect(decimalToConfidence(0)).toBe(0);
      expect(decimalToConfidence(0.5)).toBe(50);
    });

    test("rounds to integer", () => {
      expect(decimalToConfidence(0.333)).toBe(33);
      expect(decimalToConfidence(0.666)).toBe(67);
    });

    test("clamps values outside 0-1 range", () => {
      expect(decimalToConfidence(1.5)).toBe(100);
      expect(decimalToConfidence(-0.5)).toBe(0);
    });
  });
});

describe("calculateConfidenceFromForecastRow", () => {
  test("calculates high confidence for CDIP data in near future", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = calculateConfidenceFromForecastRow({
      data_source: "CDIP",
      forecast_date: tomorrow.toISOString().split("T")[0],
      forecast_time: "12:00:00",
      wave_height: 3.5,
      tide_height: 2.1,
      wind_speed: 8,
    });

    // CDIP data with tide/weather should score high
    expect(result).toBeGreaterThan(80);
  });

  test("calculates lower confidence for NOAA data far in future", () => {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const result = calculateConfidenceFromForecastRow({
      data_source: "NOAA_NWS",
      forecast_date: nextWeek.toISOString().split("T")[0],
      forecast_time: "12:00:00",
    });

    // Non-CDIP data 7 days out should score lower due to time penalty
    expect(result).toBeLessThan(70);
  });

  test("treats historical forecasts as hoursAhead=0", () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const result = calculateConfidenceFromForecastRow({
      data_source: "CDIP",
      forecast_date: yesterday.toISOString().split("T")[0],
      forecast_time: "12:00:00",
      wave_height: 3.0,
    });

    // Historical forecasts should not have negative time penalty
    // Base 50 + CDIP 25 + buoy 15 (CDIP=buoy) = 90 (no tide/weather without actual data)
    expect(result).toBe(90);
  });

  test("handles null data_source as non-CDIP", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = calculateConfidenceFromForecastRow({
      data_source: null,
      forecast_date: tomorrow.toISOString().split("T")[0],
      forecast_time: "12:00:00",
    });

    // Null source should use wave model scoring, not CDIP
    // Won't have the +25 CDIP bonus
    expect(result).toBeLessThan(100);
  });

  test("handles completely null data fields conservatively", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = calculateConfidenceFromForecastRow({
      data_source: null,
      forecast_date: tomorrow.toISOString().split("T")[0],
      forecast_time: "12:00:00",
      wave_height: null,
      tide_height: null,
      wind_speed: null,
    });

    // Base 50 only, no data bonuses, with time penalty
    // Should be lower than a forecast with actual data
    expect(result).toBeGreaterThanOrEqual(0);
    expect(result).toBeLessThanOrEqual(100);
    expect(result).toBeLessThan(60); // Conservative score with no data
  });

  test("handles far future forecasts with maximum time penalty", () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 30);

    const result = calculateConfidenceFromForecastRow({
      data_source: "NOAA_NWS",
      forecast_date: farFuture.toISOString().split("T")[0],
      forecast_time: "12:00:00",
      wave_height: 4.0,
      tide_height: 3.0,
      wind_speed: 10,
    });

    // 30 days = ~720 hours ahead
    // Base 50 + wave 20 + tide 15 + weather 10 = 95
    // Time penalty: min(30, 720*0.5) = 30 (capped)
    // Result: 95 - 30 = 65
    expect(result).toBeLessThanOrEqual(70);
    expect(result).toBeGreaterThanOrEqual(50);
  });

  test("provides full credit when all data fields present", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const result = calculateConfidenceFromForecastRow({
      data_source: "CDIP",
      forecast_date: tomorrow.toISOString().split("T")[0],
      forecast_time: "12:00:00",
      wave_height: 3.5,
      tide_height: 2.1,
      wind_speed: 8,
    });

    // Base 50 + CDIP 25 + tide 15 + weather 10 = 100 (before time penalty)
    // With ~24 hours ahead: penalty = 24 * 0.3 = 7.2 → 93
    expect(result).toBeGreaterThan(85);
    expect(result).toBeLessThanOrEqual(100);
  });

  test("returns valid score range for any input", () => {
    // Test edge case: very old date
    const veryOld = calculateConfidenceFromForecastRow({
      data_source: "CDIP",
      forecast_at: "2020-01-01T00:00:00Z",
      forecast_date: "2020-01-01",
      forecast_time: "00:00:00",
    });
    expect(veryOld).toBeGreaterThanOrEqual(0);
    expect(veryOld).toBeLessThanOrEqual(100);

    // Test edge case: very far future
    const veryFar = calculateConfidenceFromForecastRow({
      data_source: "CDIP",
      forecast_at: "2099-12-31T23:59:59Z",
      forecast_date: "2099-12-31",
      forecast_time: "23:59:59",
    });
    expect(veryFar).toBeGreaterThanOrEqual(0);
    expect(veryFar).toBeLessThanOrEqual(100);
  });
});
