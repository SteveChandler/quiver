import Link from "next/link";
import {
  Compass,
  Sunrise,
  Sunset,
  Waves,
  Users,
  Thermometer,
  Sailboat,
  MapPin,
  ArrowRight,
  CalendarDays,
} from "lucide-react";
import { stateToSlug, buildCityUrl } from "@/lib/utils/beach-url-utils";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
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
  bestTimeToSurfUrl?: string;
}

/**
 * Displays links to all intent-based SEO pages for the beach's city.
 * Helps reduce orphan pages by creating internal links to tide, dawn-patrol,
 * sunset, beginner, longboard, least-crowded, and water-temp pages.
 */
export function RelatedGuidesSection({
  beach,
  className = "",
  bestTimeToSurfUrl,
}: RelatedGuidesSectionProps) {
  // Only show if we have city data
  if (!beach.city) {
    return null;
  }

  // Build collision-aware city slug for intent page links.
  // Simple cities: "San Diego" → "san-diego"
  // Collision cities: "Newport, OR" → "newport-or" (avoids ambiguity with Newport, CA etc.)
  const stateSlug = stateToSlug(beach.state);
  const intentSlug = buildCitySlug(beach.city, stateSlug || beach.state || "", COLLISION_CITY_MAP);
  if (!intentSlug) {
    return null;
  }

  return (
    <section className={`${className}`}>
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Surf Guides for {beach.city}
      </h2>
      {/* City hub link - primary navigation back to city page */}
      <Link
        href={buildCityUrl(beach.state, beach.city)}
        className="group flex items-center justify-between gap-3 rounded-lg border border-sky-200 bg-sky-50/80 p-4 mb-3 transition-all hover:border-sky-400 hover:bg-sky-50 hover:shadow-sm"
      >
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-sky-700" />
          <span className="font-medium text-sky-900 text-sm">
            Explore all {beach.city} surf spots
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-sky-600 group-hover:translate-x-0.5 transition-transform" />
      </Link>
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
        {bestTimeToSurfUrl && (
          <Link
            href={bestTimeToSurfUrl}
            className="group flex flex-col gap-2 rounded-lg border border-gray-200 bg-white p-4 transition-all hover:border-sky-300 hover:shadow-sm"
          >
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-sky-600 group-hover:text-sky-700" />
              <span className="font-medium text-gray-900 text-sm">Best Time to Surf</span>
            </div>
            <p className="text-xs text-gray-500 line-clamp-2">Month-by-month surf calendar</p>
          </Link>
        )}
      </div>
    </section>
  );
}
