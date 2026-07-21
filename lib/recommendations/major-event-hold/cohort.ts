import type { SafetyCohort } from "./types";

const SAFETY_COHORTS = new Set<SafetyCohort>([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
  "unknown",
]);

export function mapSafetyCohort(experience: unknown): SafetyCohort {
  if (typeof experience !== "string") return "unknown";

  const normalized = experience.trim().toLowerCase();
  return SAFETY_COHORTS.has(normalized as SafetyCohort)
    ? (normalized as SafetyCohort)
    : "unknown";
}
