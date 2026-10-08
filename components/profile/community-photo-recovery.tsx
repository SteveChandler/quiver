"use client";

import { useCallback, useMemo, useState } from "react";
import Image from "next/image";
import { ImageIcon, Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDataFetcher } from "@/hooks/use-data-fetcher";

interface RemovedCommunityPhoto {
  id: string;
  targetType: "beach" | "custom_spot";
  targetId: string;
  imageUrl: string;
  thumbUrl: string | null;
  recoverableUntil: string;
  moderationStatus: string;
  hasActiveHold: boolean;
}

interface RemovedCommunityPhotoResponse {
  photos: RemovedCommunityPhoto[];
  featureEnabled: boolean;
}

async function loadRemovedPhotos(): Promise<RemovedCommunityPhotoResponse> {
  const response = await fetch("/api/community-photos/mine?status=removed", {
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string;
    } | null;
    if (response.status === 403 && payload?.code === "feature_disabled") {
      return { photos: [], featureEnabled: false };
    }
    throw new Error("Failed to load removed spot photos");
  }
  const payload = (await response.json()) as {
    photos: RemovedCommunityPhoto[];
  };
  return { photos: payload.photos, featureEnabled: true };
}

function formatRecoveryDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Recovery date unavailable";

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function recoveryBlockReason(photo: RemovedCommunityPhoto): string | null {
  if (photo.hasActiveHold) {
    return "Recovery is paused during an investigation.";
  }
  if (photo.moderationStatus !== "visible") {
    return "This photo must pass moderation before it can be recovered.";
  }
  if (new Date(photo.recoverableUntil).getTime() <= Date.now()) {
    return "The 30-day recovery window has expired.";
  }
  return null;
}

export function CommunityPhotoRecovery() {
  const fetchPhotos = useCallback(() => loadRemovedPhotos(), []);
  const { data, loading, error, refetch } =
    useDataFetcher<RemovedCommunityPhotoResponse>(fetchPhotos);
  const [pendingPhotoId, setPendingPhotoId] = useState<string | null>(null);
  const [recoveredPhotoIds, setRecoveredPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const photos = useMemo(
    () =>
      (data?.photos ?? []).filter(
        (photo) => !recoveredPhotoIds.has(photo.id),
      ),
    [data?.photos, recoveredPhotoIds],
  );

  const recoverPhoto = useCallback(
    async (photoId: string): Promise<void> => {
      setPendingPhotoId(photoId);
      setActionError(null);
      setSuccessMessage(null);

      try {
        const response = await fetch(
          `/api/community-photos/${photoId}/recover`,
          {
            method: "POST",
            cache: "no-store",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              idempotencyKey: crypto.randomUUID(),
            }),
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error ?? "Photo recovery failed");
        }

        setRecoveredPhotoIds((current) => {
          const next = new Set(current);
          next.add(photoId);
          return next;
        });
        setSuccessMessage(
          "Photo recovered. It is back in its spot gallery.",
        );
        await refetch();
      } catch (recoveryError) {
        setActionError(
          recoveryError instanceof Error
            ? recoveryError.message
            : "Photo recovery failed",
        );
      } finally {
        setPendingPhotoId(null);
      }
    },
    [refetch],
  );

  if (loading || data?.featureEnabled === false) {
    return null;
  }

  return (
    <section
      className="mt-8 border-t-2 border-dashed border-[#11100D]/35 pt-6"
      aria-labelledby="removed-spot-photos-heading"
    >
      <div className="mb-4">
        <h3
          id="removed-spot-photos-heading"
          className="font-heading text-xl font-black uppercase text-[#11100D]"
        >
          Removed spot photos
        </h3>
        <p className="mt-1 max-w-2xl font-sans text-sm text-[#11100D]/65">
          Photos you remove stay here for 30 days before permanent deletion.
        </p>
      </div>

      {successMessage ? (
        <p
          role="status"
          className="mb-4 border-2 border-[#11100D] bg-[#00D4AA]/20 px-3 py-2 font-mono text-xs font-bold text-[#11100D]"
        >
          {successMessage}
        </p>
      ) : null}
      {actionError ? (
        <p
          role="alert"
          className="mb-4 border-2 border-[#11100D] bg-red-100 px-3 py-2 font-mono text-xs font-bold text-[#11100D]"
        >
          {actionError}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="font-sans text-sm text-red-700">
          {error}
        </p>
      ) : null}
      {!loading && !error && photos.length === 0 ? (
        <div className="flex items-center gap-3 border-2 border-[#11100D]/25 bg-[#F4EBD8] p-4 text-[#11100D]/65">
          <ImageIcon className="h-5 w-5" aria-hidden />
          <p className="font-sans text-sm">
            No removed spot photos are in the 30-day recovery window.
          </p>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {photos.map((photo) => {
          const blockReason = recoveryBlockReason(photo);
          const isPending = pendingPhotoId === photo.id;
          const targetLabel =
            photo.targetType === "beach" ? "Beach" : "Custom spot";
          const imageAlt =
            photo.targetType === "beach"
              ? "Removed beach spot photo"
              : "Removed custom spot photo";

          return (
            <article
              key={photo.id}
              className="grid grid-cols-[7rem_1fr] gap-3 border-2 border-[#11100D] bg-[#F4EBD8] p-3 shadow-[2px_3px_0_rgba(17,16,13,0.18)]"
            >
              <Image
                src={photo.thumbUrl ?? photo.imageUrl}
                alt={imageAlt}
                width={112}
                height={84}
                className="h-[5.25rem] w-28 object-cover"
                unoptimized
              />
              <div className="min-w-0">
                <p className="font-heading text-sm font-bold uppercase text-[#11100D]">
                  {targetLabel} photo
                </p>
                <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[#11100D]/60">
                  Recover by {formatRecoveryDate(photo.recoverableUntil)}
                </p>
                {blockReason ? (
                  <p className="mt-2 font-sans text-xs text-[#11100D]/70">
                    {blockReason}
                  </p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={Boolean(blockReason) || isPending}
                  onClick={() => void recoverPhoto(photo.id)}
                  className="mt-3 border-2 border-[#11100D] bg-[#FBF6E8] font-heading text-xs font-bold text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.18)] hover:bg-[#F78E42]"
                >
                  {isPending ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Recover photo
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
