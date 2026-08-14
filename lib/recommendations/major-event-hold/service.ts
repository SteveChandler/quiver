import "server-only";

import { createHash } from "node:crypto";

import { mapSafetyCohort } from "./cohort";
import { MAJOR_EVENT_HOLD_MODE } from "./config";
import {
  evaluateMajorEventHold,
  parseMajorEventHoldCandidate,
} from "./evaluator";
import { resolveMajorEventHolds } from "./repository";
import {
  resolveWaterQualityHolds,
  waterQualityHoldId,
  type WaterQualityHoldResolution,
} from "./water-quality";
import type {
  MajorEventHoldAuditEvent,
  MajorEventHoldAuditSink,
  MajorEventHoldCandidate,
  MajorEventHoldCandidateDecision,
  MajorEventHoldMode,
  MajorEventHoldResolution,
  RecommendationAvailability,
} from "./types";

export interface EvaluateMajorEventHoldCandidatesInput {
  candidates: readonly unknown[];
  profileExperience: unknown;
  mode?: MajorEventHoldMode;
  asOf?: Date;
  applyWaterQualityHolds?: boolean;
  waterQualityExemptBeachIds?: readonly string[];
}

export type ResolveMajorEventHolds = (
  candidates: readonly unknown[],
  options: { asOf?: Date },
) => Promise<MajorEventHoldResolution>;

export type ResolveWaterQualityHolds = (
  candidates: readonly MajorEventHoldCandidate[],
) => Promise<WaterQualityHoldResolution>;

export interface MajorEventHoldServiceDependencies {
  resolveHolds?: ResolveMajorEventHolds;
  resolveWaterQualityHolds?: ResolveWaterQualityHolds;
  audit?: MajorEventHoldAuditSink;
  clock?: () => Date;
}

function defaultMajorEventHoldAuditSink(event: MajorEventHoldAuditEvent): void {
  console.info("[major-event-hold:audit]", {
    event: event.event,
    mode: event.mode,
    beachId: event.beachId,
    cohort: event.cohort,
    holdIds: [...event.holdIds],
    holdEpoch: event.holdEpoch,
    reasonCode: event.reasonCode,
  });
}

