import { Star, MapPin } from "lucide-react";
import Image from "next/image";
import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface BeachHeroProps {
  beach: Beach;
  mapImageUrl: string;
}

export function BeachHero({ beach, mapImageUrl }: BeachHeroProps) {
  return (
    <div className="relative h-48">
      <Image
        src={mapImageUrl}
        alt={`Map of ${beach.name}`}
        fill
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      <div className="absolute bottom-0 left-0 p-4 text-white">
        <h2 className="text-2xl font-bold">{beach.name}</h2>
        <div className="flex items-center">
          <MapPin className="h-4 w-4 mr-1" />
          <span>{getBeachLocation(beach)}</span>
        </div>
        <div className="flex items-center mt-1">
          {Array(5)
            .fill(0)
            .map((_, i) => (
              <Star
                key={i}
                className={`h-4 w-4 ${
                  i < Math.round(beach.average_rating || 0)
                    ? "text-yellow-500 fill-yellow-500"
                    : "text-gray-300"
                }`}
              />
            ))}
          <span className="ml-1">({beach.review_count ?? 0} {(beach.review_count ?? 0) === 1 ? 'review' : 'reviews'})</span>
        </div>
      </div>
    </div>
  );
}
