import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { briefingArtifactId, briefingInputHash } from "./swell-briefing-hash";
import type {
  SwellBriefingArtifact,
  SwellBriefingInputSnapshot,
  SwellBriefingPublishResult,
} from "./swell-briefing-types";

type Client = SupabaseClient<Database>;

/**
 * The briefing tables are new in `20261026010000_swell_briefing_editions.sql`
 * and are not in the generated `Database` types yet, because those are
 * regenerated from an applied schema. Narrow the escape hatch to the table
 * accessor rather than widening the whole client, so every other call on this
 * client stays type-checked. Remove once the migration is applied and
 * `types/database.ts` is regenerated.
 */
type UntypedTables = {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
};

function briefingTables(client: Client): UntypedTables {
  return client as unknown as UntypedTables;
}

export class BriefingStoreError extends Error {
  readonly status: number;

  constructor(code: string, status: number) {
    super(code);
    this.name = "BriefingStoreError";
    this.status = status;
  }
}

/** Postgres error codes raised by `publish_swell_briefing_edition`. */
const PUBLISH_FAILURES: Record<string, number> = {
  unknown_input_hash: 409,
  stale_source: 409,
  artifact_owner_mismatch: 403,
};

export async function saveBriefingInput(
  client: Client,
  snapshot: SwellBriefingInputSnapshot,
): Promise<void> {
  // The hash is recomputed here rather than trusted from the caller, so a
  // snapshot can never be stored under a key that does not describe it.
  const inputHash = briefingInputHash(snapshot as unknown as Record<string, unknown>);
  if (inputHash !== snapshot.inputHash) {
    throw new BriefingStoreError("briefing_input_hash_mismatch", 500);
  }

  const { error } = await briefingTables(client)
    .from("swell_briefing_inputs")
    .upsert(
      {
        input_hash: inputHash,
        user_id: snapshot.userId,
        region: snapshot.region,
        edition_date: snapshot.editionDate,
        source_published_at: snapshot.sourcePublishedAt,
        valid_until: snapshot.validUntil,
        snapshot,
      },
      { onConflict: "input_hash", ignoreDuplicates: true },
    );

  if (error) throw new BriefingStoreError("briefing_input_save_failed", 503);
}

export async function loadBriefingInput(
  client: Client,
  inputHash: string,
  userId: string,
): Promise<SwellBriefingInputSnapshot | null> {
  const { data, error } = await briefingTables(client)
    .from("swell_briefing_inputs")
    .select("snapshot, user_id")
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (error) throw new BriefingStoreError("briefing_input_read_failed", 503);
  if (!data) return null;
  // Cross-account reads are refused even though the hash is unguessable.
  if ((data as { user_id: string }).user_id !== userId) return null;
  return (data as { snapshot: SwellBriefingInputSnapshot }).snapshot;
}

/**
 * The most recent snapshot issued for a day, used to decide whether the
 * measurements have actually moved since the last one. Reissuing the same
 * snapshot keeps the worker's deduplication intact across a refetch.
 */
export async function loadLatestBriefingInput(
  client: Client,
  userId: string,
  region: string,
  editionDate: string,
): Promise<SwellBriefingInputSnapshot | null> {
  const { data, error } = await briefingTables(client)
    .from("swell_briefing_inputs")
    .select("snapshot")
    .eq("user_id", userId)
    .eq("region", region)
    .eq("edition_date", editionDate)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new BriefingStoreError("briefing_input_read_failed", 503);
  if (!data) return null;
  return (data as { snapshot: SwellBriefingInputSnapshot }).snapshot;
}

/**
 * Saves an artifact through the publishing function, which owns idempotency and
 * the no-older-source rule. Returns the stored id either way, so a retry after
 * a lost response is indistinguishable from the first success.
 */
export async function publishBriefingEdition(
  client: Client,
  artifact: SwellBriefingArtifact,
): Promise<SwellBriefingPublishResult> {
  const expectedId = briefingArtifactId(artifact as unknown as Record<string, unknown>);
  if (expectedId !== artifact.artifactId) {
    throw new BriefingStoreError("briefing_artifact_id_mismatch", 400);
  }

  const { data, error } = await briefingTables(client).rpc("publish_swell_briefing_edition", {
    p_artifact_id: artifact.artifactId,
    p_user_id: artifact.userId,
    p_region: artifact.region,
    p_edition_date: artifact.editionDate,
    p_input_hash: artifact.inputHash,
    p_source_published_at: artifact.sourcePublishedAt,
    p_valid_until: artifact.validUntil,
    p_generation_version: artifact.generationVersion,
    p_model: artifact.model,
    p_briefing: artifact.briefing,
    p_provenance: artifact.provenance ?? null,
  });

  if (error) {
    const status = PUBLISH_FAILURES[error.message];
    if (status) throw new BriefingStoreError(error.message, status);
    throw new BriefingStoreError("briefing_publish_failed", 503);
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    artifactId: (row as { artifact_id: string })?.artifact_id ?? artifact.artifactId,
    created: Boolean((row as { created: boolean })?.created),
  };
}

interface EditionRow {
  artifact_id: string;
  user_id: string;
  region: string;
  edition_date: string;
  input_hash: string;
  source_published_at: string;
  valid_until: string;
  generation_version: string;
  model: string;
  briefing: SwellBriefingArtifact["briefing"];
  provenance: SwellBriefingArtifact["provenance"];
}

const EDITION_COLUMNS =
  "artifact_id, user_id, region, edition_date, input_hash, source_published_at, valid_until, generation_version, model, briefing, provenance";

/**
 * The newest edition for an account. Ordered by the source behind it before the
 * row's own insert time, so a late upload of an older source never wins.
 */
export async function loadLatestBriefingEdition(
  client: Client,
  userId: string,
  region: string,
): Promise<SwellBriefingArtifact | null> {
  const { data, error } = await briefingTables(client)
    .from("swell_briefing_editions")
    .select(EDITION_COLUMNS)
    .eq("user_id", userId)
    .eq("region", region)
    .order("edition_date", { ascending: false })
    .order("source_published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new BriefingStoreError("briefing_edition_read_failed", 503);
  if (!data) return null;
  return toArtifact(data as EditionRow);
}

function toArtifact(row: EditionRow): SwellBriefingArtifact {
  return {
    artifactId: row.artifact_id,
    schemaVersion: 1,
    userId: row.user_id,
    region: row.region,
    editionDate: row.edition_date,
    inputHash: row.input_hash,
    sourcePublishedAt: row.source_published_at,
    validUntil: row.valid_until,
    generationVersion: row.generation_version,
    model: row.model,
    briefing: row.briefing,
    provenance: row.provenance,
  };
}
