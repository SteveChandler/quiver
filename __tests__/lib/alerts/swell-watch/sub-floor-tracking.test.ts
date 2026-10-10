/** @jest-environment node */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import v2 from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import v3 from "@/docs/operations/swell-watch-no-send-producer-config-v3-proposed.json";
import { deriveSwellWatchHorizon } from "@/lib/alerts/swell-watch/horizon-derivation";
import { resolveNativeSamplingProfile, SUB_FLOOR_TRACKING_MODE } from "@/lib/alerts/swell-watch/native-sampling";
import { calculateSwellWatchPolicyHash, verifySwellWatchPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { evaluateSwellWatchPhysicalImpact } from "@/lib/alerts/swell-watch/impact-evaluator";
import { capSwellWatchTrackingEvents, ingestAttestedSwellWatchCohort } from "@/lib/alerts/swell-watch/provider-impact-ingestion";
import { evaluateSwellWatchShadow } from "@/lib/alerts/swell-watch/shadow-evaluation";
import { loadMatchedSwellWatchHistory } from "@/lib/alerts/swell-watch/persisted-history";
import { loadSwellWatchAudience } from "@/lib/alerts/swell-watch/audience";
import { sourceIdentity } from "@/__tests__/helpers/swell-watch-retained";

jest.mock("@/lib/alerts/swell-watch/provider-impact-ingestion", () => ({
  ...jest.requireActual("@/lib/alerts/swell-watch/provider-impact-ingestion"), ingestAttestedSwellWatchCohort: jest.fn(),
}));
jest.mock("@/lib/alerts/swell-watch/persisted-history", () => ({ loadMatchedSwellWatchHistory: jest.fn() }));
jest.mock("@/lib/alerts/swell-watch/audience", () => ({ loadSwellWatchAudience: jest.fn() }));

const current = v2.policy as SwellWatchPolicy;
const floored = v3.policy as SwellWatchPolicy;
const issuedAt = "2026-09-13T12:00:00.000Z";
const at = (hour: number): string => new Date(Date.parse(issuedAt) + hour * 3_600_000).toISOString();

/** s1 is calm and outside the beach window; s2 is the in-window swell between `from` and `to`. */
function frames(from: number, to: number, swellPeriod = 13) {
  return Array.from({ length: 168 }, (_, hour) => (["s1", "s2"] as const).map((sourceSlot, index) => {
    const swell = index === 1 && hour >= from && hour <= to;
    return { provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", sourceSlot, forecastAt: at(hour),
      heightM: swell ? 1.5 : 0.3, periodS: index ? swellPeriod : 9, directionDeg: index ? 170 : 260, completeness: "complete" as const };
  }));
}
function derive(series: ReturnType<typeof frames>, policy: SwellWatchPolicy, options: { trackingMode?: typeof SUB_FLOOR_TRACKING_MODE; now?: string } = {}) {
  return deriveSwellWatchHorizon({ series, qualificationRule: "complete_partitions.v1", policy, now: options.now ?? issuedAt,
    ...(options.trackingMode ? { trackingMode: options.trackingMode } : {}),
    beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 },
    sampling: { profile: resolveNativeSamplingProfile(sourceIdentity), issuedAt } });
}

