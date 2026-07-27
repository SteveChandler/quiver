import { createServiceRoleClient } from "@/lib/supabase";

import { getCommunityPhotoFeatureFlags } from "./contracts";
import { CommunityPhotoError } from "./errors";
import { mergeResolvedSpotPhotos } from "./ranking";
import type {
  CommunityPhotoTarget,
  ResolvedSpotPhoto,
} from "./types";

interface ResolverRow {
  photo_id: string;
  target_type: "beach" | "custom_spot";
  target_id: string;
  visibility: "public" | "private";
  width: number | null;
  height: number | null;
  uploader_id: string | null;
  display_name: string | null;
  upvotes: number;
  downvotes: number;
  viewer_vote: "up" | "down" | null;
  wilson_score: number;
  is_pinned: boolean;
  created_at: string;
}

interface ResolverClient {
  rpc(
    name:
      | "resolve_community_spot_photos_v1"
      | "resolve_community_spot_photo_batch_v1"
      | "resolve_community_spot_photo_by_id_v1",
    args: Record<string, unknown>,
  ): PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  from(table: "beach_photos"): {
    select(columns: string): {
      eq(column: string, value: unknown): {
        eq(column: string, value: unknown): {
          is(column: string, value: null): {
            order(
              column: string,
              options: { ascending: boolean },
            ): {
              limit(
                limit: number,
              ): PromiseLike<{
                data: unknown;
                error: { message?: string } | null;
              }>;
            };
          };
        };
      };
    };
  };
}

interface CuratedPhotoRow {
  id: string;
  beach_id?: string;
  image_url: string;
  thumb_url: string | null;
  title: string | null;
  creator_name: string | null;
  attribution_html: string | null;
  fetched_at: string;
}

function toResolvedPhoto(
  row: ResolverRow,
  viewerId: string | null,
): ResolvedSpotPhoto {
  const isPrivate = row.visibility === "private";
  const owner = row.uploader_id === viewerId;
  const safeProfileAttribution = Boolean(
    row.uploader_id && row.display_name?.trim(),
  );
  return {
    id: row.photo_id,
    source: "community",
    visibility: row.visibility,
    imageUrl: `/api/community-photos/${row.photo_id}/image`,
    thumbUrl: `/api/community-photos/${row.photo_id}/image`,
    width: row.width,
    height: row.height,
    title: null,
    creatorName: null,
    attributionHtml: null,
    attribution: isPrivate
      ? null
      : {
          kind: safeProfileAttribution ? "profile" : "community",
          displayName: safeProfileAttribution
            ? row.display_name!
            : "Quiver community",
          profileId: safeProfileAttribution ? row.uploader_id : null,
        },
    community: {
      voteScore: row.wilson_score,
      upvotes: row.upvotes,
      downvotes: row.downvotes,
      viewerVote: row.viewer_vote,
      canVote: Boolean(viewerId && !owner && !isPrivate),
      canReport: Boolean(viewerId && !owner && !isPrivate),
      canRemove: Boolean(viewerId && owner),
      isPinned: row.is_pinned,
    },
    createdAt: row.created_at,
  };
}

export async function getCommunityPhotoById({
  photoId,
  viewerId,
}: {
  photoId: string;
  viewerId: string;
}): Promise<ResolvedSpotPhoto> {
  if (!getCommunityPhotoFeatureFlags(viewerId).readEnabled) {
    throw new CommunityPhotoError("feature_disabled");
  }
  const database = createServiceRoleClient() as unknown as ResolverClient;
  const { data, error } = await database.rpc(
    "resolve_community_spot_photo_by_id_v1",
    {
      p_photo_id: photoId,
      p_viewer_id: viewerId,
    },
  );
  if (error) throw new CommunityPhotoError("database_failed", true);
  const row = (Array.isArray(data) ? data[0] : data) as ResolverRow | null;
  if (!row) throw new CommunityPhotoError("photo_not_found");
  return toResolvedPhoto(row, viewerId);
}

export function communityPhotoTargetKey(target: CommunityPhotoTarget): string {
  return `${target.type}:${target.id}`;
}

export async function getCommunityPhotosForTarget({
  target,
  viewerId = null,
  limit = 20,
}: {
  target: CommunityPhotoTarget;
  viewerId?: string | null;
  limit?: number;
}): Promise<ResolvedSpotPhoto[]> {
  if (!getCommunityPhotoFeatureFlags(viewerId).readEnabled) return [];

  const client = createServiceRoleClient() as unknown as ResolverClient;
  const { data, error } = await client.rpc("resolve_community_spot_photos_v1", {
    p_target_type: target.type,
    p_target_id: target.id,
    p_viewer_id: viewerId,
    p_limit: limit,
  });
  if (error) throw new CommunityPhotoError("database_failed", true);
  return ((data ?? []) as ResolverRow[]).map((row) =>
    toResolvedPhoto(row, viewerId),
  );
}

