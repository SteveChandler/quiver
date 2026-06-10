"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
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
}

const STRATEGY_TAG_COLORS: Record<string, string> = {
  biggest_waves: '#F78E42',
  cleanest: '#22C55E',
  sleep_in: '#8B5CF6',
  low_crowd: '#06B6D4',
  skip: '#EF4444',
};

function SpotCard({
  spot,
  onViewSpot,
}: {
  spot: NearbySpot;
  onViewSpot: (spotId: string) => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`bg-[#2D357D] border border-[#404C92] noise-texture rounded-xl w-[280px] min-w-[280px] flex-shrink-0 snap-start cursor-pointer${spot.strategyTag?.type === 'skip' ? ' opacity-60' : ''}`}
      onClick={() => onViewSpot(spot.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewSpot(spot.id);
        }
      }}
    >
      <div className="relative h-[90px] rounded-t-xl overflow-hidden">
        {spot.photoUrl ? (
          <Image
            src={spot.photoUrl}
            alt={spot.name}
            width={560}
            height={180}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a3a4a] to-[#2a5a6a]" />
        )}
        {spot.strategyTag && (
          <span
            className="absolute top-1.5 left-1.5 text-[10px] font-bold text-white px-2 py-0.5 rounded-full uppercase tracking-wide"
            style={{ backgroundColor: STRATEGY_TAG_COLORS[spot.strategyTag.type] ?? '#6B7280' }}
          >
            {spot.strategyTag.label}
          </span>
        )}
      </div>
      <div className="p-3">
        <div className="flex items-center gap-1.5">
          <p className="font-heading text-white text-sm font-semibold line-clamp-1">
            {spot.name}
          </p>
          {spot.skillMismatch && (
            <span
              className="shrink-0 text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded-full"
              title="Above your skill level"
            >
              ADV
            </span>
          )}
        </div>
        <p className="text-medium text-xs line-clamp-1">{spot.reasonText ?? spot.conditions}</p>
        <p className="text-[#4A70D9] text-base font-bold">{spot.height}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#2D357D] border border-[#404C92] rounded-xl w-[280px] min-w-[280px] flex-shrink-0 snap-start">
      <Skeleton className="h-[90px] rounded-t-xl rounded-b-none" />
      <div className="p-3 flex flex-col gap-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-5 w-12" />
      </div>
    </div>
  );
}

export function NearbySpots({ spots, onViewSpot, loading = false }: NearbySpotsProps) {
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-white text-lg font-semibold">Nearby Spots</h2>
        <Link href="/map" className="text-[#4A70D9] text-sm font-medium inline-flex items-center gap-0.5">Map <ChevronRight className="h-3.5 w-3.5" /></Link>
      </div>
      <div className="relative">
        <div
          ref={scrollRef}
          data-testid="nearby-spots-scroll"
          className="flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-2 -mx-6 px-6"
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
            spots.map((spot) => (
              <SpotCard key={spot.id} spot={spot} onViewSpot={onViewSpot} />
            ))
          )}
        </div>
        {!loading && spots.length > 2 && (
          <div
            className="absolute right-0 top-0 bottom-2 w-8 sm:w-12 pointer-events-none bg-gradient-to-l from-[#252D6B] to-transparent md:hidden"
            aria-hidden="true"
            data-testid="scroll-fade-indicator"
          />
        )}
      </div>
    </section>
  );
}
