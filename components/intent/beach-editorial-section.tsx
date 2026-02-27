/**
 * Beach Editorial Section
 *
 * Renders per-beach editorial data on intent pages with intent-specific
 * highlight sections. Shared across all intent types with conditional
 * rendering based on the current intent.
 *
 * Server Component that renders ExpandableText client islands for prose fields.
 */

import Link from "next/link";
import {
  Users,
  Car,
  Footprints,
  Waves,
  Compass,
  AlertTriangle,
  ArrowUpDown,
  Sunrise,
  Sunset as SunsetIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ExpandableText } from "@/components/ui/expandable-text";
import type { BeachEditorialItem } from "@/types/location";
import type { SurfIntentSlug } from "@/lib/constants/surf-intents";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BeachEditorialSectionProps {
  /** Editorial data for each beach in the city */
  beaches: BeachEditorialItem[];
  /** Current intent slug — controls which editorial fields are highlighted */
  intentSlug: SurfIntentSlug;
  /** City name for section heading */
  cityName: string;
  /** State slug (lowercase) for building beach links */
  stateSlug: string;
  /** City slug for building beach links */
  citySlug: string;
}

// ---------------------------------------------------------------------------
// Intent-specific headings & descriptions
// ---------------------------------------------------------------------------

const INTENT_SECTION_COPY: Record<
  string,
  { heading: (city: string) => string; subheading: string }
> = {
  "least-crowded": {
    heading: (city) => `Crowd & access intel for ${city} beaches`,
    subheading:
      "Local crowd levels, parking tips, and access routes to help you find emptier lineups.",
  },
  longboard: {
    heading: (city) => `Longboard-friendly breaks in ${city}`,
    subheading:
      "Break types, wave character, and ideal conditions for mellow log sessions.",
  },
  "dawn-patrol": {
    heading: (city) => `Dawn patrol access guide for ${city}`,
    subheading:
      "Parking and access info for early morning sessions before sunrise.",
  },
  sunset: {
    heading: (city) => `Sunset session picks in ${city}`,
    subheading:
      "West-facing beaches with golden hour potential and evening access.",
  },
  tide: {
    heading: (city) => `Tide preferences by spot in ${city}`,
    subheading:
      "Optimal tide direction and height ranges for each break.",
  },
};

const DEFAULT_SECTION_COPY = {
  heading: (city: string) => `Spot guide for ${city}`,
  subheading: "Break types, ratings, and local tips for each beach.",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** True when aspect is roughly west-facing (225-315 deg) */
function isWestFacing(aspectDeg: number | undefined): boolean {
  if (aspectDeg == null) return false;
  return aspectDeg >= 225 && aspectDeg <= 315;
}

/** Human-readable compass label from degrees */
function aspectToLabel(deg: number): string {
  const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const index = Math.round(deg / 45) % 8;
  return `${directions[index]}-facing (${Math.round(deg)}\u00B0)`;
}

/** Format tide range as a readable string */
function formatTideRange(min?: number, max?: number): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return `${min}ft \u2013 ${max}ft`;
  if (min != null) return `${min}ft+`;
  return `up to ${max}ft`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Shared star + review count display (inline) */
function RatingDisplay({
  averageRating,
  reviewCount,
}: {
  averageRating?: number;
  reviewCount?: number;
}) {
  if (!averageRating) return null;

  return (
    <span className="inline-flex items-center gap-1 text-sm text-gray-600">
      <span className="text-yellow-500" aria-hidden="true">
        {"★".repeat(Math.round(averageRating))}
        {"☆".repeat(5 - Math.round(averageRating))}
      </span>
      <span className="font-medium">{averageRating.toFixed(1)}</span>
      {reviewCount != null && reviewCount > 0 && (
        <span className="text-gray-400">({reviewCount})</span>
      )}
    </span>
  );
}

/** A single detail row with icon + label + text */
function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 items-start">
      <Icon className="h-4 w-4 text-ocean-blue/70 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {label}
        </span>
        <div className="text-sm text-gray-700 mt-0.5">{children}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Intent-specific detail renderers
// ---------------------------------------------------------------------------

function LeastCrowdedDetails({ beach }: { beach: BeachEditorialItem }) {
  const hasContent = beach.crowdLevel || beach.crowdTips || beach.parkingTips || beach.accessTips;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {beach.crowdLevel && (
        <DetailRow icon={Users} label="Typical crowd">
          {beach.crowdLevel}
        </DetailRow>
      )}
      {beach.crowdTips && (
        <DetailRow icon={Users} label="Crowd intel">
          <ExpandableText text={beach.crowdTips} />
        </DetailRow>
      )}
      {beach.parkingTips && (
        <DetailRow icon={Car} label="Parking">
          <ExpandableText text={beach.parkingTips} />
        </DetailRow>
      )}
      {beach.accessTips && (
        <DetailRow icon={Footprints} label="Access">
          <ExpandableText text={beach.accessTips} />
        </DetailRow>
      )}
    </div>
  );
}

