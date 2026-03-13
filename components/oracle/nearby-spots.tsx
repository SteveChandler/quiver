"use client";

import Image from "next/image";
import { Skeleton } from "@/components/ui/skeleton";

export interface NearbySpot {
  id: string;
  name: string;
  conditions: string;
  height: string;
  photoUrl: string | null;
  score?: number;
  /** True when beach skill level exceeds user level AND conditions are significant */
  skillMismatch?: boolean;
}

export interface NearbySpotsProps {
  spots: NearbySpot[];
  onViewSpot: (spotId: string) => void;
  loading?: boolean;
}

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
      className="bg-[#2D357D] border border-[#404C92] noise-texture rounded-xl w-[280px] min-w-[280px] flex-shrink-0 snap-start cursor-pointer"
      onClick={() => onViewSpot(spot.id)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onViewSpot(spot.id);
        }
      }}
    >
      <div className="h-[90px] rounded-t-xl overflow-hidden">
        {spot.photoUrl ? (
          <Image
            src={spot.photoUrl}
            alt={spot.name}
            width={150}
            height={90}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-[#1a3a4a] to-[#2a5a6a]" />
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
        <p className="text-medium text-xs">{spot.conditions}</p>
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
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-heading text-white text-lg font-semibold">Nearby Spots</h2>
        <button className="text-[#4A70D9] text-sm font-medium">Map &gt;</button>
      </div>
      <div className="relative">
        <div
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
