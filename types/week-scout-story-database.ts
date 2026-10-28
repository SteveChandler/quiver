import type { StoryArtifact, StoryInput } from "@/lib/services/discovery/week-scout-story-types";

/** Manual schema mirror while the migration remains file-only. Do not edit database.generated.ts. */
export interface WeekScoutStoryInputRow {
  input_hash: string;
  region: string;
  edition_date: string;
  source_published_at: string;
  valid_until: string;
  schema_version: 3;
  snapshot: StoryInput;
  created_at: string;
}

export interface WeekScoutStoryEditionRow {
  artifact_id: string;
  region: string;
  edition_date: string;
  input_hash: string;
  source_published_at: string;
  valid_until: string;
  schema_version: 3;
  generation_version: string;
  model: string;
  briefing: StoryArtifact["briefing"];
  provenance: StoryArtifact["provenance"];
  created_at: string;
}

export interface WeekScoutStoryJobRow {
  region: string;
  edition_date: string;
  input_hash: string;
  generation_version: string;
  model: string;
  lease_owner: string | null;
  lease_until: string | null;
  attempts: number;
  status: "pending" | "leased" | "published" | "failed";
  last_error: string | null;
  updated_at: string;
}