describe("period floor policy", () => {
  it("leaves the approved policy and its hash untouched, and adds exactly one value in the proposed policy", () => {
    expect(verifySwellWatchPolicy(current)).toBe(true);
    expect(current.value_hash).toBe("86616945b7f78ebb57c809403547bec60339b7a77a734bdecf1977f70dd70d5f");
    expect(current.policy_values.partition_matching.minimum_period_s).toBeUndefined();
    expect(verifySwellWatchPolicy(floored)).toBe(true);
    expect(floored.value_hash).toBe("f5535096a2eb18e911f22a9adf0dbd2e17b5b214c6c266e5659c3959c86eb95e");
    expect(floored.profile_id).toBe("swell-watch-no-send-evaluation-proposal.v3");
    expect(floored.provenance).toBe("pending_review");
    expect(floored.approval_evidence).toBeNull();
    expect({ ...floored.policy_values, partition_matching: { ...floored.policy_values.partition_matching, minimum_period_s: undefined } })
      .toEqual({ ...current.policy_values, partition_matching: { ...current.policy_values.partition_matching, minimum_period_s: undefined } });
    expect(floored.policy_values.partition_matching.minimum_period_s).toBe(9);
  });

  it("rejects any floor other than the reviewed 9 s value, and any hash that does not cover it", () => {
    const tampered = { ...floored, policy_values: { ...floored.policy_values,
      partition_matching: { ...floored.policy_values.partition_matching, minimum_period_s: 8 } } };
    tampered.value_hash = calculateSwellWatchPolicyHash(tampered as never);
    expect(verifySwellWatchPolicy(tampered)).toBe(false);
    expect(verifySwellWatchPolicy({ ...floored, value_hash: current.value_hash })).toBe(false);
  });

  it("is unchanged under the current policy and excludes wind sea only under the amended policy", () => {
    const windSea = frames(78, 84, 7);
    expect(derive(windSea, current).events).toHaveLength(1);
    expect(derive(windSea, current).events[0].impact.partition.periodS).toBe(7);
    expect(derive(windSea, floored)).toMatchObject({ events: [] });
    expect(derive(frames(78, 84, 8.9), floored).events).toEqual([]);
    expect(derive(frames(78, 84, 9), floored).events).toHaveLength(1);
    // A swell the floor does not touch derives identically under both policies.
    const swell = frames(78, 84, 13);
    const withoutPolicyIdentity = (events: ReturnType<typeof derive>["events"]) => events.map(({ impact: { policyId: _id, policyHash: _hash, ...impact }, ...event }) => ({ ...event, impact }));
    expect(withoutPolicyIdentity(derive(swell, floored).events)).toEqual(withoutPolicyIdentity(derive(swell, current).events));
    expect(derive(swell, floored).derivation).toEqual(derive(swell, current).derivation);
  });

  it("reports a distinct suppression reason for the physical evaluator", () => {
    const input = { baselineHeightFt: 0.5, baselineEnergy: 1, beach: { swell_window_center_deg: 170, swell_window_halfwidth_deg: 30 },
      seamContinuous: true, sourceCoherent: true,
      partition: { provider: "open_meteo" as const, evaluationId: "genuine_completed:fixture", forecastAt: at(0), sourceSlot: "s1" as const,
        heightM: 1.5, periodS: 7, directionDeg: 170, completeness: "complete" as const } };
    expect(evaluateSwellWatchPhysicalImpact({ ...input, policy: current }).kind).toBe("candidate");
    expect(evaluateSwellWatchPhysicalImpact({ ...input, policy: floored })).toEqual({ kind: "suppressed", reason: "below_period_floor" });
  });
});

