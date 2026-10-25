"use client";

import { useState, type ReactElement } from "react";
import type { BeachSources } from "@/hooks/use-beach-detail-data";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { CamsSection } from "@/components/beach-detail/cams-section";
import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import { MapDoodle } from "./atoms";

interface ZineHeroMediaProps {
  photoUrl?: string | null;
  sources?: BeachSources | null;
  hasLiveCam: boolean;
  beachName: string;
  locationName: string;
  attributionKind?: "profile" | "community" | null;
  attributionName?: string | null;
  attributionProfileId?: string | null;
  attributionHtml?: string | null;
  lat?: number | null;
  lon?: number | null;
  aspectDeg?: number | null;
  breakType?: string | null;
  features?: string[] | null;
}

export function ZineHeroMedia({
  photoUrl: beachPhotoUrl,
  sources,
  hasLiveCam,
  beachName,
  locationName,
  attributionKind,
  attributionName,
  attributionProfileId,
  attributionHtml,
  lat,
  lon,
  aspectDeg,
  breakType,
  features,
}: ZineHeroMediaProps): ReactElement {
  const [failedUrls, setFailedUrls] = useState<Set<string>>(new Set());
  const reducedMotion = useReducedMotion();
  const dioramaUrl = sources?.diorama_url;
  // A live cam is the most useful thing a beach can show, so it leads over any photo.
  const photoUrl =
    !hasLiveCam && beachPhotoUrl && !failedUrls.has(beachPhotoUrl) ? beachPhotoUrl : null;
  const videoUrl =
    !hasLiveCam && !photoUrl && dioramaUrl && !failedUrls.has(dioramaUrl) ? dioramaUrl : null;
  const showsCam = hasLiveCam || (!photoUrl && !videoUrl && !!sources?.cam_thumbnail_url);
  const showMap = !photoUrl && !videoUrl && !showsCam;
  const handleMediaError = (url: string): void => {
    setFailedUrls((current) => new Set(current).add(url));
  };

  return (
    <div className="mb-2 mr-2 mt-5" data-testid="zine-hero-media">
      <div
        className="relative overflow-hidden"
        style={{
          border: "3px solid #11100D",
          borderRadius: "16px 6px 18px 8px",
          boxShadow: "8px 8px 0 #11100D",
          background: "#11100D",
        }}
      >
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the image proxy already sizes the photo
          <img
            src={getOptimizedImageUrl(photoUrl)}
            alt={`${beachName}, ${locationName}`}
            className="block h-[240px] w-full object-cover sm:h-[320px] md:h-[380px]"
            onError={() => handleMediaError(photoUrl)}
          />
        ) : videoUrl ? (
          <video
            src={videoUrl}
            autoPlay={!reducedMotion}
            controls={reducedMotion}
            loop={!reducedMotion}
            muted
            playsInline
            aria-label={`Illustrated scene of ${beachName}; not live conditions`}
            className="block h-[240px] w-full object-cover sm:h-[320px] md:h-[380px]"
            onError={() => handleMediaError(videoUrl)}
          />
        ) : showsCam ? (
          <div className="zine-hero-cam-frame">
            <CamsSection sources={sources} variant="hero" beachName={beachName} />
          </div>
        ) : (
          <MapDoodle
            height={320}
            beachName={beachName}
            locationName={locationName}
            lat={lat}
            lon={lon}
            aspectDeg={aspectDeg}
            breakType={breakType}
            features={features}
          />
        )}
        {showMap ? (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 left-1/2 right-0"
            style={{
              backgroundImage: "radial-gradient(rgba(17,16,13,0.07) 1.1px, transparent 1.3px)",
              backgroundSize: "6px 6px",
            }}
          />
        ) : null}
        {photoUrl && (attributionKind || attributionHtml) ? (
          <PhotoAttribution
            attribution={attributionKind ? {
              kind: attributionKind,
              displayName: attributionName ?? "",
              profileId: attributionProfileId ?? null,
            } : null}
            attributionHtml={attributionHtml}
            className="absolute bottom-2 right-2 z-20 max-w-[70%] truncate bg-[#11100D]/75 px-2 py-1 font-mono text-[10px] text-[#F4EBD8] underline-offset-2 hover:underline"
          />
        ) : null}
      </div>
    </div>
  );
}