export async function getResolvedSpotPhotoMap({
  targets,
  viewerId = null,
  limitPerTarget = 6,
}: {
  targets: CommunityPhotoTarget[];
  viewerId?: string | null;
  limitPerTarget?: number;
}): Promise<Map<string, ResolvedSpotPhoto[]>> {
  const result = new Map<string, ResolvedSpotPhoto[]>();
  for (const target of targets) result.set(communityPhotoTargetKey(target), []);
  if (targets.length === 0) return result;

  const readEnabled = getCommunityPhotoFeatureFlags(viewerId).readEnabled;
  const client = createServiceRoleClient() as unknown as ResolverClient;
  const beachTargets = targets.filter(({ type }) => type === "beach");
  const curatedPromise = getCuratedPhotoRowsForPublicBeaches(
    beachTargets.map(({ id }) => id),
    limitPerTarget,
  );
  const communityPromise = readEnabled
    ? client.rpc("resolve_community_spot_photo_batch_v1", {
        p_targets: targets.map((target) => ({
          target_type: target.type,
          target_id: target.id,
        })),
        p_viewer_id: viewerId,
        p_limit_per_target: limitPerTarget,
      })
    : Promise.resolve({ data: [], error: null });
  const [curatedResult, communityResult] = await Promise.all([
    curatedPromise,
    communityPromise,
  ]);
  if (curatedResult.error || communityResult.error) {
    throw new CommunityPhotoError("database_failed", true);
  }

  const communityMap = new Map<string, ResolvedSpotPhoto[]>();
  for (const row of (communityResult.data ?? []) as ResolverRow[]) {
    const key = communityPhotoTargetKey({
      type: row.target_type,
      id: row.target_id,
    });
    const photos = communityMap.get(key) ?? [];
    photos.push(toResolvedPhoto(row, viewerId));
    communityMap.set(key, photos);
  }
  const curatedMap = new Map<string, ResolvedSpotPhoto[]>();
  for (const row of (curatedResult.data ?? []) as CuratedPhotoRow[]) {
    if (!row.beach_id) continue;
    const key = communityPhotoTargetKey({ type: "beach", id: row.beach_id });
    const photos = curatedMap.get(key) ?? [];
    photos.push(toCuratedPhoto(row));
    curatedMap.set(key, photos);
  }
  for (const target of targets) {
    const key = communityPhotoTargetKey(target);
    result.set(
      key,
      mergeResolvedSpotPhotos({
        curated: curatedMap.get(key) ?? [],
        community: communityMap.get(key) ?? [],
        limit: limitPerTarget,
      }),
    );
  }
  return result;
}

export async function getResolvedSpotPhotos({
  target,
  curated,
  viewerId = null,
  limit = 6,
}: {
  target: CommunityPhotoTarget;
  curated: ResolvedSpotPhoto[];
  viewerId?: string | null;
  limit?: number;
}): Promise<ResolvedSpotPhoto[]> {
  const community = await getCommunityPhotosForTarget({
    target,
    viewerId,
    limit,
  });
  return mergeResolvedSpotPhotos({ curated, community, limit });
}

async function getCuratedPhotosForTarget(
  target: CommunityPhotoTarget,
  limit: number,
): Promise<ResolvedSpotPhoto[]> {
  if (target.type !== "beach") return [];

  const database = createServiceRoleClient();
  const { data: beach, error: beachError } = await database
    .from("beaches")
    .select("id")
    .eq("id", target.id)
    .or("is_private.is.null,is_private.eq.false")
    .maybeSingle();
  if (beachError) throw new CommunityPhotoError("database_failed", true);
  if (!beach) return [];

  const photoDatabase = database as unknown as ResolverClient;
  const { data, error } = await photoDatabase
    .from("beach_photos")
    .select(
      "id, image_url, thumb_url, title, creator_name, attribution_html, fetched_at",
    )
    .eq("beach_id", target.id)
    .eq("approved", true)
    .is("deleted_at", null)
    .order("fetched_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 100));
  if (error) throw new CommunityPhotoError("database_failed", true);
  return ((data ?? []) as CuratedPhotoRow[]).map(toCuratedPhoto);
}

async function getCuratedPhotoRowsForPublicBeaches(
  beachIds: string[],
  limitPerTarget: number,
): Promise<{ data: unknown[]; error: { message?: string } | null }> {
  if (beachIds.length === 0) return { data: [], error: null };

  const database = createServiceRoleClient();
  const { data: publicBeaches, error: beachError } = await database
    .from("beaches")
    .select("id")
    .in("id", beachIds)
    .or("is_private.is.null,is_private.eq.false");
  if (beachError) return { data: [], error: beachError };
  const publicIds = (publicBeaches ?? []).map(({ id }) => id);
  if (publicIds.length === 0) return { data: [], error: null };

  const { data, error } = await database
    .from("beach_photos")
    .select(
      "id, beach_id, image_url, thumb_url, title, creator_name, attribution_html, fetched_at",
    )
    .in("beach_id", publicIds)
    .eq("approved", true)
    .is("deleted_at", null)
    .order("fetched_at", { ascending: false })
    .limit(
      Math.min(
        Math.max(limitPerTarget, 1) * Math.max(publicIds.length, 1),
        1000,
      ),
    );
  return { data: data ?? [], error };
}

function toCuratedPhoto(row: CuratedPhotoRow): ResolvedSpotPhoto {
  return {
    id: row.id,
    source: "curated",
    visibility: "public",
    imageUrl: row.image_url,
    thumbUrl: row.thumb_url,
    width: null,
    height: null,
    title: row.title,
    creatorName: row.creator_name,
    attributionHtml: row.attribution_html,
    attribution: null,
    community: null,
    createdAt: row.fetched_at,
  };
}

export async function getCanonicalSpotPhotos({
  target,
  viewerId = null,
  limit = 20,
}: {
  target: CommunityPhotoTarget;
  viewerId?: string | null;
  limit?: number;
}): Promise<ResolvedSpotPhoto[]> {
  const [curated, community] = await Promise.all([
    getCuratedPhotosForTarget(target, limit),
    getCommunityPhotosForTarget({ target, viewerId, limit }),
  ]);
  return mergeResolvedSpotPhotos({ curated, community, limit });
}
