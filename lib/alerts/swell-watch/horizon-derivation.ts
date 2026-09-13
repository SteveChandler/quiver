import { GFS_NATIVE_CONTRACT_REF, selectGfsNativeFrames, type NativeSamplingEvidence } from "./native-step-selection";
import { evaluateSwellWatchImpact, evaluateSwellWatchPhysicalImpact } from "./impact-evaluator";
import type { SwellPartitionObservation } from "./partition-normalizer";
import type { SwellWatchPolicy } from "./policy";
import type { BeachTerrainConfig } from "@/lib/utils/wave-height-transformer";
import { metersToFeet } from "@/lib/utils/unit-conversions";

const HOUR = 3_600_000;
type Impact = Extract<ReturnType<typeof evaluateSwellWatchImpact>, { kind: "candidate" }>;
interface NativeEventTiming {
  // Existing arrivalAt/peakAt are retained-sample times, not exact ocean-onset/peak times.
  arrivalAfter: string;
  arrivalAtOrBefore: string;
  closureAfter: string;
  closureAtOrBefore: string;
  peakKind: "maximum_native_sample";
}
interface Event { arrivalAt: string; peakAt: string; impact: Impact; confidence: number | null; nativeTiming?: NativeEventTiming }

function distance(left: number, right: number): number {
  const delta = Math.abs(left - right) % 360;
  return Math.min(delta, 360 - delta);
}

function follows(left: SwellPartitionObservation, right: SwellPartitionObservation, policy: SwellWatchPolicy): boolean {
  return distance(left.directionDeg, right.directionDeg) <= policy.policy_values.partition_matching.maximum_direction_delta_deg
    && Math.abs(left.periodS - right.periodS) <= policy.policy_values.partition_matching.maximum_period_delta_s;
}

export function matchSwellWatchFrame(active: SwellPartitionObservation[][], frame: SwellPartitionObservation[], policy: SwellWatchPolicy): Array<number | null> {
  const legacy = policy.policy_values.partition_matching.trajectory_assignment === undefined;
  if (legacy) {
    const matches = frame.map((part) => active.filter((track) => follows(track[track.length - 1], part, policy)));
    if (matches.some((items) => items.length > 1) || (matches[0][0] && matches[0][0] === matches[1][0])) throw new Error("ambiguous_partition_path");
    return matches.map((items) => items.length ? active.indexOf(items[0]) : null);
  }
  const candidates: Array<{ links: Array<number | null>; cardinality: number; worst: number; sum: number }> = [];
  for (const links of [[0, 1], [1, 0], [0, null], [null, 0], [1, null], [null, 1], [null, null]] as Array<Array<number | null>>) {
    if (links.some((previous, current) => previous !== null && !follows(active[previous][active[previous].length - 1], frame[current], policy))) continue;
    const scores = links.flatMap((previous, current) => previous === null ? [] : [
      distance(active[previous][active[previous].length - 1].directionDeg, frame[current].directionDeg) / policy.policy_values.partition_matching.maximum_direction_delta_deg,
      Math.abs(active[previous][active[previous].length - 1].periodS - frame[current].periodS) / policy.policy_values.partition_matching.maximum_period_delta_s,
    ]);
    candidates.push({ links, cardinality: scores.length / 2, worst: Math.max(0, ...scores), sum: scores.reduce((total, score) => total + score, 0) });
  }
  const maxCardinality = Math.max(...candidates.map((candidate) => candidate.cardinality));
  const maxCandidates = candidates.filter((candidate) => candidate.cardinality === maxCardinality);
  const bestWorst = Math.min(...maxCandidates.map((candidate) => candidate.worst));
  const minimax = maxCandidates.filter((candidate) => candidate.worst === bestWorst);
  const bestSum = Math.min(...minimax.map((candidate) => candidate.sum));
  const winners = minimax.filter((candidate) => candidate.sum === bestSum);
  if (winners.length !== 1) throw new Error("ambiguous_partition_path");
  return winners[0].links;
}

