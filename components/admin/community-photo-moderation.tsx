"use client";

import { useCallback, useState } from "react";
import Image from "next/image";

import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { CommunityPhotoAttribution } from "@/lib/community-photos";

type QueueStatus = "all" | "visible" | "hidden" | "removed";

interface CommunityPhotoAdminItem {
  id: string;
  targetType: "beach" | "custom_spot";
  targetId: string;
  imageUrl: string;
  visibility: "public" | "private";
  processingStatus: string;
  moderationStatus: string;
  lifecycleStatus: string;
  attribution: CommunityPhotoAttribution | null;
  upvotes: number;
  downvotes: number;
  reportCounts: {
    severe: number;
    quality: number;
    total: number;
  };
  isPinned: boolean;
  hold: {
    id: string;
    reason: string;
    placedAt: string;
  } | null;
  contributorRestriction: {
    reasonCode: string;
    restrictedUntil: string | null;
  } | null;
  createdAt: string;
  removedAt: string | null;
  recoverableUntil: string | null;
}

interface CommunityPhotoAdminQueue {
  photos: CommunityPhotoAdminItem[];
  nextCursor: string | null;
}

async function loadQueue(status: QueueStatus): Promise<CommunityPhotoAdminQueue> {
  const response = await fetch(
    `/api/admin/community-photos?status=${status}&limit=100`,
    { cache: "no-store" },
  );
  if (!response.ok) throw new Error("Failed to load community photos");
  return response.json() as Promise<CommunityPhotoAdminQueue>;
}

async function mutate(
  path: string,
  method: "POST" | "DELETE",
  body: Record<string, unknown>,
): Promise<void> {
  const response = await fetch(path, {
    method,
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...body,
      idempotencyKey: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? "Admin photo action failed");
  }
}

function AdminPhotoThumbnail({ photo }: { photo: CommunityPhotoAdminItem }) {
  const [auditId] = useState(() => crypto.randomUUID());
  const useAdminMedia =
    photo.moderationStatus === "hidden" &&
    photo.lifecycleStatus !== "purging";
  const usePublicMedia =
    photo.moderationStatus === "visible" &&
    photo.lifecycleStatus === "active" &&
    photo.processingStatus === "ready";
  if (!useAdminMedia && !usePublicMedia) {
    const message =
      photo.lifecycleStatus === "removed"
        ? "Owner-removed media is available only to the contributor."
        : "Media is unavailable in its current lifecycle state.";

    return (
      <div className="flex aspect-[4/3] items-center justify-center rounded-md bg-muted p-3">
        <p className="text-center text-xs text-muted-foreground">{message}</p>
      </div>
    );
  }

  const src = useAdminMedia
    ? `/api/admin/community-photos/${photo.id}/image?auditId=${auditId}`
    : photo.imageUrl;

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-md bg-muted">
      <Image
        src={src}
        alt={`Community photo ${photo.id}`}
        fill
        sizes="160px"
        className="object-cover"
        unoptimized
      />
    </div>
  );
}

