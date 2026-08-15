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
  "selected_maybe",
  "selected_no",
  "below_minimum_utility",
  "no_candidates",
  "unknown_skill",
  "major_event_hold",
  "water_quality_hold",
  "hold_state_unavailable",
  "water_quality_closure",
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
const personalMatchEvidenceSchema = z.object({
  score: z.number().finite(),
  label: z.enum(["EPIC", "GOOD", "FAIR", "RIDEABLE", "MEH"]),
  confidence: z.enum(["low", "medium", "high"]),
  sessionCount: z.number().int().nonnegative(),
  reasons: z.array(z.string().min(1)),
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
  evidence: z.object({
    conditionScore: z.number().finite(),
    recommendationLabel: z.enum(["Worth it", "Maybe", "Skip"]).nullable(),
    personalMatch: personalMatchEvidenceSchema.nullable(),
  }).strict(),
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
  verdict: z.enum(["go", "maybe", "no"]),
  decisionBasis: z.enum([
    "personal_match",
    "physical_fallback",
    "safety_override",
  ]),
  decisionBasisV2: z.enum([
    "personal_match",
    "physical_fallback",
    "safety_override",
    "data_unavailable",
  ]).optional(),
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
    decision.verdict === "maybe" &&
    decision.reasonCode !== "selected_maybe"
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "maybe decisions require the selected_maybe reason",
    });
  }
  if (
    decision.verdict === "no" &&
    (decision.reasonCode === "selected_go" ||
      decision.reasonCode === "selected_maybe")
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reasonCode"],
      message: "no decisions require a no reason code",
    });
  }
  if (
    decision.decisionBasis === "safety_override" &&
    decision.selection !== null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection"],
      message: "safety overrides cannot include a selection",
    });
  }
  if (
    decision.decisionBasis !== "safety_override" &&
    decision.selection === null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection"],
      message: "personal and physical decisions require one selection",
    });
  }
  if (
    decision.decisionBasis === "personal_match" &&
    decision.selection?.evidence.personalMatch === null
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["selection", "evidence", "personalMatch"],
      message: "personal-match decisions require personal-match evidence",
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
