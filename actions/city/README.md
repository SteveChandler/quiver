# City Editorial Actions API

Server actions for fetching curated editorial content on city surf guide pages.

## Overview

The city editorial actions provide a simple API for retrieving editorial content associated with city pages. This includes session timing advice, quick navigation links, planning checklists, and rich editorial descriptions.

These server actions are designed to be called from Next.js Server Components or Client Components, with full type safety and error handling.

## Functions

### getCityEditorialContent

Fetches the complete editorial content for a city page. Returns null if no editorial content exists for the specified location.

**Signature:**

```typescript
async function getCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<CityEditorialContent | null>
```

**Parameters:**

- `citySlug` (required): City slug identifier (e.g., "san-diego", "orange-county")
- `stateSlug` (optional): State slug identifier (e.g., "ca", "or") - defaults to "ca"
- `countrySlug` (optional): Country slug identifier (e.g., "usa") - defaults to "usa"

**Returns:**

`CityEditorialContent | null` - Full editorial content object or null if not found

**Example:**

```typescript
import { getCityEditorialContent } from "@/actions/city/city-editorial-actions";

// In a Server Component
export default async function CityPage({ params }) {
  const editorial = await getCityEditorialContent(
    params.city,
    params.state,
    params.country
  );

  if (!editorial) {
    return <FallbackCityLayout />;
  }

  return (
    <div>
      <h1>{editorial.city_name}</h1>
      <p>{editorial.region_label}</p>
      {/* Render editorial modules */}
    </div>
  );
}
```

### hasCityEditorialContent

Checks if editorial content exists for a city without fetching the full content. Useful for determining layout strategy or conditional rendering before performing the full data fetch.

**Signature:**

```typescript
async function hasCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<boolean>
```

**Parameters:**

- `citySlug` (required): City slug identifier
- `stateSlug` (optional): State slug identifier - defaults to "ca"
- `countrySlug` (optional): Country slug identifier - defaults to "usa"

**Returns:**

`boolean` - `true` if editorial content exists, `false` otherwise

**Example:**

```typescript
import { hasCityEditorialContent } from "@/actions/city/city-editorial-actions";

// Check before loading heavy editorial components
export default async function CityLayout({ params }) {
  const hasEditorial = await hasCityEditorialContent(params.city);

  return (
    <div className={hasEditorial ? "editorial-layout" : "simple-layout"}>
      {/* Conditional rendering based on result */}
    </div>
  );
}
```

## Types

### CityEditorialContent

The complete editorial content object returned by `getCityEditorialContent`.

```typescript
interface CityEditorialContent {
  id: string;
  city_slug: string;
  state_slug: string;
  country_slug: string;
  city_name: string;
  region_label: string;
  description: string[];
  session_timing: SessionTimingModule[];
  quick_links: QuickLink[];
  featured_intents: string[];
  planning_checklist: string[];
  created_at: string;
  updated_at: string;
}
```

### SessionTimingModule

Tactical surf advice for different time horizons (Today, Now, Weekend).

```typescript
interface SessionTimingModule {
  icon: "sun" | "clock" | "calendar";
  title: string;
  summary: string;
}
```

**Example:**

```json
{
  "icon": "sun",
  "title": "Today",
  "summary": "Check the forecast and watch the tide flip around mid-morning."
}
```

### QuickLink

Navigation shortcuts to related city pages.

```typescript
interface QuickLink {
  label: string;
  href: string;
}
```

**Example:**

```json
{
  "label": "San Diego surf map",
  "href": "/map?city=san-diego"
}
```

## Error Handling

Both functions include built-in error handling and logging. Errors are logged to the console but do not throw exceptions:

**getCityEditorialContent:**
- Database errors → Returns `null`, logs error to console
- No data found → Returns `null`
- Invalid JSONB parsing → Attempts to parse, falls back to empty arrays

**hasCityEditorialContent:**
- Database errors → Returns `false`, logs error to console
- No data found → Returns `false`

**Example error handling:**

```typescript
const editorial = await getCityEditorialContent("san-diego");

if (!editorial) {
  // Could be: no editorial content, database error, or missing city
  console.log("No editorial content available, rendering fallback");
  return <SimpleCityView />;
}

// Safe to use editorial content
return <EditorialCityView editorial={editorial} />;
```

## JSONB Field Parsing

The functions automatically handle JSONB field parsing for `session_timing` and `quick_links`:

- If the database returns strings, they are parsed as JSON
- If parsing fails or data is missing, defaults to empty arrays
- This ensures type-safe consumption in components

## Usage Patterns

### Conditional Layout Rendering

```typescript
export default async function CityPage({ params }) {
  const editorial = await getCityEditorialContent(
    params.city,
    params.state,
    params.country
  );

  if (editorial) {
    return (
      <>
        <CityMapView cityName={editorial.city_name} />
        <QuickActionsBar links={editorial.quick_links} />
        <SessionTimingModules modules={editorial.session_timing} />
        <AboutAccordion description={editorial.description} />
      </>
    );
  }

  // Fallback: simple beach list
  return <BeachList />;
}
```

### Performance Optimization

```typescript
// Check existence before heavy data operations
const hasEditorial = await hasCityEditorialContent("san-diego");

if (hasEditorial) {
  // Only fetch full editorial and related data if it exists
  const [editorial, beaches, weather] = await Promise.all([
    getCityEditorialContent("san-diego"),
    getBeaches("san-diego"),
    getWeather("san-diego"),
  ]);
}
```

### Default Parameters

```typescript
// Full parameters (explicit)
await getCityEditorialContent("san-diego", "ca", "usa");

// With defaults (California, USA assumed)
await getCityEditorialContent("san-diego");

// Different state
await getCityEditorialContent("newport", "or", "usa");
```

## Database Integration

These actions use the `get_city_editorial` RPC function in Supabase, which performs a case-insensitive lookup:

```sql
SELECT * FROM get_city_editorial('san-diego', 'ca', 'usa');
```

**Database Table:** `city_editorial_content`

**RLS Policies:**
- Public read access (editorial content is public)
- Admin-only write access (via service role or admin users)

## Related Documentation

- [City Editorial Content Feature](/docs/features/CITY_EDITORIAL_CONTENT.md) - Complete feature documentation and content guidelines
- [City Components Architecture](/components/city/ARCHITECTURE.md) - City page component structure
- [URL Routing](/docs/architecture/URL_ROUTING.md) - City page URL structure and routing

## Migration Notes

Editorial content is stored in the `city_editorial_content` table created by migration:

```
supabase/migrations/20251204030000_create_city_editorial_content.sql
```

To add editorial content for a new city, see the "Adding Editorial Content" section in the [City Editorial Content Feature](/docs/features/CITY_EDITORIAL_CONTENT.md) documentation.
