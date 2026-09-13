/** @jest-environment node */
import { createHash } from "node:crypto";
import { fetchOpenMeteoSingleRunReceipt } from "@/lib/alerts/swell-watch/single-run-receipt";

const input = { latitude: 32.8, longitude: -117.3, runUtc: "2026-09-13T06:00Z", forecastDays: 7 };
const fields = ["swell_wave_height", "swell_wave_period", "swell_wave_direction", "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"];
function fixture() {
  const time = Array.from({ length: 168 }, (_, i) => new Date(Date.parse(input.runUtc) + i * 3_600_000).toISOString().slice(0, 16));
  const hourly: Record<string, unknown[]> = { time }; const hourly_units: Record<string, string> = { time: "iso8601" };
  fields.forEach((field, i) => { hourly[field] = Array(168).fill([1.2, 12, 225, 0.6, 9, 170][i]); hourly_units[field] = ["m", "s", "°"][i % 3]; });
  return { latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0, hourly_units, hourly };
}
const parse = (body: ReturnType<typeof fixture>) => fetchOpenMeteoSingleRunReceipt(input, async () => ({ status: 200, text: async () => JSON.stringify(body) }));

it.each([0, 1])("normalizes only exact north in component %i with original evidence", async (slot) => {
  const body = fixture(); body.hourly[fields[slot * 3 + 2]][146] = 360;
  const raw = JSON.stringify(body); const result = await parse(body);
  const part = result.observations[146].components[slot];
  expect(part.directionDeg).toBe(0);
  expect(part.unavailableReason).toBeUndefined();
  expect(part.rawFieldProvenance.directionNormalization).toEqual({ rule: "north_360_to_0.v1", rawDegrees: 360, canonicalDegrees: 0 });
  expect(result.rawResponse).toBe(raw);
  expect(result.rawResponseSha256).toBe(createHash("sha256").update(raw).digest("hex"));
  expect(JSON.parse(result.canonicalSemanticPayload).hourly[fields[slot * 3 + 2]][146]).toBe(360);
  expect(result.revisionHash).toBe(createHash("sha256").update(result.canonicalSemanticPayload).digest("hex"));
  expect(result.qualification.status).toBe("prototype_unqualified");
});

it.each([0, 0.001, 90, 180, 359, 359.999999])("preserves valid direction %s without inventing normalization provenance", async (direction) => {
  const body = fixture(); body.hourly.swell_wave_direction[0] = direction;
  const part = (await parse(body)).observations[0].components[0];
  expect(part.directionDeg).toBe(direction);
  expect(part.rawFieldProvenance).toEqual({ height: "swell_wave_height", period: "swell_wave_period", direction: "swell_wave_direction" });
});

it.each([-1, -0.001, 360.000001, 361, 720, "360", null, true, {}, [], NaN, Infinity, -Infinity])("does not wrap, coerce, or accept invalid direction %p", async (direction) => {
  const body = fixture(); body.hourly.swell_wave_direction[146] = direction;
  await expect(parse(body)).rejects.toThrow("Single Runs tuple is invalid");
});

it.each([[0, 0, 360], [1, 0, 360], [-1, 12, 360], [1, -1, 360], [1, null, 360]])("does not turn invalid tuple %p into a valid or unavailable swell", async (height, period, direction) => {
  const body = fixture(); [height, period, direction].forEach((value, i) => { body.hourly[fields[i]][0] = value; });
  await expect(parse(body)).rejects.toThrow("Single Runs tuple is invalid");
});

it("retains raw all-zero missingness without normalization", async () => {
  const body = fixture(); fields.slice(3).forEach((field) => { body.hourly[field][0] = 0; });
  const part = (await parse(body)).observations[0].components[1];
  expect(part).toMatchObject({ heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
  expect(part.rawFieldProvenance.directionNormalization).toBeUndefined();
});
