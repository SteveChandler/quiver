import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildOpenMeteoSingleRunRequest, fetchOpenMeteoSingleRunReceipt } from "@/lib/alerts/swell-watch/single-run-receipt";
import { storePrototypeSingleRunReceipts } from "@/lib/alerts/swell-watch/provider-run-store";

const input = { latitude: 32.8, longitude: -117.3, runUtc: "2026-09-03T06:00Z", forecastDays: 1 };
const slotsFrom = (runUtc: string) => Array.from({ length: 24 }, (_, index) => new Date(Date.parse(runUtc) + index * 3_600_000).toISOString().slice(0, 16));
const slots = slotsFrom(input.runUtc);

function response(overrides: Record<string, unknown> = {}): string {
  const hourly = { time: slots, swell_wave_height: slots.map(() => 1.2), swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 170), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) };
  const hourlyUnits = { time: "iso8601", swell_wave_height: "m", swell_wave_period: "s", swell_wave_direction: "°", secondary_swell_wave_height: "m", secondary_swell_wave_period: "s", secondary_swell_wave_direction: "°" };
  return JSON.stringify({ latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0, hourly_units: hourlyUnits, hourly, ...overrides });
}

function fetcher(body = response(), status = 200): jest.Mock {
  return jest.fn().mockResolvedValue({ status, text: jest.fn().mockResolvedValue(body) });
}

