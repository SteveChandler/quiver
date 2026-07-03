"use client";

import { useCallback, useEffect, useState } from "react";
import { useTrackEvent } from "@/hooks/use-track-event";
import { ZineSurface } from "@/components/zine";
import { ImInButton } from "@/components/surf-drops/im-in-button";
import { ShareDropSheet } from "@/components/surf-drops/share-drop-sheet";
import { formatSurfDropWindow } from "@/lib/surf-drops/format";
import { cn } from "@/lib/utils";
import type { SurfDropDetail } from "@/types/surf-drops";

interface DropDetailCardProps {
  initialDrop: SurfDropDetail;
  /** Present when the user reached this page via /go/{slug}. */
  viaShareSlug?: string;
}

interface ForecastTeaserView {
  waveLabel: string | null;
  rating: string | null;
}

function readForecastTeaser(snapshot: unknown): ForecastTeaserView {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) {
    return { waveLabel: null, rating: null };
  }
  const rec = snapshot as Record<string, unknown>;

  let waveLabel: string | null = null;
  const wave = rec.wave_height_ft;
  if (typeof wave === "number" && Number.isFinite(wave)) {
    waveLabel = `${wave.toFixed(1)}ft`;
  } else if (
    wave &&
    typeof wave === "object" &&
    "min" in wave &&
    "max" in wave &&
    typeof (wave as Record<string, unknown>).min === "number" &&
    typeof (wave as Record<string, unknown>).max === "number"
  ) {
    const w = wave as { min: number; max: number };
    waveLabel = `${w.min.toFixed(1)}-${w.max.toFixed(1)}ft`;
  }

  const rating = typeof rec.rating === "string" ? rec.rating : null;

  return { waveLabel, rating };
}

function directionsUrl(drop: SurfDropDetail): string | null {
  if (drop.custom_pin) {
    return `https://maps.apple.com/?ll=${drop.custom_pin.lat},${drop.custom_pin.lon}`;
  }
  if (drop.beach?.lat != null && drop.beach.lon != null) {
    return `https://maps.apple.com/?ll=${drop.beach.lat},${drop.beach.lon}`;
  }
  if (drop.general_area) {
    return `https://maps.apple.com/?q=${encodeURIComponent(drop.general_area)}`;
  }
  return null;
}

function spotHeadline(drop: SurfDropDetail): string {
  if (drop.location_type === "known_spot" && drop.beach?.name) {
    return drop.beach.name;
  }
  if (drop.custom_pin?.exact_label) {
    return drop.custom_pin.exact_label;
  }
  if (drop.general_area) {
    return `Near ${drop.general_area}`;
  }
  return "A surf zone";
}

function initials(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

export function DropDetailCard({ initialDrop, viaShareSlug }: DropDetailCardProps) {
  const [drop, setDrop] = useState<SurfDropDetail>(initialDrop);
  const [shareOpen, setShareOpen] = useState(false);
  const { track } = useTrackEvent();

  useEffect(() => {
    void track("surf_drop_link_view_authenticated", {
      metadata: { drop_id: drop.id, slug: drop.share_slug },
    });
    // Only fire once per drop-load; safe to omit drop.id from deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const forecast = readForecastTeaser(drop.forecast_snapshot);
  const windowLabel = formatSurfDropWindow(drop.starts_at, drop.ends_at);
  const directions = directionsUrl(drop);

  const visibleParticipants = drop.participants.slice(0, 8);
  const extraCount = Math.max(0, drop.participants_count - visibleParticipants.length);

  const handleJoinChange = useCallback(
    (next: { isJoined: boolean; participantsCount: number }) => {
      setDrop((prev) => {
        const currentUserAlreadyIn = prev.participants.some(
          (p) => p.user_id === prev.creator.id,
        );
        // Note: we can't know the viewer's user_id here without threading
        // it in. Keeping participants list unchanged; participants_count is
        // authoritative for count display until refetch.
        void currentUserAlreadyIn;
        return {
          ...prev,
          is_joined: next.isJoined,
          participants_count: next.participantsCount,
        };
      });
    },
    [],
  );

  return (
    <>
      <ZineSurface sectionLabel="Surf Drop" data-testid="drop-detail-card">
        <div className="drop-detail">
          <header className="drop-detail__header">
            <div className="drop-detail__creator">
              <div className="drop-detail__avatar" aria-hidden>
                {drop.creator.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={drop.creator.avatar_url}
                    alt=""
                    loading="lazy"
                  />
                ) : (
                  <span>{initials(drop.creator.display_name)}</span>
                )}
              </div>
              <div>
                <p className="drop-detail__creator-name">
                  {drop.creator.display_name || "A surfer"}
                </p>
                <p className="drop-detail__creator-meta">just dropped a wave</p>
              </div>
            </div>

            {drop.can_edit ? (
              <span className="drop-detail__badge">Your drop</span>
            ) : null}
          </header>

          <h1 className="drop-detail__headline">{spotHeadline(drop)}</h1>

          {drop.general_area && drop.location_type === "custom_pin" ? (
            <p className="drop-detail__subarea">Near {drop.general_area}</p>
          ) : null}

          {windowLabel ? (
            <p className="drop-detail__window">{windowLabel}</p>
          ) : null}

          {forecast.waveLabel || forecast.rating ? (
            <div className="drop-detail__forecast">
              {forecast.waveLabel ? (
                <span className="drop-detail__forecast-wave">
                  {forecast.waveLabel}
                </span>
              ) : null}
              {forecast.rating ? (
                <span className="drop-detail__forecast-rating">
                  {forecast.rating}
                </span>
              ) : null}
            </div>
          ) : null}

          {drop.note ? (
            <blockquote className="drop-detail__note">
              &ldquo;{drop.note}&rdquo;
            </blockquote>
          ) : null}

          <div className="drop-detail__participants">
            <div className="drop-detail__avatars" aria-hidden>
              {visibleParticipants.map((p) => (
                <div key={p.user_id} className="drop-detail__avatar drop-detail__avatar--sm">
                  {p.profile?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.profile.avatar_url} alt="" loading="lazy" />
                  ) : (
                    <span>{initials(p.profile?.display_name ?? p.profile?.full_name ?? null)}</span>
                  )}
                </div>
              ))}
              {extraCount > 0 ? (
                <div className="drop-detail__avatar drop-detail__avatar--sm drop-detail__avatar--more">
                  +{extraCount}
                </div>
              ) : null}
            </div>
            <p className="drop-detail__participants-label">
              {drop.participants_count === 0
                ? "Be the first to jump in"
                : `${drop.participants_count} in`}
            </p>
          </div>
        </div>
      </ZineSurface>

      <div
        className={cn(
          "drop-detail__action-bar",
          drop.status !== "active" && "drop-detail__action-bar--disabled",
        )}
      >
        <ImInButton
          dropId={drop.id}
          shareSlug={viaShareSlug}
          isJoined={drop.is_joined}
          participantsCount={drop.participants_count}
          onChange={handleJoinChange}
          disabled={drop.status !== "active"}
        />

        <div className="drop-detail__secondary">
          <button
            type="button"
            className="drop-detail__secondary-button"
            onClick={() => setShareOpen(true)}
          >
            Share
          </button>
          {directions ? (
            <a
              href={directions}
              target="_blank"
              rel="noopener noreferrer"
              className="drop-detail__secondary-button"
            >
              Directions
            </a>
          ) : null}
        </div>
      </div>

      <ShareDropSheet
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        drop={drop}
      />
    </>
  );
}
