"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  trackNearbyBeachClick,
  trackNearbyBeachesViewed,
} from "@/lib/analytics/engagement-tracking";
import { FALLBACK_IMAGE_BY_NAME } from "@/lib/constants/featured-beaches-config";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import type { EnrichedNearbyBeach } from "@/lib/utils/nearby-beach-enrichment";
import { HalftonePhoto, DoodleStar } from "./atoms";

interface ZineNearbySpotsProps {
  beaches: EnrichedNearbyBeach[];
  sourceBeachName: string;
  sourceBeachLat?: number | null;
  sourceBeachLon?: number | null;
}

const ROTATIONS = ["rotate(-1.4deg)", "rotate(0.9deg)", "rotate(-0.6deg)", "rotate(1.2deg)"];

/**
 * Cream-paper styled Nearby Surf Spots — replaces the legacy dark-theme
 * `NearbyBeachesEnriched` block on the beach detail page so the section
 * reads as part of the zine field guide instead of a Stripe-blue card grid.
 */
export function ZineNearbySpots({
  beaches,
  sourceBeachName,
  sourceBeachLat,
  sourceBeachLon,
}: ZineNearbySpotsProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const hasTrackedView = useRef(false);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section || beaches.length === 0) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTrackedView.current) {
          hasTrackedView.current = true;
          trackNearbyBeachesViewed(sourceBeachName, beaches.length);
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(section);
    return () => observer.disconnect();
  }, [sourceBeachName, beaches.length]);

  if (!beaches || beaches.length === 0) return null;

  const mapLink =
    sourceBeachLat != null && sourceBeachLon != null
      ? `/map?lat=${sourceBeachLat}&lon=${sourceBeachLon}&zoom=12`
      : "/map";

  return (
    <section ref={sectionRef} aria-label="Nearby surf spots" className="mt-2">
      <div className="flex items-end justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-end gap-3">
          <h2
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 400,
              fontSize: 36,
              color: "#11100D",
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              margin: 0,
              lineHeight: 1,
            }}
          >
            Nearby Spots
          </h2>
          <span
            className="hidden md:inline-block"
            style={{
              fontFamily: "var(--font-handwritten), cursive",
              fontSize: 24,
              color: "#11100D",
              fontWeight: 700,
              transform: "rotate(-2deg)",
              lineHeight: 1,
              alignSelf: "flex-end",
              marginBottom: 4,
            }}
            aria-hidden
          >
            close to here →
          </span>
        </div>
        <Link
          href={mapLink}
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: "#0B3A75",
            fontWeight: 700,
            textDecoration: "underline",
            textUnderlineOffset: 4,
          }}
        >
          Explore all nearby spots →
        </Link>
      </div>

      <div className="grid gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        {beaches.slice(0, 8).map((beach, i) => (
          <NearbyCard
            key={beach.id}
            beach={beach}
            index={i}
            rotation={ROTATIONS[i % ROTATIONS.length]}
          />
        ))}
      </div>
    </section>
  );
}

function NearbyCard({
  beach,
  index,
  rotation,
}: {
  beach: EnrichedNearbyBeach;
  index: number;
  rotation: string;
}) {
  const href = getBeachHrefSafe({
    id: beach.id,
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
    country: beach.country,
  }) || "/";
  const location = getBeachLocation(beach);
  const skill = beach.skill_level || "All";
  const wave = beach.waveHeight != null ? formatWave(beach.waveHeight) : null;
  const photoUrl = getNearbyCardPhotoUrl(beach);

  return (
    <Link
      href={href}
      prefetch={false}
      onClick={() => trackNearbyBeachClick(beach.name, index + 1, beach.score ?? 0)}
      className="block group"
      style={{ transform: rotation, transformOrigin: "center" }}
    >
      <article
        style={{
          background: "#F4EBD8",
          border: "2.5px solid #11100D",
          borderRadius: 4,
          boxShadow: "3px 4px 0 rgba(17,16,13,0.25)",
          padding: 10,
          transition: "transform 180ms ease, box-shadow 180ms ease",
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
        className="group-hover:translate-y-[-2px] group-hover:shadow-[5px_6px_0_rgba(17,16,13,0.3)]"
      >
        <div className="relative" style={{ aspectRatio: "4/3", overflow: "hidden", border: "2px solid #11100D" }}>
          <HalftonePhoto src={photoUrl} alt={photoUrl ? `${beach.name} photo` : undefined} height={140} />
        </div>

        <div className="mt-3 flex flex-col flex-1">
          <h3
            style={{
              fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
              fontWeight: 400,
              fontSize: 18,
              color: "#11100D",
              letterSpacing: "-0.01em",
              lineHeight: 1.05,
              margin: 0,
              textTransform: "uppercase",
            }}
            className="line-clamp-2"
          >
            {beach.name}
          </h3>

          <div
            className="mt-1.5 flex items-center gap-2 flex-wrap"
            style={{
              fontFamily: "var(--font-mono), monospace",
              fontSize: 11,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#11100D",
              opacity: 0.85,
              fontWeight: 700,
            }}
          >
            {wave && (
              <>
                <span>{wave}</span>
                <span style={{ opacity: 0.4 }}>·</span>
              </>
            )}
            <span>{skill}</span>
          </div>

          {location && (
            <div
              className="mt-1"
              style={{
                fontFamily: "var(--font-handwritten), cursive",
                fontSize: 16,
                color: "#11100D",
                fontWeight: 600,
                lineHeight: 1.15,
              }}
            >
              {location}
            </div>
          )}

          {typeof beach.score === "number" && beach.score > 0 && (
            <div
              className="mt-2.5 inline-flex items-center gap-1.5 self-start"
              style={{
                background: "#0B3A75",
                color: "#F4EBD8",
                padding: "3px 10px",
                fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
                fontWeight: 400,
                fontSize: 13,
                letterSpacing: "0.04em",
                border: "2px solid #11100D",
                boxShadow: "2px 2px 0 rgba(17,16,13,0.5)",
                transform: "rotate(-1.5deg)",
              }}
            >
              <DoodleStar size={11} color="#F4EBD8" filled />
              {Math.round(beach.score)}
            </div>
          )}
        </div>
      </article>
    </Link>
  );
}

function formatWave(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}ft`;
}

function getNearbyCardPhotoUrl(beach: EnrichedNearbyBeach): string | null {
  const approvedPhoto =
    typeof beach.photoUrl === "string" && beach.photoUrl.trim().length > 0
      ? beach.photoUrl
      : null;
  const fallbackPhoto =
    FALLBACK_IMAGE_BY_NAME[beach.name as keyof typeof FALLBACK_IMAGE_BY_NAME] ?? null;
  const selected = fallbackPhoto ?? approvedPhoto;

  if (!selected) return null;
  return getProxiedImageUrl(selected) || null;
}
