import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import proposed from "@/docs/operations/swell-watch-no-send-producer-config-v2-proposed.json";
import { deriveAttestedSwellWatchRun } from "@/lib/alerts/swell-watch/attested-run";
import { calculateSwellWatchPolicyHash, type SwellWatchDetectionPolicy, type SwellWatchPolicy } from "@/lib/alerts/swell-watch/policy";
import { measureSwellWatchImpact } from "@/lib/alerts/swell-watch/impact-evaluator";

export const BACKTEST_DIR = join(process.cwd(), "__tests__/fixtures/swell-watch-epoch-7-backtest");
export const OLD_POLICY = proposed.policy as SwellWatchPolicy;
const HOUR = 3_600_000;

export interface BacktestFixture {
  name: string; providerBatchId: string; sourcePointId: string; issuedAt: string; evaluatedAt: string;
  oldArrivalAt: string; oldPeakAt: string; buoy: { station: string; peakAt: string };
  frames: number[][]; trailing: number[][];
}
type Beach = { swell_window_center_deg: number; swell_window_halfwidth_deg: number } & Record<string, unknown>;

export function loadBacktest(): { fixtures: BacktestFixture[]; beaches: Record<string, Beach> } {
  const beaches = JSON.parse(readFileSync(join(BACKTEST_DIR, "beaches.json"), "utf8")) as Record<string, Beach>;
  const fixtures = readdirSync(BACKTEST_DIR).filter((file) => file !== "beaches.json" && file.endsWith(".json")).sort()
    .map((file) => JSON.parse(readFileSync(join(BACKTEST_DIR, file), "utf8")) as BacktestFixture);
  return { fixtures, beaches };
}

export function policyVariant(input: { energy?: number; detection?: SwellWatchDetectionPolicy }): SwellWatchPolicy {
  const base = structuredClone(OLD_POLICY);
  const policy_values = { ...base.policy_values, ...(input.detection ? { detection: input.detection } : {}),
    local_significance: { ...base.policy_values.local_significance, ...(input.energy ? { minimum_energy_ratio: input.energy } : {}) } };
  const unsigned = { ...base, profile_id: "swell-watch-backtest-variant", policy_values };
  return { ...unsigned, value_hash: calculateSwellWatchPolicyHash(unsigned) };
}

export const TRAILING_BASELINE = { source: "trailing_persisted_frames.v1", trailing_hours: 48, maximum_lead_hours: 12, minimum_trailing_frames: 36 } as const;
export const RAMP_TIMING = { source: "partition_ramp.v1", arrival_rise_fraction: 0.5, actionability_basis: "ramp_arrival" } as const;

const iso = (ms: number): string => new Date(ms).toISOString();
const components = (row: number[]) => [0, 3].map((offset, index) => {
  const unavailable = row[offset + 1] === 0;
  return { sourceSlot: index === 0 ? "s1" : "s2", heightM: row[offset], periodS: row[offset + 1], directionDeg: row[offset + 2],
    ...(unavailable ? { unavailableReason: "provider_zero_tuple" } : {}), rawFieldProvenance: {}, timeProvenance: {} };
});

export function backtestClient(fixture: BacktestFixture, trailingHours = 48): { rpc: (name: string) => Promise<{ data: unknown; error: null }> } {
  const issued = Date.parse(fixture.issuedAt);
  const run = { source: { provider: "open_meteo", transportProvider: "open_meteo_single_runs", model: "ncep_gfswave016", upstreamModelProvider: "ncep",
    sourcePointId: fixture.sourcePointId, issuedAt: fixture.issuedAt, issuanceId: fixture.sourcePointId, evaluationId: `genuine_completed:${fixture.providerBatchId}`,
    providerBatchId: fixture.providerBatchId, revisionSetId: fixture.providerBatchId }, forecastDays: 7, selectedGrid: {},
  samples: fixture.frames.map((row, hour) => ({ forecastAt: iso(issued + hour * HOUR), components: components(row) })) };
  const trailing = fixture.trailing.filter(([hoursBefore]) => hoursBefore <= trailingHours)
    .map(([hoursBefore, runHoursBefore, ...row]) => ({ forecastAt: iso(issued - hoursBefore * HOUR), runUtc: iso(issued - runHoursBefore * HOUR),
      components: components(row).map(({ rawFieldProvenance: _raw, timeProvenance: _time, ...part }) => part) }))
    .sort((left, right) => Date.parse(left.forecastAt) - Date.parse(right.forecastAt));
  return { rpc: async (name: string) => ({ data: name === "read_swell_watch_attested_run" ? run : trailing, error: null }) };
}

export async function replay(fixture: BacktestFixture, beach: Beach, policy: SwellWatchPolicy, trailingHours = 48) {
  return deriveAttestedSwellWatchRun({ qualificationRule: "model_reported_swell_system_count.v1", providerBatchId: fixture.providerBatchId,
    sourcePointId: fixture.sourcePointId, now: fixture.evaluatedAt, beach: beach as never, policy }, backtestClient(fixture, trailingHours) as never);
}

/** Face-height alternative for the backtest only: peak face over the highest in-window face in the baseline frames. */
export function baselineFaceHeightFt(fixture: BacktestFixture, beach: Beach, source: "forecast_front" | "trailing"): number | null {
  const issued = Date.parse(fixture.issuedAt);
  const rows = source === "trailing" ? fixture.trailing.map(([, , ...row]) => row) : fixture.frames.slice(0, 48);
  const center = beach.swell_window_center_deg;
  const half = beach.swell_window_halfwidth_deg;
  const faces: number[] = [];
  for (const row of rows) {
    for (const offset of [0, 3]) {
      const [heightM, periodS, directionDeg] = row.slice(offset, offset + 3);
      const delta = Math.abs(directionDeg - center) % 360;
      if (periodS === 0 || Math.min(delta, 360 - delta) > half) continue;
      const measured = measureSwellWatchImpact({ partition: { provider: "open_meteo", evaluationId: "backtest", forecastAt: iso(issued), sourceSlot: "s1",
        heightM, periodS, directionDeg, completeness: "complete" }, baselineHeightFt: 0, baselineEnergy: 1, beach: beach as never });
      if (measured) faces.push(measured.projectedFaceHeightFt);
    }
  }
  return faces.length ? Math.max(...faces) : null;
}
