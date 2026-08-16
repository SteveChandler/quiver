import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE = "/api/cron/session-video-retention";
const STORAGE_BUCKET = "session-videos" as const;
const STORAGE_PAGE_SIZE = 1000;
const ORPHAN_SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000;
// The client PUTs before it creates the row; this window protects that in-flight gap.

interface StorageEntry {
  id: string | null;
  name: string;
  created_at: string | null;
}

interface StorageError {
  message?: string;
}

interface RetentionClient {
  from(table: "session_media"): {
    select(columns: "id"): {
      eq(column: "storage_path", value: string): {
        limit(limit: number): PromiseLike<{
          data: Array<{ id: string }> | null;
          error: StorageError | null;
        }>;
      };
    };
  };
  storage: {
    from(bucket: typeof STORAGE_BUCKET): {
      list(
        path: string,
        options: { limit: number; offset: number },
      ): PromiseLike<{
        data: StorageEntry[] | null;
        error: StorageError | null;
      }>;
      remove(paths: string[]): PromiseLike<{
        data: unknown;
        error: StorageError | null;
      }>;
    };
  };
}

interface RetentionSummary {
  scanned: number;
  orphaned: number;
  deleted: number;
  failed: number;
}

interface ObjectOutcome {
  orphaned: boolean;
  deleted: boolean;
  failed: boolean;
}

function json(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store, no-cache, must-revalidate",
    },
  });
}

async function listStorageObjects(client: RetentionClient): Promise<StorageEntry[]> {
  const objects: StorageEntry[] = [];

  async function visit(prefix: string): Promise<void> {
    let offset = 0;

    while (true) {
      const listing = await client.storage
        .from(STORAGE_BUCKET)
        .list(prefix, { limit: STORAGE_PAGE_SIZE, offset });

      if (listing.error) {
        throw new Error(
          `Failed to list session-video storage prefix ${prefix || "<root>"}: ${listing.error.message ?? "unknown error"}`,
        );
      }
      if (!Array.isArray(listing.data)) {
        throw new Error(
          `Failed to list session-video storage prefix ${prefix || "<root>"}: invalid result`,
        );
      }

      for (const entry of listing.data) {
        if (!entry.name) {
          throw new Error(
            `Failed to list session-video storage prefix ${prefix || "<root>"}: invalid entry`,
          );
        }

        const storagePath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.id === null) {
          await visit(storagePath);
        } else {
          objects.push({ ...entry, name: storagePath });
        }
      }

      if (listing.data.length < STORAGE_PAGE_SIZE) return;
      offset += listing.data.length;
    }
  }

  await visit("");
  return objects;
}

async function processObject(
  client: RetentionClient,
  object: StorageEntry,
  cutoff: number,
): Promise<ObjectOutcome> {
  let lookup: {
    data: Array<{ id: string }> | null;
    error: StorageError | null;
  };

  try {
    lookup = await client
      .from("session_media")
      .select("id")
      .eq("storage_path", object.name)
      .limit(1);
  } catch {
    return { orphaned: false, deleted: false, failed: true };
  }

  // A null or malformed result is not positive confirmation that no row exists.
  if (lookup.error || !Array.isArray(lookup.data)) {
    return { orphaned: false, deleted: false, failed: true };
  }
  if (lookup.data.length > 0) {
    return { orphaned: false, deleted: false, failed: false };
  }

  const createdAt = object.created_at ? Date.parse(object.created_at) : NaN;
  if (!Number.isFinite(createdAt)) {
    return { orphaned: true, deleted: false, failed: true };
  }

  if (createdAt >= cutoff) {
    return { orphaned: true, deleted: false, failed: false };
  }

  try {
    const removal = await client.storage
      .from(STORAGE_BUCKET)
      .remove([object.name]);
    return {
      orphaned: true,
      deleted: !removal.error,
      failed: Boolean(removal.error),
    };
  } catch {
    return { orphaned: true, deleted: false, failed: true };
  }
}

async function runRetention(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  const client =
    createSupabaseServiceRoleClient() as unknown as RetentionClient;
  let objects: StorageEntry[];

  try {
    objects = await listStorageObjects(client);
  } catch {
    return json(
      { ok: false, code: "list_failed", scanned: 0, orphaned: 0, deleted: 0, failed: 1 },
      500,
    );
  }

  const summary: RetentionSummary = {
    scanned: 0,
    orphaned: 0,
    deleted: 0,
    failed: 0,
  };
  const cutoff = Date.now() - ORPHAN_SAFETY_WINDOW_MS;

  for (const object of objects) {
    summary.scanned += 1;
    const outcome = await processObject(client, object, cutoff);
    if (outcome.orphaned) summary.orphaned += 1;
    if (outcome.deleted) summary.deleted += 1;
    if (outcome.failed) summary.failed += 1;
  }

  return json({ ok: summary.failed === 0, ...summary });
}

export const GET = withObservedCron(ROUTE, runRetention, {
  slug: "session-video-retention",
  schedule: "50 9 * * *",
});
