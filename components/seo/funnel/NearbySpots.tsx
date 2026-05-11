import Link from "next/link";
import Image from "next/image";
import { MapPinned } from "lucide-react";

import type { SeoSpotLink } from "@/lib/seo/funnel-pages";

interface NearbySpotsProps {
  title?: string;
  spots: SeoSpotLink[];
}

export function NearbySpots({
  title = "Nearby backup spots",
  spots,
}: NearbySpotsProps) {
  if (spots.length === 0) return null;

  return (
    <section aria-labelledby="nearby-spots-heading" className="py-4">
      <div className="mb-5 flex items-center gap-2">
        <MapPinned className="h-5 w-5 text-ocean-blue" aria-hidden />
        <h2
          id="nearby-spots-heading"
          className="font-heading text-2xl font-bold text-gray-900"
        >
          {title}
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {spots.map((spot) => (
          <Link
            key={`${spot.href}-${spot.label}`}
            href={spot.href}
            className="group relative flex min-h-[150px] overflow-hidden rounded-lg border border-gray-200 bg-gray-900 p-4 shadow-sm transition hover:border-ocean-blue/40 hover:shadow-md"
          >
            {spot.imageSrc ? (
              <Image
                src={spot.imageSrc}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 33vw"
                className="object-cover transition duration-300 group-hover:scale-105"
              />
            ) : null}
            <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/10" />
            <span className="relative mt-auto block">
              <span className="font-heading text-lg font-bold leading-tight text-white drop-shadow-sm">
                {spot.label}
              </span>
              {spot.description ? (
                <span className="mt-2 block text-sm leading-6 text-white/85">
                  {spot.description}
                </span>
              ) : null}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
