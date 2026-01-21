# Intent Page Linking Architecture Design

**Date:** 2026-01-20
**Status:** Ready for implementation
**Scope:** Fix orphan intent pages via hub-centric SEO architecture

---

## Problem Statement

150+ intent pages are orphaned (exist in sitemap but have no incoming internal links):
- State-level: `/sunset/ca`, `/dawn-patrol/hi`, `/tide/fl`, etc.
- City-level: `/sunset/newport-beach`, `/longboard/malibu`, etc.

These pages are only discoverable via sitemap, which is poor for SEO and user navigation.

---

## Solution: Hub-Centric Link Architecture

City hub pages (`/beaches/usa/ca/san-diego`) become the authoritative source, linking to ALL 7 intent pages for that city.

### Link Flow
```
City Hub (authority)
    ↓ links to all 7
City Intent Pages (/beginner/ca/san-diego)
    ↓ cross-links + up-links
State Intent Pages (/beginner/ca)
    ↓ links down to
Popular City Intent Pages
```

### Success Criteria
- Every intent page has ≥1 inbound link from a relevant hub
- Crawl paths are obvious on inspection
- 0 intent pages are orphaned

---

## URL Structure Migration (Breaking Change)

### Current (Ambiguous)
```
State:  /{intent}/{state}     → /beginner/ca
City:   /{intent}/{citySlug}  → /beginner/san-diego
```

### New (Clean)
```
State:  /{intent}/{state}        → /beginner/ca
City:   /{intent}/{state}/{city} → /beginner/ca/san-diego
```

### Route Files
```
app/
  [intent]/
    [state]/
      page.tsx              # State intent page
      [city]/
        page.tsx            # City intent page
    [legacyCity]/
      route.ts              # 301 redirect handler
```

---

## Component: Intent Definitions (Source of Truth)

**File:** `lib/constants/intent-definitions.ts`

```typescript
export const INTENT_GROUPS = {
  session: 'Session',
  style: 'Style',
} as const;

export type IntentGroupKey = keyof typeof INTENT_GROUPS;

type IntentDefinition = {
  key: string;
  label: string;
  description: string;
  group: IntentGroupKey;
};

export const INTENT_DEFINITIONS = [
  // SESSION GROUP
  { key: 'dawn-patrol', label: 'Dawn Patrol', description: 'Best early morning sessions', group: 'session' },
  { key: 'sunset', label: 'Sunset Sessions', description: 'Evening golden hour spots', group: 'session' },
  { key: 'tide', label: 'Tide Windows', description: 'Optimal tidal conditions', group: 'session' },
  // STYLE GROUP
  { key: 'beginner', label: 'Beginner Spots', description: 'Gentle waves for learning', group: 'style' },
  { key: 'longboard', label: 'Longboard Spots', description: 'Mellow waves for logging', group: 'style' },
  { key: 'least-crowded', label: 'Less Crowded', description: 'Quieter lineups & backups', group: 'style' },
  { key: 'water-temp', label: 'Water Temperature', description: 'Conditions & wetsuit guide', group: 'style' },
] as const satisfies readonly IntentDefinition[];

export type IntentKey = (typeof INTENT_DEFINITIONS)[number]['key'];
export type IntentDefinitionType = (typeof INTENT_DEFINITIONS)[number];

export const INTENTS_BY_GROUP = {
  session: INTENT_DEFINITIONS.filter(i => i.group === 'session'),
  style: INTENT_DEFINITIONS.filter(i => i.group === 'style'),
} as const;

// URL builders - single source of truth
export const buildStateIntentUrl = (intent: IntentKey, stateSlug: string) =>
  `/${intent}/${stateSlug}`;

export const buildCityIntentUrl = (intent: IntentKey, stateSlug: string, citySlug: string) =>
  `/${intent}/${stateSlug}/${citySlug}`;

export const buildCityHubUrl = (stateSlug: string, citySlug: string) =>
  `/beaches/usa/${stateSlug}/${citySlug}`;

// For redirects: parse old collision-aware slugs
export const parseOldCitySlug = (slug: string): { city: string; state?: string } | null => {
  if (!slug) return null;
  const stateMatch = slug.match(/-([a-z]{2})$/);
  if (stateMatch) {
    return { city: slug.slice(0, -3), state: stateMatch[1] };
  }
  return { city: slug };
};
```

---

## Component: IntentGuidesGrid

**File:** `components/city/intent-guides-grid.tsx`

Displays all 7 intent links on city hub pages, organized by category.

```typescript
import Link from 'next/link';
import {
  INTENTS_BY_GROUP,
  INTENT_GROUPS,
  buildCityIntentUrl,
  type IntentDefinitionType,
} from '@/lib/constants/intent-definitions';

interface IntentGuidesGridProps {
  citySlug: string;
  cityName: string;
  stateSlug: string;
  stateAbbrev?: string;
}

export function IntentGuidesGrid({
  citySlug,
  cityName,
  stateSlug,
  stateAbbrev,
}: IntentGuidesGridProps) {
  const displayName = stateAbbrev ? `${cityName}, ${stateAbbrev}` : cityName;

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-semibold">Surf Guides for {displayName}</h2>

      {/* SESSION group */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {INTENT_GROUPS.session}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {INTENTS_BY_GROUP.session.map((intent) => (
            <IntentCard key={intent.key} intent={intent} stateSlug={stateSlug} citySlug={citySlug} />
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
            <IntentCard key={intent.key} intent={intent} stateSlug={stateSlug} citySlug={citySlug} />
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
  const href = buildCityIntentUrl(intent.key as any, stateSlug, citySlug);

  return (
    <Link
      href={href}
      className="block p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
      aria-label={`${intent.label} surf guide for ${citySlug}`}
    >
      <div className="font-medium">{intent.label}</div>
      <div className="text-sm text-muted-foreground line-clamp-2">{intent.description}</div>
    </Link>
  );
}
```

