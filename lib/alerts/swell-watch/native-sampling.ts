import type { SwellPartitionObservation } from "./partition-normalizer";

export const COMPLETE_PARTITIONS_RULE = "complete_partitions.v1" as const;
export const RETAINED_UNAVAILABLE_SECONDARY_RULE = "primary_partition_with_retained_unavailable_secondary.v1" as const;
export const MODEL_REPORTED_PARTITION_COUNT_RULE = "model_reported_partition_count.v1" as const;
export type SwellWatchQualificationRule = typeof COMPLETE_PARTITIONS_RULE | typeof RETAINED_UNAVAILABLE_SECONDARY_RULE | typeof MODEL_REPORTED_PARTITION_COUNT_RULE;
export type SwellWatchFramePart = SwellPartitionObservation | {
  kind: "unavailable"; sourceSlot: "s2"; forecastAt: string; reason: "provider_zero_tuple";
} | {
  kind: "absent"; basis: typeof MODEL_REPORTED_PARTITION_COUNT_RULE; sourceSlot: "s2"; forecastAt: string;
};
export function isObservedPartition(part: SwellWatchFramePart): part is SwellPartitionObservation {
  return !("kind" in part);
}
export function isAbsentPartition(part: SwellWatchFramePart): part is Extract<SwellWatchFramePart, { kind: "absent" }> {
  return "kind" in part && part.kind === "absent";
}

export const SWELL_WATCH_DERIVATION_VERSION = "swell-watch-horizon-derivation.v2" as const;
const profile = {
  id: "ncep_gfswave016.native-1h-to-120h-3h-to-168h.v1",
  transportProvider: "open_meteo_single_runs", model: "ncep_gfswave016",
  upstreamModelProvider: "ncep", provider: "open_meteo", forecastDays: 7,
  segments: [{ fromHour: 0, toHour: 120, stepHours: 1 }, { fromHour: 120, toHour: 168, stepHours: 3 }],
  witness: "provider-linear-interpolation.v1",
  providerReference: "open-meteo/open-meteo@9701689dd81ebef2d478800366c586c8a02c0c19 Sources/App/Gfs/GfsDomain.swift, GfsWaveVariable.swift",
} as const;
export type NativeSamplingProfile = typeof profile;
type Selection = { native: Array<{ index: number; hoursSinceIssue: number; gapHoursBefore: number | null }>; interpolated: number[] };

export function resolveNativeSamplingProfile(source: {
  transportProvider: string; model: string; upstreamModelProvider: string; provider: string; forecastDays: number; issuedAt: string;
}): NativeSamplingProfile {
  if (source.transportProvider !== profile.transportProvider || source.model !== profile.model
    || source.upstreamModelProvider !== profile.upstreamModelProvider || source.provider !== profile.provider
    || source.forecastDays !== profile.forecastDays) throw new Error("unsupported_sampling_profile");
  if (Date.parse(source.issuedAt) % 21_600_000 !== 0) throw new Error("invalid_sampling_issuance");
  return profile;
}

export function selectNativeFrames(
  series: SwellWatchFramePart[][], sampling: NativeSamplingProfile, issuedAt: string,
): Selection {
  resolveNativeSamplingProfile({ ...sampling, issuedAt });
  if (series.length !== sampling.forecastDays * 24) throw new Error("incomplete_horizon");
  const selection: Selection = { native: [], interpolated: [] };
  for (const [index, frame] of series.entries()) {
    if (frame.some((part) => Date.parse(part.forecastAt) !== Date.parse(issuedAt) + index * 3_600_000)) {
      throw new Error("inconsistent_frame_evidence");
    }
    if (!sampling.segments.some((segment) => index >= segment.fromHour && index <= segment.toHour
      && (index - segment.fromHour) % segment.stepHours === 0)) {
      selection.interpolated.push(index);
      continue;
    }
    const previous = selection.native.at(-1);
    selection.native.push({ index, hoursSinceIssue: index, gapHoursBefore: previous ? index - previous.index : null });
  }
  return selection;
}

function directionDistance(left: number, right: number): number {
  const delta = ((left - right) % 360 + 540) % 360 - 180;
  return Math.abs(delta);
}

export function verifyInterpolationWitness(series: SwellWatchFramePart[][], selection: Selection): void {
  for (let bracket = 1; bracket < selection.native.length; bracket++) {
    const a = selection.native[bracket - 1].index;
    const b = selection.native[bracket].index;
    for (let i = a + 1; i < b; i++) {
      const t = (i - a) / (b - a);
      for (const part of series[i]) {
        const left = series[a].find((item) => item.sourceSlot === part.sourceSlot)!;
        const right = series[b].find((item) => item.sourceSlot === part.sourceSlot)!;
        if (!isObservedPartition(part) || !isObservedPartition(left) || !isObservedPartition(right)) continue;
        const arc = ((right.directionDeg - left.directionDeg + 540) % 360) - 180;
        const shortDeviation = directionDistance(part.directionDeg, left.directionDeg + t * arc);
        const longDeviation = Math.abs(arc) >= 179
          ? directionDistance(part.directionDeg, left.directionDeg + t * (arc > 0 ? arc - 360 : arc + 360)) : Infinity;
        const heightDeviation = Math.abs(part.heightM - (left.heightM + t * (right.heightM - left.heightM)));
        // Periods use nonlinear interpolation; trailing hours without a native bracket carry no witness.
        if (!(Math.min(shortDeviation, longDeviation) <= 1 && heightDeviation <= 0.02)) {
          throw new Error("sampling_profile_mismatch");
        }
      }
    }
  }
}
