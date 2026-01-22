/**
 * City Intent Guides Grid
 *
 * Thin wrapper around the shared IntentGuidesGrid component
 * that provides the city-specific props interface.
 *
 * @deprecated Import from '@/components/shared/intent-guides-grid' directly
 * and use locationType="city" for new code.
 */

import { IntentGuidesGrid as SharedIntentGuidesGrid } from "@/components/shared/intent-guides-grid";

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
  return (
    <SharedIntentGuidesGrid
      locationSlug={citySlug}
      locationName={cityName}
      locationType="city"
      stateAbbrev={stateAbbrev}
    />
  );
}