**Placement:** City hub pages (`/beaches/usa/[state]/[city]`) after beach listings.

---

## Component: PopularCitiesForIntent

**File:** `components/intent/popular-cities-for-intent.tsx`

On state intent pages, shows links to top city intent pages (crawl loop backstop).

```typescript
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
  cities: CityLink[];  // Top 8, sorted by beach count
}

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
      <h2 className="text-lg font-semibold">
        Popular cities for {intentLabel} in {stateName}
      </h2>
      <ul className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {cities.map((city) => (
          <li key={city.slug}>
            <Link
              href={buildCityIntentUrl(intentKey, stateSlug, city.slug)}
              className="block p-3 rounded-md border hover:bg-accent transition-colors"
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

**Data:** Query top 8 cities in state by beach count.

---

## Redirect Handler (Legacy URLs)

**File:** `app/[intent]/[legacyCity]/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { INTENT_DEFINITIONS } from '@/lib/constants/intent-definitions';
import {
  lookupCityBySlug,
  lookupCityByCityAndStateSlug,
  isValidStateSlug
} from '@/actions/beach/beach-location-actions';
import { parseOldCitySlug } from '@/lib/constants/intent-definitions';

const VALID_INTENT_KEYS = INTENT_DEFINITIONS.map(i => i.key);

export async function GET(
  request: Request,
  { params }: { params: { intent: string; legacyCity: string } }
) {
  const intent = params.intent.toLowerCase();
  const legacyCity = params.legacyCity.toLowerCase();

  // Not a valid intent
  if (!VALID_INTENT_KEYS.includes(intent as any)) {
    return new NextResponse(null, { status: 404 });
  }

  // Known state slug → let new route handle it
  if (isValidStateSlug(legacyCity)) {
    return new NextResponse(null, { status: 404 });
  }

  // Parse collision-aware slug
  const parsed = parseOldCitySlug(legacyCity);
  if (!parsed) {
    return new NextResponse(null, { status: 404 });
  }

  // Look up city
  const city = parsed.state
    ? await lookupCityByCityAndStateSlug(parsed.city, parsed.state)
    : await lookupCityBySlug(parsed.city);

  if (!city || !city.stateSlug) {
    return new NextResponse(null, { status: 404 });
  }

  // Loop guard
  const targetPath = `/${intent}/${city.stateSlug}/${city.slug}`;
  if (`/${intent}/${legacyCity}` === targetPath) {
    return new NextResponse(null, { status: 404 });
  }

  // 301 redirect preserving querystring
  const newUrl = new URL(targetPath, request.url);
  newUrl.search = new URL(request.url).search;
  return NextResponse.redirect(newUrl, { status: 301 });
}
```

---

## SEO Checklist

| Item | Location | Action |
|------|----------|--------|
| Canonical tags | `[intent]/[state]/[city]/page.tsx` | Self-canonical to new URL |
| Sitemap | `app/sitemap.ts` | Emit only new URL format |
| Structured data | Breadcrumb schema | Update URLs in BreadcrumbList |
| Internal links | All components using intent URLs | Update to new builders |
| robots.txt | Root | Verify no conflicting rules |
| HTTP status validation | Legacy URLs | Ensure 301 (not 307/308) |
| Sitemap/canonical consistency | All URLs | Every sitemap URL → 200 + self-canonical |
| Search Console | Post-deploy | Monitor redirect processing, submit updated sitemap |

---

## Implementation Order

1. Create `lib/constants/intent-definitions.ts` (source of truth)
2. Create new route files: `[intent]/[state]/page.tsx`, `[intent]/[state]/[city]/page.tsx`
3. Create `IntentGuidesGrid` component
4. Create `PopularCitiesForIntent` component
5. Create redirect handler: `[intent]/[legacyCity]/route.ts`
6. Add `isValidStateSlug` and `lookupCityByCityAndStateSlug` functions
7. Update sitemap to emit new URLs only
8. Add `IntentGuidesGrid` to city hub pages
9. Add `PopularCitiesForIntent` to state intent pages
10. Update all existing intent URL references to use new builders
11. Add canonical tags and update structured data
12. Deploy, monitor Search Console

---

## Out of Scope (Logged Follow-ups)

These are explicitly NOT part of this effort:

1. **Threshold policy** - Whether cities with 1-2 beaches should get hub pages (product decision)
2. **International navigation** - Mexico `/beaches/mexico` hierarchy (foundational work)
3. **Stale sitemap cleanup** - Remove Waimea/Hapuna entries that don't exist in DB

---

## Appendix: Crawl Loop Visualization

```
                    ┌──────────────────┐
                    │  State Intent    │
                    │  /beginner/ca    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │ City Intent │  │ City Intent │  │ City Intent │
    │ /beginner/  │  │ /beginner/  │  │ /beginner/  │
    │ ca/san-diego│  │ ca/malibu   │  │ ca/ventura  │
    └──────┬──────┘  └──────┬──────┘  └──────┬──────┘
           │                │                │
           ▼                ▼                ▼
    ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
    │  City Hub   │  │  City Hub   │  │  City Hub   │
    │ /beaches/   │  │ /beaches/   │  │ /beaches/   │
    │ usa/ca/     │  │ usa/ca/     │  │ usa/ca/     │
    │ san-diego   │  │ malibu      │  │ ventura     │
    └─────────────┘  └─────────────┘  └─────────────┘
           │                │                │
           └────────────────┴────────────────┘
                            │
                   Links to all 7 intents
                   (IntentGuidesGrid)
```
