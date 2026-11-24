import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { WeekScoutStoryEditionRow, WeekScoutStoryInputRow } from "@/types/week-scout-story-database";
import { briefingArtifactId, briefingInputHash } from "./swell-briefing-hash";
import type { StoryArtifact, StoryInput } from "./week-scout-story-types";

type Client = SupabaseClient<Database>;
// These tables have not been applied locally; generated database types stay untouched until migration day.
type StoryDb = { from: (table: string) => any; rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
const db = (client: Client): StoryDb => client as unknown as StoryDb;

export class StoryStoreError extends Error {
  constructor(code: string, readonly status = 503) { super(code); this.name = "StoryStoreError"; }
}

export async function activeStoryRegions(client: Client): Promise<Array<{ region: string; timezone: string }>> {
  const { data, error } = await db(client).rpc("week_scout_story_active_regions");
  if (error) throw new StoryStoreError("story_regions_read_failed");
  return (Array.isArray(data) ? data : []).filter((row): row is { region: string; timezone: string } =>
    typeof row?.region === "string" && row.region.length > 0 && typeof row?.timezone === "string");
}

export async function saveStoryInput(client: Client, input: StoryInput): Promise<void> {
  if (briefingInputHash(input as unknown as Record<string, unknown>) !== input.inputHash) {
    throw new StoryStoreError("story_input_hash_mismatch", 500);
  }
  const { error } = await db(client).from("week_scout_story_inputs").upsert({
    input_hash: input.inputHash, region: input.region, edition_date: input.editionDate,
    source_published_at: input.sourcePublishedAt, valid_until: input.validUntil,
    schema_version: 3, snapshot: input,
  }, { onConflict: "input_hash", ignoreDuplicates: true });
  if (error) throw new StoryStoreError("story_input_save_failed");
}

export async function loadStoryInput(client: Client, hash: string): Promise<StoryInput | null> {
  const { data, error } = await db(client).from("week_scout_story_inputs")
    .select("snapshot").eq("input_hash", hash).maybeSingle();
  if (error) throw new StoryStoreError("story_input_read_failed");
  return (data as Pick<WeekScoutStoryInputRow, "snapshot"> | null)?.snapshot ?? null;
}

export async function loadLatestStoryInput(client: Client, region: string, date: string): Promise<StoryInput | null> {
  const { data, error } = await db(client).from("week_scout_story_inputs")
    .select("snapshot").eq("region", region).eq("edition_date", date)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new StoryStoreError("story_input_read_failed");
  return (data as Pick<WeekScoutStoryInputRow, "snapshot"> | null)?.snapshot ?? null;
}

export async function publishStoryEdition(client: Client, artifact: StoryArtifact): Promise<{ artifactId: string; created: boolean }> {
  if (briefingArtifactId(artifact as unknown as Record<string, unknown>) !== artifact.artifactId) {
    throw new StoryStoreError("story_artifact_id_mismatch", 400);
  }
  const { data, error } = await db(client).rpc("publish_week_scout_story_edition", {
    p_artifact_id: artifact.artifactId, p_region: artifact.region,
    p_edition_date: artifact.editionDate, p_input_hash: artifact.inputHash,
    p_source_published_at: artifact.sourcePublishedAt, p_valid_until: artifact.validUntil,
    p_generation_version: artifact.generationVersion, p_model: artifact.model,
    p_briefing: artifact.briefing, p_provenance: artifact.provenance,
  });
  if (error) {
    if (["unknown_input_hash", "stale_source", "revision_conflict", "artifact_conflict"].includes(error.message)) {
      throw new StoryStoreError(error.message, 409);
    }
    throw new StoryStoreError("story_publish_failed");
  }
  const row = (Array.isArray(data) ? data[0] : data) as { artifact_id: string; created: boolean } | null;
  return { artifactId: row?.artifact_id ?? artifact.artifactId, created: row?.created === true };
}

export async function loadLatestStoryEdition(client: Client, region: string): Promise<StoryArtifact | null> {
  const { data, error } = await db(client).from("week_scout_story_editions")
    .select("artifact_id, region, edition_date, input_hash, source_published_at, valid_until, schema_version, generation_version, model, briefing, provenance")
    .eq("region", region).order("edition_date", { ascending: false })
    .order("source_published_at", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw new StoryStoreError("story_edition_read_failed");
  if (!data) return null;
  const row = data as WeekScoutStoryEditionRow;
  const instant = (value: string): string => new Date(value).toISOString();
  return {
    artifactId: row.artifact_id, schemaVersion: row.schema_version, region: row.region,
    editionDate: row.edition_date, inputHash: row.input_hash,
    sourcePublishedAt: instant(row.source_published_at), validUntil: instant(row.valid_until),
    generationVersion: row.generation_version, model: row.model,
    briefing: row.briefing, provenance: row.provenance,
  };
}
