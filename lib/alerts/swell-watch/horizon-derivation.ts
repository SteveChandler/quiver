import { evaluateSwellWatchImpact, evaluateSwellWatchPhysicalImpact } from "./impact-evaluator";
import type { SwellPartitionObservation } from "./partition-normalizer";
import type { SwellWatchPolicy } from "./policy";
import type { BeachTerrainConfig } from "@/lib/utils/wave-height-transformer";
import { metersToFeet } from "@/lib/utils/unit-conversions";

const HOUR = 3_600_000;
type Impact = Extract<ReturnType<typeof evaluateSwellWatchImpact>, { kind: "candidate" }>;
interface Event { arrivalAt: string; peakAt: string; impact: Impact; confidence: number | null }

function distance(left: number, right: number): number {
  const delta = Math.abs(left - right) % 360;
  return Math.min(delta, 360 - delta);
}

function follows(left: SwellPartitionObservation, right: SwellPartitionObservation, policy: SwellWatchPolicy): boolean {
  return distance(left.directionDeg, right.directionDeg) <= policy.policy_values.partition_matching.maximum_direction_delta_deg
    && Math.abs(left.periodS - right.periodS) <= policy.policy_values.partition_matching.maximum_period_delta_s;
}

/** Pure calculation over validated complete frames; does not establish evidence or release authority. */
export function deriveSwellWatchHorizon(input: {
  series: SwellPartitionObservation[][];
  now: string;
  beach: BeachTerrainConfig & { swell_window_center_deg: number; swell_window_halfwidth_deg: number };
  policy: SwellWatchPolicy;
}): { baseline: { heightFt: number; energy: number }; events: Event[] } {
  const { series, policy } = input;
  if (series.length < 144 || series.some((frame) => frame.length !== 2)) throw new Error("incomplete_horizon");
  const requiredEnd = Date.parse(input.now) + policy.policy_values.actionability.maximum_days_before_arrival * 24 * HOUR;
  if (Date.parse(series[series.length - 1][0].forecastAt) <= requiredEnd) throw new Error("incomplete_horizon");
  const exposed = series.slice(0, 48).flat().filter((part) => distance(part.directionDeg, input.beach.swell_window_center_deg)
    <= input.beach.swell_window_halfwidth_deg);
  if (!exposed.length) throw new Error("missing_baseline");
  const baseline = { heightFt: 0, energy: 0 };
  for (const part of exposed) {
    const height = metersToFeet(part.heightM, 4);
    if (height === null) throw new Error("missing_baseline");
    baseline.heightFt = Math.max(baseline.heightFt, height);
    baseline.energy = Math.max(baseline.energy, height ** 2 * part.periodS);
  }
  if (baseline.energy <= 0 || !Number.isFinite(baseline.energy)) throw new Error("missing_baseline");

  const tracks: SwellPartitionObservation[][] = series[0].map((part) => [part]);
  let active = tracks.slice();
  for (const frame of series.slice(1)) {
    const matches = frame.map((part) => active.filter((track) => follows(track[track.length - 1], part, policy)));
    // ponytail: ambiguous adjacent matches suppress; reviewed trajectory assignment if this loses useful coverage.
    if (matches.some((items) => items.length > 1) || (matches[0][0] && matches[0][0] === matches[1][0])) {
      throw new Error("ambiguous_partition_path");
    }
    active = frame.map((part, index) => {
      const track = matches[index][0];
      if (track) { track.push(part); return track; }
      const fresh = [part];
      tracks.push(fresh);
      return fresh;
    });
  }

  const events: Event[] = [];
  const physicalInput = { baselineHeightFt: baseline.heightFt, baselineEnergy: baseline.energy,
    beach: input.beach, policy, seamContinuous: true, sourceCoherent: true };
  const actionable = (arrivalAt: string): boolean => {
    const days = (Date.parse(arrivalAt) - Date.parse(input.now)) / (24 * HOUR);
    return days >= policy.policy_values.actionability.minimum_days_before_arrival
      && days <= policy.policy_values.actionability.maximum_days_before_arrival;
  };
  for (const track of tracks) {
    let episode: { arrivalAt: string; peak: SwellPartitionObservation; projected: number } | null = null;
    for (const [index, part] of track.entries()) {
      const physical = evaluateSwellWatchPhysicalImpact({ ...physicalInput, partition: part });
      if (physical.kind === "candidate") {
        if (!episode) {
          if (index === 0 && actionable(part.forecastAt)) throw new Error("unbounded_episode");
          episode = { arrivalAt: part.forecastAt, peak: part, projected: physical.projectedFaceHeightFt };
        } else if (physical.projectedFaceHeightFt > episode.projected) {
          episode.peak = part;
          episode.projected = physical.projectedFaceHeightFt;
        }
        continue;
      }
      if (physical.reason !== "low_significance" && physical.reason !== "non_impactful") throw new Error(physical.reason);
      if (episode && actionable(episode.arrivalAt)) {
        const impact = evaluateSwellWatchImpact({ ...physicalInput, partition: episode.peak,
          arrivalAt: episode.arrivalAt, now: new Date(input.now) });
        if (impact.kind !== "candidate") throw new Error(impact.reason);
        events.push({ arrivalAt: episode.arrivalAt, peakAt: episode.peak.forecastAt, impact, confidence: null });
      }
      episode = null;
    }
    if (episode && actionable(episode.arrivalAt)) throw new Error("unclosed_episode");
  }
  events.sort((left, right) => Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt)
    || Date.parse(left.peakAt) - Date.parse(right.peakAt)
    || left.impact.partition.sourceSlot.localeCompare(right.impact.partition.sourceSlot));
  return { baseline, events };
}


