import { calculateConfidenceScore } from "@/lib/services/forecast/confidence-scorer";

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


