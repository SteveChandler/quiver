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
      className="bg-[#2D357D] border border-[#404C92] noise-texture rounded-xl min-w-[150px] flex-shrink-0 cursor-pointer"
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
        <p className="font-heading text-white text-sm font-semibold line-clamp-1">
          {spot.name}
        </p>
        <p className="text-medium text-xs">{spot.conditions}</p>
        <p className="text-[#4A70D9] text-base font-bold">{spot.height}</p>
      </div>
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-[#2D357D] border border-[#404C92] rounded-xl min-w-[150px] flex-shrink-0">
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
      <div
        className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4"
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
    </section>
  );
}
