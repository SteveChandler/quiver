export { buildCanonicalSessionDecision } from "./engine";
export {
  canonicalSessionDecisionSchema,
  parseCanonicalSessionDecision,
} from "./contract";
export { buildCanonicalDecisionFromSurfDiscovery } from "./discovery-adapter";
export type { BuildCanonicalDecisionFromSurfDiscoveryInput } from "./discovery-adapter";
export {
  resolveCanonicalSessionDecision,
  resolveCanonicalSessionDecisionContext,
} from "./service";
export { projectCanonicalDiscoverySurface } from "./client-projection";
export {
  buildCanonicalDecisionFromAlertMatches,
  canonicalAlertCandidateId,
} from "./alert-adapter";
export type { BuildCanonicalDecisionFromAlertMatchesInput } from "./alert-adapter";
export type {
  CanonicalSessionDecisionServiceDependencies,
  CanonicalSessionDecisionContext,
  ResolveCanonicalSessionDecisionInput,
} from "./service";
export {
  CANONICAL_SESSION_DECISION_ENGINE_VERSION,
  CANONICAL_SESSION_DECISION_SCHEMA_VERSION,
} from "./types";
export type {
  BuildCanonicalSessionDecisionInput,
  CanonicalDecisionCandidate,
  CanonicalDecisionBasis,
  CanonicalDecisionBasisV2,
  CanonicalMatchConfidence,
  CanonicalDecisionReasonCode,
  CanonicalDecisionScope,
  CanonicalDecisionSelection,
  CanonicalDecisionSkill,
  CanonicalDecisionVerdict,
  CanonicalEligibilityState,
  CanonicalPersonalMatchEvidence,
  CanonicalSessionDecision,
} from "./types";
