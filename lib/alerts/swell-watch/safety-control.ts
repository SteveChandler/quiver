import "server-only";

import {
  verifySwellWatchPolicy,
  type SwellWatchPolicy,
} from "./policy";

type SwellWatchSafetyReasonCode =
  | "static_disabled"
  | "control_unavailable"
  | "control_not_armed"
  | "authority_unavailable"
  | "authority_revoked"
  | "authority_invalid"
  | "candidate_cap_exceeded"
  | "recipient_cap_exceeded"
  | "projected_send_cap_exceeded"
  | "data_discontinuity"
  | "material_disagreement"
  | "forecast_stale"
  | "provider_failure_rate"
  | "invalid_hold_input"
  | "event_not_releasable"
  | "recipient_not_eligible"
  | "recipient_deduplicated";

export function evaluateSwellWatchSafety(input: {
  policy: unknown;
  candidateCount: number;
  recipientCount: number;
  projectedSendCount: number | null;
  hasDiscontinuousData: boolean;
  hasMaterialDisagreement: boolean;
  stale: boolean;
  providerFailures: { samples: number; failures: number } | null;
}): { reasonCode: SwellWatchSafetyReasonCode | null; missingMetrics: string[] } {
  const policy = input.policy as SwellWatchPolicy;
  const values = verifySwellWatchPolicy(policy) ? policy.policy_values : null;
  const numericInput = [
    input.candidateCount,
    input.recipientCount,
    ...(input.projectedSendCount === null ? [] : [input.projectedSendCount]),
    ...(input.providerFailures === null ? [] : [input.providerFailures.samples, input.providerFailures.failures]),
  ].every((value) => Number.isFinite(value) && value >= 0);
  const reasonCode: SwellWatchSafetyReasonCode | null =
    !numericInput
      ? "invalid_hold_input"
      : !values
        ? "authority_invalid"
        : input.candidateCount > values.volume_caps.maximum_candidates_per_region
      ? "candidate_cap_exceeded"
      : input.recipientCount > values.volume_caps.maximum_recipients_per_event
        ? "recipient_cap_exceeded"
        : input.projectedSendCount !== null && input.projectedSendCount > values.volume_caps.maximum_projected_sends_per_window
          ? "projected_send_cap_exceeded"
          : input.hasDiscontinuousData
            ? "data_discontinuity"
            : input.hasMaterialDisagreement
              ? "material_disagreement"
              : input.stale
                ? "forecast_stale"
                : input.providerFailures !== null && input.providerFailures.samples >= values.provider_failure_hold.minimum_samples &&
                    input.providerFailures.failures / input.providerFailures.samples > values.provider_failure_hold.maximum_failure_rate
                  ? "provider_failure_rate"
                  : null;
  return { reasonCode, missingMetrics: [
    ...(input.projectedSendCount === null ? ["projected_send_window"] : []),
    ...(input.providerFailures === null ? ["delivery_health"] : []),
  ] };
}
