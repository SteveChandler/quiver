import Link from "next/link";
import {
  INTENT_DEFINITIONS,
  buildCityIntentUrl,
  buildCityHubUrl,
  buildStateIntentUrl,
  type IntentKey,
} from "@/lib/constants/intent-definitions";

interface ContinueExploringProps {
  currentIntent: IntentKey;
  citySlug: string;
  cityName: string;
  stateSlug: string;
  stateName: string;
  bestTimeToSurfUrl?: string;
  /** Optional intent keys to exclude from the cross-navigation links */
  excludeIntents?: IntentKey[];
}

/**
 * ContinueExploring - Shared server component for intent page cross-navigation.
 *
 * Renders links to:
 * - City hub page
 * - State-level intent page for the current intent
 * - All 6 OTHER intents for this city (excludes current)
 * - Forecast hub
 *
 * Replaces the 3 different hardcoded "Continue exploring" sidebars in
 * intent page, beginner page, and tide page components.
 */
export function ContinueExploring({
  currentIntent,
  citySlug,
  cityName,
  stateSlug,
  stateName,
  bestTimeToSurfUrl,
  excludeIntents,
}: ContinueExploringProps) {
  const currentDef = INTENT_DEFINITIONS.find((i) => i.key === currentIntent);
  const currentLabel = currentDef?.label ?? currentIntent;
  const excludeSet = excludeIntents ? new Set(excludeIntents) : null;
  const otherIntents = INTENT_DEFINITIONS.filter(
    (i) => i.key !== currentIntent && (!excludeSet || !excludeSet.has(i.key))
  );

  return (
    <aside className="overflow-hidden rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border border-blue-200/50 shadow-lg p-5">
      <h2 className="text-lg font-semibold text-gray-800 mb-3">
        Continue exploring
      </h2>
      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm text-sky-700">
        <li>
          <Link
            href={buildCityHubUrl(stateSlug, citySlug)}
            className="underline-offset-2 hover:underline"
          >
            Back to the {cityName} surf hub
          </Link>
        </li>
        <li>
          <Link
            href={buildStateIntentUrl(currentIntent, stateSlug)}
            className="underline-offset-2 hover:underline"
          >
            {currentLabel} across {stateName}
          </Link>
        </li>
        {otherIntents.map((intent) => (
          <li key={intent.key}>
            <Link
              href={buildCityIntentUrl(intent.key, citySlug)}
              className="underline-offset-2 hover:underline"
            >
              {intent.label} in {cityName}
            </Link>
          </li>
        ))}
        {bestTimeToSurfUrl && (
          <li>
            <Link
              href={bestTimeToSurfUrl}
              className="underline-offset-2 hover:underline"
            >
              Best Time to Surf in {cityName}
            </Link>
          </li>
        )}
        <li>
          <Link
            href="/forecast"
            className="underline-offset-2 hover:underline"
          >
            7-Day Surf Forecast
          </Link>
        </li>
      </ul>
    </aside>
  );
}
