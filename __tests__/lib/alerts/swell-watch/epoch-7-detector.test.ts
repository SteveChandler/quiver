/** @jest-environment node */
import { readFileSync } from "node:fs";
import v2 from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import v3 from "@/docs/operations/swell-watch-no-send-producer-config-v3-proposed.json";
import { OLD_POLICY, RAMP_TIMING, TRAILING_BASELINE, loadBacktest, policyVariant, replay } from "@/__tests__/helpers/swell-watch-epoch-7-backtest";
import { deriveSwellWatchHorizon, type TrailingBaselineFrame } from "@/lib/alerts/swell-watch/horizon-derivation";
import { deriveAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import { evaluateSwellWatchPhysicalImpact } from "@/lib/alerts/swell-watch/impact-evaluator";
import { resolveNativeSamplingProfile } from "@/lib/alerts/swell-watch/native-sampling";
import { calculateSwellWatchPolicyHash, verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { findPartitionRamp } from "@/lib/alerts/swell-watch/ramp-timing";
import { studyConfig } from "@/lib/alerts/swell-watch/study";
import { sourceIdentity } from "@/__tests__/helpers/swell-watch-retained";

const HOUR = 3_600_000;
const start = Date.parse("2026-09-05T00:00:00Z");
const at = (hour: number): string => new Date(start + hour * HOUR).toISOString();
const beach = { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 };
const gates2 = policyVariant({ energy: 2 });
const baselineOnly = policyVariant({ detection: { baseline: TRAILING_BASELINE } });
const timingOnly = policyVariant({ detection: { timing: RAMP_TIMING } });
const both = policyVariant({ energy: 2, detection: { baseline: TRAILING_BASELINE, timing: RAMP_TIMING } });

type Part = { heightM: number; directionDeg: number; periodS: number };
/** s1 is a steady out-of-window background; s2 is the tracked partition. */
function series(s2: (hour: number) => Part) {
  return Array.from({ length: 168 }, (_, hour) => [
    { provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot: "s1" as const, forecastAt: at(hour), heightM: 0.3, periodS: 9, directionDeg: 260, completeness: "complete" as const },
    { provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot: "s2" as const, forecastAt: at(hour), ...s2(hour), completeness: "complete" as const },
  ]);
}
const quiet: Part = { heightM: 0.3, directionDeg: 170, periodS: 13 };
function trailing(heightM = 0.3, hours = 48): TrailingBaselineFrame[] {
  return Array.from({ length: hours }, (_, index) => ({ forecastAt: at(index - hours),
    parts: [{ provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot: "s2" as const, forecastAt: at(index - hours), heightM, periodS: 13, directionDeg: 170, completeness: "complete" as const }] }));
}
function derive(value: ReturnType<typeof series>, policy: SwellWatchPolicy, extra: { trailing?: TrailingBaselineFrame[]; now?: string } = {}) {
  return deriveSwellWatchHorizon({ series: value, qualificationRule: "complete_partitions.v1", now: extra.now ?? at(0), policy, beach,
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt: at(0) }, trailing: extra.trailing });
}

describe("epoch 7 policy", () => {
  it("pins the v3 config and leaves the epoch 3 policy untouched", () => {
    expect(verifySwellWatchPolicy(v3.policy)).toBe(true);
    expect(calculateSwellWatchPolicyHash(v3.policy as SwellWatchPolicy)).toBe(v3.policy.value_hash);
    expect(v2.policy.value_hash).toBe("86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f");
    const { detection, local_significance: significance, ...unchanged } = v3.policy.policy_values;
    const { local_significance: previous, ...previousRest } = v2.policy.policy_values;
    expect(unchanged).toEqual(previousRest);
    expect(significance).toEqual({ ...previous, minimum_energy_ratio: 2 });
    expect(detection).toEqual({ baseline: TRAILING_BASELINE, timing: RAMP_TIMING });
    expect(v3.cohort).toEqual(v2.cohort);
    expect(studyConfig.parse(v3).policy.value_hash).toBe(v3.policy.value_hash);
  });
  it("binds the activation script to the same hash and policy values", () => {
    const sql = readFileSync("docs/operations/swell-watch-study-activate-epoch-7.sql", "utf8");
    expect(sql).toContain(`new_hash text := '${v3.policy.value_hash}'`);
    const values = /new_values jsonb := \$values\$([\s\S]*?)\$values\$::jsonb;/.exec(sql)?.[1];
    expect(JSON.parse(values ?? "null")).toEqual(v3.policy.policy_values);
    const revoke = readFileSync("docs/operations/swell-watch-study-revoke-epoch-7.sql", "utf8");
    const rollback = readFileSync("docs/operations/swell-watch-study-rollback-epoch-7.sql", "utf8");
    for (const text of [revoke, rollback]) expect(text).toContain(v3.policy.value_hash);
    expect(rollback).toContain(v2.policy.value_hash);
    const migration = readFileSync("supabase/migrations/20261004150000_add_swell_watch_trailing_baseline_read.sql", "utf8");
    const pin = /<>'([0-9a-f]{64})'/.exec(migration)?.[1];
    expect(pin).toBeDefined();
    expect(sql).toContain(`<>'${pin}'`);
  });
  it.each([
    ["unknown key", { extra: true }],
    ["short trailing window", { baseline: { ...TRAILING_BASELINE, trailing_hours: 5 } }],
    ["long trailing window", { baseline: { ...TRAILING_BASELINE, trailing_hours: 73 } }],
    ["more frames than hours", { baseline: { ...TRAILING_BASELINE, minimum_trailing_frames: 49 } }],
    ["zero lead", { baseline: { ...TRAILING_BASELINE, maximum_lead_hours: 0 } }],
    ["extra baseline key", { baseline: { ...TRAILING_BASELINE, extra: 1 } }],
    ["zero rise fraction", { timing: { ...RAMP_TIMING, arrival_rise_fraction: 0 } }],
    ["full rise fraction", { timing: { ...RAMP_TIMING, arrival_rise_fraction: 1 } }],
    ["unknown basis", { timing: { ...RAMP_TIMING, actionability_basis: "peak" } }],
    ["unknown timing source", { timing: { ...RAMP_TIMING, source: "other" } }],
  ])("rejects a detection block with %s", (_label, detection) => {
    const unsigned = { ...v3.policy, policy_values: { ...v3.policy.policy_values, detection } } as Omit<SwellWatchPolicy, "value_hash" | "approval_evidence">;
    expect(verifySwellWatchPolicy({ ...unsigned, value_hash: calculateSwellWatchPolicyHash(unsigned), approval_evidence: null })).toBe(false);
  });
});

describe("change 1: energy gate", () => {
  const input = { baselineHeightFt: 1, baselineEnergy: 60, beach, seamContinuous: true, sourceCoherent: true };
  const part = (heightM: number) => ({ provider: "open_meteo" as const, evaluationId: "e", forecastAt: at(80), sourceSlot: "s2" as const, heightM, periodS: 10, directionDeg: 170, completeness: "complete" as const });
  it("suppresses an energy ratio of 1.45 only under 2.0", () => {
    expect(evaluateSwellWatchPhysicalImpact({ ...input, partition: part(0.9), policy: OLD_POLICY })).toMatchObject({ kind: "candidate" });
    expect(evaluateSwellWatchPhysicalImpact({ ...input, partition: part(0.9), policy: gates2 })).toEqual({ kind: "suppressed", reason: "low_significance" });
    expect(evaluateSwellWatchPhysicalImpact({ ...input, partition: part(1.2), policy: gates2 })).toMatchObject({ kind: "candidate" });
  });
  it("keeps the 1 ft rise and 1 ft face floors", () => {
    expect(evaluateSwellWatchPhysicalImpact({ ...input, baselineHeightFt: 3.5, partition: part(1.2), policy: gates2 })).toEqual({ kind: "suppressed", reason: "low_significance" });
  });
});

describe("change 2: trailing baseline", () => {
  const pulse = (hour: number): Part => (hour >= 30 && hour <= 36) || (hour >= 78 && hour <= 84) ? { heightM: 1.5, directionDeg: 170, periodS: 13 } : quiet;
  it("keeps the legacy forecast-front baseline byte-identical and ignores trailing input", () => {
    const value = series(pulse);
    const legacy = derive(value, OLD_POLICY);
    expect(legacy.events).toEqual([]);
    expect(derive(value, OLD_POLICY, { trailing: trailing(0.1) })).toEqual(legacy);
    expect(legacy.derivation.version).toBe("swell-watch-horizon-derivation.v3");
  });
  it("lets a swell inside the first 48 h stay out of its own baseline", () => {
    const result = derive(series(pulse), baselineOnly, { trailing: trailing() });
    expect(result.baseline.heightFt).toBeCloseTo(0.9843, 3);
    expect(result.events.map((event) => event.arrivalAt)).toEqual([at(78)]);
    expect(result.derivation.version).toBe("swell-watch-horizon-derivation.v4");
  });
  it("raises the baseline when the swell was already present before issuance", () => {
    expect(derive(series(pulse), baselineOnly, { trailing: trailing(1.5) }).events).toEqual([]);
  });
  it.each([["absent", undefined], ["empty", []], ["35 of 48 frames", trailing().slice(13)]])("suppresses with missing_baseline when trailing data is %s", (_label, frames) => {
    expect(() => derive(series(pulse), baselineOnly, { trailing: frames })).toThrow("missing_baseline");
  });
  it("accepts 36 frames and rejects frames outside the trailing window", () => {
    expect(() => derive(series(pulse), baselineOnly, { trailing: trailing().slice(12) })).not.toThrow();
    expect(() => derive(series(pulse), baselineOnly, { trailing: [...trailing(), { forecastAt: at(0), parts: [] }] })).toThrow("inconsistent_trailing_evidence");
    expect(() => derive(series(pulse), baselineOnly, { trailing: [...trailing(), { forecastAt: at(-49), parts: [] }] })).toThrow("inconsistent_trailing_evidence");
  });
  it("needs an in-window trailing partition", () => {
    const outside = trailing().map((frame) => ({ ...frame, parts: frame.parts.map((part) => ({ ...part, directionDeg: 300 })) }));
    expect(() => derive(series(pulse), baselineOnly, { trailing: outside })).toThrow("missing_baseline");
  });
});

describe("change 3: partition ramp timing", () => {
  /** Out-of-window ramp, with a single in-window hour at 78 (Steamer Lane shape). */
  const ramp = (hour: number): Part => {
    if (hour < 60 || hour > 90) return quiet;
    const heightM = hour <= 70 ? 0.4 + (1.2 * (hour - 60)) / 10 : 1.6 - (1.2 * (hour - 70)) / 20;
    return { heightM: Number(heightM.toFixed(3)), directionDeg: hour === 78 ? 199 : 205, periodS: 13 };
  };
  it("keeps legacy one-frame timing without the policy block", () => {
    const [event] = derive(series(ramp), OLD_POLICY).events;
    expect(event.arrivalAt).toBe(at(78));
    expect(event.peakAt).toBe(at(78));
  });
  it("reports the ramp arrival and peak of the full contiguous partition", () => {
    const result = derive(series(ramp), timingOnly);
    expect(result.events).toHaveLength(1);
    const [event] = result.events;
    expect(event.peakAt).toBe(at(70));
    expect(Date.parse(event.arrivalAt)).toBeLessThan(Date.parse(event.peakAt));
    expect(event.arrivalAt).toBe(at(65));
    expect(event.arrivalWindow).toEqual({ earliestAt: at(64), latestAt: at(65) });
    expect(event.peakWindow).toEqual({ earliestAt: at(69), latestAt: at(71) });
    expect(event.impact.partition).toMatchObject({ sourceSlot: "s2", forecastAt: at(70), heightM: 1.6, directionDeg: 205 });
    expect(event.impact.arrivalAt).toBe(at(65));
    expect(event.impact.heightRiseFt).toBeCloseTo(1.6 * 3.2808 - 0.3 * 3.2808, 2);
    expect(event.closureWindow).toEqual({ earliestAt: at(78), latestAt: at(79) });
  });
  it("emits one event when several gated episodes share a ramp", () => {
    const value = series((hour) => hour === 74 || hour === 82 ? { ...ramp(hour), directionDeg: 199 } : ramp(hour));
    expect(derive(value, timingOnly).events).toHaveLength(1);
    expect(derive(value, OLD_POLICY).events).toHaveLength(3);
  });
  /** Triangular partition: rises from `from` to `peak`, falls back by `to`; in-window only at `gated` hours. */
  const triangle = (from: number, peak: number, to: number, gated: number[]) => (hour: number): Part => {
    if (hour < from || hour > to) return quiet;
    const heightM = hour <= peak ? 0.3 + (1.3 * (hour - from)) / (peak - from) : 1.6 - (1.3 * (hour - peak)) / (to - peak);
    return { heightM: Number(heightM.toFixed(3)), directionDeg: gated.includes(hour) ? 199 : 205, periodS: 13 };
  };
  it("splits ramps where the partition returns to baseline", () => {
    const first = triangle(52, 62, 72, [66]);
    const second = triangle(82, 92, 102, [96]);
    const value = series((hour) => hour > 75 ? second(hour) : first(hour));
    expect(derive(value, timingOnly).events.map((event) => event.peakAt)).toEqual([at(62), at(92)]);
  });
  it("applies the 2-5 day test to the ramp arrival by default and to the gated frame when configured", () => {
    const early = series(triangle(20, 30, 70, [55]));
    const withBaseline = (basis: "ramp_arrival" | "gated_arrival") => policyVariant({ detection: { baseline: TRAILING_BASELINE, timing: { ...RAMP_TIMING, actionability_basis: basis } } });
    expect(derive(early, baselineOnly, { trailing: trailing() }).events.map((event) => event.arrivalAt)).toEqual([at(55)]);
    expect(derive(early, withBaseline("ramp_arrival"), { trailing: trailing() }).events).toEqual([]);
    const gated = derive(early, withBaseline("gated_arrival"), { trailing: trailing() }).events;
    expect(gated).toHaveLength(1);
    expect(gated[0].peakAt).toBe(at(30));
    expect(Date.parse(gated[0].arrivalAt)).toBeLessThan(start + 48 * HOUR);
  });
  it("still requires the gated episode to close before the horizon ends", () => {
    const open = series((hour) => hour >= 60 ? { heightM: 1.2, directionDeg: 170, periodS: 13 } : quiet);
    expect(() => derive(open, timingOnly)).toThrow("unclosed_episode");
    expect(() => derive(open, OLD_POLICY)).toThrow("unclosed_episode");
  });
  it("combines with the 2.0 gate and trailing baseline", () => {
    const result = derive(series(ramp), both, { trailing: trailing() });
    expect(result.events.map((event) => [event.arrivalAt, event.peakAt])).toEqual([[at(65), at(70)]]);
  });
});

describe("ramp primitive", () => {
  const steps = (values: Array<[number, number | null]>) => values.map(([heightFt, faceHeightFt]) => ({ heightFt, faceHeightFt }));
  it("stops at heights at or below baseline, picks the first maximum and the half-rise arrival", () => {
    const result = findPartitionRamp({ steps: steps([[5, 5], [2, 2], [3, 3], [5, 6], [9, 10], [9, 10], [4, 4], [2, 2], [8, 9]]), episodeStart: 4, episodeEnd: 5, baselineHeightFt: 2, arrivalRiseFraction: 0.5 });
    expect(result).toEqual({ start: 2, end: 6, arrival: 4, peak: 4 });
    expect(findPartitionRamp({ steps: steps([[5, 5], [2, 2], [3, 3], [5, 6], [9, 10], [9, 10], [4, 4], [2, 2], [8, 9]]), episodeStart: 4, episodeEnd: 5, baselineHeightFt: 2, arrivalRiseFraction: 0.4 }))
      .toEqual({ start: 2, end: 6, arrival: 3, peak: 4 });
  });
  it("ignores steps without a finite face height and returns null when none remain", () => {
    expect(findPartitionRamp({ steps: steps([[4, null], [5, null]]), episodeStart: 0, episodeEnd: 1, baselineHeightFt: 1, arrivalRiseFraction: 0.5 })).toBeNull();
  });
});

describe("attested derivation reads the trailing baseline only when the policy asks", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  async function run(policy: SwellWatchPolicy, trailingData: unknown) {
    const { fixtures, beaches } = loadBacktest();
    const fixture = fixtures.find((item) => item.name === "oceanbeach-0923")!;
    const rpc = jest.fn(async (name: string) => name === "read_swell_watch_attested_run" ? (await import("@/__tests__/helpers/swell-watch-epoch-7-backtest")).backtestClient(fixture).rpc(name)
      : { data: trailingData, error: null });
    const result = await deriveAttestedSwellWatchRun({ qualificationRule: "model_reported_swell_system_count.v1", providerBatchId: fixture.providerBatchId,
      sourcePointId: fixture.sourcePointId, now: fixture.evaluatedAt, beach: beaches[fixture.sourcePointId] as never, policy }, { rpc } as never);
    return { result, rpc, fixture, id };
  }
  it("reads once under the legacy policy and twice with exact arguments under epoch 7", async () => {
    expect((await run(OLD_POLICY, [])).rpc).toHaveBeenCalledTimes(1);
    const { fixtures } = loadBacktest();
    const fixture = fixtures.find((item) => item.name === "oceanbeach-0923")!;
    const { backtestClient } = await import("@/__tests__/helpers/swell-watch-epoch-7-backtest");
    const { rpc, result } = await run(both, (await backtestClient(fixture).rpc("read_swell_watch_trailing_baseline")).data);
    expect(rpc.mock.calls).toEqual([
      ["read_swell_watch_attested_run", { p_provider_batch_id: fixture.providerBatchId, p_source_point_id: fixture.sourcePointId }],
      ["read_swell_watch_trailing_baseline", { p_provider_batch_id: fixture.providerBatchId, p_source_point_id: fixture.sourcePointId, p_trailing_hours: 48, p_maximum_lead_hours: 12 }],
    ]);
    expect(result).toMatchObject({ kind: "derived", derivation: { version: "swell-watch-horizon-derivation.v4" } });
  });
  it("suppresses with missing_baseline when too few trailing frames exist and throws on a read error", async () => {
    expect((await run(both, [])).result).toEqual({ kind: "suppressed", reason: "missing_baseline" });
    const { fixtures, beaches } = loadBacktest();
    const fixture = fixtures[0];
    const rpc = async (name: string) => name === "read_swell_watch_trailing_baseline" ? { data: null, error: { message: "current provider attestation is required" } }
      : (await import("@/__tests__/helpers/swell-watch-epoch-7-backtest")).backtestClient(fixture).rpc(name);
    await expect(deriveAttestedSwellWatchRun({ qualificationRule: "model_reported_swell_system_count.v1", providerBatchId: fixture.providerBatchId,
      sourcePointId: fixture.sourcePointId, now: fixture.evaluatedAt, beach: beaches[fixture.sourcePointId] as never, policy: both }, { rpc } as never)).rejects.toThrow("current provider attestation is required");
  });
});

describe("backtest of the nine scored swells (persisted production runs, SELECT-only capture)", () => {
  const summarize = (result: Awaited<ReturnType<typeof replay>>) => result.kind === "suppressed" ? result.reason
    : result.events.map((event) => `${event.arrivalAt.slice(5, 16)}/${event.peakAt.slice(5, 16)}`);
  it("reproduces the persisted old events exactly and records the new outcomes", async () => {
    const { fixtures, beaches } = loadBacktest();
    expect(fixtures).toHaveLength(9);
    const outcomes: Record<string, { old: unknown; new: unknown }> = {};
    for (const fixture of fixtures) {
      const old = await replay(fixture, beaches[fixture.sourcePointId], OLD_POLICY);
      expect(old.kind).toBe("derived");
      if (old.kind === "derived") {
        expect(old.events.some((event) => event.arrivalAt === fixture.oldArrivalAt.replace(/Z$/, ".000Z") && event.peakAt === fixture.oldPeakAt.replace(/Z$/, ".000Z"))).toBe(true);
      }
      outcomes[fixture.name] = { old: summarize(old), new: summarize(await replay(fixture, beaches[fixture.sourcePointId], both)) };
    }
    expect(outcomes).toMatchSnapshot();
  });
});
