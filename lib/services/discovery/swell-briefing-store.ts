import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

import { briefingArtifactId, briefingInputHash } from "./swell-briefing-hash";
import {
  WEEK_SCOUT_NOTES_KIND,
  type BriefingArtifact,
  type BriefingInputSnapshot,
  type BriefingSchemaVersion,
  type SwellBriefingPublishResult,
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
  snapshot: BriefingInputSnapshot,
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
): Promise<BriefingInputSnapshot | null> {
  const { data, error } = await briefingTables(client)
    .from("swell_briefing_inputs")
    .select("snapshot, user_id")
    .eq("input_hash", inputHash)
    .maybeSingle();

  if (error) throw new BriefingStoreError("briefing_input_read_failed", 503);
  if (!data) return null;
  // Cross-account reads are refused even though the hash is unguessable.
  if ((data as { user_id: string }).user_id !== userId) return null;
  return (data as { snapshot: BriefingInputSnapshot }).snapshot;
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
  schemaVersion?: BriefingSchemaVersion,
): Promise<BriefingInputSnapshot | null> {
  let query = briefingTables(client)
    .from("swell_briefing_inputs")
    .select("snapshot")
    .eq("user_id", userId)
    .eq("region", region)
    .eq("edition_date", editionDate);
  // Both schemas share the table, so each builder asks for its own: a newer
  // input of the other kind must not stop an unchanged one being reused.
  if (schemaVersion !== undefined) query = query.eq("snapshot->>schemaVersion", String(schemaVersion));
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new BriefingStoreError("briefing_input_read_failed", 503);
  if (!data) return null;
  return (data as { snapshot: BriefingInputSnapshot }).snapshot;
}

/**
 * Saves an artifact through the publishing function, which owns idempotency and
 * the no-older-source rule. Returns the stored id either way, so a retry after
 * a lost response is indistinguishable from the first success.
 */
export async function publishBriefingEdition(
  client: Client,
  artifact: BriefingArtifact,
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

export interface EditionRow {
  artifact_id: string;
  user_id: string;
  region: string;
  edition_date: string;
  input_hash: string;
  source_published_at: string;
  valid_until: string;
  generation_version: string;
  model: string;
  briefing: BriefingArtifact["briefing"];
  provenance: BriefingArtifact["provenance"];
}

const EDITION_COLUMNS =
  "artifact_id, user_id, region, edition_date, input_hash, source_published_at, valid_until, generation_version, model, briefing, provenance";

/** Outlook (schema 1) editions carry no `kind`; this names them for filtering. */
export const SWELL_OUTLOOK_KIND = "swell_outlook";
type EditionKind = typeof WEEK_SCOUT_NOTES_KIND | typeof SWELL_OUTLOOK_KIND;

/** How many recent revisions to consider when choosing the current edition. */
const LATEST_CANDIDATE_ROWS = 20;

function generatedMs(row: EditionRow): number {
  const parsed = Date.parse(row.briefing?.generatedAt ?? "");
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

/**
 * The current edition for an account.
 *
 * The newest day wins, then the newest source behind it, and within that the
 * most recently *generated* revision - not the most recently inserted. The
 * generation time is the worker's, so two runs over one input make two
 * artifacts, and the upload of the older one can land second. Ordering by
 * insert time would let it replace the newer edition and send the footer's
 * "Updated" time backwards; ordering by generation time cannot.
 *
 * Revisions are all retained. Choosing among the few most recent is done here
 * rather than in SQL because the generation time lives inside the stored
 * briefing; the insert order is kept as the tiebreak.
 */
export async function loadLatestBriefingEdition(
  client: Client,
  userId: string,
  region: string,
  options: { kind?: EditionKind } = {},
): Promise<BriefingArtifact | null> {
  let query = briefingTables(client)
    .from("swell_briefing_editions")
    .select(EDITION_COLUMNS)
    .eq("user_id", userId)
    .eq("region", region);
  // Outlook and Week Scout notes editions share the table. Unfiltered, the
  // newest of either wins, which is what retires the Outlook briefing once
  // notes publish. Readers that need one kind ask for it; an Outlook briefing
  // has no `kind`.
  if (options.kind === WEEK_SCOUT_NOTES_KIND) query = query.eq("briefing->>kind", WEEK_SCOUT_NOTES_KIND);
  if (options.kind === SWELL_OUTLOOK_KIND) query = query.is("briefing->>kind", null);
  const { data, error } = await query
    .order("edition_date", { ascending: false })
    .order("source_published_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(LATEST_CANDIDATE_ROWS);

  if (error) throw new BriefingStoreError("briefing_edition_read_failed", 503);
  const rows = (data ?? []) as EditionRow[];
  if (rows.length === 0) return null;

  return toArtifact(selectCurrentEdition(rows));
}

/**
 * Picks the current revision from rows already ordered newest day, newest
 * source, newest insert. Exported for testing; the sort is stable, so equal
 * generation times keep the insert order as the tiebreak.
 */
export function selectCurrentEdition(rows: EditionRow[]): EditionRow {
  const [head] = rows;
  const sameEdition = rows.filter(
    (row) => row.edition_date === head.edition_date
      && row.source_published_at === head.source_published_at,
  );
  return [...sameEdition].sort((a, b) => generatedMs(b) - generatedMs(a))[0];
}

/**
 * The instant as the server issued it. Postgres hands `timestamptz` back as
 * `2026-10-26T11:51:13.397+00:00`, but the input builder issues every instant
 * through `toISOString()`, and the artifact id hashes that exact string - so
 * returning the column as read gives the publisher an artifact that no longer
 * hashes to its own id.
 */
function issuedInstant(value: string): string {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
}

export function toArtifact(row: EditionRow): BriefingArtifact {
  // The schema is the stored briefing's own. The artifact id hashes it, so a
  // v2 edition read back as v1 would no longer match the id it was saved under.
  return {
    artifactId: row.artifact_id,
    schemaVersion: (row.briefing as { schemaVersion?: unknown } | null)?.schemaVersion === 2 ? 2 : 1,
    userId: row.user_id,
    region: row.region,
    editionDate: row.edition_date,
    inputHash: row.input_hash,
    sourcePublishedAt: issuedInstant(row.source_published_at),
    validUntil: issuedInstant(row.valid_until),
    generationVersion: row.generation_version,
    model: row.model,
    briefing: row.briefing,
    provenance: row.provenance,
  } as BriefingArtifact;
}
