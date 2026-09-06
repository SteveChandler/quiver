/** @jest-environment node */
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { ingestAttestedSwellWatchCohort, ingestAttestedSwellWatchImpact, ingestAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import type { SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const id = "11111111-1111-4111-8111-111111111111";
const input: Parameters<typeof ingestAttestedSwellWatchImpact>[0] = {
  providerBatchId: id, sourcePointId: id, observationId: id, impactId: id, regionalEventId: id,
  forecastAt: "2026-09-08T00:00:00.000Z", sourceSlot: "s2", regionKey: "fixture-region", physicalKey: "fixture-event",
  peakAt: "2026-09-09T00:00:00.000Z",
  impact: { baselineHeightFt: 1, baselineEnergy: 8, arrivalAt: "2026-09-08T00:00:00.000Z", now: new Date("2026-09-05T00:00:00.000Z"),
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 }, policy: fixturePolicy as SwellWatchPolicy, seamContinuous: true, sourceCoherent: true },
};
const rows = [
  { evaluation_id: `genuine_completed:${id}`, source_slot: "s1", height_m: 1, period_s: 9, direction_deg: 270 },
  { evaluation_id: `genuine_completed:${id}`, source_slot: "s2", height_m: 1.8, period_s: 13, direction_deg: 170 },
];
const from = jest.fn();
const identity = [{ regional_event_id: id, event_state: "candidate" }];
const identityReader = { from: from as never };

beforeEach(() => {
  jest.clearAllMocks();
});

describe("attested component impact ingestion", () => {
  it("does not persist a run with an unavailable component or read an invalid region", async () => {
    const value = { providerBatchId: id, sourcePointId: id, regionKey: "fixture-region",
      now: "2026-09-05T00:00:00.000Z", policy: fixturePolicy as SwellWatchPolicy,
      beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 90 } };
    const data = { source: { provider: "open_meteo", transportProvider: "open_meteo_single_runs",
      model: "ncep_gfswave016", upstreamModelProvider: "ncep", sourcePointId: id, providerBatchId: id,
      issuanceId: id, revisionSetId: id, issuedAt: value.now, evaluationId: `genuine_completed:${id}` },
    forecastDays: 1, selectedGrid: {}, samples: Array.from({ length: 24 }, (_, hour) => ({
      forecastAt: new Date(Date.parse(value.now) + hour * 3_600_000).toISOString(),
      components: [
        { sourceSlot: "s1", heightM: 1, periodS: 13, directionDeg: 170, rawFieldProvenance: {}, timeProvenance: {} },
        { sourceSlot: "s2", heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple",
          rawFieldProvenance: {}, timeProvenance: {} },
      ],
    })) };
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    expect(await ingestAttestedSwellWatchRun(value, { rpc, ...identityReader }))
      .toEqual({ kind: "suppressed", reason: "incomplete_partition" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("read_swell_watch_attested_run", expect.any(Object));
    rpc.mockClear();
    await expect(ingestAttestedSwellWatchRun({ ...value, regionKey: " " }, { rpc, ...identityReader }))
      .rejects.toThrow("Invalid region key");
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
    const other = "22222222-2222-4222-8222-222222222222";
    const scopes = [id, other].map((sourcePointId) => ({ sourcePointId, latitude: 32.8, longitude: -117.3,
      regionKey: "fixture-region", beach: value.beach }));
    const good = { ...data, forecastDays: 7, samples: Array.from({ length: 168 }, (_, hour) => ({
      forecastAt: new Date(Date.parse(value.now) + hour * 3_600_000).toISOString(),
      components: [
        { sourceSlot: "s1", heightM: 0.3, periodS: 9, directionDeg: 260, rawFieldProvenance: {}, timeProvenance: {} },
        { sourceSlot: "s2", heightM: 0.25, periodS: 13, directionDeg: 170, rawFieldProvenance: {}, timeProvenance: {} },
      ],
    })) };
    const missing = { ...good, source: { ...good.source, sourcePointId: other }, samples: good.samples.map((sample, index) =>
      index === 80 ? { ...sample, components: [sample.components[0], data.samples[0].components[1]] } : sample) };
    rpc.mockReset().mockImplementation(async (name: string, args: Record<string, string>) => {
      if (name === "read_swell_watch_run_scope") return { data: { providerBatchId: id,
        evaluationId: data.source.evaluationId, issuedAt: value.now, scopeHash: "a".repeat(64),
        expectedComponentCount: 672, scopes: scopes.map((scope) => ({ ...scope, forecastDays: 7 })) }, error: null };
      if (name === "read_swell_watch_attested_run") {
        return { data: args.p_source_point_id === id ? good : missing, error: null };
      }
      throw new Error("Cohort must not write after failed preflight");
    });
    expect(await ingestAttestedSwellWatchCohort({ providerBatchId: id, forecastDays: 7,
      now: value.now, policy: value.policy, scopes }, { rpc, ...identityReader }))
      .toEqual({ kind: "suppressed", reason: "incomplete_partition", sourcePointId: other });
    expect(rpc.mock.calls.map(([name]) => name)).toEqual([
      "read_swell_watch_run_scope", "read_swell_watch_attested_run", "read_swell_watch_attested_run",
    ]);
  });

  it("persists the exact attested S2, not headline S1, through the verified RPC only", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    const result = await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader });
    expect(result).toMatchObject({ kind: "candidate", regionalEventId: id, partition: { sourceSlot: "s2", heightM: 1.8, periodS: 13, directionDeg: 170 } });
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenNthCalledWith(1, "read_swell_watch_attested_components", { p_provider_batch_id: id, p_source_point_id: id, p_forecast_at: input.forecastAt });
    expect(rpc).toHaveBeenNthCalledWith(2, "resolve_and_ingest_swell_watch_evaluation", expect.objectContaining({ p_provider_batch_id: id, p_source_slot: "s2", p_height_m: 1.8, p_period_s: 13, p_direction_deg: 170, p_impact_hash: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(from).not.toHaveBeenCalled();
    expect(rpc.mock.calls[1][1]).not.toHaveProperty("p_regional_event_id");
    expect(result).toHaveProperty("eventState", "candidate");
  });

  it.each([
    [rows[0], rows[0]],
    [rows[0], { ...rows[1], evaluation_id: "synthetic_fixture:fake" }],
    [rows[0], { ...rows[1], period_s: null }],
  ])("rejects missing, contradictory or malformed component evidence without ingestion: %j", async (...data) => {
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it.each([{ data: [] }, { data: [rows[0]] }, { data: [rows[1]] }])("suppresses unavailable partition scope without advancing an event: %j", async ({ data }) => {
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).resolves.toEqual({ kind: "suppressed", reason: "incomplete_partition" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("read_swell_watch_attested_components", expect.any(Object));
    expect(from).not.toHaveBeenCalled();
  });

  it("returns suppression without persistence for source discontinuity", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: rows, error: null });
    await expect(ingestAttestedSwellWatchImpact({ ...input, impact: { ...input.impact, seamContinuous: false } }, { rpc, ...identityReader })).resolves.toEqual({ kind: "suppressed", reason: "seam_discontinuous" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(from).not.toHaveBeenCalled();
  });

  it("propagates revocation between read and write rather than claiming ingestion", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: null, error: { message: "provider attestation revoked" } });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("revoked");
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(from).not.toHaveBeenCalled();
  });

  it("keeps the persisted impact hash stable across equivalent timestamp spellings", async () => {
    const rpc = jest.fn().mockImplementation(async (name: string) => ({ data: name === "read_swell_watch_attested_components" ? rows : identity, error: null }));
    await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader });
    await ingestAttestedSwellWatchImpact({ ...input, forecastAt: "2026-09-07T17:00:00-07:00", peakAt: "2026-09-08T17:00:00-07:00", impact: { ...input.impact, arrivalAt: "2026-09-07T17:00:00-07:00" } }, { rpc, ...identityReader });
    expect(rpc.mock.calls[1][1]).toEqual(rpc.mock.calls[3][1]);
  });

  it("does not read or write for an invalid clock or identity", async () => {
    const rpc = jest.fn();
    await expect(ingestAttestedSwellWatchImpact({ ...input, providerBatchId: "fake" }, { rpc, ...identityReader })).rejects.toThrow("Invalid");
    await expect(ingestAttestedSwellWatchImpact({ ...input, impact: { ...input.impact, now: new Date("invalid") } }, { rpc, ...identityReader })).rejects.toThrow("Invalid");
    expect(rpc).not.toHaveBeenCalled();
    expect(from).not.toHaveBeenCalled();
  });

  it("returns the persisted regional identity rather than the proposed retry ID", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    const actual = "22222222-2222-4222-8222-222222222222";
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: [{ regional_event_id: actual, event_state: "stable" }], error: null });
    expect(await ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).toMatchObject({ regionalEventId: actual, eventState: "stable" });
  });

  it.each([null, [], [null], [{ regional_event_id: "invalid" }], [{ regional_event_id: id }], [{ regional_event_id: id, event_state: "unknown" }],
    [...identity, ...identity]].map((data) => ({ data })))("rejects missing or ambiguous persisted identity: %j", async ({ data }) => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data, error: null });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("missing or ambiguous");
  });

  it("does not fall back to the proposed identity when read-back fails", async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: identity, error: null });
    rpc.mockReset().mockResolvedValueOnce({ data: rows, error: null }).mockResolvedValueOnce({ data: null, error: { message: "resolution unavailable" } });
    await expect(ingestAttestedSwellWatchImpact(input, { rpc, ...identityReader })).rejects.toThrow("ingestion failed");
  });
});
