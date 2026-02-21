"use client";

import Link from "next/link";
import type { Beach } from "@/types/database";
import { cn } from "@/lib/utils";
import { getBeachLocation } from "@/lib/utils/beach-card-utils";
import {
  buildCityUrl,
  buildInternationalCityUrl,
  stateToSlug,
  getUsStateDisplayNameFromSlug,
} from "@/lib/utils/beach-url-utils";

interface BeachBreadcrumbProps {
  beach: Beach;
  className?: string;
}

export function BeachBreadcrumb({ beach, className }: BeachBreadcrumbProps) {
  const location = getBeachLocation(beach);

  // Build location URL if we have city and state
  const normalizedCountry = (beach.country || "USA")
    .toString()
    .trim()
    .toLowerCase();
  const isUsa =
    normalizedCountry === "usa" ||
    normalizedCountry === "us" ||
    normalizedCountry === "united states" ||
    normalizedCountry === "united states of america";

  const locationUrl = isUsa
    ? buildCityUrl(beach.state, beach.city)
    : buildInternationalCityUrl(beach.country, beach.state, beach.city);

  const hasLocationPage = locationUrl !== "/"; // build*Url returns "/" when incomplete

  // State breadcrumb data (USA only)
  const stateSlug = isUsa ? stateToSlug(beach.state) : "";
  const stateDisplayName = stateSlug
    ? getUsStateDisplayNameFromSlug(stateSlug)
    : "";
  const stateUrl = stateSlug ? `/beaches/usa/${stateSlug}` : "";

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1 text-sm mb-4", className)}
    >
      {/* Home */}
      <Link href="/" className="text-ocean-blue hover:underline transition-colors">
        Home
      </Link>

      {/* State level — USA beaches only */}
      {isUsa && stateUrl && (
        <>
          <span className="text-gray-400 mx-2" aria-hidden="true">›</span>
          <Link
            href={stateUrl}
            className="text-ocean-blue hover:underline transition-colors"
          >
            {stateDisplayName}
          </Link>
        </>
      )}

      {/* City level */}
      <span className="text-gray-400 mx-2" aria-hidden="true">›</span>
      {hasLocationPage ? (
        <Link
          href={locationUrl}
          className="text-ocean-blue hover:underline transition-colors"
        >
          {location}
        </Link>
      ) : (
        <span className="text-gray-600">{location}</span>
      )}

      {/* Current beach (not a link) */}
      <span className="text-gray-400 mx-2" aria-hidden="true">›</span>
      <span className="text-gray-900 font-medium truncate max-w-[200px] sm:max-w-none">
        {beach.name}
      </span>
    </nav>
  );
}
