import {
  ArrowRight,
  CalendarDays,
  Compass,
  MapPin,
  Sailboat,
  Sunrise,
  Sunset,
  Thermometer,
  Users,
  Waves,
  type LucideIcon,
} from "lucide-react";
import {
  buildBeachUrl,
  buildCityUrl,
  countryToSlug,
  isValidStateSlug,
  regionToSlug,
  stateToSlug,
} from "@/lib/utils/beach-url-utils";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import type { Beach } from "@/types/database";

type IntentGuideDefinition = {
  key: string;
  label: string;
  icon: LucideIcon;
  description: string;
};

const INTENT_GUIDES: IntentGuideDefinition[] = [
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
];

const INTERNATIONAL_GUIDES: IntentGuideDefinition[] = [
  {
    key: "tides",
    label: "Tide Chart",
    icon: Waves,
    description: "Track the local tide window",
  },
  {
    key: "water-temp",
    label: "Water Temp",
    icon: Thermometer,
    description: "Plan your wetsuit call",
  },
  {
    key: "map",
    label: "Surf Map",
    icon: MapPin,
    description: "Compare nearby breaks",
  },
  {
    key: "country",
    label: "Mexico Spots",
    icon: ArrowRight,
    description: "Browse the Mexico beach index",
  },
];

export type RelatedGuideLink = IntentGuideDefinition & {
  href: string;
};

export type RelatedGuideLinks = {
  heading: string;
  primaryLink: RelatedGuideLink;
  guides: RelatedGuideLink[];
};

type BuildRelatedGuideLinksInput = {
  beach: Beach;
  hasLeastCrowded: boolean;
  hasWaterTemp?: boolean;
  bestTimeToSurfUrl?: string;
};

export function buildRelatedGuideLinks({
  beach,
  hasLeastCrowded,
  hasWaterTemp,
  bestTimeToSurfUrl,
}: BuildRelatedGuideLinksInput): RelatedGuideLinks | null {
  if (!beach.city) return null;

  const stateSlug = stateToSlug(beach.state);
  if (!isValidStateSlug(stateSlug)) {
    return buildInternationalGuideLinks(beach);
  }

  const intentSlug = buildCitySlug(beach.city, stateSlug || beach.state || "", COLLISION_CITY_MAP);
  if (!intentSlug) return null;

  const visibleGuides = INTENT_GUIDES.filter((guide) => {
    if (guide.key === "least-crowded") return hasLeastCrowded;
    if (guide.key === "water-temp") return hasWaterTemp !== false;
    return true;
  });

  const guides: RelatedGuideLink[] = visibleGuides.map((guide) => ({
    ...guide,
    href:
      guide.key === "water-temp" && hasWaterTemp === true
        ? `${buildBeachUrl(beach)}/water-temp`
        : `/${guide.key}/${intentSlug}`,
  }));

  if (bestTimeToSurfUrl) {
    guides.push({
      key: "best-time-to-surf",
      label: "Best Time to Surf",
      icon: CalendarDays,
      description: "Month-by-month surf calendar",
      href: bestTimeToSurfUrl,
    });
  }

  return {
    heading: `Surf Guides for ${beach.city}`,
    primaryLink: {
      key: "city",
      label: `Explore all ${beach.city} surf spots`,
      icon: MapPin,
      description: "City surf spot guide",
      href: buildCityUrl(beach.state, beach.city),
    },
    guides,
  };
}

function buildInternationalGuideLinks(beach: Beach): RelatedGuideLinks | null {
  const countrySlug = countryToSlug(beach.country);
  const regionSlug = regionToSlug(beach.state);
  const beachPath = buildBeachUrl(beach);
  const countryName = beach.country || "International";

  if (!countrySlug || !regionSlug || !beach.slug) return null;

  return {
    heading: `Surf Guides for ${beach.city}`,
    primaryLink: {
      key: "region",
      label: `Explore ${beach.state || countryName} surf spots`,
      icon: MapPin,
      description: "Regional surf spot guide",
      href: `/beaches/${countrySlug}/${regionSlug}`,
    },
    guides: INTERNATIONAL_GUIDES.map((guide) => {
      if (guide.key === "tides") {
        return { ...guide, href: `${beachPath}/tides` };
      }
      if (guide.key === "water-temp") {
        return { ...guide, href: `${beachPath}/water-temp` };
      }
      if (guide.key === "country") {
        return { ...guide, label: `${countryName} Spots`, href: `/beaches/${countrySlug}` };
      }
      return { ...guide, href: "/map" };
    }),
  };
}
