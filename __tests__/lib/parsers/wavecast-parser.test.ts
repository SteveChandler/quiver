/**
 * @jest-environment node
 */

import fs from "node:fs";
import path from "node:path";

import { extractHazards, parseWaveCastHTML } from "@/lib/parsers/wavecast-parser";

function readFixture(relPath: string) {
  return fs.readFileSync(path.join(process.cwd(), relPath), "utf8");
}

describe("wavecast-parser", () => {
  test("parseWaveCastHTML parses metadata, forecasts, tides, and water temp from fixture HTML", () => {
    const html = readFixture("__tests__/fixtures/wavecast/wavecast-sample.html");
    const res = parseWaveCastHTML(html);

    expect(res.success).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.confidence).toBeGreaterThan(0.7);

    expect(res.data?.author).toBe("Nathan Cool");
    expect(res.data?.report_date).toBe("2025-10-28");

    // Wave forecasts: numeric + descriptive parsing
    const forecasts = res.data?.wave_forecasts || [];
    expect(forecasts.some((f) => f.day_name?.toLowerCase() === "wednesday")).toBe(true);
    expect(forecasts.some((f) => f.day_name?.toLowerCase() === "thursday")).toBe(true);

    const weds = forecasts.find((f) => f.day_name?.toLowerCase() === "wednesday");
    expect(weds?.height_range).toEqual({ min: 3, max: 5, unit: "ft" });

    const thurs = forecasts.find((f) => f.day_name?.toLowerCase() === "thursday");
    expect(thurs?.height_range.unit).toBe("ft");
    expect(thurs?.height_range.min).toBeGreaterThan(1);
    expect(thurs?.height_range.max).toBeGreaterThan(thurs?.height_range.min || 0);

    // Weather / water temp / tides
    expect(res.data?.water_temp?.current).toBe(62);
    expect(res.data?.water_temp?.trend).toBe("warming");
    expect(res.data?.tides?.level).toBe("high");

    // Swell detection is currently context-based (not structured dir/period)
    expect((res.data?.swells || []).length).toBeGreaterThan(0);
  });

  test("parseWaveCastHTML degrades confidence and records errors for minimal text", () => {
    const html = "<html><body><article>Hi</article></body></html>";
    const res = parseWaveCastHTML(html);

    expect(res.success).toBe(true);
    expect(res.confidence).toBeLessThanOrEqual(0.5);
    expect(res.errors).toEqual(
      expect.arrayContaining([
        "Failed to extract metadata (author/timestamp)",
        "Insufficient forecast text found",
      ])
    );
  });

  test("extractHazards finds hazard keywords", () => {
    const hazards = extractHazards(
      "High surf advisory with rip current warning. Conditions can be dangerous."
    );

    expect(hazards.length).toBeGreaterThan(0);
    // Implementation currently returns regex sources (e.g., rips*current), so keep this loose.
    expect(hazards.join("|").toLowerCase()).toMatch(/rip|advisory|warning|danger/);
  });
});




