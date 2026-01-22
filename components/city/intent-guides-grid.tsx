import Link from "next/link";
import {
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildCityIntentUrl,
  type IntentDefinitionType,
  type IntentKey,
} from "@/lib/constants/intent-definitions";

interface IntentGuidesGridProps {
  citySlug: string;
  cityName: string;
  stateAbbrev?: string;
}

/**
 * IntentGuidesGrid - Displays all 7 intent links on city hub pages
 *
 * This is the primary internal linking component for the hub-centric
 * SEO architecture. Every city hub page should render this component
 * to ensure all 7 intent pages have incoming links.
 *
 * Features:
 * - Deterministic: always shows all 7 intents, no conditional logic
 * - Grouped by Session (3) and Style (4) categories
 * - Uses URL format: /{intent}/{city}
 */
export function IntentGuidesGrid({
  citySlug,
  cityName,
  stateAbbrev,
}: IntentGuidesGridProps) {
  const displayName = stateAbbrev ? `${cityName}, ${stateAbbrev}` : cityName;

  return (
    <section className="space-y-6">
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
              citySlug={citySlug}
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
              citySlug={citySlug}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

interface IntentCardProps {
  intent: IntentDefinitionType;
  citySlug: string;
}

function IntentCard({ intent, citySlug }: IntentCardProps) {
  const href = buildCityIntentUrl(intent.key as IntentKey, citySlug);

  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      aria-label={`${intent.label} surf guide for ${citySlug}`}
    >
      <div className="font-medium text-slate-900">{intent.label}</div>
      <div className="text-sm text-slate-600 line-clamp-2">
        {intent.description}
      </div>
    </Link>
  );
}