/** Pure calculation over validated complete frames; does not establish evidence or release authority. */
export function deriveSwellWatchHorizon(input: {
  series: SwellPartitionObservation[][];
  now: string;
  beach: BeachTerrainConfig & { swell_window_center_deg: number; swell_window_halfwidth_deg: number };
  policy: SwellWatchPolicy;
  sampling?: NativeSamplingEvidence;
}): { baseline: { heightFt: number; energy: number }; events: Event[];
  sampling?: NativeSamplingEvidence & { contractRef: typeof GFS_NATIVE_CONTRACT_REF; retainedFrames: number; trackingFrames: number } } {
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

  // Validate all hourly inputs before selecting native frames. Interpolated missing
  // data is not silently discarded. Native selection changes tracking, not evidence.
  const selected = input.sampling ? selectGfsNativeFrames(series, input.sampling) : null;
  const trackingSeries = selected?.frames ?? series;
  if (Date.parse(trackingSeries[trackingSeries.length - 1][0].forecastAt) <= requiredEnd) {
    throw new Error("incomplete_horizon");
  }
  const tracks: SwellPartitionObservation[][] = trackingSeries[0].map((part) => [part]);
  let active = tracks.slice();
  for (const frame of trackingSeries.slice(1)) {
    const matches = matchSwellWatchFrame(active, frame, policy);
    active = frame.map((part, index) => {
      const previous = matches[index];
      const track = previous === null ? undefined : active[previous];
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
  const boundedActionable = (arrivalAt: string, after: string | null): boolean => {
    if (!selected || after === null) return actionable(arrivalAt);
    const min = Date.parse(input.now) + policy.policy_values.actionability.minimum_days_before_arrival * 24 * HOUR;
    const max = requiredEnd;
    const lower = Date.parse(after);
    const upper = Date.parse(arrivalAt);
    if (upper < min || lower >= max) return false;
    if (lower < min || upper > max) throw new Error("ambiguous_arrival_window");
    return true;
  };
  for (const track of tracks) {
    let episode: { arrivalAt: string; after: string | null; lastCandidateAt: string;
      peak: SwellPartitionObservation; projected: number } | null = null;
    for (const [index, part] of track.entries()) {
      const physical = evaluateSwellWatchPhysicalImpact({ ...physicalInput, partition: part });
      if (physical.kind === "candidate") {
        if (!episode) {
          if (index === 0 && actionable(part.forecastAt)) throw new Error("unbounded_episode");
          episode = { arrivalAt: part.forecastAt, after: index ? track[index - 1].forecastAt : null,
            lastCandidateAt: part.forecastAt, peak: part, projected: physical.projectedFaceHeightFt };
        } else if (physical.projectedFaceHeightFt > episode.projected) {
          episode.peak = part;
          episode.projected = physical.projectedFaceHeightFt;
        }
        episode.lastCandidateAt = part.forecastAt;
        continue;
      }
      if (physical.reason !== "low_significance" && physical.reason !== "non_impactful") throw new Error(physical.reason);
      if (episode && boundedActionable(episode.arrivalAt, episode.after)) {
        const impact = evaluateSwellWatchImpact({ ...physicalInput, partition: episode.peak,
          arrivalAt: episode.arrivalAt, now: new Date(input.now) });
        if (impact.kind !== "candidate") throw new Error(impact.reason);
        events.push({ arrivalAt: episode.arrivalAt, peakAt: episode.peak.forecastAt, impact, confidence: null,
          ...(selected ? { nativeTiming: { arrivalAfter: episode.after!, arrivalAtOrBefore: episode.arrivalAt,
            closureAfter: episode.lastCandidateAt, closureAtOrBefore: part.forecastAt,
            peakKind: "maximum_native_sample" as const } } : {}) });
      }
      episode = null;
    }
    if (episode && boundedActionable(episode.arrivalAt, episode.after)) throw new Error("unclosed_episode");
  }
  events.sort((left, right) => Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt)
    || Date.parse(left.peakAt) - Date.parse(right.peakAt)
    || left.impact.partition.sourceSlot.localeCompare(right.impact.partition.sourceSlot));
  return { baseline, events, ...(selected ? { sampling: { ...input.sampling!,
    contractRef: GFS_NATIVE_CONTRACT_REF, retainedFrames: series.length, trackingFrames: trackingSeries.length } } : {}) };
}
