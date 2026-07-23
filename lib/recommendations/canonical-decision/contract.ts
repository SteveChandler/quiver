import { z } from "zod";

import type { CanonicalSessionDecision } from "./types";
import {
  CANONICAL_SESSION_DECISION_ENGINE_VERSION,
  CANONICAL_SESSION_DECISION_SCHEMA_VERSION,
} from "./types";

const instantSchema = z.string().datetime({ offset: true });
const skillSchema = z.enum([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "unknown",
]);
const reasonCodeSchema = z.enum([
  "selected_go",
  "selected_consider",
  "below_minimum_utility",
  "no_candidates",
  "unknown_skill",
  "major_event_hold",
  "hold_state_unavailable",
  "beach_skill_exceeds_user",
  "wave_height_exceeds_skill",
  "missing_beach_skill",
  "missing_wave_height",
  "invalid_candidate",
]);
const skillEligibilitySchema = z.object({
  skill: skillSchema,
  state: z.enum(["eligible", "ineligible", "insufficient_safety_data"]),
  reasonCodes: z.array(reasonCodeSchema),
}).strict();
const selectedSkillEligibilitySchema = z.object({
  skill: skillSchema,
  state: z.literal("eligible"),
  reasonCodes: z.tuple([]),
}).strict();
const selectionSchema = z.object({
  candidateId: z.string().min(1),
  beachId: z.string().min(1),
  beachName: z.string().min(1),
  windowStart: instantSchema,
  windowEnd: instantSchema,
  timezone: z.string().min(1),
  forecastRef: z.object({
    forecastId: z.string().min(1),
    beachId: z.string().min(1),
    forecastAt: instantSchema,
  }).strict(),
  skillEligibility: selectedSkillEligibilitySchema,
}).strict();

export const canonicalSessionDecisionSchema = z.object({
  schemaVersion: z.literal(CANONICAL_SESSION_DECISION_SCHEMA_VERSION),
  engineVersion: z.literal(CANONICAL_SESSION_DECISION_ENGINE_VERSION),
  decisionId: z.string().regex(/^[a-f0-9]{64}$/),
  createdAt: instantSchema,
  expiresAt: instantSchema,
  scope: z.object({
    kind: z.literal("plan_next_session"),
    windowStart: instantSchema,
    windowEnd: instantSchema,
    timezone: z.string().min(1),
  }).strict(),
  verdict: z.enum(["go", "consider", "no"]),
  reasonCode: reasonCodeSchema,
  selection: selectionSchema.nullable(),
  skillEligibility: skillEligibilitySchema,
  holdEpoch: z.string().min(1),
}).strict().superRefine((decision, context) => {
  if (decision.verdict === "go" && decision.reasonCode !== "selected_go") {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "go decisions require the selected_go reason",
    });
  }
  if (
    decision.verdict === "consider" &&
    decision.reasonCode !== "selected_consider"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "consider decisions require the selected_consider reason",
    });
  }
  if (
    decision.verdict === "no" &&
    (decision.reasonCode === "selected_go" ||
      decision.reasonCode === "selected_consider")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "no decisions require a non-selection reason",
    });
  }
  if (decision.verdict === "no" && decision.selection !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection"],
      message: "no decisions cannot include a selection",
    });
  }
  if (decision.verdict !== "no" && decision.selection === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection"],
      message: "positive decisions require one selection",
    });
  }
  if (
    decision.selection !== null &&
    decision.selection.skillEligibility.skill !== decision.skillEligibility.skill
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection", "skillEligibility", "skill"],
      message: "selection skill must match decision skill",
    });
  }
});

export function parseCanonicalSessionDecision(
  value: unknown,
): CanonicalSessionDecision {
  return canonicalSessionDecisionSchema.parse(value) as CanonicalSessionDecision;
}
