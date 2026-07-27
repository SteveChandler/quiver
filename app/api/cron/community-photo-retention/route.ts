import { z } from "zod";

import { withCommunityPhotoRouteObservability } from "@/lib/community-photos";
import { withObservedCron } from "@/lib/cron/observability";
import { validateCronRequest } from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const ROUTE = "/api/cron/community-photo-retention";
const candidatesSchema = z.array(
  z.object({
    photo_id: z.string().uuid(),
    storage_path: z.string().min(1).max(512),
  }),
);

interface RetentionClient {
  rpc(
    name:
      | "purge_removed_community_spot_photos_v1"
      | "finalize_purged_community_spot_photos_v1"
      | "release_community_spot_photo_purge_v1"
      | "claim_stuck_community_spot_photo_uploads_v1"
      | "finalize_stuck_community_spot_photo_uploads_v1"
      | "release_stuck_community_spot_photo_uploads_v1"
      | "list_orphan_community_photo_objects_v1",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: unknown }>;
  storage: {
    from(bucket: "community-spot-photos"): {
      remove(
        paths: string[],
      ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
    };
  };
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

async function removeObjects(
  client: RetentionClient,
  candidates: Array<{ photo_id: string; storage_path: string }>,
): Promise<{ successfulIds: string[]; failedIds: string[] }> {
  const successfulIds: string[] = [];
  const failedIds: string[] = [];
  for (const candidate of candidates) {
    const removal = await client.storage
      .from("community-spot-photos")
      .remove([candidate.storage_path]);
    if (removal.error) failedIds.push(candidate.photo_id);
    else successfulIds.push(candidate.photo_id);
  }
  return { successfulIds, failedIds };
}

async function runRetention(request: Request): Promise<Response> {
  if (!validateCronRequest(request)) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  const client =
    createSupabaseServiceRoleClient() as unknown as RetentionClient;

  const stuckClaim = await client.rpc(
    "claim_stuck_community_spot_photo_uploads_v1",
    { p_now: new Date().toISOString(), p_limit: 100 },
  );
  if (stuckClaim.error) {
    return json({ ok: false, code: "stuck_claim_failed" }, 500);
  }
  const stuckParsed = candidatesSchema.safeParse(stuckClaim.data ?? []);
  if (!stuckParsed.success) {
    return json({ ok: false, code: "stuck_claim_result_invalid" }, 500);
  }
  const stuckRemoval = await removeObjects(client, stuckParsed.data);
  if (stuckRemoval.failedIds.length > 0) {
    const released = await client.rpc(
      "release_stuck_community_spot_photo_uploads_v1",
      { p_photo_ids: stuckRemoval.failedIds },
    );
    if (released.error) {
      return json({ ok: false, code: "stuck_release_failed" }, 500);
    }
  }
  let stuckCleaned = 0;
  if (stuckRemoval.successfulIds.length > 0) {
    const finalized = await client.rpc(
      "finalize_stuck_community_spot_photo_uploads_v1",
      { p_photo_ids: stuckRemoval.successfulIds },
    );
    if (finalized.error || typeof finalized.data !== "number") {
      return json({ ok: false, code: "stuck_finalize_failed" }, 500);
    }
    stuckCleaned = finalized.data;
  }

  const orphanLookup = await client.rpc(
    "list_orphan_community_photo_objects_v1",
    { p_now: new Date().toISOString(), p_limit: 100 },
  );
  if (orphanLookup.error) {
    return json({ ok: false, code: "orphan_lookup_failed" }, 500);
  }
  const orphanParsed = z
    .array(z.object({ storage_path: z.string().min(1).max(512) }))
    .safeParse(orphanLookup.data ?? []);
  if (!orphanParsed.success) {
    return json({ ok: false, code: "orphan_result_invalid" }, 500);
  }
  let orphansRemoved = 0;
  let orphanFailures = 0;
  for (const orphan of orphanParsed.data) {
    const removal = await client.storage
      .from("community-spot-photos")
      .remove([orphan.storage_path]);
    if (removal.error) orphanFailures += 1;
    else orphansRemoved += 1;
  }

  const claim = await client.rpc("purge_removed_community_spot_photos_v1", {
    p_now: new Date().toISOString(),
    p_limit: 100,
  });
  if (claim.error) return json({ ok: false, code: "claim_failed" }, 500);

  const parsed = candidatesSchema.safeParse(claim.data ?? []);
  if (!parsed.success) {
    return json({ ok: false, code: "claim_result_invalid" }, 500);
  }
  const { successfulIds, failedIds } = await removeObjects(
    client,
    parsed.data,
  );

  if (failedIds.length > 0) {
    const released = await client.rpc(
      "release_community_spot_photo_purge_v1",
      { p_photo_ids: failedIds },
    );
    if (released.error) {
      return json(
        {
          ok: false,
          code: "release_failed",
          claimed: parsed.data.length,
          purged: 0,
          released: 0,
        },
        500,
      );
    }
  }

  let purged = 0;
  if (successfulIds.length > 0) {
    const finalized = await client.rpc(
      "finalize_purged_community_spot_photos_v1",
      { p_photo_ids: successfulIds },
    );
    if (finalized.error || typeof finalized.data !== "number") {
      return json(
        {
          ok: false,
          code: "finalize_failed",
          claimed: parsed.data.length,
          purged: 0,
          released: failedIds.length,
        },
        500,
      );
    }
    purged = finalized.data;
  }

  return json({
    ok:
      failedIds.length === 0 &&
      stuckRemoval.failedIds.length === 0 &&
      orphanFailures === 0,
    claimed: parsed.data.length,
    purged,
    released: failedIds.length,
    stuckClaimed: stuckParsed.data.length,
    stuckCleaned,
    stuckReleased: stuckRemoval.failedIds.length,
    orphansFound: orphanParsed.data.length,
    orphansRemoved,
    orphanFailures,
  });
}

export const GET = withCommunityPhotoRouteObservability(
  {
    route: "/api/cron/community-photo-retention",
    surface: "retention",
    successResultClass: "retention_success",
  },
  withObservedCron(ROUTE, runRetention, {
    slug: "community-photo-retention",
    schedule: "35 9 * * *",
  }),
);
