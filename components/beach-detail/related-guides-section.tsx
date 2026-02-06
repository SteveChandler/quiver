"use client";

import Link from "next/link";
import {
  Compass,
  Sunrise,
  Sunset,
  Waves,
  Users,
  Thermometer,
  Sailboat,
} from "lucide-react";
import { slugify } from "@/lib/utils/text-utils";
import { stateToSlug } from "@/lib/utils/beach-url-utils";
import { getIntentSlug } from "@/lib/utils/slug-helpers";
import type { Beach } from "@/types/database";

const INTENT_GUIDES = [
  {
    key: "tide",
    label: "Tide Charts",
    icon: Waves,
    description: "Track tide swings for optimal sessions",
  },
  {
    key: "dawn-patrol",
    label: "Dawn Patrol",
    icon: Sunrise,
    description: "Early morning sessions",
  },
  {
    key: "sunset",
    label: "Sunset Sessions",
    icon: Sunset,
    description: "Golden hour surf windows",
  },
  {
    key: "beginner",
    label: "Beginner Spots",
    icon: Compass,
    description: "Mellow waves for learning",
  },
  {
    key: "longboard",
    label: "Longboard Spots",
    icon: Sailboat,
    description: "Cruisy waves for logging",
  },
  {
    key: "least-crowded",
    label: "Less Crowded",
    icon: Users,
    description: "Escape the crowds",
  },
  {
    key: "water-temp",
    label: "Water Temp",
    icon: Thermometer,
    description: "Current ocean temps",
  },
] as const;

interface RelatedGuidesSectionProps {
  beach: Beach;
  className?: string;
}

/**
 * Displays links to all intent-based SEO pages for the beach's city.
 * Helps reduce orphan pages by creating internal links to tide, dawn-patrol,
 * sunset, beginner, longboard, least-crowded, and water-temp pages.
 */
export function RelatedGuidesSection({
  beach,
  className = "",
}: RelatedGuidesSectionProps) {
  // Only show if we have city data
  if (!beach.city) {
    return null;
  }

  // Build city slug - use existing slug or create from city name
  const citySlug = slugify(beach.city);
  if (!citySlug) {
    return null;
  }

  // Use collision-aware slug for intent pages
  // Simple cities like "San Diego" become "san-diego"
  // Common names like "Newport" that exist in multiple states get state suffix: "newport-ca"
  const stateSlug = stateToSlug(beach.state);
  const intentSlug = getIntentSlug(citySlug, stateSlug) || citySlug;

  return (
    <section className={`${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Surf Guides for {beach.city}
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {INTENT_GUIDES.map(({ key, label, icon: Icon, description }) => (
          <Link
            key={key}
            href={`/${key}/${intentSlug}`}
            className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-sky-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-sky-600 group-hover:text-sky-700" />
              <span className="font-medium text-gray-900 text-sm">{label}</span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
