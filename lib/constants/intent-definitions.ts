/**
 * Intent Definitions - Single Source of Truth
 *
 * Used for:
 * - IntentGuidesGrid component on city hub pages
 * - PopularCitiesForIntent on state intent pages
 * - URL building for intent pages
 * - Type-safe intent key validation
 */

export const INTENT_GROUPS = {
  conditions: 'Conditions',
  style: 'Style',
} as const;

export type IntentGroupKey = keyof typeof INTENT_GROUPS;

type IntentDefinitionShape = {
  key: string;
  label: string;
  description: string;
  group: IntentGroupKey;
};

export const INTENT_DEFINITIONS = [
  // CONDITIONS GROUP
  {
    key: 'dawn-patrol',
    label: 'Dawn Patrol',
    description: 'Best early morning sessions',
    group: 'conditions',
  },
  {
    key: 'sunset',
    label: 'Sunset Sessions',
    description: 'Evening golden hour spots',
    group: 'conditions',
  },
  {
    key: 'tide',
    label: 'Tide Windows',
    description: 'Optimal tidal conditions',
    group: 'conditions',
  },
  {
    key: 'water-temp',
    label: 'Water Temperature',
    description: 'Conditions & wetsuit guide',
    group: 'conditions',
  },
  // STYLE GROUP
  {
    key: 'beginner',
    label: 'Beginner Spots',
    description: 'Gentle waves for learning',
    group: 'style',
  },
  {
    key: 'longboard',
    label: 'Longboard Spots',
    description: 'Mellow waves for logging',
    group: 'style',
  },
  {
    key: 'least-crowded',
    label: 'Less Crowded',
    description: 'Quieter lineups & backups',
    group: 'style',
  },
] as const satisfies readonly IntentDefinitionShape[];

// Derived types
export type IntentKey = (typeof INTENT_DEFINITIONS)[number]['key'];
export type IntentDefinitionType = (typeof INTENT_DEFINITIONS)[number];

// Pre-computed groups for efficient rendering
export const INTENTS_BY_GROUP = {
  conditions: INTENT_DEFINITIONS.filter(i => i.group === 'conditions'),
  style: INTENT_DEFINITIONS.filter(i => i.group === 'style'),
} as const;

export const isConditionsIntent = (key: IntentKey): boolean =>
  INTENTS_BY_GROUP.conditions.some(i => i.key === key);

export const isStyleIntent = (key: IntentKey): boolean =>
  INTENTS_BY_GROUP.style.some(i => i.key === key);

// URL builders - single source of truth
export const buildStateIntentUrl = (intent: IntentKey, stateSlug: string): string =>
  `/${intent}/${stateSlug}`;

export const buildCityIntentUrl = (
  intent: IntentKey,
  citySlug: string
): string => `/${intent}/${citySlug}`;

export const buildCityHubUrl = (stateSlug: string, citySlug: string): string =>
  `/${stateSlug}/${citySlug}`;

/**
 * Parse old collision-aware city slugs for redirect handling.
 * Examples:
 *   "san-diego" → { city: "san-diego" }
 *   "oceanside-ca" → { city: "oceanside", state: "ca" }
 */
export const parseOldCitySlug = (slug: string): { city: string; state?: string } | null => {
  if (!slug) return null;

  // Check for 2-letter state suffix (e.g., "-ca", "-or")
  const stateMatch = slug.match(/-([a-z]{2})$/);
  if (stateMatch) {
    return {
      city: slug.slice(0, -3),
      state: stateMatch[1],
    };
  }

  return { city: slug };
};
