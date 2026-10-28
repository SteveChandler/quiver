import { canonicalJson } from "./swell-briefing-hash";
import type { StoryArtifact, StoryInput } from "./week-scout-story-types";
import { WEEK_SCOUT_STORY_GENERATION_VERSION } from "./week-scout-story-types";

export class StoryValidationError extends Error {
  constructor(code: string, readonly status = 400) { super(code); this.name = "StoryValidationError"; }
}

const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/;

export function assertStoryArtifactMatchesInput(artifact: StoryArtifact, input: StoryInput, now = new Date()): void {
  if (artifact.schemaVersion !== 3 || input.schemaVersion !== 3 || artifact.briefing?.schemaVersion !== 3) {
    throw new StoryValidationError("schema_version_mismatch");
  }
  if (artifact.region !== input.region || artifact.editionDate !== input.editionDate
    || artifact.inputHash !== input.inputHash || artifact.sourcePublishedAt !== input.sourcePublishedAt
    || artifact.validUntil !== input.validUntil) throw new StoryValidationError("story_input_mismatch");
  if (input.provenance.fixture === true) throw new StoryValidationError("fixture_not_publishable", 403);
  if (artifact.generationVersion !== WEEK_SCOUT_STORY_GENERATION_VERSION) {
    throw new StoryValidationError("generation_version_unsupported");
  }
  if (typeof artifact.model !== "string" || !artifact.model.trim() || artifact.model.length > 120) {
    throw new StoryValidationError("model_invalid");
  }
  if (typeof artifact.briefing?.generatedAt !== "string" || !ISO_INSTANT.test(artifact.briefing.generatedAt)) {
    throw new StoryValidationError("generated_at_invalid", 422);
  }
  const generatedAt = Date.parse(artifact.briefing.generatedAt);
  const issuedAt = Date.parse(input.briefing.generatedAt);
  if (!Number.isFinite(generatedAt) || generatedAt < issuedAt - 5 * 60_000
    || generatedAt > now.getTime() + 5 * 60_000 || generatedAt > Date.parse(input.validUntil)) {
    throw new StoryValidationError("generated_at_invalid", 422);
  }
  const ids = artifact.briefing?.selections;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > 100 || ids.some((id) => typeof id !== "string")) {
    throw new StoryValidationError("selections_invalid");
  }
  const chosen = new Set(ids);
  if (chosen.size !== ids.length) throw new StoryValidationError("duplicate_candidate");
  const selected = input.copyFacts.filter((fact) => chosen.has(fact.id));
  if (selected.length !== ids.length) throw new StoryValidationError("candidate_not_offered");
  if (canonicalJson(selected.map((fact) => fact.id)) !== canonicalJson(ids)) {
    throw new StoryValidationError("candidate_order_invalid");
  }
  const slots = new Set(selected.map((fact) => fact.slot));
  if (slots.size !== selected.length) throw new StoryValidationError("duplicate_slot");
  for (const slot of ["cover", "story:lead"]) {
    if (input.copyFacts.some((fact) => fact.slot === slot) && !slots.has(slot)) {
      throw new StoryValidationError("required_slot_missing");
    }
  }
  if (canonicalJson(artifact.briefing) !== canonicalJson({
    ...input.briefing, generatedAt: artifact.briefing.generatedAt, selections: ids,
  })) throw new StoryValidationError("briefing_values_altered");
  if (canonicalJson(artifact.provenance) !== canonicalJson(input.provenance)) {
    throw new StoryValidationError("provenance_mismatch");
  }
  if (canonicalJson(artifact) !== canonicalJson({
    artifactId: artifact.artifactId, schemaVersion: 3, region: input.region,
    editionDate: input.editionDate, inputHash: input.inputHash,
    sourcePublishedAt: input.sourcePublishedAt, validUntil: input.validUntil,
    generationVersion: WEEK_SCOUT_STORY_GENERATION_VERSION, model: artifact.model,
    briefing: artifact.briefing, provenance: input.provenance,
  })) throw new StoryValidationError("artifact_values_altered");
}