describe("sub-floor tracking", () => {
  it("is invisible by default: same events, same derivation, no tracking key", () => {
    const series = frames(70, 76);
    const base = derive(series, current);
    const tracked = derive(series, current, { trackingMode: SUB_FLOOR_TRACKING_MODE });
    expect(base).not.toHaveProperty("trackingEvents");
    expect(base.events).toHaveLength(1);
    expect(tracked.events).toEqual(base.events);
    expect(tracked.derivation).toEqual(base.derivation);
    expect(tracked.baseline).toEqual(base.baseline);
    expect(tracked.trackingEvents).toEqual([]);
  });

  it("never changes whether the approved derivation succeeds", () => {
    const series = frames(20, 26);
    series[78][1] = { ...series[78][1], periodS: -1 };
    expect(() => derive(series, current)).toThrow("incomplete_partition");
    expect(() => derive(series, current, { trackingMode: SUB_FLOOR_TRACKING_MODE })).toThrow("incomplete_partition");
  });

  it("keeps tracking a swell that has dropped below the actionability floor", () => {
    const series = frames(20, 26);
    expect(derive(series, current).events).toEqual([]);
    expect(derive(series, current)).not.toHaveProperty("trackingEvents");
    const result = derive(series, current, { trackingMode: SUB_FLOOR_TRACKING_MODE });
    expect(result.events).toEqual([]);
    expect(result.trackingEvents).toEqual([expect.objectContaining({
      sourceSlot: "s2", phase: "approaching", onsetObserved: true, arrivalAt: at(20), peakAt: at(20), periodS: 13, directionDeg: 170,
      heightM: 1.5, arrivalWindow: { earliestAt: at(19), latestAt: at(20) }, closureWindow: { earliestAt: at(26), latestAt: at(27) },
    })]);
  });

  it("reports a swell already under way as in progress, and drops it once it has passed", () => {
    const underway = derive(frames(0, 10), current, { trackingMode: SUB_FLOOR_TRACKING_MODE });
    expect(underway.trackingEvents).toEqual([expect.objectContaining({ phase: "in_progress", onsetObserved: false, arrivalAt: at(0) })]);
    const passed = derive(frames(5, 10), current, { trackingMode: SUB_FLOOR_TRACKING_MODE, now: at(30) });
    expect(passed.trackingEvents).toEqual([]);
    const open = derive(frames(5, 10), current, { trackingMode: SUB_FLOOR_TRACKING_MODE, now: at(8) });
    expect(open.trackingEvents).toHaveLength(1);
  });

  it("leaves actionable swells to the approved events and tracks nothing beyond the floor", () => {
    const result = derive(frames(70, 76), current, { trackingMode: SUB_FLOOR_TRACKING_MODE });
    expect(result.events).toHaveLength(1);
    expect(result.trackingEvents).toEqual([]);
  });

  it("tracks neither wind sea under the amended policy nor sub-9 s partitions under any policy it excludes", () => {
    const windSea = frames(20, 26, 7);
    expect(derive(windSea, current, { trackingMode: SUB_FLOOR_TRACKING_MODE }).trackingEvents).toHaveLength(1);
    expect(derive(windSea, floored, { trackingMode: SUB_FLOOR_TRACKING_MODE }).trackingEvents).toEqual([]);
  });

  it("caps tracking per feed", () => {
    const row = { sourceSlot: "s1" as const, phase: "approaching" as const, onsetObserved: true, arrivalAt: at(1),
      arrivalWindow: { earliestAt: at(0), latestAt: at(1) }, peakAt: at(2), peakWindow: { earliestAt: at(1), latestAt: at(3) }, closureWindow: null,
      heightM: 1, periodS: 12, directionDeg: 170, heightFt: 3.3, projectedFaceHeightFt: 3 };
    const events = [...Array(12)].map(() => ({ ...row, sourcePointId: "a" })).concat([{ ...row, sourcePointId: "b" }]);
    const capped = capSwellWatchTrackingEvents(events);
    expect(capped.filter((event) => event.sourcePointId === "a")).toHaveLength(10);
    expect(capped.filter((event) => event.sourcePointId === "b")).toHaveLength(1);
  });
});

