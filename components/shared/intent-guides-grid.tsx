import Link from "next/link";
import {
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildStateIntentUrl,
  buildCityIntentUrl,
  type IntentDefinitionType,
  type IntentKey,
} from "@/lib/constants/intent-definitions";

type LocationType = "state" | "city";

interface IntentGuidesGridProps {
  /** The URL slug for the location (e.g., "ca", "san-diego") */
  locationSlug: string;
  /** Display name for the location (e.g., "California", "San Diego") */
  locationName: string;
  /** Whether this is a state or city location */
  locationType: LocationType;
  /** Optional state abbreviation, only used for city locations to display "City, ST" */
  stateAbbrev?: string;
}

/**
 * IntentGuidesGrid - Displays all 7 intent links on hub pages
 *
 * This is the primary internal linking component for the hub-centric
 * SEO architecture. Every state and city hub page should render this
 * component to ensure all 7 intent pages have incoming links.
 *
 * Features:
 * - Deterministic: always shows all 7 intents, no conditional logic
 * - Grouped by Session (3) and Style (4) categories
 * - Polymorphic: supports both state and city locations
 * - URL format: /{intent}/{location-slug}
 */
export function IntentGuidesGrid({
  locationSlug,
  locationName,
  locationType,
  stateAbbrev,
}: IntentGuidesGridProps) {
  const displayName =
    locationType === "city" && stateAbbrev
      ? `${locationName}, ${stateAbbrev}`
      : locationName;

  const buildUrl = (intentKey: IntentKey): string =>
    locationType === "state"
      ? buildStateIntentUrl(intentKey, locationSlug)
      : buildCityIntentUrl(intentKey, locationSlug);

  // State pages get top margin since they're placed after other content
  const sectionClassName =
    locationType === "state" ? "mt-10 space-y-6" : "space-y-6";

  return (
    <section className={sectionClassName}>
      <h2 className="text-xl font-semibold text-slate-900">
        Surf Guides for {displayName}
      </h2>

      {/* SESSION group */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {INTENT_GROUPS.session}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTENTS_BY_GROUP.session.map((intent) => (
            <IntentCard
              key={intent.key}
              intent={intent}
              href={buildUrl(intent.key as IntentKey)}
              locationName={locationName}
            />
          ))}
        </div>
      </div>

      {/* STYLE group */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {INTENT_GROUPS.style}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {INTENTS_BY_GROUP.style.map((intent) => (
            <IntentCard
              key={intent.key}
              intent={intent}
              href={buildUrl(intent.key as IntentKey)}
              locationName={locationName}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface IntentCardProps {
  intent: IntentDefinitionType;
  href: string;
  locationName: string;
}

function IntentCard({ intent, href, locationName }: IntentCardProps) {
  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      aria-label={`${intent.label} surf guide for ${locationName}`}
    >
      <div className="font-medium text-slate-900">{intent.label}</div>
      <div className="text-sm text-slate-600 line-clamp-2">
        {intent.description}
      </div>
    </Link>
  );
}

// Re-export types for consumers
export type { IntentGuidesGridProps, LocationType };
