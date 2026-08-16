"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronRight, LocateFixed } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { StrategyTag } from "@/types/personalization";

export interface NearbySpot {
  id: string;
  kind?: "beach" | "custom_spot";
  beachId?: string | null;
  customSpotId?: string | null;
  name: string;
  conditions: string;
  height: string;
  photoUrl: string | null;
  score?: number;
  /** True when beach skill level exceeds user level AND conditions are significant */
  skillMismatch?: boolean;
  strategyTag?: StrategyTag;
  /**
   * Pre-computed display copy for the card body. Decided in the transform
   * layer (oracle-home-screen.tsx → buildPersonalizedReason) where the full
   * SurfDiscoveryRecommendation + hero context are still in scope. The
   * renderer never recomputes this — NearbySpot does not carry forecast
   * fields. Falls back to `conditions` when omitted.
   */
  reasonText?: string;
}

export interface NearbySpotsProps {
  spots: NearbySpot[];
  onViewSpot: (spotId: string) => void;
  loading?: boolean;
  onUseMyLocation?: () => void;
  locationLoading?: boolean;
}

const INK = "#11100D";
const STAMP_BLUE = "#0B3A75";

/** Ink-on-paper tag colours. The neon set read as a dashboard on cream. */
const STRATEGY_TAG_COLORS: Record<string, string> = {
  biggest_waves: '#C2410C',
  cleanest: '#006B5F',
  sleep_in: '#5B3A8E',
  low_crowd: '#0B3A75',
  skip: '#B91C1C',
};

/** Alternating tilt so a row of polaroids reads as pinned, not gridded. */
const CARD_ROTATION = ["rot-1", "rot-2", "rot-3", "rot-neg"];

function SpotCard({
  spot,
  index,
  onViewSpot,
}: {
  spot: NearbySpot;
  index: number;
  onViewSpot: (spotId: string) => void;
}) {
  const isSkip = spot.strategyTag?.type === 'skip';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${spot.name}, ${spot.height}`}
      className={`polaroid ${CARD_ROTATION[index % CARD_ROTATION.length]} w-[248px] min-w-[248px] flex-shrink-0 snap-start cursor-pointer${isSkip ? ' opacity-70' : ''}`}
      onClick={() => onViewSpot(spot.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewSpot(spot.id);
        }
      }}
    >
      <div className="photo halftone-photo">
        {spot.photoUrl ? (
          <Image
            src={spot.photoUrl}
            alt={spot.name}
            width={560}
            height={420}
            className="h-full w-full object-cover"
          />
        ) : (
          <div
            className="h-full w-full"
            data-testid="nearby-spot-photo-placeholder"
            style={{
              backgroundImage:
                "linear-gradient(180deg, #E8DEC4 0%, #D6C9A6 55%, #B6AC8C 56%, #B6AC8C 100%)",
            }}
          />
        )}
        {spot.strategyTag && (
          <span
            className="absolute left-0 top-2 z-[2] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
            style={{
              backgroundColor: STRATEGY_TAG_COLORS[spot.strategyTag.type] ?? INK,
              color: "#F4EBD8",
              boxShadow: "2px 2px 0 rgba(0,0,0,0.25)",
            }}
          >
            {spot.strategyTag.label}
          </span>
        )}
      </div>

      <div className="px-1 pt-2">
        <div className="flex items-baseline gap-1.5">
          <p className="cap m-0 line-clamp-1 flex-1 text-left" style={{ marginTop: 0 }}>
            {spot.name}
          </p>
          {spot.skillMismatch && (
            <span
              className="shrink-0 px-1 text-[9px] font-bold uppercase"
              title="Above your skill level"
              style={{ color: "#B91C1C", border: `1px solid #B91C1C` }}
            >
              ADV
            </span>
          )}
        </div>

        <p
          className="mt-0.5 line-clamp-1"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 10,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: INK,
            opacity: 0.65,
          }}
        >
          {spot.reasonText ?? spot.conditions}
        </p>

        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-zine-display), 'Bowlby One', sans-serif",
            fontSize: 22,
            lineHeight: 1,
            color: STAMP_BLUE,
            margin: "4px 0 0",
          }}
        >
          {spot.height}
        </p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div
      className="polaroid w-[248px] min-w-[248px] flex-shrink-0 snap-start"
      data-testid="nearby-spot-skeleton"
    >
      <div className="photo">
        <Skeleton className="h-full w-full rounded-none" />
      </div>
      <div className="flex flex-col gap-2 px-1 pt-2">
        <Skeleton className="h-4 w-24 rounded-none" />
        <Skeleton className="h-3 w-20 rounded-none" />
        <Skeleton className="h-5 w-12 rounded-none" />
      </div>
    </div>
  );
}

export function NearbySpots({
  spots,
  onViewSpot,
  loading = false,
  onUseMyLocation,
  locationLoading = false,
}: NearbySpotsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Only intercept vertical scroll when container is horizontally scrollable
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="label-black">Nearby Spots</h2>
        <Link
          href="/map"
          className="inline-flex items-center gap-0.5"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: STAMP_BLUE,
          }}
        >
          Map <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {onUseMyLocation && (
        <button
          type="button"
          onClick={onUseMyLocation}
          disabled={locationLoading}
          className="mb-4 inline-flex min-h-11 w-full items-center justify-center gap-2 px-4 disabled:cursor-wait disabled:opacity-60 sm:w-auto focus-ring"
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            fontWeight: 700,
            color: INK,
            background: "#F0E5CC",
            border: `1.5px dashed ${INK}`,
          }}
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {locationLoading ? "Detecting…" : "Use my location"}
        </button>
      )}

      <div className="relative">
        <div
          ref={scrollRef}
          data-testid="nearby-spots-scroll"
          className="scrollbar-hide flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pt-2"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : (
            spots.map((spot, i) => (
              <SpotCard key={spot.id} spot={spot} index={i} onViewSpot={onViewSpot} />
            ))
          )}
        </div>
        {!loading && spots.length > 2 && (
          <div
            className="pointer-events-none absolute bottom-3 right-0 top-0 w-10 sm:w-12"
            aria-hidden="true"
            data-testid="scroll-fade-indicator"
            style={{
              backgroundImage:
                "linear-gradient(to left, #F4EBD8, rgba(244,235,216,0))",
            }}
          />
        )}
      </div>
    </section>
  );
}
