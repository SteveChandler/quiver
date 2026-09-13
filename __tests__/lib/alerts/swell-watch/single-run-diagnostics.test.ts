/** @jest-environment node */
import { createHash } from "node:crypto";
import { fetchOpenMeteoSingleRunReceipt, getSingleRunTupleDiagnostic } from "@/lib/alerts/swell-watch/single-run-receipt";

const source = "f11ccd59-b778-4ea1-a8ff-88bffb447cd8";
const input = { latitude: 32.8, longitude: -117.3, runUtc: "2026-09-13T06:00Z", forecastDays: 7 };
const fields = ["swell_wave_height", "swell_wave_period", "swell_wave_direction", "secondary_swell_wave_height", "secondary_swell_wave_period", "secondary_swell_wave_direction"];
function fixture() {
  const time = Array.from({ length: 168 }, (_, i) => new Date(Date.parse(input.runUtc) + i * 3_600_000).toISOString().slice(0, 16));
  const hourly: Record<string, unknown[]> = { time };
  const hourly_units: Record<string, string> = { time: "iso8601" };
  fields.forEach((field, i) => { hourly[field] = Array(168).fill([1.2, 12, 225, 0.6, 9, 170][i]); hourly_units[field] = ["m", "s", "°"][i % 3]; });
  return { latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0,
    timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0, hourly_units, hourly };
}
async function rejected(raw: string, sourcePointId = source) {
  const error = await fetchOpenMeteoSingleRunReceipt(input, async () => ({ status: 200, text: async () => raw }), sourcePointId)
    .then(() => null, (failure: unknown) => failure);
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe("Single Runs tuple is invalid");
  const diagnostic = getSingleRunTupleDiagnostic(error);
  expect(diagnostic).not.toBeNull();
  return diagnostic!;
}

it.each([["swell_wave_direction", 360, "s1"], ["secondary_swell_wave_period", 0, "s2"],
  ["swell_wave_height", -1, "s1"]])("identifies %s without relaxing its predicate", async (field, value, sourceSlot) => {
  const body = fixture(); body.hourly[field][146] = value;
  const raw = JSON.stringify(body);
  expect(await rejected(raw)).toMatchObject({ sourcePointId: source, requestedRunUtc: input.runUtc,
    forecastAtUtc: "2026-09-19T08:00Z", hourlyIndex: 146, sourceSlot, invalidFields: [field],
    rawResponseSha256: createHash("sha256").update(raw).digest("hex") });
});

it.each(["private-secret", { payload: "private-secret" }, ["private-secret"], null, true])("redacts nonnumeric upstream values (%#)", async (value) => {
  const body = fixture(); body.hourly.swell_wave_direction[0] = value;
  const diagnostic = await rejected(JSON.stringify(body));
  expect(diagnostic.values.direction.number).toBeNull();
  expect(JSON.stringify(diagnostic)).not.toContain("private-secret");
  expect(Object.isFrozen(diagnostic)).toBe(true);
  expect(Object.isFrozen(diagnostic.invalidFields)).toBe(true);
  expect(Object.isFrozen(diagnostic.values.direction)).toBe(true);
});

it("records the exact numeric endpoint but does not canonicalize it", async () => {
  const body = fixture(); body.hourly.swell_wave_direction[146] = 360;
  expect((await rejected(JSON.stringify(body))).values.direction).toEqual({ type: "number", number: 360 });
});

it("does not trust diagnostics attached to arbitrary upstream errors", () => {
  expect(getSingleRunTupleDiagnostic(Object.assign(new Error("Single Runs tuple is invalid"), { tuple: { secret: "private" } }))).toBeNull();
  expect(getSingleRunTupleDiagnostic(null)).toBeNull();
});

it("does not expose an unvalidated source identifier", async () => {
  const body = fixture(); body.hourly.swell_wave_direction[0] = 360;
  expect((await rejected(JSON.stringify(body), "private-secret")).sourcePointId).toBeNull();
});

it("preserves unavailable zero tuples and receipt identity", async () => {
  const body = fixture(); fields.slice(3).forEach((field) => { body.hourly[field][0] = 0; });
  const raw = JSON.stringify(body);
  const fetcher = async () => ({ status: 200, text: async () => raw });
  const withoutSource = await fetchOpenMeteoSingleRunReceipt(input, fetcher);
  const withSource = await fetchOpenMeteoSingleRunReceipt(input, fetcher, source);
  expect(withSource).toEqual(withoutSource);
  expect(withSource.rawResponse).toBe(raw);
  expect(withSource.observations[0].components[1].unavailableReason).toBe("provider_zero_tuple");
  expect(withSource.qualification.status).toBe("prototype_unqualified");
});