function LongboardDetails({ beach }: { beach: BeachEditorialItem }) {
  const hasContent = beach.waveTips || beach.bestConditionsProse;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {beach.waveTips && (
        <DetailRow icon={Waves} label="Wave character">
          <ExpandableText text={beach.waveTips} />
        </DetailRow>
      )}
      {beach.bestConditionsProse && (
        <DetailRow icon={Compass} label="Best conditions">
          <ExpandableText text={beach.bestConditionsProse} />
        </DetailRow>
      )}
    </div>
  );
}

function DawnPatrolDetails({ beach }: { beach: BeachEditorialItem }) {
  const hasContent = beach.accessTips || beach.parkingTips;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {beach.accessTips && (
        <DetailRow icon={Sunrise} label="Early access">
          <ExpandableText text={beach.accessTips} />
        </DetailRow>
      )}
      {beach.parkingTips && (
        <DetailRow icon={Car} label="Parking">
          <ExpandableText text={beach.parkingTips} />
        </DetailRow>
      )}
    </div>
  );
}

function SunsetDetails({ beach }: { beach: BeachEditorialItem }) {
  const hasAspect = beach.aspectDeg != null;
  const hasContent = hasAspect || beach.accessTips;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {hasAspect && (
        <DetailRow icon={SunsetIcon} label="Beach facing">
          <span>
            {aspectToLabel(beach.aspectDeg!)}
            {isWestFacing(beach.aspectDeg) && (
              <span className="ml-2 text-amber-600 text-xs font-medium">
                Golden hour
              </span>
            )}
          </span>
        </DetailRow>
      )}
      {beach.accessTips && (
        <DetailRow icon={Footprints} label="Evening access">
          <ExpandableText text={beach.accessTips} />
        </DetailRow>
      )}
    </div>
  );
}

function TideDetails({ beach }: { beach: BeachEditorialItem }) {
  const tideRange = formatTideRange(beach.preferredTideFtMin, beach.preferredTideFtMax);
  const hasContent = beach.preferredTideDirection || tideRange;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {beach.preferredTideDirection && (
        <DetailRow icon={ArrowUpDown} label="Preferred tide">
          {beach.preferredTideDirection}
        </DetailRow>
      )}
      {tideRange && (
        <DetailRow icon={Waves} label="Optimal range">
          {tideRange}
        </DetailRow>
      )}
    </div>
  );
}

function BeginnerDetails({ beach }: { beach: BeachEditorialItem }) {
  const hasContent = beach.hazards?.length || beach.skillLevel;
  if (!hasContent) return null;

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-gray-100">
      {beach.skillLevel && (
        <DetailRow icon={Users} label="Skill level">
          {beach.skillLevel}
        </DetailRow>
      )}
      {beach.hazards && beach.hazards.length > 0 && (
        <DetailRow icon={AlertTriangle} label="Hazards">
          {beach.hazards.join(" \u00B7 ")}
        </DetailRow>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Map intent to detail component
// ---------------------------------------------------------------------------

const INTENT_DETAILS: Record<
  string,
  React.ComponentType<{ beach: BeachEditorialItem }>
> = {
  "least-crowded": LeastCrowdedDetails,
  longboard: LongboardDetails,
  "dawn-patrol": DawnPatrolDetails,
  sunset: SunsetDetails,
  tide: TideDetails,
  beginner: BeginnerDetails,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BeachEditorialSection({
  beaches,
  intentSlug,
  cityName,
  stateSlug,
  citySlug,
}: BeachEditorialSectionProps) {
  if (!beaches || beaches.length === 0) return null;

  const copy = INTENT_SECTION_COPY[intentSlug] ?? DEFAULT_SECTION_COPY;
  const IntentDetails = INTENT_DETAILS[intentSlug] ?? null;

  return (
    <section aria-label={`Beach guide for ${cityName}`}>
      <h2 className="text-2xl font-semibold text-gray-800 mb-2">
        {copy.heading(cityName)}
      </h2>
      <p className="text-sm text-gray-600 mb-6">{copy.subheading}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {beaches.map((beach) => (
          <article
            key={beach.id}
            className="rounded-2xl border border-gray-200/60 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header: name + badges */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <Link
                href={`/${stateSlug}/${citySlug}/${beach.slug}`}
                className="text-base font-semibold text-gray-900 hover:text-ocean-blue transition-colors"
              >
                {beach.name}
              </Link>
              <div className="flex items-center gap-1.5 shrink-0">
                {beach.breakType && (
                  <Badge
                    variant="outline"
                    className="text-[11px] capitalize whitespace-nowrap"
                  >
                    {beach.breakType}
                  </Badge>
                )}
                {beach.skillLevel && intentSlug !== "beginner" && (
                  <Badge
                    variant="secondary"
                    className="text-[11px] capitalize whitespace-nowrap"
                  >
                    {beach.skillLevel}
                  </Badge>
                )}
              </div>
            </div>

            {/* Rating */}
            <RatingDisplay
              averageRating={beach.averageRating}
              reviewCount={beach.reviewCount}
            />

            {/* Description excerpt */}
            {beach.description && (
              <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                {beach.description}
              </p>
            )}

            {/* Intent-specific details */}
            {IntentDetails && <IntentDetails beach={beach} />}
          </article>
        ))}
      </div>
    </section>
  );
}
