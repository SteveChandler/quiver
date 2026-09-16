import { acquireProviderRunReceipts, completeAttestedProviderRun, loadAttestedProviderRunScope, loadSwellWatchAcquisitionScope, storePrototypeSingleRunReceipts, type ProviderRunReceiptRpcClient } from "@/lib/alerts/swell-watch/provider-run-store";
import { fetchOpenMeteoSingleRunReceipt } from "@/lib/alerts/swell-watch/single-run-receipt";

const input = { latitude: 32.8, longitude: -117.3, runUtc: "2026-09-03T06:00Z", forecastDays: 1 };
const slots = Array.from({ length: 24 }, (_, index) => new Date(Date.parse(input.runUtc) + index * 3_600_000).toISOString().slice(0, 16));
const response = (height = 1.2) => JSON.stringify({ latitude: 32.8, longitude: -117.3, generationtime_ms: 1, utc_offset_seconds: 0, timezone: "GMT", timezone_abbreviation: "GMT", elevation: 0, hourly_units: { time: "iso8601", swell_wave_height: "m", swell_wave_period: "s", swell_wave_direction: "°", secondary_swell_wave_height: "m", secondary_swell_wave_period: "s", secondary_swell_wave_direction: "°" }, hourly: { time: slots, swell_wave_height: slots.map(() => height), swell_wave_period: slots.map(() => 12), swell_wave_direction: slots.map(() => 170), secondary_swell_wave_height: slots.map(() => 0.6), secondary_swell_wave_period: slots.map(() => 9), secondary_swell_wave_direction: slots.map(() => 225) } });
const receipt = async (height = 1.2) => fetchOpenMeteoSingleRunReceipt(input, jest.fn().mockResolvedValue({ status: 200, text: jest.fn().mockResolvedValue(response(height)) }));
const ids = { issuance_id: "11111111-1111-4111-8111-111111111111", run_batch_id: "22222222-2222-4222-8222-222222222222", revision_set_id: "33333333-3333-4333-8333-333333333333" };

