"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import type { Beach } from "@/types/database";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";

interface BeachBreadcrumbProps {
  beach: Beach;
  className?: string;
}

export function BeachBreadcrumb({ beach, className }: BeachBreadcrumbProps) {
  const location = getBeachLocation(beach);

  return (
    <nav
      aria-label="Breadcrumb"
      className={`flex items-center gap-1 text-sm mb-4 ${className || ""}`}
    >
      {/* Back to Map link */}
      <Link
        href="/map"
        className="inline-flex items-center gap-1 text-ocean-blue hover:underline transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="hidden sm:inline">Back to Map</span>
        <span className="sm:hidden">Map</span>
      </Link>

      {/* Phase 4 Spec: Separator - › character with 8px margins, gray-400 color */}
      <span className="text-gray-400 mx-2" aria-hidden="true">›</span>

      {/* Location */}
      <span className="text-gray-600">{location}</span>

      {/* Phase 4 Spec: Separator - › character with 8px margins, gray-400 color */}
      <span className="text-gray-400 mx-2" aria-hidden="true">›</span>

      {/* Current beach (not a link) */}
      <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">
        {beach.name}
      </span>
    </nav>
  );
}
