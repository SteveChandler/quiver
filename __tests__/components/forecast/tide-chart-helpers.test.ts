import {
  isExtremaOnly,
  parseForecastDateTime,
  synthesizeFromExtrema,
  type InternalPoint,
} from "@/components/forecast/tide-chart/tide-chart-helpers";

// --- Helper to build InternalPoint fixtures ---
const pt = (
  h: number,
  timestampMs: number,
  flags?: { isHigh?: boolean; isLow?: boolean }
): InternalPoint => ({
  t: new Date(timestampMs),
  h,
  timestamp: timestampMs,
  ...flags,
});

const HOUR = 60 * 60 * 1000;
const BASE = Date.UTC(2026, 1, 6, 0, 0, 0); // 2026-02-06T00:00Z

describe("isExtremaOnly", () => {
  it("returns true when every point has isHigh or isLow set to true", () => {
    const points: InternalPoint[] = [
      pt(5.2, BASE, { isHigh: true }),
      pt(-0.3, BASE + 6 * HOUR, { isLow: true }),
      pt(4.8, BASE + 12 * HOUR, { isHigh: true }),
    ];
    expect(isExtremaOnly(points)).toBe(true);
  });

  it("returns false for dense hourly data (no flags)", () => {
    const points: InternalPoint[] = Array.from({ length: 24 }, (_, i) =>
      pt(Math.sin(i / 4) * 3, BASE + i * HOUR)
    );
    expect(isExtremaOnly(points)).toBe(false);
  });

  it("returns false for a single point", () => {
    expect(isExtremaOnly([pt(5.2, BASE, { isHigh: true })])).toBe(false);
  });

  it("returns false for an empty array", () => {
    expect(isExtremaOnly([])).toBe(false);
  });

  it("returns false for mixed flagged/unflagged data", () => {
    const points: InternalPoint[] = [
      pt(5.2, BASE, { isHigh: true }),
      pt(3.0, BASE + 3 * HOUR), // no flags
      pt(-0.3, BASE + 6 * HOUR, { isLow: true }),
    ];
    expect(isExtremaOnly(points)).toBe(false);
  });

  it("returns false when flags are explicitly false/undefined", () => {
    const points: InternalPoint[] = [
      pt(5.2, BASE, { isHigh: false, isLow: false }),
      pt(-0.3, BASE + 6 * HOUR, { isHigh: false, isLow: false }),
    ];
    expect(isExtremaOnly(points)).toBe(false);
  });
});

describe("extrema-only directData synthesis", () => {
  it("produces more points after synthesis than original extrema count", () => {
    const extrema: InternalPoint[] = [
      pt(5.2, BASE, { isHigh: true }),
      pt(-0.3, BASE + 6 * HOUR, { isLow: true }),
      pt(4.8, BASE + 12 * HOUR, { isHigh: true }),
    ];

    expect(isExtremaOnly(extrema)).toBe(true);

    const synthesized = synthesizeFromExtrema(extrema);
    // 12 hours at 1-hour granularity should produce ~13 points (including endpoints)
    expect(synthesized.length).toBeGreaterThan(extrema.length);
    // Verify cosine interpolation produces smooth curve — midpoint between
    // high (5.2) and low (-0.3) should be near their average (~2.45)
    const midTs = BASE + 3 * HOUR;
    const midPt = synthesized.find((p) => p.timestamp === midTs);
    expect(midPt).toBeDefined();
    expect(midPt!.h).toBeCloseTo((5.2 + -0.3) / 2, 0);
  });

  it("does not synthesize dense hourly data (guard returns false, data unchanged)", () => {
    const dense: InternalPoint[] = Array.from({ length: 24 }, (_, i) =>
      pt(Math.sin(i / 4) * 3, BASE + i * HOUR)
    );

    expect(isExtremaOnly(dense)).toBe(false);

    // Verify the full conditional: when isExtremaOnly is false, data passes through.
    // Simulate the rawLine branch logic:
    const result = isExtremaOnly(dense) ? synthesizeFromExtrema(dense) : dense;
    expect(result).toBe(dense); // same reference — no synthesis occurred
    expect(result).toHaveLength(24);
  });
});

describe("parseForecastDateTime with forecast_at", () => {
  it("parses forecast_at ISO string directly when called with one argument", () => {
    const result = parseForecastDateTime("2026-02-14T14:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(new Date("2026-02-14T14:00:00Z").getTime());
  });

  it("parses forecast_at ISO string with timezone offset", () => {
    const result = parseForecastDateTime("2026-02-14T06:00:00-08:00");
    expect(result).toBeInstanceOf(Date);
    expect(result!.getTime()).toBe(
      new Date("2026-02-14T06:00:00-08:00").getTime()
    );
  });

  it("still works with two arguments (legacy)", () => {
    const result = parseForecastDateTime("2026-02-14", "14:00:00");
    expect(result).toBeInstanceOf(Date);
    // Should be a valid date
    expect(isNaN(result!.getTime())).toBe(false);
  });

  it("returns undefined for empty string with no time argument", () => {
    const result = parseForecastDateTime("");
    expect(result).toBeUndefined();
  });
});
