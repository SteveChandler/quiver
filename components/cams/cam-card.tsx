import Link from "next/link";
import { MapPin } from "lucide-react";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";

interface CamCardProps {
  beach: CamBeachWithRegion;
}

export function CamCard({ beach }: CamCardProps) {
  const beachUrl = buildBeachUrl({
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
  });

  return (
    <Link
      href={`${beachUrl}?tab=cams`}
      className="group block overflow-hidden rounded-2xl border border-blue-100/60 bg-white/95 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Camera preview area */}
      <div className="relative flex h-40 items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-600">
        {/* Wave pattern overlay */}
        <svg
          className="absolute bottom-0 left-0 w-full h-12 opacity-20"
          viewBox="0 0 1440 120"
          preserveAspectRatio="none"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M0,60L60,65C120,70,240,80,360,75C480,70,600,50,720,45C840,40,960,50,1080,60C1200,70,1320,80,1380,85L1440,90L1440,120L0,120Z"
            fill="white"
            fillOpacity="0.15"
          />
        </svg>

        {/* LIVE badge */}
        <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
          LIVE
        </span>

        {/* Beach name overlay */}
        <span className="relative z-10 px-4 text-center font-roboto text-lg font-bold text-white drop-shadow-md">
          {beach.name}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {beach.city}, {beach.state}
          </span>
        </div>
        <p className="mt-1 text-xs text-ocean-blue font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          Watch live cam &rarr;
        </p>
      </div>
    </Link>
  );
}