export function CommunityPhotoModeration() {
  const [status, setStatus] = useState<QueueStatus>("all");
  const [holdReasons, setHoldReasons] = useState<Record<string, string>>({});
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const fetchQueue = useCallback(() => loadQueue(status), [status]);
  const { data, loading, error, refetch } =
    useDataFetcher<CommunityPhotoAdminQueue>(fetchQueue);

  const runAction = useCallback(
    async (
      photoId: string,
      path: string,
      method: "POST" | "DELETE",
      body: Record<string, unknown> = {},
    ): Promise<void> => {
      setPendingPhotoId(photoId);
      setActionError(null);
      try {
        await mutate(path, method, body);
        await refetch();
      } catch (actionFailure) {
        setActionError(
          actionFailure instanceof Error
            ? actionFailure.message
            : "Admin photo action failed",
        );
      } finally {
        setPendingPhotoId(null);
      }
    },
    [refetch],
  );

  const photos = data?.photos ?? [];

  return (
    <section className="space-y-5" aria-label="Community photo moderation">
      <div className="flex flex-wrap gap-2" aria-label="Queue status">
        {(["all", "visible", "hidden", "removed"] as const).map((option) => (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={status === option ? "default" : "outline"}
            onClick={() => setStatus(option)}
          >
            {option}
          </Button>
        ))}
      </div>

      {actionError ? (
        <p role="alert" className="text-sm text-destructive">
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading photos…</p> : null}
      {!loading && photos.length === 0 ? (
        <p className="text-sm text-muted-foreground">No community photos in this queue.</p>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        {photos.map((photo) => {
          const isPending = pendingPhotoId === photo.id;
          const canRecover =
            photo.lifecycleStatus === "removed" &&
            Boolean(photo.recoverableUntil);
          const profileId =
            photo.attribution?.kind === "profile"
              ? photo.attribution.profileId
              : null;

          return (
            <article
              key={photo.id}
              className="grid gap-4 rounded-lg border bg-card p-4 sm:grid-cols-[10rem_1fr]"
            >
              <AdminPhotoThumbnail photo={photo} />

              <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge>{photo.moderationStatus}</Badge>
                  <Badge variant="outline">{photo.lifecycleStatus}</Badge>
                  <Badge variant="outline">{photo.visibility}</Badge>
                  {photo.isPinned ? <Badge>pinned</Badge> : null}
                  {photo.hold ? <Badge variant="destructive">held</Badge> : null}
                </div>

                <PhotoAttribution
                  attribution={photo.attribution}
                  className="block truncate text-sm font-medium underline-offset-2 hover:underline"
                />
                <p className="text-xs text-muted-foreground">
                  {photo.targetType} · {photo.targetId}
                </p>
                <p className="text-xs">
                  {photo.upvotes} up · {photo.downvotes} down
                </p>
                <p className="text-xs">
                  {photo.reportCounts.severe} severe ·{" "}
                  {photo.reportCounts.quality} quality ·{" "}
                  {photo.reportCounts.total} total
                </p>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={isPending || photo.moderationStatus === "hidden"}
                    onClick={() =>
                      void runAction(
                        photo.id,
                        `/api/admin/community-photos/${photo.id}/moderation`,
                        "POST",
                        {
                          action: "hide",
                          reason: "manual_admin_review",
                        },
                      )
                    }
                  >
                    Hide photo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending || photo.moderationStatus !== "hidden"}
                    onClick={() =>
                      void runAction(
                        photo.id,
                        `/api/admin/community-photos/${photo.id}/moderation`,
                        "POST",
                        {
                          action: "restore",
                          reason: "manual_admin_review",
                        },
                      )
                    }
                  >
                    Restore photo
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      void runAction(
                        photo.id,
                        `/api/admin/community-photos/${photo.id}/pin`,
                        photo.isPinned ? "DELETE" : "POST",
                        photo.isPinned
                          ? {}
                          : {
                              targetType: photo.targetType,
                              targetId: photo.targetId,
                            },
                      )
                    }
                  >
                    {photo.isPinned ? "Remove pin" : "Pin photo"}
                  </Button>
                  {canRecover ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        void runAction(
                          photo.id,
                          `/api/admin/community-photos/${photo.id}/recover`,
                          "POST",
                        )
                      }
                    >
                      Recover photo
                    </Button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    aria-label={`Hold reason for ${photo.id}`}
                    value={holdReasons[photo.id] ?? ""}
                    disabled={Boolean(photo.hold)}
                    placeholder="Investigation hold reason"
                    onChange={(event) =>
                      setHoldReasons((current) => ({
                        ...current,
                        [photo.id]: event.target.value,
                      }))
                    }
                    className="min-w-56 flex-1"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                      isPending ||
                      (!photo.hold && !(holdReasons[photo.id] ?? "").trim())
                    }
                    onClick={() =>
                      void runAction(
                        photo.id,
                        `/api/admin/community-photos/${photo.id}/hold`,
                        photo.hold ? "DELETE" : "POST",
                        photo.hold
                          ? {}
                          : { reason: (holdReasons[photo.id] ?? "").trim() },
                      )
                    }
                  >
                    {photo.hold ? "Release hold" : "Place hold"}
                  </Button>
                </div>

                {profileId ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isPending}
                    onClick={() =>
                      void runAction(
                        photo.id,
                        `/api/admin/community-photo-contributors/${profileId}/restriction`,
                        photo.contributorRestriction ? "DELETE" : "POST",
                        photo.contributorRestriction
                          ? {}
                          : {
                              reasonCode: "manual_admin_review",
                              restrictedUntil: null,
                            },
                      )
                    }
                  >
                    {photo.contributorRestriction
                      ? "Lift contributor restriction"
                      : "Restrict contributor"}
                  </Button>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
