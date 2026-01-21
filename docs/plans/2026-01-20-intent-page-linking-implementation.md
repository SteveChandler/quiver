# Intent Page Linking Architecture Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix 150+ orphan intent pages via hub-centric SEO architecture with clean URL structure

**Architecture:** City hub pages link to all 7 city intent pages. URL migration from `/{intent}/{city}` to `/{intent}/{state}/{city}` with 301 redirects for legacy URLs.

**Tech Stack:** Next.js 14 App Router, TypeScript, Supabase

**Design Doc:** `docs/plans/2026-01-20-intent-page-linking-architecture-design.md`

---

## Task 1: Create Intent Definitions Constant

**Files:**
- Create: `lib/constants/intent-definitions.ts`
- Test: `__tests__/lib/constants/intent-definitions.test.ts`

**Step 1: Write the failing test**

```typescript
// __tests__/lib/constants/intent-definitions.test.ts
import {
  INTENT_DEFINITIONS,
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildStateIntentUrl,
  buildCityIntentUrl,
  buildCityHubUrl,
  parseOldCitySlug,
  type IntentKey,
  type IntentDefinitionType,
} from '@/lib/constants/intent-definitions';

describe('intent-definitions', () => {
  describe('INTENT_DEFINITIONS', () => {
    it('should have exactly 7 intents', () => {
      expect(INTENT_DEFINITIONS).toHaveLength(7);
    });

    it('should have all required intent keys', () => {
      const keys = INTENT_DEFINITIONS.map(i => i.key);
      expect(keys).toContain('beginner');
      expect(keys).toContain('least-crowded');
      expect(keys).toContain('tide');
      expect(keys).toContain('water-temp');
      expect(keys).toContain('longboard');
      expect(keys).toContain('dawn-patrol');
      expect(keys).toContain('sunset');
    });

    it('should have valid group assignments', () => {
      const validGroups = Object.keys(INTENT_GROUPS);
      INTENT_DEFINITIONS.forEach(intent => {
        expect(validGroups).toContain(intent.group);
      });
    });
  });

  describe('INTENTS_BY_GROUP', () => {
    it('should have 3 session intents', () => {
      expect(INTENTS_BY_GROUP.session).toHaveLength(3);
    });

    it('should have 4 style intents', () => {
      expect(INTENTS_BY_GROUP.style).toHaveLength(4);
    });
  });

  describe('buildStateIntentUrl', () => {
    it('should build correct state intent URL', () => {
      expect(buildStateIntentUrl('beginner', 'ca')).toBe('/beginner/ca');
      expect(buildStateIntentUrl('sunset', 'hi')).toBe('/sunset/hi');
    });
  });

  describe('buildCityIntentUrl', () => {
    it('should build correct city intent URL with state', () => {
      expect(buildCityIntentUrl('beginner', 'ca', 'san-diego')).toBe('/beginner/ca/san-diego');
      expect(buildCityIntentUrl('sunset', 'hi', 'honolulu')).toBe('/sunset/hi/honolulu');
    });
  });

  describe('buildCityHubUrl', () => {
    it('should build correct city hub URL', () => {
      expect(buildCityHubUrl('ca', 'san-diego')).toBe('/beaches/usa/ca/san-diego');
    });
  });

  describe('parseOldCitySlug', () => {
    it('should parse simple city slug', () => {
      expect(parseOldCitySlug('san-diego')).toEqual({ city: 'san-diego' });
    });

    it('should parse collision-aware slug with state suffix', () => {
      expect(parseOldCitySlug('oceanside-ca')).toEqual({ city: 'oceanside', state: 'ca' });
      expect(parseOldCitySlug('oceanside-or')).toEqual({ city: 'oceanside', state: 'or' });
    });

    it('should return null for empty input', () => {
      expect(parseOldCitySlug('')).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/lib/constants/intent-definitions.test.ts`
Expected: FAIL with "Cannot find module '@/lib/constants/intent-definitions'"

**Step 3: Write minimal implementation**

```typescript
// lib/constants/intent-definitions.ts
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
  session: 'Session',
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
  // SESSION GROUP
  {
    key: 'dawn-patrol',
    label: 'Dawn Patrol',
    description: 'Best early morning sessions',
    group: 'session',
  },
  {
    key: 'sunset',
    label: 'Sunset Sessions',
    description: 'Evening golden hour spots',
    group: 'session',
  },
  {
    key: 'tide',
    label: 'Tide Windows',
    description: 'Optimal tidal conditions',
    group: 'session',
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
  {
    key: 'water-temp',
    label: 'Water Temperature',
    description: 'Conditions & wetsuit guide',
    group: 'style',
  },
] as const satisfies readonly IntentDefinitionShape[];

// Derived types
export type IntentKey = (typeof INTENT_DEFINITIONS)[number]['key'];
export type IntentDefinitionType = (typeof INTENT_DEFINITIONS)[number];

// Pre-computed groups for efficient rendering
export const INTENTS_BY_GROUP = {
  session: INTENT_DEFINITIONS.filter(i => i.group === 'session'),
  style: INTENT_DEFINITIONS.filter(i => i.group === 'style'),
} as const;

// URL builders - single source of truth
export const buildStateIntentUrl = (intent: IntentKey, stateSlug: string): string =>
  `/${intent}/${stateSlug}`;

export const buildCityIntentUrl = (
  intent: IntentKey,
  stateSlug: string,
  citySlug: string
): string => `/${intent}/${stateSlug}/${citySlug}`;

export const buildCityHubUrl = (stateSlug: string, citySlug: string): string =>
  `/beaches/usa/${stateSlug}/${citySlug}`;

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
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/lib/constants/intent-definitions.test.ts`
Expected: PASS (all tests green)

