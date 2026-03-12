import {
  getCDIPDataForTime,
  getWaveDataForTime,
  getWeatherDataForTime,
} from "@/lib/services/forecast/temporal-interpolator";

describe("getCDIPDataForTime", () => {
  const now = new Date();
  const recentTimestamp = new Date(now.getTime() - 30 * 60 * 1000); // 30 min ago

  const mockCdipData = {
    stationId: "100",
    stationName: "Test Station",
    lastUpdated: recentTimestamp.toISOString(),
    dataSource: "CDIP" as const,
    data: [
      {
        timestamp: recentTimestamp.toISOString(),
        significantWaveHeight: 1.5,
        peakWavePeriod: 12,
        peakWaveDirection: 270,
        swellHeight: 1.2,
        swellPeriod: 14,
        swellDirection: 265,
      },
    ],
  };

  it("returns null for null cdipData", () => {
    expect(getCDIPDataForTime(null, now)).toBeNull();
  });

  it("returns null for empty data array", () => {
    expect(getCDIPDataForTime({ ...mockCdipData, data: [] }, now)).toBeNull();
  });

  it("returns most recent data for current time", () => {
    const result = getCDIPDataForTime(mockCdipData as any, now);
    expect(result).not.toBeNull();
    expect(result?.significantWaveHeight).toBe(1.5);
  });

  it("returns null for times more than 1 hour in the future", () => {
    const futureTime = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const result = getCDIPDataForTime(mockCdipData as any, futureTime);
    expect(result).toBeNull();
  });

  it("returns data for times within 1 hour", () => {
    const nearFuture = new Date(now.getTime() + 30 * 60 * 1000); // 30 min
    const result = getCDIPDataForTime(mockCdipData as any, nearFuture);
    expect(result).not.toBeNull();
  });
});

describe("getWaveDataForTime", () => {
  const now = new Date();

  const mockWaveData = {
    forecast: [
      { timestamp: new Date(now.getTime() - 3600000).toISOString(), significant_wave_height: 1.0 },
      { timestamp: now.toISOString(), significant_wave_height: 1.5 },
      { timestamp: new Date(now.getTime() + 3600000).toISOString(), significant_wave_height: 2.0 },
    ],
  };

  it("returns null for null waveData", () => {
    expect(getWaveDataForTime(null, now)).toBeNull();
  });

  it("returns null for missing forecast array", () => {
    expect(getWaveDataForTime({}, now)).toBeNull();
  });

  it("returns closest wave point to target time", () => {
    const result = getWaveDataForTime(mockWaveData, now);
    expect(result?.significant_wave_height).toBe(1.5);
  });

  it("finds correct point for past time", () => {
    const pastTime = new Date(now.getTime() - 3000000); // 50 min ago
    const result = getWaveDataForTime(mockWaveData, pastTime);
    expect(result?.significant_wave_height).toBe(1.0);
  });
});

describe("getWeatherDataForTime", () => {
  const now = new Date();

  const mockWeatherData = [
    { startTime: new Date(now.getTime() - 3600000).toISOString(), temperature: 65 },
    { startTime: now.toISOString(), temperature: 70 },
    { startTime: new Date(now.getTime() + 3600000).toISOString(), temperature: 72 },
  ];

  it("returns null for null weatherData", () => {
    expect(getWeatherDataForTime(null as any, now)).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(getWeatherDataForTime([], now)).toBeNull();
  });

  it("returns closest weather point to target time", () => {
    const result = getWeatherDataForTime(mockWeatherData, now);
    expect(result?.temperature).toBe(70);
  });
});
