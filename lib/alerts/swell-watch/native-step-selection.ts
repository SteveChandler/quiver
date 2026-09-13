/**
 * Sampling contract for the attested Open-Meteo NCEP GFS-Wave source only.
 * This is derivation provenance, never receipt acceptance or notification authority.
 * Source: open-meteo/open-meteo@9701689dd81ebef2d478800366c586c8a02c0c19,
 * Sources/App/Gfs/GfsDomain.swift and GfsWaveVariable.swift.
 *
 * Preserve and validate every retained hourly component; use the documented
 * model-native timesteps for tracking rather than interpolated ranked slots.
 * Unknown/missing components are rejected, even on an interpolated timestep.
 */
export const GFS_NATIVE_CONTRACT_REF = "open-meteo/9701689dd81ebef2d478800366c586c8a02c0c19/GfsDomain.forecastHours" as const;
export const GFS_NATIVE_SAMPLING_PROFILE = "ncep-gfswave-native-120h.v1" as const;

export interface NativeSamplingEvidence {
  profile: "ncep-gfswave-native-120h.v1";
  transportProvider: "open_meteo_single_runs";
  model: "ncep_gfswave016";
  issuedAt: string;
}
interface TrackPart {
  provider: string;
  evaluationId: string;
  forecastAt: string;
  sourceSlot: string;
  heightM: number;
  periodS: number;
  directionDeg: number;
  unavailableReason?: unknown;
}

export function selectGfsNativeFrames<T extends TrackPart[]>(
  hourlyFrames: T[], evidence: NativeSamplingEvidence,
): { frames: T[]; nativeIndices: number[]; providerInterpolatedIndices: number[]; profile: NativeSamplingEvidence["profile"] } {
  if (!evidence || evidence.profile !== "ncep-gfswave-native-120h.v1"
    || evidence.transportProvider !== "open_meteo_single_runs" || evidence.model !== "ncep_gfswave016") {
    throw new Error("unsupported_native_sampling_evidence");
  }
  const issued = Date.parse(evidence.issuedAt);
  if (typeof evidence.issuedAt !== "string" || !/(?:Z|[+]00:00)$/.test(evidence.issuedAt) || !Number.isFinite(issued) || issued % 21_600_000 !== 0) {
    throw new Error("invalid_native_sampling_issuance");
  }
  if (!Array.isArray(hourlyFrames) || hourlyFrames.length !== 168) throw new Error("incomplete_horizon");
  let evaluationId: string | null = null;
  hourlyFrames.forEach((frame, index) => {
    if (!Array.isArray(frame) || frame.length !== 2) throw new Error("incomplete_partition");
    frame.forEach((part, slot) => {
      if (!part || part.provider !== "open_meteo" || part.sourceSlot !== `s${slot + 1}`
        || typeof part.evaluationId !== "string" || !part.evaluationId
        || Date.parse(part.forecastAt) !== issued + index * 3_600_000) throw new Error("inconsistent_frame_evidence");
      if (evaluationId === null) evaluationId = part.evaluationId;
      if (part.evaluationId !== evaluationId) throw new Error("inconsistent_frame_evidence");
      if (part.unavailableReason !== undefined
        || (part.heightM === 0 && part.periodS === 0 && part.directionDeg === 0)) {
        // Provider zero-fill does not carry an independently verifiable absence witness.
        throw new Error("incomplete_partition");
      }
      if (!Number.isFinite(part.heightM) || part.heightM < 0
        || !Number.isFinite(part.periodS) || part.periodS <= 0
        || !Number.isFinite(part.directionDeg) || part.directionDeg < 0 || part.directionDeg >= 360) {
        throw new Error("invalid_component");
      }
    });
  });
  const nativeIndices: number[] = [];
  const providerInterpolatedIndices: number[] = [];
  for (let index = 0; index < hourlyFrames.length; index++) {
    (index <= 120 || index % 3 === 0 ? nativeIndices : providerInterpolatedIndices).push(index);
  }
  return { frames: nativeIndices.map((i) => hourlyFrames[i]), nativeIndices, providerInterpolatedIndices, profile: evidence.profile };
}