describe("Open-Meteo Single Runs prototype receipt", () => {
  it.each(["06z-first", "06z-repeat", "12z"])("records unavailable S2 partitions in the captured seven-day %s response without completing them", async (captureName) => {
    const capture = JSON.parse(readFileSync(join(process.cwd(), `docs/runbooks/evidence/open-meteo-seven-day-20260905-${captureName}.json`), "utf8"));
    const body = JSON.parse(capture.rawResponse);
    expect(capture.status).toBe(200);
    expect(body.hourly.time).toHaveLength(168);
    expect(body.hourly.secondary_swell_wave_period.filter((period: number) => period === 0)).toHaveLength(8);
    const receipt = await fetchOpenMeteoSingleRunReceipt(capture.input, fetcher(capture.rawResponse));
    expect(receipt.rawResponse).toBe(capture.rawResponse);
    expect(receipt.observations).toHaveLength(168);
    const unavailable = receipt.observations.flatMap((observation) => observation.components.filter((component) => component.unavailableReason));
    expect(unavailable).toHaveLength(8);
    expect(unavailable.every((component) => component.sourceSlot === "s2" && component.heightM === 0 && component.periodS === 0 && component.directionDeg === 0 && component.unavailableReason === "provider_zero_tuple")).toBe(true);
    expect(receipt.qualification.status).toBe("prototype_unqualified");
    const rpc = jest.fn().mockResolvedValue({ data: [{ issuance_id: "11111111-1111-4111-8111-111111111111", run_batch_id: "22222222-2222-4222-8222-222222222222", revision_set_id: "33333333-3333-4333-8333-333333333333" }], error: null });
    await storePrototypeSingleRunReceipts([{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt }], { rpc });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("record_swell_watch_provider_run_receipt");
    expect(rpc.mock.calls[0][1].p_scopes[0].receipt.observations).toEqual(receipt.observations);
  });

  it("distinguishes an all-zero unavailable partition from north direction and malformed zero-period data", async () => {
    const body = JSON.parse(response());
    body.hourly.swell_wave_height[0] = 0;
    body.hourly.swell_wave_period[0] = 0;
    body.hourly.swell_wave_direction[0] = 0;
    body.hourly.secondary_swell_wave_direction[0] = 0;
    const receipt = await fetchOpenMeteoSingleRunReceipt(input, fetcher(JSON.stringify(body)));
    expect(receipt.observations[0].components[0]).toMatchObject({ heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
    expect(receipt.observations[0].components[1]).toEqual({ sourceSlot: "s2", heightM: 0.6, periodS: 9, directionDeg: 0, rawFieldProvenance: { height: "secondary_swell_wave_height", period: "secondary_swell_wave_period", direction: "secondary_swell_wave_direction" } });
    body.hourly.swell_wave_height[0] = 1;
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(JSON.stringify(body)))).rejects.toThrow("tuple is invalid");
  });

  it("preserves captured provider partitions without qualifying a replay as a new evaluation", async () => {
    const body = readFileSync(join(process.cwd(), "docs/runbooks/evidence/open-meteo-single-run-20260905.json"), "utf8").replace(/\n$/, "");
    const fetch = fetcher(body);
    const first = await fetchOpenMeteoSingleRunReceipt(input, fetch);
    const replay = await fetchOpenMeteoSingleRunReceipt(input, fetch);
    expect(first.rawResponseSha256).toBe("e0cd1ba17374ae1c4a70f48ab2ee7e9b5c22bb227bfda46a012e8383378e29a4");
    expect(first.observations).toHaveLength(24);
    expect(first.observations[0].components).toEqual([
      { sourceSlot: "s1", heightM: 0.64, periodS: 5, directionDeg: 274, rawFieldProvenance: { height: "swell_wave_height", period: "swell_wave_period", direction: "swell_wave_direction" } },
      { sourceSlot: "s2", heightM: 0.62, periodS: 11.85, directionDeg: 202, rawFieldProvenance: { height: "secondary_swell_wave_height", period: "secondary_swell_wave_period", direction: "secondary_swell_wave_direction" } },
    ]);
    expect(first.observations[23].forecastAtUtc).toBe("2026-09-04T05:00Z");
    expect(first.qualification.status).toBe("prototype_unqualified");
    expect(replay).toEqual(first);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("pins the Single Runs request, UTC run, model, sea cell, and six hourly fields", () => {
    expect(buildOpenMeteoSingleRunRequest(input)).toEqual({
      method: "GET",
      url: "https://single-runs-api.open-meteo.com/v1/forecast?latitude=32.8&longitude=-117.3&models=ncep_gfswave016&hourly=swell_wave_height%2Cswell_wave_period%2Cswell_wave_direction%2Csecondary_swell_wave_height%2Csecondary_swell_wave_period%2Csecondary_swell_wave_direction&run=2026-09-03T06%3A00&cell_selection=sea&timezone=UTC&forecast_days=1",
      requestedRunUtc: "2026-09-03T06:00Z",
    });
    expect(() => buildOpenMeteoSingleRunRequest({ ...input, runUtc: "2026-09-03T07:00Z" })).toThrow("aligned");
    expect(() => buildOpenMeteoSingleRunRequest({ ...input, runUtc: "2026-02-30T00:00Z" })).toThrow("aligned");
    expect(() => buildOpenMeteoSingleRunRequest({ ...input, latitude: 91 })).toThrow("coordinates");
    expect(() => buildOpenMeteoSingleRunRequest({ ...input, forecastDays: 8 })).toThrow("days");
  });

  it("returns strictly parsed unqualified S1/S2 observations with request and raw-field provenance", async () => {
    const body = response();
    const fetch = fetcher(body);
    const receipt = await fetchOpenMeteoSingleRunReceipt(input, fetch);
    expect(fetch).toHaveBeenCalledWith(buildOpenMeteoSingleRunRequest(input).url, { method: "GET", redirect: "error" });
    expect(receipt).toMatchObject({ qualification: { status: "prototype_unqualified" }, requested: { model: "ncep_gfswave016", transportProvider: "open_meteo_single_runs", upstreamModelProvider: "ncep", runUtc: input.runUtc } });
    expect(receipt.observations[0]).toMatchObject({ providerForecastAt: slots[0], forecastAtUtc: `${slots[0]}Z`, timeProvenance: { field: "time", timezone: "UTC" } });
    expect(receipt.observations[0].components[0]).toMatchObject({ sourceSlot: "s1", periodS: 12, rawFieldProvenance: { period: "swell_wave_period" } });
    expect(receipt.observations[0].components[1]).toMatchObject({ sourceSlot: "s2", periodS: 9, rawFieldProvenance: { period: "secondary_swell_wave_period" } });
    expect(receipt.observations).toHaveLength(24);
    expect(receipt.selectedGrid).toMatchObject({ latitude: 32.8, longitude: -117.3, elevationM: 0, distanceFromRequestedKm: 0, policy: { status: "prototype_local_mapping_policy", maxDistanceKm: 30, providerGuarantee: false } });
    expect(receipt.rawResponse).toBe(body);
    expect(JSON.parse(receipt.canonicalSemanticPayload)).toEqual(expect.objectContaining({ hourly: expect.any(Object), hourly_units: expect.any(Object) }));
  });

  it.each([301, 302, 307, 308])("rejects a surfaced redirect (%s) before reading its body", async (status) => {
    const text = jest.fn().mockResolvedValue(response());
    await expect(fetchOpenMeteoSingleRunReceipt(input, jest.fn().mockResolvedValue({ status, text }))).rejects.toThrow("HTTP");
    expect(text).not.toHaveBeenCalled();
  });

  it("rejects HTTP, JSON, partial tuple, slot, finite/range, and unexpected response data", async () => {
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response(), 500))).rejects.toThrow("HTTP");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher("not-json"))).rejects.toThrow("JSON");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(`${" ".repeat(524_289)}{}`))).rejects.toThrow("durable receipt limit");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly: { time: slots, swell_wave_height: slots.map(() => 1) } })))).rejects.toThrow("hourly");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly: { time: [...slots.slice(1), slots[slots.length - 1]], swell_wave_height: slots.map(() => 1), swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 170), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) } })))).rejects.toThrow("slots");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly: { time: slots, swell_wave_height: [Number.NaN, ...slots.slice(1).map(() => 1)], swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 170), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) } })))).rejects.toThrow("tuple");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly: { time: slots, swell_wave_height: slots.map(() => 1), swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 360), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) } })))).rejects.toThrow("tuple");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ unexpected: true })))).rejects.toThrow("top-level");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly_units: { time: "iso8601", swell_wave_height: "ft", swell_wave_period: "s", swell_wave_direction: "°", secondary_swell_wave_height: "m", secondary_swell_wave_period: "s", secondary_swell_wave_direction: "°" } })))).rejects.toThrow("units");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ utc_offset_seconds: 3_600 })))).rejects.toThrow("top-level");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ timezone: "America/Los_Angeles" })))).rejects.toThrow("top-level");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ timezone_abbreviation: "PDT" })))).rejects.toThrow("top-level");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ latitude: 91 })))).rejects.toThrow("top-level");
    await expect(fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ longitude: -116.8 })))).rejects.toThrow("selected grid");
    const antimeridian = await fetchOpenMeteoSingleRunReceipt({ ...input, longitude: 179.95 }, fetcher(response({ longitude: -179.95 })));
    expect(antimeridian.selectedGrid.distanceFromRequestedKm).toBeLessThan(30);
  });

  it("keeps retries/corrections on one prototype evaluation and distinguishes runs", async () => {
    const first = await fetchOpenMeteoSingleRunReceipt(input, fetcher());
    const identical = await fetchOpenMeteoSingleRunReceipt(input, fetcher());
    const retry = await fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ generationtime_ms: 2 })));
    const corrected = await fetchOpenMeteoSingleRunReceipt(input, fetcher(response({ hourly: { time: slots, swell_wave_height: slots.map(() => 1.3), swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 170), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) } })));
    const nextSlots = slotsFrom("2026-09-03T12:00Z");
    const nextRun = await fetchOpenMeteoSingleRunReceipt({ ...input, runUtc: "2026-09-03T12:00Z" }, fetcher(response({ hourly: { time: nextSlots, swell_wave_height: nextSlots.map(() => 1.2), swell_wave_period: nextSlots.map(() => 12), swell_wave_direction: nextSlots.map(() => 170), secondary_swell_wave_height: nextSlots.map(() => 0.6), secondary_swell_wave_period: nextSlots.map(() => 9), secondary_swell_wave_direction: nextSlots.map(() => 225) } })));
    expect(identical).toMatchObject({ prototypeReceiptKey: first.prototypeReceiptKey, prototypeEvaluationIdentity: first.prototypeEvaluationIdentity, prototypeIssuanceIdentity: first.prototypeIssuanceIdentity, revisionHash: first.revisionHash });
    expect(retry.prototypeEvaluationIdentity).toBe(first.prototypeEvaluationIdentity);
    expect(retry.prototypeIssuanceIdentity).toBe(first.prototypeIssuanceIdentity);
    expect(retry.rawResponseSha256).not.toBe(first.rawResponseSha256);
    expect(retry.revisionHash).toBe(first.revisionHash);
    expect(retry.prototypeReceiptKey).toBe(first.prototypeReceiptKey);
    expect(corrected.prototypeEvaluationIdentity).toBe(first.prototypeEvaluationIdentity);
    expect(corrected.revisionHash).not.toBe(first.revisionHash);
    expect(corrected.prototypeReceiptKey).not.toBe(first.prototypeReceiptKey);
    expect(nextRun.prototypeEvaluationIdentity).not.toBe(first.prototypeEvaluationIdentity);
    expect(nextRun.prototypeIssuanceIdentity).not.toBe(first.prototypeIssuanceIdentity);
  });
});
