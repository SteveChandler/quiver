import {
  transformToFaceHeightDecomposed,
  type BeachTerrainConfig,
} from "@/lib/utils/wave-height-transformer";
import { metersToFeet } from "@/lib/utils/unit-conversions";

import { verifySwellWatchPolicy, type SwellWatchPolicy } from "./policy";
import type { SwellPartitionObservation } from "./partition-normalizer";

export type SwellWatchImpactSuppression =
  | "invalid_provisional_policy"
  | "incomplete_partition"
  | "seam_discontinuous"
  | "source_contradiction"
  | "non_impactful"
  | "low_significance"
  | "not_actionable";

export type SwellWatchImpactResult =
  | {
      kind: "candidate";
      partition: SwellPartitionObservation;
      projectedFaceHeightFt: number;
      heightRiseFt: number;
      energyRatio: number;
      arrivalAt: string;
      policyId: string;
      policyHash: string;
    }
  | { kind: "suppressed"; reason: SwellWatchImpactSuppression };

interface EvaluateSwellWatchImpactInput {
  partition: SwellPartitionObservation | null;
  baselineHeightFt: number | null;
  baselineEnergy: number | null;
  arrivalAt: string;
  now: Date;
  beach: BeachTerrainConfig;
  policy: SwellWatchPolicy;
  seamContinuous: boolean;
  sourceCoherent: boolean;
}

const PROVISIONAL_PROFILE_ID = "swell-watch-provisional-fixture.v1";
const PROVISIONAL_PROFILE_HASH =
  "9a278ceca6c2fde80358e19258e2f6118e564735b8eb762266bd682c494df2ad";

function energy(heightFt: number, periodS: number): number {
  return heightFt * heightFt * periodS;
}

function isFiniteNonNegative(value: number | null): value is number {
  return value !== null && Number.isFinite(value) && value >= 0;
}

function isProvisionalFixturePolicy(policy: SwellWatchPolicy): boolean {
  return (
    verifySwellWatchPolicy(policy) &&
    policy.provenance === "provisional_fixture" &&
    policy.profile_id === PROVISIONAL_PROFILE_ID &&
    policy.value_hash === PROVISIONAL_PROFILE_HASH
  );
}

function circularDirectionDistance(left: number, right: number): number {
  const delta = Math.abs(left - right) % 360;
  return Math.min(delta, 360 - delta);
}

export function evaluateSwellWatchImpact(
  input: EvaluateSwellWatchImpactInput,
): SwellWatchImpactResult {
  const invalid = validatePhysicalInput(input);
  if (invalid) return invalid;
  const arrivalMs = Date.parse(input.arrivalAt);
  const daysUntilArrival = (arrivalMs - input.now.getTime()) / 86_400_000;
  const { actionability } = input.policy.policy_values;
  if (
    !Number.isFinite(arrivalMs) || !Number.isFinite(daysUntilArrival) ||
    daysUntilArrival < actionability.minimum_days_before_arrival ||
    daysUntilArrival > actionability.maximum_days_before_arrival
  ) return { kind: "suppressed", reason: "not_actionable" };
  const impact = calculatePhysicalImpact(input);
  return impact.kind === "candidate" ? { ...impact, arrivalAt: input.arrivalAt } : impact;
}

type PhysicalInput = Omit<EvaluateSwellWatchImpactInput, "arrivalAt" | "now">;
type PhysicalResult = Omit<Extract<SwellWatchImpactResult, { kind: "candidate" }>, "arrivalAt">
  | Extract<SwellWatchImpactResult, { kind: "suppressed" }>;

/** Horizon discovery must establish arrival before applying the notification lead-time gate. */
export function evaluateSwellWatchPhysicalImpact(input: PhysicalInput): PhysicalResult {
  return validatePhysicalInput(input) ?? calculatePhysicalImpact(input);
}

function validatePhysicalInput(input: PhysicalInput): Extract<SwellWatchImpactResult, { kind: "suppressed" }> | null {
  // Calculation is not release authority; enqueue and dispatch require the durable owner decision.
  const productionPolicy = verifySwellWatchPolicy(input.policy)
    && input.policy.schema_version === "swell-watch-policy.v2"
    && input.policy.provenance === "production_approved";
  if (!isProvisionalFixturePolicy(input.policy) && !productionPolicy) {
    return { kind: "suppressed", reason: "invalid_provisional_policy" };
  }
  if (
    input.partition === null ||
    !isFiniteNonNegative(input.baselineHeightFt) ||
    !isFiniteNonNegative(input.baselineEnergy) ||
    input.baselineEnergy <= 0 ||
    !Number.isFinite(input.partition.heightM) ||
    input.partition.heightM < 0 ||
    !Number.isFinite(input.partition.periodS) ||
    input.partition.periodS <= 0 ||
    !Number.isFinite(input.partition.directionDeg) ||
    input.partition.directionDeg < 0 ||
    input.partition.directionDeg >= 360
  ) {
    return { kind: "suppressed", reason: "incomplete_partition" };
  }
  if (!input.seamContinuous) {
    return { kind: "suppressed", reason: "seam_discontinuous" };
  }
  if (!input.sourceCoherent) {
    return { kind: "suppressed", reason: "source_contradiction" };
  }
  return null;
}

function calculatePhysicalImpact(input: PhysicalInput): PhysicalResult {
  if (input.partition === null || input.baselineHeightFt === null || input.baselineEnergy === null) {
    return { kind: "suppressed", reason: "incomplete_partition" };
  }
  const {
    local_impact: impact,
    local_significance: significance,
  } = input.policy.policy_values;

  const heightFt = metersToFeet(input.partition.heightM, 4);
  if (heightFt === null) {
    return { kind: "suppressed", reason: "incomplete_partition" };
  }
  const windowCenter = input.beach.swell_window_center_deg;
  const windowHalfWidth = input.beach.swell_window_halfwidth_deg;
  if (
    windowCenter !== null &&
    windowCenter !== undefined &&
    windowHalfWidth !== null &&
    windowHalfWidth !== undefined &&
    circularDirectionDistance(input.partition.directionDeg, windowCenter) >
      windowHalfWidth
  ) {
    return { kind: "suppressed", reason: "non_impactful" };
  }
  const projected = transformToFaceHeightDecomposed({
    components: [
      {
        heightFt,
        periodS: input.partition.periodS,
        directionDeg: input.partition.directionDeg,
        partition: "swell",
      },
    ],
    beach: input.beach,
    source: "model_swell",
    rawHeightFt: heightFt,
    periodS: input.partition.periodS,
    swellDirectionDeg: input.partition.directionDeg,
  });
  const heightRiseFt = heightFt - input.baselineHeightFt;
  const energyRatio =
    energy(heightFt, input.partition.periodS) / input.baselineEnergy;
  if (
    !Number.isFinite(projected.faceHeightFt) ||
    !Number.isFinite(heightRiseFt) ||
    !Number.isFinite(energyRatio)
  ) {
    return { kind: "suppressed", reason: "incomplete_partition" };
  }
  if (
    heightRiseFt < significance.minimum_height_rise_ft ||
    energyRatio < significance.minimum_energy_ratio
  ) {
    return { kind: "suppressed", reason: "low_significance" };
  }
  if (projected.faceHeightFt < impact.minimum_impact_score) {
    return { kind: "suppressed", reason: "non_impactful" };
  }
  return {
    kind: "candidate",
    partition: input.partition,
    projectedFaceHeightFt: projected.faceHeightFt,
    heightRiseFt,
    energyRatio,
    policyId: input.policy.profile_id,
    policyHash: input.policy.value_hash,
  };
}