function hashEpoch(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function createHoldEpoch(
  mode: MajorEventHoldMode,
  resolution: "off" | MajorEventHoldResolution,
): string {
  if (resolution === "off") {
    return hashEpoch("major-event-hold:v1|mode:off|resolution:off");
  }

  if (resolution.state === "unresolved") {
    return hashEpoch(`major-event-hold:v1|mode:${mode}|resolution:unresolved`);
  }

  const versions = resolution.holds
    .map(({ recordId, version }) => `${recordId}:${version}`)
    .sort()
    .join(",");
  return hashEpoch(
    `major-event-hold:v1|mode:${mode}|resolution:resolved|records:${versions}`,
  );
}

function createCombinedHoldEpoch(
  majorEventEpoch: string,
  waterQualityEpoch: string,
): string {
  return hashEpoch(
    `recommendation-hold:v1|major-event:${majorEventEpoch}|water-quality:${waterQualityEpoch}`,
  );
}

function evaluateWaterQualityHold(
  candidate: MajorEventHoldCandidate | null,
  resolution: WaterQualityHoldResolution,
  holdEpoch: string,
  exemptBeachIds: ReadonlySet<string>,
): MajorEventHoldCandidateDecision["evaluation"] {
  if (candidate === null) {
    return resolution.state === "unresolved"
      ? {
          outcome: "explicit_none",
          reasonCode: "hold_state_unavailable",
          holdIds: [],
          holdEpoch,
        }
      : { outcome: "allow", holdIds: [], holdEpoch };
  }

  if (exemptBeachIds.has(candidate.beachId.toLowerCase())) {
    return { outcome: "allow", holdIds: [], holdEpoch };
  }

  const normalizedBeachId = candidate.beachId.toLowerCase();
  const isHeld = resolution.heldBeachIds.some(
    (beachId) => beachId.toLowerCase() === normalizedBeachId,
  );
  if (isHeld) {
    return {
      outcome: "explicit_none",
      reasonCode: "water_quality_hold",
      holdIds: [waterQualityHoldId(candidate.beachId)],
      holdEpoch,
    };
  }

  if (resolution.state === "unresolved") {
    return {
      outcome: "explicit_none",
      reasonCode: "hold_state_unavailable",
      holdIds: [],
      holdEpoch,
    };
  }

  return { outcome: "allow", holdIds: [], holdEpoch };
}

function combineEvaluations(
  majorEventEvaluation: MajorEventHoldCandidateDecision["evaluation"],
  waterQualityEvaluation: MajorEventHoldCandidateDecision["evaluation"],
): MajorEventHoldCandidateDecision["evaluation"] {
  if (majorEventEvaluation.outcome === "explicit_none") {
    return majorEventEvaluation;
  }
  if (waterQualityEvaluation.outcome === "explicit_none") {
    return waterQualityEvaluation;
  }
  return majorEventEvaluation;
}

export function serializeRecommendationAvailability(
  evaluation: MajorEventHoldCandidateDecision["evaluation"],
  resolutionAsOf: string,
): RecommendationAvailability {
  if (evaluation.outcome === "allow") {
    return {
      state: "available",
      holdEpoch: evaluation.holdEpoch,
      resolutionAsOf,
    };
  }

  const availability: RecommendationAvailability = {
    state: "none",
    reasonCode: evaluation.reasonCode ?? "hold_state_unavailable",
    holdEpoch: evaluation.holdEpoch,
    resolutionAsOf,
  };
  if (evaluation.expiresAt) availability.expiresAt = evaluation.expiresAt;
  return availability;
}

async function emitAudit(
  audit: MajorEventHoldAuditSink | undefined,
  event: MajorEventHoldAuditEvent | null,
): Promise<void> {
  if (!audit || event === null) return;
  try {
    await audit(event);
  } catch {
    // Audit availability must not weaken an enforce-mode decision.
  }
}

function auditEventFor(
  mode: MajorEventHoldMode,
  resolutionState: MajorEventHoldResolution["state"],
  candidate: MajorEventHoldCandidate | null,
  cohort: ReturnType<typeof mapSafetyCohort>,
  decision: MajorEventHoldCandidateDecision["evaluation"],
): MajorEventHoldAuditEvent | null {
  if (mode === "off") return null;
  if (mode === "shadow") {
    if (resolutionState === "unresolved" || candidate === null) {
      return {
        event: "resolution_unavailable",
        mode,
        candidateId: candidate?.candidateId ?? null,
        beachId: candidate?.beachId ?? null,
        cohort,
        holdIds: [],
        holdEpoch: decision.holdEpoch,
        reasonCode: "hold_state_unavailable",
      };
    }
    if (decision.holdIds.length > 0) {
      const reasonCode =
        decision.reasonCode === "water_quality_hold"
          ? "water_quality_hold"
          : "major_event_hold";
      return {
        event: "would_block",
        mode,
        candidateId: candidate.candidateId,
        beachId: candidate.beachId,
        cohort,
        holdIds: [...decision.holdIds],
        holdEpoch: decision.holdEpoch,
        reasonCode,
      };
    }
  }
  if (mode === "enforce" && decision.outcome === "explicit_none") {
    const reasonCode = decision.reasonCode ?? "hold_state_unavailable";
    return {
      event:
        reasonCode === "major_event_hold" ||
        reasonCode === "water_quality_hold"
          ? "blocked"
          : "resolution_unavailable",
      mode,
      candidateId: candidate?.candidateId ?? null,
      beachId: candidate?.beachId ?? null,
      cohort,
      holdIds: [...decision.holdIds],
      holdEpoch: decision.holdEpoch,
      reasonCode,
    };
  }
  return null;
}

export async function evaluateMajorEventHoldCandidates(
  input: EvaluateMajorEventHoldCandidatesInput,
  dependencies: MajorEventHoldServiceDependencies = {},
): Promise<MajorEventHoldCandidateDecision[]> {
  const mode = input.mode ?? MAJOR_EVENT_HOLD_MODE;
  const cohort = mapSafetyCohort(input.profileExperience);
  const parsedCandidates = input.candidates.map(parseMajorEventHoldCandidate);
  const clockNow = dependencies.clock?.() ?? new Date();
  const validClockNow = Number.isFinite(clockNow.getTime())
    ? clockNow
    : new Date();
  const validInputAsOf =
    input.asOf === undefined || Number.isFinite(input.asOf.getTime());
  const resolutionAsOfDate =
    input.asOf !== undefined && validInputAsOf ? input.asOf : validClockNow;
  const resolutionAsOf = resolutionAsOfDate.toISOString();
  const validCandidates = parsedCandidates.filter(
    (candidate): candidate is MajorEventHoldCandidate => candidate !== null,
  );
  const applyWaterQualityHolds = input.applyWaterQualityHolds === true;
  const waterQualityExemptBeachIds = new Set(
    (input.waterQualityExemptBeachIds ?? [])
      .filter((beachId): beachId is string => typeof beachId === "string")
      .map((beachId) => beachId.toLowerCase()),
  );

  let waterQualityResolution: WaterQualityHoldResolution = {
    state: "resolved",
    heldBeachIds: [],
    epoch: waterQualityHoldId("empty"),
  };
  if (applyWaterQualityHolds) {
    if (validCandidates.length !== parsedCandidates.length) {
      waterQualityResolution = {
        state: "unresolved",
        heldBeachIds: [],
        epoch: waterQualityHoldId("unresolved"),
      };
    } else {
      try {
        const resolveWaterQuality =
          dependencies.resolveWaterQualityHolds ?? resolveWaterQualityHolds;
        waterQualityResolution = await resolveWaterQuality(validCandidates);
      } catch (error) {
        console.error("[water-quality-hold:resolution-failed]", {
          candidateCount: validCandidates.length,
          error: error instanceof Error ? error.message : String(error),
        });
        waterQualityResolution = {
          state: "unresolved",
          heldBeachIds: [],
          epoch: waterQualityHoldId("unresolved"),
        };
      }
    }
  }

  if (mode === "off") {
    const majorEventEpoch = createHoldEpoch(mode, "off");
    const holdEpoch = applyWaterQualityHolds
      ? createCombinedHoldEpoch(majorEventEpoch, waterQualityResolution.epoch)
      : majorEventEpoch;
    return parsedCandidates.map((candidate) => {
      const majorEventEvaluation = evaluateMajorEventHold({
        mode,
        resolutionState: "unresolved",
        holds: [],
        cohort,
        candidate,
        holdEpoch,
      });
      const evaluation = applyWaterQualityHolds
        ? combineEvaluations(
            majorEventEvaluation,
            evaluateWaterQualityHold(
              candidate,
              waterQualityResolution,
              holdEpoch,
              waterQualityExemptBeachIds,
            ),
          )
        : majorEventEvaluation;
      return {
        candidateId: candidate?.candidateId ?? null,
        evaluation,
        recommendationAvailability:
          serializeRecommendationAvailability(evaluation, resolutionAsOf),
      };
    });
  }

  const resolveHolds = dependencies.resolveHolds ?? resolveMajorEventHolds;
  const audit = dependencies.audit ?? defaultMajorEventHoldAuditSink;
  let resolution: MajorEventHoldResolution = { state: "unresolved", holds: [] };
  if (
    validCandidates.length > 0 &&
    validInputAsOf
  ) {
    try {
      resolution = await resolveHolds(validCandidates, {
        asOf: resolutionAsOfDate,
      });
    } catch (error) {
      // Failing closed here suppresses recommendations for every candidate with
      // reasonCode "hold_state_unavailable". The audit sink records that it
      // happened, but swallowing the error left no way to tell WHY resolution
      // failed — a DB error, a timeout and a bad asOf are indistinguishable
      // from the audit line alone. Keep failing closed; just say why.
      console.error("[major-event-hold:resolution-failed]", {
        candidateCount: validCandidates.length,
        asOf: resolutionAsOf,
        error: error instanceof Error ? error.message : String(error),
      });
      resolution = { state: "unresolved", holds: [] };
    }
  }

  const majorEventEpoch = createHoldEpoch(mode, resolution);
  const unresolvedEpoch = createHoldEpoch(mode, {
    state: "unresolved",
    holds: [],
  });
  const resolvedEpoch = applyWaterQualityHolds
    ? createCombinedHoldEpoch(majorEventEpoch, waterQualityResolution.epoch)
    : majorEventEpoch;
  const unresolvedCombinedEpoch = applyWaterQualityHolds
    ? createCombinedHoldEpoch(unresolvedEpoch, waterQualityResolution.epoch)
    : unresolvedEpoch;
  const decisions: MajorEventHoldCandidateDecision[] = [];

  for (const candidate of parsedCandidates) {
    const candidateResolution =
      candidate === null
        ? ({ state: "unresolved", holds: [] } as const)
        : resolution;
    const evaluation = evaluateMajorEventHold({
      mode,
      resolutionState: candidateResolution.state,
      holds: candidateResolution.holds,
      cohort,
      candidate,
      holdEpoch: candidate === null ? unresolvedCombinedEpoch : resolvedEpoch,
    });
    const combinedEvaluation = applyWaterQualityHolds
      ? combineEvaluations(
          evaluation,
          evaluateWaterQualityHold(
            candidate,
            waterQualityResolution,
            candidate === null ? unresolvedCombinedEpoch : resolvedEpoch,
            waterQualityExemptBeachIds,
          ),
        )
      : evaluation;
    const decision: MajorEventHoldCandidateDecision = {
      candidateId: candidate?.candidateId ?? null,
      evaluation: combinedEvaluation,
      recommendationAvailability:
        serializeRecommendationAvailability(combinedEvaluation, resolutionAsOf),
    };
    decisions.push(decision);
    await emitAudit(
      audit,
      auditEventFor(
        mode,
        candidateResolution.state,
        candidate,
        cohort,
        combinedEvaluation,
      ),
    );
  }

  return decisions;
}

export async function evaluateRecommendationHoldCandidates(
  input: Omit<
    EvaluateMajorEventHoldCandidatesInput,
    "applyWaterQualityHolds"
  >,
  dependencies: MajorEventHoldServiceDependencies = {},
): Promise<MajorEventHoldCandidateDecision[]> {
  return evaluateMajorEventHoldCandidates(
    { ...input, applyWaterQualityHolds: true },
    dependencies,
  );
}