describe("provider run receipt store", () => {
  const source = { sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", latitude: input.latitude, longitude: input.longitude };

  it("loads exact configured membership in order and preserves terrain without hiding missing beaches", async () => {
    const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const configured = [{ sourcePointId: source.sourcePointId, regionKey: "south" }, { sourcePointId: other, regionKey: "north" }];
    const beach = { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30,
      swell_access_factors: Array(72).fill(0.4), terrain_enabled: true, deepwater_decay_factor: 0.6,
      shoaling_factors: { version: 1, type: "period_lookup", buckets: [{ tp_min_s: 0, tp_max_s: 20, factor: 1.2 }] } };
    const rows = [other, source.sourcePointId].map((id) => ({ id, lat: 32.8, lon: -117.3,
      slug: "test-beach", timezone: "Pacific/Honolulu", ...beach }));
    const query = { select: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(),
      is: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue({ data: rows, count: 2, error: null }) };
    const from = jest.fn().mockReturnValue(query);
    expect(await loadSwellWatchAcquisitionScope(configured, { from } as never)).toEqual(configured.map((scope) =>
      ({ ...scope, latitude: 32.8, longitude: -117.3, slug: "test-beach", timezone: "Pacific/Honolulu", beach })));
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining("slug,timezone"), { count: "exact" });
    expect(query.in).toHaveBeenCalledWith("id", configured.map((scope) => scope.sourcePointId));
    expect(query.is).toHaveBeenCalledWith("deleted_at", null);
    expect(query.eq).toHaveBeenCalledWith("is_private", false);
    expect(query.is).toHaveBeenCalledWith("owner_id", null);
    query.limit.mockResolvedValue({ data: rows.map((row) => ({ ...row, deepwater_decay_factor: 0 })), count: 2, error: null });
    expect((await loadSwellWatchAcquisitionScope(configured, { from } as never))[0].beach.deepwater_decay_factor).toBe(0);
    for (const data of [rows.slice(0, 1), [rows[0], rows[0]], [rows[0], { ...rows[1], id: ids.issuance_id }],
      [rows[0], { ...rows[1], swell_window_center_deg: null }]]) {
      query.limit.mockResolvedValue({ data, count: data.length, error: null });
      await expect(loadSwellWatchAcquisitionScope(configured, { from } as never)).rejects.toThrow();
    }
    query.limit.mockResolvedValue({ data: rows, count: 3, error: null });
    await expect(loadSwellWatchAcquisitionScope(configured, { from } as never)).rejects.toThrow("differs");
    from.mockClear();
    await expect(loadSwellWatchAcquisitionScope([configured[0], configured[0]], { from } as never)).rejects.toThrow("Duplicate");
    expect(from).not.toHaveBeenCalled();
  });

  it("matches the whole frozen scope without shrinking the expected cohort", async () => {
    const scopes = [source, { ...source, sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }];
    const data = { providerBatchId: ids.run_batch_id, evaluationId: `genuine_completed:${ids.run_batch_id}`,
      issuedAt: input.runUtc, scopeHash: "a".repeat(64), expectedComponentCount: 96,
      scopes: scopes.map((scope) => ({ ...scope, forecastDays: 1 })) };
    const value = { providerBatchId: ids.run_batch_id, forecastDays: 1, scopes };
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    expect(await loadAttestedProviderRunScope(value, { rpc })).toEqual(data);
    expect(rpc).toHaveBeenCalledWith("read_swell_watch_run_scope", { p_provider_batch_id: ids.run_batch_id });
    for (const invalid of [{ ...data, scopes: data.scopes.slice(0, 1) },
      { ...data, scopes: [data.scopes[0], data.scopes[0]] },
      { ...data, scopes: [data.scopes[0], { ...data.scopes[1], latitude: 0 }] },
      { ...data, expectedComponentCount: 48 }, { ...data, issuedAt: "2026-09-03T07:00:00Z" },
      { ...data, providerBatchId: ids.issuance_id }, { ...data, evaluationId: "synthetic_fixture:fake" }]) {
      rpc.mockResolvedValue({ data: invalid, error: null });
      await expect(loadAttestedProviderRunScope(value, { rpc })).rejects.toThrow();
    }
    rpc.mockClear();
    await expect(loadAttestedProviderRunScope({ ...value, scopes: [source, source] }, { rpc }))
      .rejects.toThrow("Duplicate expected source scope");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("validates the whole acquisition scope before the first fetch", async () => {
    const fetcher = jest.fn();
    const rpc = jest.fn();
    await expect(acquireProviderRunReceipts({ ...input, scopes: [source, { ...source, sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", latitude: NaN }] }, fetcher, { rpc })).rejects.toThrow("coordinates");
    await expect(acquireProviderRunReceipts({ ...input, scopes: [source, source] }, fetcher, { rpc })).rejects.toThrow("scope");
    expect(fetcher).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not persist or complete a partially acquired batch", async () => {
    const fetcher = jest.fn().mockResolvedValueOnce({ status: 200, text: async () => response() }).mockResolvedValueOnce({ status: 503, text: async () => "unavailable" });
    const rpc = jest.fn();
    await expect(acquireProviderRunReceipts({ ...input, scopes: [source, { ...source, sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }] }, fetcher, { rpc })).rejects.toThrow("unsuccessful");
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("freezes scope across awaits and only records unqualified receipts", async () => {
    const scopes = [{ ...source }, { ...source, sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }];
    const fetcher = jest.fn().mockImplementation(async () => {
      scopes[1].latitude = 0;
      return { status: 200, text: async () => response() };
    });
    const rpc = jest.fn().mockResolvedValue({ data: [ids], error: null });
    await acquireProviderRunReceipts({ ...input, scopes }, fetcher, { rpc });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("latitude")).toBe("32.8");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("record_swell_watch_provider_run_receipt");
    expect(rpc.mock.calls[0][1].p_scopes).toHaveLength(2);
    expect(rpc.mock.calls[0][1].p_scopes[0].receipt.qualification.status).toBe("prototype_unqualified");
  });

  it("selects the advertised run only after replication and still stores unqualified receipts", async () => {
    const issued = Date.parse(input.runUtc) / 1000;
    const metadata = { last_run_initialisation_time: issued, last_run_modification_time: issued + 3600,
      last_run_availability_time: issued + 3700, temporal_resolution_seconds: 3600, update_interval_seconds: 21600 };
    const fetcher = jest.fn().mockResolvedValueOnce({ status: 200, text: async () => JSON.stringify(metadata) })
      .mockResolvedValueOnce({ status: 200, text: async () => response() });
    const rpc = jest.fn().mockResolvedValue({ data: [ids], error: null });
    await acquireProviderRunReceipts({ forecastDays: 1, scopes: [source],
      latestAvailableAt: new Date((issued + 4300) * 1000) }, fetcher, { rpc });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]).toEqual(["https://marine-api.open-meteo.com/data/ncep_gfswave016/static/meta.json", { method: "GET", redirect: "error" }]);
    expect(new URL(fetcher.mock.calls[1][0]).searchParams.get("run")).toBe("2026-09-03T06:00");
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("record_swell_watch_provider_run_receipt");
    expect(rpc.mock.calls[0][1].p_scopes[0].receipt.qualification.status).toBe("prototype_unqualified");
    for (const invalid of [metadata, { ...metadata, last_run_initialisation_time: issued + 1 },
      { ...metadata, last_run_modification_time: issued - 1 }, { ...metadata, last_run_availability_time: issued },
      { ...metadata, update_interval_seconds: 1 }, { ...metadata, temporal_resolution_seconds: 0 },
      { ...metadata, last_run_initialisation_time: "invalid" }]) {
      fetcher.mockReset().mockResolvedValue({ status: 200, text: async () => JSON.stringify(invalid) });
      rpc.mockClear();
      await expect(acquireProviderRunReceipts({ forecastDays: 1, scopes: [source],
        latestAvailableAt: new Date((issued + (invalid === metadata ? 4299 : 4300)) * 1000) }, fetcher, { rpc })).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("does not acquire or persist after failed, malformed or oversized availability responses", async () => {
    const rpc = jest.fn();
    for (const response of [{ status: 503, text: async () => "unavailable" },
      { status: 200, text: async () => "not-json" }, { status: 200, text: async () => " ".repeat(16_385) }]) {
      const fetcher = jest.fn().mockResolvedValue(response);
      await expect(acquireProviderRunReceipts({ forecastDays: 1, scopes: [source],
        latestAvailableAt: new Date("2026-09-05T18:00Z") }, fetcher, { rpc })).rejects.toThrow();
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("requires database attestation and validates the returned completion identity", async () => {
    const stored = { issuanceId: ids.issuance_id, runBatchId: ids.run_batch_id, revisionSetId: ids.revision_set_id };
    const rpc = jest.fn().mockResolvedValueOnce({ data: null, error: { message: "active accepted attestation is required" } })
      .mockResolvedValueOnce({ data: [{ provider_batch_id: ids.issuance_id, evaluation_id: `genuine_completed:${ids.revision_set_id}` }], error: null })
      .mockResolvedValueOnce({ data: [{ provider_batch_id: ids.issuance_id, evaluation_id: `genuine_completed:${ids.run_batch_id}` }], error: null });
    await expect(completeAttestedProviderRun(stored, { rpc })).rejects.toThrow("attestation");
    await expect(completeAttestedProviderRun(stored, { rpc })).rejects.toThrow("invalid identity");
    await expect(completeAttestedProviderRun(stored, { rpc })).resolves.toEqual({ providerBatchId: ids.issuance_id, evaluationId: `genuine_completed:${ids.run_batch_id}` });
    expect(rpc).toHaveBeenLastCalledWith("complete_swell_watch_provider_run_receipt", { p_revision_set_id: ids.revision_set_id });
  });

  it("stores an atomic scope and accepts Supabase table-return rows", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [ids], error: null });
    const result = await storePrototypeSingleRunReceipts([{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: await receipt() }, { sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", receipt: await receipt() }], { rpc } satisfies ProviderRunReceiptRpcClient);
    expect(result).toEqual({ issuanceId: ids.issuance_id, runBatchId: ids.run_batch_id, revisionSetId: ids.revision_set_id });
    expect(rpc).toHaveBeenCalledWith("record_swell_watch_provider_run_receipt", expect.objectContaining({ p_scopes: expect.arrayContaining([expect.objectContaining({ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: expect.objectContaining({ hourlyUnits: expect.objectContaining({ swell_wave_height: "m" }) }) })]) }));
  });

  it("fails before persistence for duplicate beaches, a partial slot set, or mixed runs", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [ids], error: null });
    const first = await receipt();
    await expect(storePrototypeSingleRunReceipts([{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: first }, { sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: first }], { rpc })).rejects.toThrow("source scope");
    await expect(storePrototypeSingleRunReceipts([{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: { ...first, observations: first.observations.slice(1) } as never }], { rpc })).rejects.toThrow("incomplete");
    await expect(storePrototypeSingleRunReceipts([{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: first }, { sourcePointId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", receipt: { ...first, requested: { ...first.requested, runUtc: "2026-09-03T12:00Z" } } as never }], { rpc })).rejects.toThrow("one run");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects incomplete RPC results and missing selected-grid evidence", async () => {
    const first = await receipt();
    const scope = [{ sourcePointId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", receipt: first }];
    await expect(storePrototypeSingleRunReceipts(scope, { rpc: jest.fn().mockResolvedValue({ data: [], error: null }) })).rejects.toThrow("invalid result");
    await expect(storePrototypeSingleRunReceipts(scope, { rpc: jest.fn().mockResolvedValue({ data: [ids, ids], error: null }) })).rejects.toThrow("invalid result");
    await expect(storePrototypeSingleRunReceipts([{ ...scope[0], receipt: { ...first, selectedGrid: { ...first.selectedGrid, latitude: Number.NaN } } }], { rpc: jest.fn() })).rejects.toThrow("provenance");
    await expect(storePrototypeSingleRunReceipts([{ ...scope[0], receipt: { ...first, selectedGrid: { ...first.selectedGrid, latitude: 40, distanceFromRequestedKm: 0 } } }], { rpc: jest.fn() })).rejects.toThrow("provenance");
  });
});
