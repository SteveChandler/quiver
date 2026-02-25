"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Waves,
  Car,
  DollarSign,
  Accessibility,
  Baby,
  Bath,
  Info,
  Tent,
  Dog,
  Ship,
  Fish,
  UtensilsCrossed,
  CircleDot,
  Bike,
  Droplets,
  Sun,
  Mountain,
  TreePine,
  Bird,
  type LucideProps,
} from "lucide-react";
import type { BeachAmenities, AmenityCategory } from "@/types/amenities";
import {
  AMENITY_DISPLAY_MAP,
  CCC_AMENITY_KEYS,
} from "@/types/amenities";
import type { ForwardRefExoticComponent, RefAttributes } from "react";

// ------------------------------------------------
// Icon registry – maps the string names used in
// AMENITY_DISPLAY_MAP to the actual Lucide components.
// This avoids a dynamic import and keeps the bundle tree-shakeable.
// ------------------------------------------------
const ICON_MAP: Record<
  string,
  ForwardRefExoticComponent<Omit<LucideProps, "ref"> & RefAttributes<SVGSVGElement>>
> = {
  Car,
  DollarSign,
  Accessibility,
  Baby,
  Bath,
  Info,
  Tent,
  Dog,
  Ship,
  Fish,
  UtensilsCrossed,
  CircleDot,
  Bike,
  Droplets,
  Sun,
  Mountain,
  TreePine,
  Bird,
};

// ------------------------------------------------
// Distance label helper
// ------------------------------------------------

/**
 * Converts a distance in metres to a human-readable label.
 * Buckets: <100m, ~200m, ~500m, ~1km, etc.
 */
function formatSourceDistance(metres: number): string {
  if (metres < 100) return "<100m";
  if (metres < 300) return "~200m";
  if (metres < 750) return "~500m";
  if (metres < 1500) return "~1km";
  const km = Math.round(metres / 1000);
  return `~${km}km`;
}

// ------------------------------------------------
// Category ordering and labels
// ------------------------------------------------

const CATEGORY_ORDER: AmenityCategory[] = [
  "access",
  "facilities",
  "recreation",
  "terrain",
];

const CATEGORY_LABELS: Record<AmenityCategory, string> = {
  access: "Access",
  facilities: "Facilities",
  recreation: "Recreation",
  terrain: "Terrain",
};

// ------------------------------------------------
// Props
// ------------------------------------------------

interface AmenitiesBadgesProps {
  amenities: BeachAmenities | Partial<BeachAmenities> | null;
}

// ------------------------------------------------
// Component
// ------------------------------------------------

/**
 * Renders data-driven amenity badges grouped by category inside a styled Card.
 *
 * Accepts either a full `BeachAmenities` row (from mv_beach_amenities) or a
 * partial object derived by `deriveAmenitiesFromFeatures`. Returns null when
 * no amenity data is available so the card is omitted entirely.
 */
export function AmenitiesBadges({ amenities }: AmenitiesBadgesProps) {
  if (!amenities) return null;

  // Collect active amenity keys grouped by category
  const grouped: Record<AmenityCategory, typeof CCC_AMENITY_KEYS[number][]> = {
    access: [],
    facilities: [],
    recreation: [],
    terrain: [],
  };

  for (const key of CCC_AMENITY_KEYS) {
    if ((amenities as Record<string, unknown>)[key] === true) {
      const info = AMENITY_DISPLAY_MAP[key];
      grouped[info.category].push(key);
    }
  }

  const hasAnyActive = CATEGORY_ORDER.some((cat) => grouped[cat].length > 0);
  if (!hasAnyActive) return null;

  // Distance subtitle – only available on full BeachAmenities rows
  const nearestM = (amenities as BeachAmenities).nearest_source_m;
  const distanceLabel =
    typeof nearestM === "number" ? formatSourceDistance(nearestM) : null;

  return (
    <Card className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg">
      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50">
        <CardTitle className="flex items-center gap-2 text-lg font-roboto text-gray-800">
          <Waves className="h-5 w-5 text-blue-600" /> Amenities
        </CardTitle>
        {distanceLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Amenities within {distanceLabel}
          </p>
        )}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        {CATEGORY_ORDER.map((category) => {
          const keys = grouped[category];
          if (keys.length === 0) return null;

          return (
            <div key={category}>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                {CATEGORY_LABELS[category]}
              </p>
              <div className="flex flex-wrap gap-2">
                {keys.map((key) => {
                  const info = AMENITY_DISPLAY_MAP[key];
                  const Icon = ICON_MAP[info.icon];

                  return (
                    <Badge
                      key={key}
                      variant="secondary"
                      className="flex items-center gap-1 text-xs"
                    >
                      {Icon && (
                        <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      )}
                      {info.label}
                    </Badge>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
