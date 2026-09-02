import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  isValidStateSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { createPublicReadClient } from "@/lib/supabase/server";
import type { Beach } from "@/types/database";
import { buildRelatedGuideLinks } from "./related-guides-links";

interface RelatedGuidesSectionProps {
  beach: Beach;
  className?: string;
  bestTimeToSurfUrl?: string;
  hasLeastCrowded?: boolean;
  hasWaterTemp?: boolean;
  hasTides?: boolean;
}

/**
 * Displays links to all intent-based SEO pages for the beach's city.
 * Helps reduce orphan pages by creating internal links to tide, dawn-patrol,
 * sunset, beginner, longboard, least-crowded, and water-temp pages.
 */
export async function RelatedGuidesSection({
  beach,
  className = "",
  bestTimeToSurfUrl,
  hasLeastCrowded: knownHasLeastCrowded,
  hasWaterTemp,
  hasTides,
}: RelatedGuidesSectionProps) {
  // Only show if we have city data
  if (!beach.city) {
    return null;
  }

  // Build collision-aware city slug for intent page links.
  // Simple cities: "San Diego" → "san-diego"
  // Collision cities: "Newport, OR" → "newport-or" (avoids ambiguity with Newport, CA etc.)
  const stateSlug = stateToSlug(beach.state);
  const isUsBeach = isValidStateSlug(stateSlug);

  // Check if any beach in this city has light/moderate crowd level so we can
  // decide whether to include the least-crowded intent link. Without this
  // guard the /least-crowded/{city} page returns 404 for cities that have no
  // qualifying beaches.
  let hasLeastCrowded = knownHasLeastCrowded ?? false;
  if (isUsBeach && knownHasLeastCrowded === undefined) {
    const supabase = createPublicReadClient();
    const { data: crowdData, error: crowdError } = await supabase
      .from("beaches")
      .select("id")
      .ilike("city", beach.city)
      .eq("state", beach.state?.toUpperCase() || "")
      .or("crowd_level.ilike.light,crowd_level.ilike.moderate")
      .limit(1);
    if (crowdError) {
      console.warn("Failed to check crowd data for least-crowded filter:", crowdError.message);
    }
    hasLeastCrowded = Boolean(crowdData && crowdData.length > 0);
  }

  const linkSet = buildRelatedGuideLinks({
    beach,
    hasLeastCrowded,
    hasWaterTemp,
    hasTides,
    bestTimeToSurfUrl,
  });
  if (!linkSet) return null;
  const PrimaryIcon = linkSet.primaryLink.icon;

  return (
    <section className={`${className}`}>
      <h2 className="text-lg font-semibold text-[#11100D] mb-4">
        {linkSet.heading}
      </h2>
      {/* City hub link - primary navigation back to city page */}
      <Link
        href={linkSet.primaryLink.href}
        className="group flex items-center justify-between gap-3 rounded-lg border-2 border-[#11100D] bg-[#EFE5CF] p-4 mb-3 transition-[background-color,border-color,box-shadow] hover:bg-[#F7E7BE] hover:shadow-[2px_2px_0_#11100D]"
      >
        <div className="flex items-center gap-2">
          <PrimaryIcon className="h-5 w-5 text-[#0B3A75]" />
          <span className="font-medium text-[#0B3A75] text-sm">
            {linkSet.primaryLink.label}
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-[#0B3A75] group-hover:translate-x-0.5 transition-transform" />
      </Link>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {linkSet.guides.map(({ key, label, href, icon: Icon, description }) => (
          <Link
            key={key}
            href={href}
            className="group flex flex-col gap-2 rounded-lg border-2 border-[#11100D] bg-[#F4EBD8] p-4 transition-colors hover:bg-[#F7E7BE]"
          >
            <div className="flex items-center gap-2">
              <Icon className="h-5 w-5 text-[#0B3A75]" />
              <span className="font-medium text-[#11100D] text-sm">{label}</span>
            </div>
            <p className="text-xs text-[#11100D]/75 line-clamp-2">{description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
