import "server-only";

import { createHash } from "node:crypto";

import { mapSafetyCohort } from "./cohort";
import { MAJOR_EVENT_HOLD_MODE } from "./config";
import {
  evaluateMajorEventHold,
  parseMajorEventHoldCandidate,
} from "./evaluator";
import { resolveMajorEventHolds } from "./repository";
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
}

export type ResolveMajorEventHolds = (
  candidates: readonly unknown[],
  options: { asOf?: Date },
) => Promise<MajorEventHoldResolution>;

export interface MajorEventHoldServiceDependencies {
  resolveHolds?: ResolveMajorEventHolds;
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
      return {
        event: "would_block",
        mode,
        candidateId: candidate.candidateId,
        beachId: candidate.beachId,
        cohort,
        holdIds: [...decision.holdIds],
        holdEpoch: decision.holdEpoch,
        reasonCode: "major_event_hold",
      };
    }
  }
  if (mode === "enforce" && decision.outcome === "explicit_none") {
    const reasonCode = decision.reasonCode ?? "hold_state_unavailable";
    return {
      event:
        reasonCode === "major_event_hold"
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

  if (mode === "off") {
    const holdEpoch = createHoldEpoch(mode, "off");
    return parsedCandidates.map((candidate) => {
      const evaluation = evaluateMajorEventHold({
        mode,
        resolutionState: "unresolved",
        holds: [],
        cohort,
        candidate,
        holdEpoch,
      });
      return {
        candidateId: candidate?.candidateId ?? null,
        evaluation,
        recommendationAvailability:
          serializeRecommendationAvailability(evaluation, resolutionAsOf),
      };
    });
  }

  const validCandidates = parsedCandidates.filter(
    (candidate): candidate is MajorEventHoldCandidate => candidate !== null,
  );
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
    } catch {
      resolution = { state: "unresolved", holds: [] };
    }
  }

  const resolvedEpoch = createHoldEpoch(mode, resolution);
  const unresolvedEpoch = createHoldEpoch(mode, {
    state: "unresolved",
    holds: [],
  });
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
      holdEpoch: candidate === null ? unresolvedEpoch : resolvedEpoch,
    });
    const decision: MajorEventHoldCandidateDecision = {
      candidateId: candidate?.candidateId ?? null,
      evaluation,
      recommendationAvailability:
        serializeRecommendationAvailability(evaluation, resolutionAsOf),
    };
    decisions.push(decision);
    await emitAudit(
      audit,
      auditEventFor(
        mode,
        candidateResolution.state,
        candidate,
        cohort,
        evaluation,
      ),
    );
  }

  return decisions;
}