**Step 5: Commit**

```bash
git add lib/constants/intent-definitions.ts __tests__/lib/constants/intent-definitions.test.ts
git commit -m "feat: add intent-definitions constant with URL builders

- Single source of truth for 7 surf intents
- Grouped by session (3) and style (4)
- Type-safe URL builders for state/city intent pages
- parseOldCitySlug for redirect handling

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 2: Add City Lookup Functions

**Files:**
- Modify: `actions/beach/beach-location-actions.ts`
- Test: `__tests__/actions/beach/beach-location-actions.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to existing test file or create new
import { lookupCityBySlug, lookupCityByCityAndStateSlug } from '@/actions/beach/beach-location-actions';

describe('city lookup functions', () => {
  describe('lookupCityBySlug', () => {
    it('should return city data for valid slug', async () => {
      const result = await lookupCityBySlug('san-diego');
      expect(result).toBeDefined();
      if (result) {
        expect(result.slug).toBe('san-diego');
        expect(result.stateSlug).toBe('ca');
      }
    });

    it('should return null for invalid slug', async () => {
      const result = await lookupCityBySlug('nonexistent-city-xyz');
      expect(result).toBeNull();
    });
  });

  describe('lookupCityByCityAndStateSlug', () => {
    it('should return city data for valid city+state', async () => {
      const result = await lookupCityByCityAndStateSlug('oceanside', 'ca');
      expect(result).toBeDefined();
      if (result) {
        expect(result.slug).toBe('oceanside');
        expect(result.stateSlug).toBe('ca');
      }
    });

    it('should return null for invalid combination', async () => {
      const result = await lookupCityByCityAndStateSlug('nonexistent', 'ca');
      expect(result).toBeNull();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/actions/beach/beach-location-actions.test.ts`
Expected: FAIL with "lookupCityBySlug is not a function"

**Step 3: Write minimal implementation**

Add to `actions/beach/beach-location-actions.ts`:

```typescript
export interface CityLookupResult {
  slug: string;
  cityName: string;
  stateSlug: string;
  stateName: string;
  country: string;
}

/**
 * Look up a city by its URL slug.
 * Used for redirect handling when we only have a city slug.
 */
export async function lookupCityBySlug(citySlug: string): Promise<CityLookupResult | null> {
  try {
    const supabase = await createSupabaseServerClient();

    // Query beaches to find a city matching this slug
    const { data, error } = await supabase
      .from('beaches')
      .select('city, state, country')
      .or('is_private.is.null,is_private.eq.false')
      .is('deleted_at', null)
      .not('city', 'is', null)
      .not('state', 'is', null)
      .limit(1);

    if (error || !data || data.length === 0) return null;

    // Find matching city by slugifying
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (!citiesResult.success || !citiesResult.data) return null;

    for (const cityRecord of citiesResult.data) {
      const slug = slugify(cityRecord.city);
      if (slug === citySlug) {
        return {
          slug,
          cityName: cityRecord.city,
          stateSlug: stateToSlug(cityRecord.state),
          stateName: cityRecord.state,
          country: cityRecord.country || 'USA',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error looking up city by slug:', error);
    return null;
  }
}

/**
 * Look up a city by city slug + state slug.
 * Used for redirect handling of collision-aware slugs like "oceanside-ca".
 */
export async function lookupCityByCityAndStateSlug(
  citySlug: string,
  stateSlug: string
): Promise<CityLookupResult | null> {
  try {
    const citiesResult = await getAllCitiesWithBeaches(1);
    if (!citiesResult.success || !citiesResult.data) return null;

    for (const cityRecord of citiesResult.data) {
      const slug = slugify(cityRecord.city);
      const state = stateToSlug(cityRecord.state);

      if (slug === citySlug && state === stateSlug) {
        return {
          slug,
          cityName: cityRecord.city,
          stateSlug: state,
          stateName: cityRecord.state,
          country: cityRecord.country || 'USA',
        };
      }
    }

    return null;
  } catch (error) {
    console.error('Error looking up city by city+state:', error);
    return null;
  }
}
```

Also add import at top:
```typescript
import { slugify } from '@/lib/utils/text-utils';
import { stateToSlug } from '@/lib/utils/beach-url-utils';
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/actions/beach/beach-location-actions.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add actions/beach/beach-location-actions.ts __tests__/actions/beach/beach-location-actions.test.ts
git commit -m "feat: add city lookup functions for redirect handling

- lookupCityBySlug: find city by URL slug
- lookupCityByCityAndStateSlug: find city by slug + state
- Used by legacy URL redirect handler

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 3: Create IntentGuidesGrid Component

**Files:**
- Create: `components/city/intent-guides-grid.tsx`
- Test: `__tests__/components/city/intent-guides-grid.test.tsx`

**Step 1: Write the failing test**

```typescript
// __tests__/components/city/intent-guides-grid.test.tsx
import { render, screen } from '@testing-library/react';
import { IntentGuidesGrid } from '@/components/city/intent-guides-grid';

describe('IntentGuidesGrid', () => {
  const defaultProps = {
    citySlug: 'san-diego',
    cityName: 'San Diego',
    stateSlug: 'ca',
    stateAbbrev: 'CA',
  };

  it('should render all 7 intent links', () => {
    render(<IntentGuidesGrid {...defaultProps} />);

    // Check for all intent labels
    expect(screen.getByText('Dawn Patrol')).toBeInTheDocument();
    expect(screen.getByText('Sunset Sessions')).toBeInTheDocument();
    expect(screen.getByText('Tide Windows')).toBeInTheDocument();
    expect(screen.getByText('Beginner Spots')).toBeInTheDocument();
    expect(screen.getByText('Longboard Spots')).toBeInTheDocument();
    expect(screen.getByText('Less Crowded')).toBeInTheDocument();
    expect(screen.getByText('Water Temperature')).toBeInTheDocument();
  });

  it('should render section headings', () => {
    render(<IntentGuidesGrid {...defaultProps} />);

    expect(screen.getByText('Session')).toBeInTheDocument();
    expect(screen.getByText('Style')).toBeInTheDocument();
  });

  it('should build correct URLs with state slug', () => {
    render(<IntentGuidesGrid {...defaultProps} />);

    const beginnerLink = screen.getByRole('link', { name: /beginner spots surf guide/i });
    expect(beginnerLink).toHaveAttribute('href', '/beginner/ca/san-diego');
  });

  it('should display city name with state abbreviation', () => {
    render(<IntentGuidesGrid {...defaultProps} />);

    expect(screen.getByText('Surf Guides for San Diego, CA')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/components/city/intent-guides-grid.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// components/city/intent-guides-grid.tsx
import Link from 'next/link';
import {
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildCityIntentUrl,
  type IntentDefinitionType,
  type IntentKey,
} from '@/lib/constants/intent-definitions';

interface IntentGuidesGridProps {
  citySlug: string;
  cityName: string;
  stateSlug: string;
  stateAbbrev?: string;
}

/**
 * IntentGuidesGrid - Displays all 7 intent links on city hub pages
 *
 * This is the primary internal linking component for the hub-centric
 * SEO architecture. Every city hub page should render this component
 * to ensure all 7 intent pages have incoming links.
 */
export function IntentGuidesGrid({
  citySlug,
  cityName,
  stateSlug,
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
              stateSlug={stateSlug}
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
              stateSlug={stateSlug}
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
  stateSlug: string;
  citySlug: string;
}

function IntentCard({ intent, stateSlug, citySlug }: IntentCardProps) {
  const href = buildCityIntentUrl(intent.key as IntentKey, stateSlug, citySlug);

  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
      aria-label={`${intent.label} surf guide for ${citySlug}`}
    >
      <div className="font-medium text-slate-900">{intent.label}</div>
      <div className="text-sm text-slate-600 line-clamp-2">{intent.description}</div>
    </Link>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/components/city/intent-guides-grid.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/city/intent-guides-grid.tsx __tests__/components/city/intent-guides-grid.test.tsx
git commit -m "feat: add IntentGuidesGrid component for hub-centric linking

- Displays all 7 intents grouped by Session and Style
- Uses new URL format: /{intent}/{state}/{city}
- Deterministic: always shows all 7, no conditional logic

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 4: Create PopularCitiesForIntent Component

**Files:**
- Create: `components/intent/popular-cities-for-intent.tsx`
- Test: `__tests__/components/intent/popular-cities-for-intent.test.tsx`

**Step 1: Write the failing test**

```typescript
// __tests__/components/intent/popular-cities-for-intent.test.tsx
import { render, screen } from '@testing-library/react';
import { PopularCitiesForIntent } from '@/components/intent/popular-cities-for-intent';

describe('PopularCitiesForIntent', () => {
  const defaultProps = {
    intentKey: 'beginner' as const,
    intentLabel: 'Beginner Spots',
    stateSlug: 'ca',
    stateName: 'California',
    cities: [
      { slug: 'san-diego', name: 'San Diego' },
      { slug: 'malibu', name: 'Malibu' },
      { slug: 'santa-cruz', name: 'Santa Cruz' },
    ],
  };

  it('should render heading with intent and state', () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    expect(screen.getByText('Popular cities for Beginner Spots in California')).toBeInTheDocument();
  });

  it('should render all city links', () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    expect(screen.getByText('San Diego')).toBeInTheDocument();
    expect(screen.getByText('Malibu')).toBeInTheDocument();
    expect(screen.getByText('Santa Cruz')).toBeInTheDocument();
  });

  it('should build correct URLs', () => {
    render(<PopularCitiesForIntent {...defaultProps} />);

    const sanDiegoLink = screen.getByRole('link', { name: /san diego/i });
    expect(sanDiegoLink).toHaveAttribute('href', '/beginner/ca/san-diego');
  });

  it('should return null when no cities', () => {
    const { container } = render(
      <PopularCitiesForIntent {...defaultProps} cities={[]} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/components/intent/popular-cities-for-intent.test.tsx`
Expected: FAIL

**Step 3: Write minimal implementation**

```typescript
// components/intent/popular-cities-for-intent.tsx
import Link from 'next/link';
import { buildCityIntentUrl, type IntentKey } from '@/lib/constants/intent-definitions';

interface CityLink {
  slug: string;
  name: string;
}

interface PopularCitiesForIntentProps {
  intentKey: IntentKey;
  intentLabel: string;
  stateSlug: string;
  stateName: string;
  cities: CityLink[];
}

/**
 * PopularCitiesForIntent - State-level backstop for crawl loops
 *
 * Displayed on state intent pages (e.g., /beginner/ca) to link DOWN
 * to city intent pages, creating the crawl loop:
 * state intent → city intent → city hub → state intent
 */
export function PopularCitiesForIntent({
  intentKey,
  intentLabel,
  stateSlug,
  stateName,
  cities,
}: PopularCitiesForIntentProps) {
  if (cities.length === 0) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-900">
        Popular cities for {intentLabel} in {stateName}
      </h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {cities.map((city) => (
          <li key={city.slug}>
            <Link
              href={buildCityIntentUrl(intentKey, stateSlug, city.slug)}
              className="block p-3 rounded-md border border-slate-200 hover:bg-slate-50 transition-colors"
              aria-label={`${intentLabel} guide for ${city.name}`}
            >
              {city.name}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/components/intent/popular-cities-for-intent.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add components/intent/popular-cities-for-intent.tsx __tests__/components/intent/popular-cities-for-intent.test.tsx
git commit -m "feat: add PopularCitiesForIntent component for state pages

- Links from state intent pages to city intent pages
- Creates crawl loop: state → city intent → city hub
- Limit to top N cities by beach count

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 5: Create New Route Structure

**Files:**
- Create: `app/[intent]/[state]/page.tsx`
- Create: `app/[intent]/[state]/[city]/page.tsx`

**Step 1: Create state intent page**

```typescript
// app/[intent]/[state]/page.tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { SURF_INTENTS, type SurfIntentSlug } from '@/lib/constants/surf-intents';
import { isValidStateSlug, getUsStateDisplayNameFromSlug } from '@/lib/utils/beach-url-utils';
import { getBeachesByIntentAndState } from '@/actions/beach/beach-query-actions';
import { buildPageMetadata } from '@/lib/seo/meta';
import { BreadcrumbStructuredData } from '@/components/seo/breadcrumb-schema';
import { FAQSchema } from '@/components/seo/faq-schema';
import { generateIntentFAQ } from '@/lib/seo/intent-faq-generator';
import { StateMapView } from '@/components/state/state-map-view';
import { PopularCitiesForIntent } from '@/components/intent/popular-cities-for-intent';
import { getTopCitiesInState } from '@/actions/beach/beach-location-actions';
import { buildStateIntentUrl, type IntentKey } from '@/lib/constants/intent-definitions';

export const revalidate = 1800;

const INTENT_SLUGS: SurfIntentSlug[] = [
  'beginner', 'least-crowded', 'tide', 'water-temp', 'longboard', 'dawn-patrol', 'sunset'
];

export async function generateStaticParams() {
  const usStates = ['ca', 'or', 'wa', 'hi', 'fl', 'nj', 'ny', 'nc', 'sc', 'tx'];
  const params: Array<{ intent: string; state: string }> = [];

  for (const state of usStates) {
    for (const intent of INTENT_SLUGS) {
      params.push({ intent, state });
    }
  }

  return params;
}

interface StateIntentPageParams {
  params: { intent: string; state: string };
}

export async function generateMetadata({ params }: StateIntentPageParams): Promise<Metadata> {
  const { intent, state } = params;

  if (!isValidStateSlug(state) || !SURF_INTENTS[intent as SurfIntentSlug]) {
    return {};
  }

  const stateName = getUsStateDisplayNameFromSlug(state);
  const definition = SURF_INTENTS[intent as SurfIntentSlug];

  return buildPageMetadata({
    title: `${definition.label} Spots in ${stateName}`,
    description: `Find the best ${definition.label.toLowerCase()} surf spots across ${stateName}. AI-powered recommendations for every skill level.`,
    path: buildStateIntentUrl(intent as IntentKey, state),
  });
}

export default async function StateIntentPage({ params }: StateIntentPageParams) {
  const { intent, state } = params;

  // Validate intent and state
  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition || !isValidStateSlug(state)) {
    notFound();
  }

  const stateName = getUsStateDisplayNameFromSlug(state);
  const beachesResult = await getBeachesByIntentAndState(intent, state);

  if (!beachesResult.success || !beachesResult.data || beachesResult.data.length === 0) {
    notFound();
  }

  const beaches = beachesResult.data;
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quiversurf.app';

  // Get top cities for the backstop component
  const topCitiesResult = await getTopCitiesInState(state, 8);
  const topCities = topCitiesResult.success && topCitiesResult.data
    ? topCitiesResult.data.map(c => ({ slug: c.slug, name: c.cityName }))
    : [];

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: 'Quiver', url: baseUrl },
          { name: `${stateName} Surf`, url: `${baseUrl}/beaches/usa/${state}` },
          { name: definition.label, url: `${baseUrl}${buildStateIntentUrl(intent as IntentKey, state)}` },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          intent as SurfIntentSlug,
          stateName,
          beaches.slice(0, 3).map((b) => b.name)
        )}
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
            {definition.heading({ cityName: stateName })}
          </h1>
          <p className="text-lg text-gray-600 mt-2">
            {beaches.length} spots across {stateName}
          </p>
          <p className="text-base text-slate-700 mt-4">
            {definition.intro({ cityName: stateName })}
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">
            {definition.label} spots in {stateName}
          </h2>
          <StateMapView
            beaches={beaches}
            ariaLabel={`${definition.label} spots in ${stateName}`}
          />
        </section>

        {/* Backstop: links to city intent pages */}
        {topCities.length > 0 && (
          <section className="mt-12">
            <PopularCitiesForIntent
              intentKey={intent as IntentKey}
              intentLabel={definition.label}
              stateSlug={state}
              stateName={stateName}
              cities={topCities}
            />
          </section>
        )}
      </div>
    </div>
  );
}
```

**Step 2: Create city intent page**

```typescript
// app/[intent]/[state]/[city]/page.tsx
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';

import { SURF_INTENTS, type SurfIntentSlug } from '@/lib/constants/surf-intents';
import { isValidStateSlug } from '@/lib/utils/beach-url-utils';
import { findCityBySlug } from '@/actions/city/city-metadata-actions';
import { getBeachesByIntentAndCity } from '@/actions/beach/beach-query-actions';
import { buildPageMetadata } from '@/lib/seo/meta';
import { buildIntentPageContent } from '@/lib/seo/intent-content-templates';
import { BreadcrumbStructuredData } from '@/components/seo/breadcrumb-schema';
import { FAQSchema } from '@/components/seo/faq-schema';
import { generateIntentFAQ } from '@/lib/seo/intent-faq-generator';
import { CityMapView } from '@/components/city/city-map-view';
import { transformBeachesToSurfSpots } from '@/lib/utils/beach-to-surfspot-transformer';
import type { BeachWithMetrics } from '@/types/location';
import {
  buildCityIntentUrl,
  buildCityHubUrl,
  buildStateIntentUrl,
  type IntentKey,
} from '@/lib/constants/intent-definitions';
import { getAllCitiesWithBeaches } from '@/actions/beach/beach-location-actions';
import { detectCityCollisions, buildCitySlug } from '@/lib/seo/city-slug-utils';

export const revalidate = 1800;

const INTENT_SLUGS: SurfIntentSlug[] = [
  'beginner', 'least-crowded', 'tide', 'water-temp', 'longboard', 'dawn-patrol', 'sunset'
];

export async function generateStaticParams() {
  const params: Array<{ intent: string; state: string; city: string }> = [];

  try {
    const citiesResult = await getAllCitiesWithBeaches(3);
    if (citiesResult.success && citiesResult.data) {
      const collisionMap = detectCityCollisions(citiesResult.data);

      for (const cityRecord of citiesResult.data) {
        const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
        if (!citySlug) continue;

        const stateSlug = cityRecord.state.toLowerCase();
        if (stateSlug.length !== 2) continue; // Only US states

        for (const intent of INTENT_SLUGS) {
          params.push({ intent, state: stateSlug, city: citySlug });
        }
      }
    }
  } catch (error) {
    console.error('generateStaticParams: Failed to fetch cities', error);
  }

  return params;
}

interface CityIntentPageParams {
  params: { intent: string; state: string; city: string };
}

export async function generateMetadata({ params }: CityIntentPageParams): Promise<Metadata> {
  const { intent, state, city } = params;

  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition || !isValidStateSlug(state)) return {};

  const cityResult = await findCityBySlug(city);
  if (!cityResult.success || !cityResult.data) return {};

  const cityMetadata = cityResult.data;
  const pageContent = buildIntentPageContent(intent as SurfIntentSlug, cityMetadata);

  return buildPageMetadata({
    title: pageContent.title,
    description: pageContent.metaDescription,
    path: buildCityIntentUrl(intent as IntentKey, state, city),
    keywords: [
      `${cityMetadata.cityName} ${definition.label}`,
      `${cityMetadata.cityName} surf`,
      `${cityMetadata.stateName} surfing`,
    ],
  });
}

function formatPacificDateTime(date: Date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

export default async function CityIntentPage({ params }: CityIntentPageParams) {
  const { intent, state, city } = params;

  const definition = SURF_INTENTS[intent as SurfIntentSlug];
  if (!definition || !isValidStateSlug(state)) {
    notFound();
  }

  const cityResult = await findCityBySlug(city);
  if (!cityResult.success || !cityResult.data) {
    notFound();
  }

  const cityMetadata = cityResult.data;
  const pageContent = buildIntentPageContent(intent as SurfIntentSlug, cityMetadata);

  const beachesResult = await getBeachesByIntentAndCity(intent, city, state);
  if (!beachesResult.success || !beachesResult.data || beachesResult.data.length === 0) {
    notFound();
  }

  const beachesWithMetrics: BeachWithMetrics[] = beachesResult.data.map(beach => ({
    ...beach,
    compositeScore: 0,
    recentIntelCount: 0,
    avgConfirmations: 0,
  }));
  const spots = transformBeachesToSurfSpots(beachesWithMetrics);

  const now = new Date();
  const updatedAt = formatPacificDateTime(now);
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.quiversurf.app';
  const regionLabel = `${cityMetadata.cityName}, ${cityMetadata.stateName}`;

  return (
    <div className="bg-white">
      <BreadcrumbStructuredData
        items={[
          { name: 'Quiver', url: baseUrl },
          { name: `${cityMetadata.cityName} Surf`, url: `${baseUrl}${buildCityHubUrl(state, city)}` },
          { name: definition.label, url: `${baseUrl}${buildCityIntentUrl(intent as IntentKey, state, city)}` },
        ]}
      />
      <FAQSchema
        items={generateIntentFAQ(
          intent as SurfIntentSlug,
          cityMetadata.cityName,
          spots.slice(0, 3).map((s) => s.name)
        )}
      />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Breadcrumb */}
        <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm mb-6">
          <Link
            href={buildCityHubUrl(state, city)}
            className="inline-flex items-center gap-1 text-ocean-blue hover:underline"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to {cityMetadata.cityName}
          </Link>
          <span className="text-gray-400 mx-2">›</span>
          <span className="text-gray-900 font-medium">{definition.label}</span>
        </nav>

        {/* Header */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
            {pageContent.heading}
          </h1>
          <p className="text-lg text-gray-600 mb-4">{regionLabel}</p>
          <div className="space-y-2 mt-6">
            <p className="text-base text-slate-700">
              Updated {updatedAt} · Dialed recommendations refresh every 30 minutes based on tide, wind, and crowd telemetry from Quiver.
            </p>
            <p className="text-base text-slate-700">{pageContent.intro}</p>
          </div>
        </header>

        {/* Map & List Section */}
        <section className="space-y-12">
          <div>
            <h2 className="text-2xl font-semibold text-slate-900 mb-4">Top spot recommendations</h2>
            <p className="mb-6 text-sm text-slate-600">
              Sort your quiver, choose the right tide window, and jot down a backup in case the main peak gets stacked.
            </p>
            <CityMapView beaches={beachesWithMetrics} cityName={cityMetadata.cityName} />
          </div>

          {/* Up-link to state intent page */}
          <div className="border-t pt-8">
            <p className="text-sm text-slate-600">
              Explore more{' '}
              <Link
                href={buildStateIntentUrl(intent as IntentKey, state)}
                className="text-ocean-blue hover:underline"
              >
                {definition.label.toLowerCase()} spots across {cityMetadata.stateName}
              </Link>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
```

**Step 3: Commit**

```bash
git add app/[intent]/[state]/page.tsx app/[intent]/[state]/[city]/page.tsx
git commit -m "feat: add new intent page routes with clean URL structure

- /[intent]/[state]/page.tsx for state intent pages
- /[intent]/[state]/[city]/page.tsx for city intent pages
- New URL format: /{intent}/{state}/{city}
- Includes PopularCitiesForIntent backstop on state pages
- Links back to city hub from city intent pages

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 6: Create Legacy URL Redirect Handler

**Files:**
- Create: `app/[intent]/[legacyCity]/route.ts`
- Test: Manual testing with curl

**Step 1: Write the redirect handler**

```typescript
// app/[intent]/[legacyCity]/route.ts
import { NextResponse } from 'next/server';
import { INTENT_DEFINITIONS, parseOldCitySlug } from '@/lib/constants/intent-definitions';
import {
  lookupCityBySlug,
  lookupCityByCityAndStateSlug,
} from '@/actions/beach/beach-location-actions';
import { isValidStateSlug } from '@/lib/utils/beach-url-utils';

const VALID_INTENT_KEYS = INTENT_DEFINITIONS.map(i => i.key);

/**
 * Legacy URL Redirect Handler
 *
 * Handles old city intent URLs and redirects to new format:
 * - /beginner/san-diego → /beginner/ca/san-diego
 * - /beginner/oceanside-ca → /beginner/ca/oceanside
 *
 * This route handler only matches legacy city slugs, not state slugs.
 * State intent pages (e.g., /beginner/ca) are handled by [intent]/[state]/page.tsx
 */
export async function GET(
  request: Request,
  { params }: { params: { intent: string; legacyCity: string } }
) {
  const intent = params.intent.toLowerCase();
  const legacyCity = params.legacyCity.toLowerCase();

  // Not a valid intent → 404
  if (!VALID_INTENT_KEYS.includes(intent as any)) {
    return new NextResponse(null, { status: 404 });
  }

  // Known state slug → let new route handle it (return 404 so Next.js tries next route)
  if (isValidStateSlug(legacyCity)) {
    return new NextResponse(null, { status: 404 });
  }

  // Parse collision-aware slug (e.g., "oceanside-ca" → { city: "oceanside", state: "ca" })
  const parsed = parseOldCitySlug(legacyCity);
  if (!parsed) {
    return new NextResponse(null, { status: 404 });
  }

  // Look up city - with state context if available
  const city = parsed.state
    ? await lookupCityByCityAndStateSlug(parsed.city, parsed.state)
    : await lookupCityBySlug(parsed.city);

  if (!city || !city.stateSlug) {
    return new NextResponse(null, { status: 404 });
  }

  // Build new URL
  const targetPath = `/${intent}/${city.stateSlug}/${city.slug}`;

  // Loop guard: if we'd redirect to ourselves, 404 instead
  const incomingPath = `/${intent}/${legacyCity}`;
  if (incomingPath === targetPath) {
    return new NextResponse(null, { status: 404 });
  }

  // 301 redirect preserving querystring
  const newUrl = new URL(targetPath, request.url);
  newUrl.search = new URL(request.url).search;
  return NextResponse.redirect(newUrl, { status: 301 });
}
```

**Step 2: Test manually**

Run dev server: `yarn dev`

Test with curl:
```bash
# Should redirect to /beginner/ca/san-diego
curl -I http://localhost:3000/beginner/san-diego

# Expected: HTTP/1.1 301 Moved Permanently
# Location: /beginner/ca/san-diego

# State URL should NOT redirect (handled by new route)
curl -I http://localhost:3000/beginner/ca

# Expected: HTTP/1.1 200 OK (served by new state route)
```

**Step 3: Commit**

```bash
git add app/[intent]/[legacyCity]/route.ts
git commit -m "feat: add legacy URL redirect handler for intent pages

- 301 redirects from old format to new
- Handles collision-aware slugs (oceanside-ca → ca/oceanside)
- Preserves querystrings (UTMs, ref codes)
- Loop guard prevents infinite redirects

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 7: Update Sitemap

**Files:**
- Modify: `app/sitemap.ts`

**Step 1: Update sitemap to emit new URL format**

In `app/sitemap.ts`, modify the `dynamicIntentRoutes` section (around line 50):

```typescript
// BEFORE (old format):
return intents.map((intent) => ({
  url: `${baseUrl}/${intent}/${citySlug}`,
  // ...
}));

// AFTER (new format with state):
const stateSlug = stateToSlug(cityRecord.state);
return intents.map((intent) => ({
  url: `${baseUrl}/${intent}/${stateSlug}/${citySlug}`,
  lastModified: lastmod,
  changeFrequency: 'daily' as const,
  priority: intent === 'beginner' ? 0.85 : 0.8,
}));
```

Full updated section:

```typescript
// Generate intent routes for ALL cities with 3+ beaches (database-driven)
let dynamicIntentRoutes: MetadataRoute.Sitemap = [];
try {
  const citiesResult = await getAllCitiesWithBeaches(3);
  if (citiesResult.success && citiesResult.data) {
    const collisionMap = detectCityCollisions(citiesResult.data);
    const intents = ['beginner', 'least-crowded', 'tide', 'water-temp', 'longboard', 'dawn-patrol', 'sunset'];

    dynamicIntentRoutes = citiesResult.data.flatMap((cityRecord) => {
      const citySlug = buildCitySlug(cityRecord.city, cityRecord.state, collisionMap);
      if (!citySlug) return [];

      const stateSlug = stateToSlug(cityRecord.state);
      if (!stateSlug || stateSlug.length !== 2) return []; // Only US states

      // NEW URL FORMAT: /{intent}/{state}/{city}
      return intents.map((intent) => ({
        url: `${baseUrl}/${intent}/${stateSlug}/${citySlug}`,
        lastModified: lastmod,
        changeFrequency: 'daily' as const,
        priority: intent === 'beginner' ? 0.85 : 0.8,
      }));
    });
  }
} catch (error) {
  console.error('Sitemap: Failed to generate dynamic intent routes', error);
}
```

**Step 2: Verify sitemap output**

Run: `yarn build && yarn start`
Visit: `http://localhost:3000/sitemap.xml`

Verify intent URLs follow new format:
- `/beginner/ca/san-diego` (not `/beginner/san-diego`)

**Step 3: Commit**

```bash
git add app/sitemap.ts
git commit -m "fix: update sitemap to emit new intent URL format

- City intent URLs now include state: /{intent}/{state}/{city}
- State intent URLs unchanged: /{intent}/{state}
- Only generates for US states (2-letter codes)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 8: Update City Hub Pages

**Files:**
- Modify: `app/beaches/[country]/[state]/[city]/page.tsx`

**Step 1: Replace GuidesByIntentGrid with new IntentGuidesGrid**

Find the import (around line 41):
```typescript
// BEFORE
import { GuidesByIntentGrid } from '@/components/city/guides-by-intent-grid';

// AFTER
import { IntentGuidesGrid } from '@/components/city/intent-guides-grid';
```

Find the usage (search for `<GuidesByIntentGrid`):
```typescript
// BEFORE
<GuidesByIntentGrid
  cityName={cityName}
  citySlug={params.city}
  stateSlug={params.state}
  featuredIntents={editorial?.featured_intents || []}
  beaches={beaches}
/>

// AFTER
<IntentGuidesGrid
  citySlug={params.city}
  cityName={cityName}
  stateSlug={params.state}
  stateAbbrev={params.state.toUpperCase()}
/>
```

**Step 2: Test the city hub page**

Visit: `http://localhost:3000/beaches/usa/ca/san-diego`

Verify:
- All 7 intent links are displayed
- Links use new format: `/beginner/ca/san-diego`
- Grouped by Session and Style

**Step 3: Commit**

```bash
git add app/beaches/[country]/[state]/[city]/page.tsx
git commit -m "feat: use IntentGuidesGrid on city hub pages

- Shows all 7 intents (not just featured)
- Links use new URL format
- Hub-centric SEO architecture complete

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 9: Add getTopCitiesInState Function

**Files:**
- Modify: `actions/beach/beach-location-actions.ts`

**Step 1: Add the function**

```typescript
/**
 * Get top N cities in a state by beach count.
 * Used by PopularCitiesForIntent on state intent pages.
 */
export async function getTopCitiesInState(stateSlug: string, limit: number = 8) {
  try {
    const citiesResult = await getAllCitiesWithBeaches(3);
    if (!citiesResult.success || !citiesResult.data) {
      return { success: false, error: 'Failed to fetch cities' };
    }

    const stateCities = citiesResult.data
      .filter(c => stateToSlug(c.state) === stateSlug)
      .sort((a, b) => b.beachCount - a.beachCount)
      .slice(0, limit)
      .map(c => ({
        slug: slugify(c.city),
        cityName: c.city,
        beachCount: c.beachCount,
      }));

    return { success: true, data: stateCities };
  } catch (error) {
    console.error('Error getting top cities in state:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
```

**Step 2: Commit**

```bash
git add actions/beach/beach-location-actions.ts
git commit -m "feat: add getTopCitiesInState for state intent pages

- Returns top N cities by beach count
- Used by PopularCitiesForIntent component

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 10: Remove Old Intent Route (after validation)

**Files:**
- Remove: `app/[intent]/[city]/page.tsx` (old route)

**Step 1: Verify new routes are working**

Test all paths:
```bash
# State intent (new route)
curl -I http://localhost:3000/beginner/ca
# Expected: 200

# City intent (new route)
curl -I http://localhost:3000/beginner/ca/san-diego
# Expected: 200

# Legacy redirect
curl -I http://localhost:3000/beginner/san-diego
# Expected: 301 → /beginner/ca/san-diego
```

**Step 2: Remove old route file**

```bash
rm app/[intent]/[city]/page.tsx
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove old intent route after migration

- Old route: /[intent]/[city]/page.tsx
- Replaced by: /[intent]/[state]/page.tsx and /[intent]/[state]/[city]/page.tsx
- Legacy URLs handled by redirect handler

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Task 11: Final Verification

**Step 1: Run full test suite**

```bash
yarn test
yarn build
```

**Step 2: Verify SEO checklist**

- [ ] Sitemap emits new URLs only
- [ ] Legacy URLs return 301
- [ ] New URLs return 200 with self-canonical
- [ ] All 7 intents linked from city hub pages
- [ ] State intent pages link to city intent pages

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete intent page linking architecture

- Hub-centric SEO: city hubs link to all 7 intents
- Clean URL structure: /{intent}/{state}/{city}
- 301 redirects for legacy URLs
- Crawl loop: state ↔ city intent ↔ city hub

Fixes 150+ orphan intent pages.

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Intent definitions constant | `lib/constants/intent-definitions.ts` |
| 2 | City lookup functions | `actions/beach/beach-location-actions.ts` |
| 3 | IntentGuidesGrid component | `components/city/intent-guides-grid.tsx` |
| 4 | PopularCitiesForIntent component | `components/intent/popular-cities-for-intent.tsx` |
| 5 | New route structure | `app/[intent]/[state]/**` |
| 6 | Legacy redirect handler | `app/[intent]/[legacyCity]/route.ts` |
| 7 | Update sitemap | `app/sitemap.ts` |
| 8 | Update city hub pages | `app/beaches/[country]/[state]/[city]/page.tsx` |
| 9 | getTopCitiesInState function | `actions/beach/beach-location-actions.ts` |
| 10 | Remove old route | `app/[intent]/[city]/page.tsx` |
| 11 | Final verification | All files |