describe("study result", () => {
  const scopes = ["beach-a", "beach-b"].map((sourcePointId) => ({ sourcePointId, regionKey: "region", beach: {} }));
  const base = { qualificationRule: "complete_partitions.v1", providerBatchId: "batch", policy: v2.policy, now: "2026-09-06T00:00:00Z", forecastDays: 7, scopes };
  const client = { rpc: jest.fn(() => ({ data: [{ observed_at: "2026-09-06T00:00:00Z", recorded_pairs_24h: 0 }], error: null })) };
  const trackingEvent = { sourcePointId: "beach-a", sourceSlot: "s2", phase: "approaching" };

  beforeEach(() => {
    jest.mocked(ingestAttestedSwellWatchCohort).mockReset();
    jest.mocked(loadMatchedSwellWatchHistory).mockReset();
    jest.mocked(loadSwellWatchAudience).mockReset().mockResolvedValue([]);
    jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValue({ kind: "ingested", runs: [], derivation: null,
      scopeOutcomes: scopes.map(({ sourcePointId }) => ({ sourcePointId, status: "derived", reason: null })) } as never);
  });

  it("omits tracking keys entirely under the default authority", async () => {
    const result = await evaluateSwellWatchShadow(base as never, client as never);
    expect(Object.keys(result)).not.toEqual(expect.arrayContaining(["trackingMode"]));
    expect(result).not.toHaveProperty("trackingEvents");
    expect(JSON.stringify(result)).not.toContain("tracking");
    expect(jest.mocked(ingestAttestedSwellWatchCohort).mock.calls[0][0]).not.toHaveProperty("trackingMode");
  });

  it("carries tracking as top-level fields, outside scopeOutcomes, when the authority enables it", async () => {
    jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValue({ kind: "ingested", runs: [], derivation: null,
      trackingEvents: [trackingEvent], scopeOutcomes: scopes.map(({ sourcePointId }) => ({ sourcePointId, status: "derived", reason: null })) } as never);
    const result = await evaluateSwellWatchShadow({ ...base, trackingMode: SUB_FLOOR_TRACKING_MODE } as never, client as never);
    expect(result).toMatchObject({ status: "evaluated", trackingMode: SUB_FLOOR_TRACKING_MODE, trackingEvents: [trackingEvent], candidateCount: 0,
      stableRegionalEventCount: 0, preSafetyRecipientsThisEvaluation: 0, enqueued: 0 });
    expect(result.scopeOutcomes).toEqual(scopes.map(({ sourcePointId }) => ({ sourcePointId, status: "derived", reason: null })));
    expect(loadMatchedSwellWatchHistory).not.toHaveBeenCalled();
  });

  it("states an empty tracking set when every scope is suppressed", async () => {
    jest.mocked(ingestAttestedSwellWatchCohort).mockResolvedValue({ kind: "suppressed", reason: "stale_run", sourcePointId: "beach-a", derivation: null,
      scopeOutcomes: scopes.map(({ sourcePointId }) => ({ sourcePointId, status: "suppressed", reason: "stale_run" })) } as never);
    const result = await evaluateSwellWatchShadow({ ...base, trackingMode: SUB_FLOOR_TRACKING_MODE } as never, client as never);
    expect(result).toMatchObject({ status: "suppressed", trackingMode: SUB_FLOOR_TRACKING_MODE, trackingEvents: [] });
  });

  it("only ever hands cohort ingestion the mode the authority named", async () => {
    await evaluateSwellWatchShadow({ ...base, trackingMode: SUB_FLOOR_TRACKING_MODE } as never, client as never);
    expect(jest.mocked(ingestAttestedSwellWatchCohort).mock.calls[0][0]).toMatchObject({ trackingMode: SUB_FLOOR_TRACKING_MODE });
  });
});

describe("authority and migration contract", () => {
  const migration = readFileSync(join(process.cwd(), "supabase/migrations/20261010120000_add_swell_watch_study_sub_floor_tracking.sql"), "utf8");
  const activation = readFileSync(join(process.cwd(), "docs/operations/swell-watch-study-amend-tracking.sql"), "utf8");
  const periodFloor = readFileSync(join(process.cwd(), "docs/operations/swell-watch-study-amend-period-floor.sql"), "utf8");

  it("binds tracking to the authority without touching the qualifying-day cycle or send controls", () => {
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS tracking_mode text NOT NULL DEFAULT 'none'");
    expect(migration).toContain("jsonb_build_object(''trackingMode'',NEW.tracking_mode)");
    expect(migration).toContain("''trackingMode'',a.tracking_mode");
    expect(migration).toContain("study tracking requires a tracking authority");
    expect(migration).not.toContain("swell_watch_study_cycle_start(p_epoch");
    expect(migration).not.toMatch(/swell_watch_(automation_control|production_approval_authority)\b.*INSERT/);
    expect(migration).toContain("current_user <> 'postgres'");
    expect(migration.trim()).toMatch(/^--[\s\S]*BEGIN;[\s\S]*COMMIT;$/);
  });

  it("keeps both activation scripts inert until an approval sentence is recorded", () => {
    for (const script of [activation, periodFloor]) {
      expect(script).toContain("<<FILL AT APPROVAL");
      expect(script).toContain("approval evidence not recorded");
      expect(script).toMatch(/exact retry only/i);
    }
    expect(periodFloor).toContain(v3.policy.value_hash);
    expect(activation).not.toContain(v3.policy.value_hash);
  });
});
