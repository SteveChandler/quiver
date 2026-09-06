/**
 * @jest-environment node
 */
import { interpolateSwellPartition, rowToSwellPartition } from "@/app/api/forecasts/bulk/swell-partition";

describe("rowToSwellPartition", () => {
  it("parses real-shaped live fields (ft + compass + mph) into numbers", () => {
    // Shapes confirmed by Task 2 live DB check: heights are "<n> ft", directions
    // are compass text, periods are "<n>s", wind_speed is "<n> mph",
    // wind_direction_deg is a numeric string.
    const p = rowToSwellPartition({
      swell_1_height: "2 ft",
      swell_1_period: "15s",
      swell_1_direction: "SSW",
      swell_2_height: "1 ft",
      swell_2_period: "9s",
      swell_2_direction: "WNW",
      wind_speed: "7 mph",
      wind_direction_deg: "104",
    });

    expect(p.s1Dir).toBe(202.5);
    expect(p.s1PeriodS).toBe(15);
    expect(p.s1HeightFt).toBe(2);
    expect(p.s2Dir).toBe(292.5);
    expect(p.s2PeriodS).toBe(9);
    expect(p.s2HeightFt).toBe(1);
    expect(p.windDir).toBe(104);
    expect(p.windMph).toBe(7);
    expect(p.s1HeightFt!).toBeGreaterThan(p.s2HeightFt!);
  });

  it("parses numeric direction strings as degrees", () => {
    const p = rowToSwellPartition({
      swell_1_direction: "270",
      swell_2_direction: "200",
      swell_direction_om: null,
      wave_direction_om: null,
      wind_direction_deg: 310,
    });
    expect(p.s1Dir).toBe(270);
    expect(p.s2Dir).toBe(200);
    expect(p.windDir).toBe(310);
  });

  it("sets Open-Meteo swell direction from swell_direction_om without changing s1Dir", () => {
    const p = rowToSwellPartition({
      swell_1_direction: "270",
      swell_direction_om: 215,
      wave_direction_om: 245,
    });

    expect(p.s1Dir).toBe(270);
    expect(p.swellDirOm).toBe(215);
  });

  it("falls back to wave_direction_om for Open-Meteo swell direction", () => {
    const p = rowToSwellPartition({
      swell_1_direction: "270",
      swell_direction_om: null,
      wave_direction_om: 245,
    });

    expect(p.s1Dir).toBe(270);
    expect(p.swellDirOm).toBe(245);
  });

  it("sets Open-Meteo swell direction to null when both OM fields are absent", () => {
    const p = rowToSwellPartition({
      swell_1_direction: "270",
      swell_direction_om: null,
      wave_direction_om: null,
    });

    expect(p.s1Dir).toBe(270);
    expect(p.swellDirOm).toBeNull();
  });

  it("returns nulls for missing/garbage fields without throwing", () => {
    const p = rowToSwellPartition({
      swell_1_height: null,
      swell_1_period: null,
      swell_1_direction: null,
      swell_direction_om: null,
      wave_direction_om: null,
      swell_2_height: "not-a-number",
      swell_2_period: undefined,
      swell_2_direction: "",
      wind_speed: null,
      wind_direction_deg: null,
    });
    expect(p.s1Dir).toBeNull();
    expect(p.s1PeriodS).toBeNull();
    expect(p.s1HeightFt).toBeNull();
    expect(p.s2HeightFt).toBeNull();
    expect(p.s2Dir).toBeNull();
    expect(p.windDir).toBeNull();
    expect(p.windMph).toBeNull();
  });
});

describe("map swell source consistency", () => {
  it("uses a complete offshore tuple for both the field and the selected reading", () => {
    const { mapSwellPartition } = require("@/app/api/forecasts/bulk/swell-partition");
    const { partitionToPoint } = require("@/components/map/swell-field/field-sampler");
    const { resolveCalloutComponents } = require("@/components/map/conditions-callout-data");
    const partition = { s1Dir: 292.5, s1HeightFt: 1.7, s1PeriodS: 18, swellDirOm: 182, swellHeightOmFt: 4, swellPeriodOmS: 12, s2Dir: null, s2HeightFt: null, s2PeriodS: null, windDir: null, windMph: null };
    expect(mapSwellPartition(partition)).toMatchObject({ s1Dir: 182, s1HeightFt: 4, s1PeriodS: 12 });
    expect(partitionToPoint(-117.25, 32.74, partition, "s1")).toMatchObject({ dir: 182, heightFt: 4, periodS: 12 });
    expect(resolveCalloutComponents(partition)[0]).toMatchObject({ bearingDeg: 182, label: "4ft, 12s" });
    expect(mapSwellPartition({ ...partition, swellPeriodOmS: null }).s1Dir).toBe(292.5);
    expect(partitionToPoint(-117.25, 32.74, { ...partition, swellPeriodOmS: null, s1PeriodS: null }, "s1")).toBeNull();
  });
});

it("does not interpolate an unavailable safety score into a positive pin color", () => {
  const from = { ...rowToSwellPartition({} as never), conditionScore: null };
  const to = { ...from, conditionScore: 80 };
  expect(interpolateSwellPartition(from, to, 0.5).conditionScore).toBeNull();
  expect(interpolateSwellPartition(to, from, 0.5).conditionScore).toBeNull();
});
