import { selectNativeFrames, verifyInterpolationWitness, SWELL_WATCH_DERIVATION_VERSION, type NativeSamplingProfile } from "./native-sampling";
import { evaluateSwellWatchImpact, evaluateSwellWatchPhysicalImpact } from "./impact-evaluator";
import type { SwellPartitionObservation } from "./partition-normalizer";
import type { SwellWatchPolicy } from "./policy";
import type { BeachTerrainConfig } from "@/lib/utils/wave-height-transformer";
import { metersToFeet } from "@/lib/utils/unit-conversions";

const HOUR = 3_600_000;
type Impact = Extract<ReturnType<typeof evaluateSwellWatchImpact>, { kind: "candidate" }>;
interface Window { earliestAt: string; latestAt: string }
interface Event { arrivalAt: string; peakAt: string; arrivalWindow: Window; peakWindow: Window; closureWindow: Window; impact: Impact; confidence: number | null }
interface TrackStep extends SwellPartitionObservation { nativeIndex: number; gapHoursBefore: number | null }
interface Derivation { version: typeof SWELL_WATCH_DERIVATION_VERSION; samplingProfile: NativeSamplingProfile["id"];
  witness: NativeSamplingProfile["witness"]; nativeFrames: number; interpolatedFrames: number }

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
  sampling: { profile: NativeSamplingProfile; issuedAt: string };
}): { derivation: Derivation; baseline: { heightFt: number; energy: number }; events: Event[] } {
  const { series, policy } = input;
  if (series.length < 144 || series.some((frame) => frame.length !== 2)) throw new Error("incomplete_horizon");
  if (series.some((frame) => frame.some((part) => !Number.isFinite(part.heightM) || part.heightM < 0
    || !Number.isFinite(part.periodS) || part.periodS <= 0 || !Number.isFinite(part.directionDeg)
    || part.directionDeg < 0 || part.directionDeg >= 360))) throw new Error("incomplete_partition");
  const selection = selectNativeFrames(series, input.sampling.profile, input.sampling.issuedAt);
  verifyInterpolationWitness(series, selection);
  const nativeAt = (index: number): string => series[selection.native[index].index][0].forecastAt;
  const requiredEnd = Date.parse(input.now) + policy.policy_values.actionability.maximum_days_before_arrival * 24 * HOUR;
  if (Date.parse(nativeAt(selection.native.length - 1)) <= requiredEnd) throw new Error("incomplete_horizon");
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

  const tracks: TrackStep[][] = series[0].map((part) => [{ ...part, nativeIndex: 0, gapHoursBefore: null }]);
  let active = tracks.slice();
  for (let nativeIndex = 1; nativeIndex < selection.native.length; nativeIndex++) {
    const { index, gapHoursBefore } = selection.native[nativeIndex];
    const frame = series[index].map((part) => ({ ...part, nativeIndex, gapHoursBefore }));
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
  const actionable = (window: Window): boolean => {
    const earliest = (Date.parse(window.earliestAt) - Date.parse(input.now)) / (24 * HOUR);
    const latest = (Date.parse(window.latestAt) - Date.parse(input.now)) / (24 * HOUR);
    const { minimum_days_before_arrival: min, maximum_days_before_arrival: max } = policy.policy_values.actionability;
    if (earliest >= min && latest <= max) return true;
    if (latest < min || earliest > max) return false;
    throw new Error("arrival_window_crosses_actionability");
  };
  for (const track of tracks) {
    let episode: { arrivalWindow: Window; start: number; peak: number; projected: number; actionable: boolean } | null = null;
    for (const [index, part] of track.entries()) {
      const physical = evaluateSwellWatchPhysicalImpact({ ...physicalInput, partition: part });
      if (physical.kind === "candidate") {
        if (!episode) {
          const arrivalWindow = { earliestAt: nativeAt(Math.max(0, part.nativeIndex - 1)), latestAt: part.forecastAt };
          const isActionable = actionable(arrivalWindow);
          if (index === 0 && isActionable) throw new Error("unbounded_episode");
          episode = { arrivalWindow, start: index, peak: index, projected: physical.projectedFaceHeightFt, actionable: isActionable };
        } else if (physical.projectedFaceHeightFt > episode.projected) {
          episode.peak = index;
          episode.projected = physical.projectedFaceHeightFt;
        }
        continue;
      }
      if (physical.reason !== "low_significance" && physical.reason !== "non_impactful") throw new Error(physical.reason);
      if (episode?.actionable) {
        // Latest onset bound is the persisted point estimate. A 3h native step fits within
        // the unchanged 6h arrival/peak matching window; thresholds remain per native step.
        const arrivalAt = episode.arrivalWindow.latestAt;
        const step = track[episode.peak];
        const peak = series[selection.native[step.nativeIndex].index].find((part) => part.sourceSlot === step.sourceSlot)!;
        const impact = evaluateSwellWatchImpact({ ...physicalInput, partition: peak,
          arrivalAt, now: new Date(input.now) });
        if (impact.kind !== "candidate") throw new Error(impact.reason);
        events.push({ arrivalAt, peakAt: peak.forecastAt, arrivalWindow: episode.arrivalWindow,
          peakWindow: { earliestAt: track[Math.max(episode.start, episode.peak - 1)].forecastAt,
            latestAt: track[Math.min(index - 1, episode.peak + 1)].forecastAt },
          closureWindow: { earliestAt: track[index - 1].forecastAt, latestAt: part.forecastAt }, impact, confidence: null });
      }
      episode = null;
    }
    if (episode?.actionable) throw new Error("unclosed_episode");
  }
  events.sort((left, right) => Date.parse(left.arrivalAt) - Date.parse(right.arrivalAt)
    || Date.parse(left.peakAt) - Date.parse(right.peakAt)
    || left.impact.partition.sourceSlot.localeCompare(right.impact.partition.sourceSlot));
  return { derivation: { version: SWELL_WATCH_DERIVATION_VERSION, samplingProfile: input.sampling.profile.id,
    witness: input.sampling.profile.witness, nativeFrames: selection.native.length, interpolatedFrames: selection.interpolated.length }, baseline, events };
}
