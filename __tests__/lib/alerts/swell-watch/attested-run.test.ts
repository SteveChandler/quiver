/** @jest-environment node */
import { deriveAttestedSwellWatchRun, loadAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import fixturePolicy from "@/__tests__/fixtures/swell-watch-provisional-policy.json";
import { verifySwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";

const id = "11111111-1111-4111-8111-111111111111";
const input = { providerBatchId: id, sourcePointId: id };
function run() {
  return { source: { provider: "open_meteo", transportProvider: "open_meteo_single_runs", model: "ncep_gfswave016",
    upstreamModelProvider: "ncep", sourcePointId: id, providerBatchId: id, issuanceId: id, revisionSetId: id,
    issuedAt: "2026-09-05T00:00:00Z", evaluationId: `genuine_completed:${id}` },
  forecastDays: 1, selectedGrid: {}, samples: Array.from({ length: 24 }, (_, hour) => ({
    forecastAt: `2026-09-05T${String(hour).padStart(2, "0")}:00:00Z`,
    components: ["s1", "s2"].map((sourceSlot) => ({ sourceSlot, heightM: 1, periodS: 13, directionDeg: 170,
      rawFieldProvenance: { period: "swell_wave_period" }, timeProvenance: { timezone: "UTC" } })),
  })) };
}

describe("attested whole-run reader", () => {
  it("uses one read and preserves explicit missingness without granting authority", async () => {
    const data = run();
    Object.assign(data.samples[0].components[1], { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    expect(await loadAttestedSwellWatchRun(input, { rpc })).toEqual(data);
    expect(rpc.mock.calls).toEqual([["read_swell_watch_attested_run", { p_provider_batch_id: id, p_source_point_id: id }]]);
  });

  it.each(["truncated", "duplicate-time", "duplicate-slot", "wrong-beach", "wrong-batch", "wrong-model", "zero-period", "forged-missing"])("rejects %s data", async (failure) => {
    const data = run();
    if (failure === "truncated") data.samples.pop();
    if (failure === "duplicate-time") data.samples[1].forecastAt = data.samples[0].forecastAt;
    if (failure === "duplicate-slot") data.samples[0].components[1].sourceSlot = "s1";
    if (failure === "wrong-beach") data.source.sourcePointId = "22222222-2222-4222-8222-222222222222";
    if (failure === "wrong-batch") data.source.providerBatchId = "22222222-2222-4222-8222-222222222222";
    if (failure === "wrong-model") data.source.model = "best_match";
    if (failure === "zero-period") data.samples[0].components[1].periodS = 0;
    if (failure === "forged-missing") Object.assign(data.samples[0].components[1], { unavailableReason: "provider_zero_tuple" });
    await expect(loadAttestedSwellWatchRun(input, { rpc: jest.fn().mockResolvedValue({ data, error: null }) })).rejects.toThrow();
  });
});

describe("attested horizon derivation", () => {
  const start = Date.parse("2026-09-05T00:00:00Z");
  const at = (hour: number): string => new Date(start + hour * 3_600_000).toISOString();
  function horizon() {
    const data = run();
    const components = data.samples[0].components;
    data.forecastDays = 7;
    data.samples = Array.from({ length: 168 }, (_, hour) => ({
      forecastAt: at(hour), components: components.map((part, index) => ({
        ...part, heightM: index === 0 ? 0.3 : hour >= 78 && hour <= 84 ? (hour === 81 ? 1.5 : 1) : 0.25,
        periodS: index === 0 ? 9 : 13, directionDeg: index === 0 ? 260 : 170,
      })),
    }));
    return data;
  }
  function request() {
    if (!verifySwellWatchPolicy(fixturePolicy)) throw new Error("Invalid test policy");
    return { ...input, now: at(0), policy: fixturePolicy,
      beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 } };
  }
  it("derives the real read identity and measured baseline without claiming independent-run confidence", async () => {
    const data = horizon();
    const rpc = jest.fn().mockResolvedValue({ data, error: null });
    const result = await deriveAttestedSwellWatchRun(request(), { rpc });
    expect(result).toMatchObject({ kind: "derived", source: data.source,
      baseline: { heightFt: 0.8202, energy: 0.8202 ** 2 * 13 },
      events: [{ arrivalAt: at(78), peakAt: at(81), confidence: null,
        impact: { partition: { evaluationId: data.source.evaluationId, sourceSlot: "s2", heightM: 1.5 } } }] });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(result).not.toHaveProperty("qualifyingEvaluationCount");
    expect(result).not.toHaveProperty("productionApproved");
  });
  it.each(["missing", "short", "stale", "future"])("suppresses %s evidence", async (failure) => {
    const data = failure === "short" ? run() : horizon();
    const value = request();
    if (failure === "missing") Object.assign(data.samples[80].components[1],
      { heightM: 0, periodS: 0, directionDeg: 0, unavailableReason: "provider_zero_tuple" });
    if (failure === "stale") value.now = at(13);
    if (failure === "future") value.now = at(-1);
    expect(await deriveAttestedSwellWatchRun(value, { rpc: jest.fn().mockResolvedValue({ data, error: null }) }))
      .toEqual({ kind: "suppressed", reason: { missing: "incomplete_partition", short: "incomplete_horizon",
        stale: "stale_run", future: "future_run" }[failure] });
  });
  it("propagates revoked evidence and rejects a forged policy before reading", async () => {
    const rpc = jest.fn().mockResolvedValue({ data: null, error: { message: "current attestation required" } });
    await expect(deriveAttestedSwellWatchRun(request(), { rpc })).rejects.toThrow("current attestation required");
    rpc.mockClear();
    const value = request();
    value.policy = { ...value.policy, value_hash: "0".repeat(64) };
    await expect(deriveAttestedSwellWatchRun(value, { rpc })).rejects.toThrow("Invalid derivation policy");
    expect(rpc).not.toHaveBeenCalled();
  });
});
