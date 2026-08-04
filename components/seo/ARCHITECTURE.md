# SEO structured-data architecture

## Purpose

SEO components emit route-specific JSON-LD. Schema eligibility is explicit: a
page should only claim an entity type that its visible content and source data
can support.

## Main components

```text
components/seo/
├── article-schema.tsx              # Article and BlogPosting
├── blog-schema.tsx                 # Blog collection
├── breadcrumb-schema.tsx           # BreadcrumbList
├── home-page-structured-data.tsx   # Organization/WebSite root graph wrapper
├── structured-data.tsx             # Beach Place schema
└── web-page-schema.tsx              # WebPage
```

The root layout calls `buildRootStructuredDataGraph()` directly. The homepage
wrapper uses the same builder when a component form is useful in tests or a
page surface.

## Root graph

`lib/seo/root-structured-data.ts` builds one object with a top-level
`@context` and an `@graph` containing only:

- `Organization`
- `WebSite`

Do not add `SoftwareApplication` to the root graph. Application rich-result
markup belongs only on an app-specific page with the required offer and real
rating or review data.

```tsx
const jsonLd = buildRootStructuredDataGraph();

<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
/>
```

## Beach pages

`BeachPageStructuredData` emits one `Place` object with coordinates, postal
context, and verified amenity flags.

Public beaches are not businesses. Do not emit `LocalBusiness`,
`SportsActivityLocation`, `sport`, or `AggregateRating` from this component.
Those properties make beach pages eligible for rich-result features whose
required business and review data Quiver cannot truthfully provide.

```tsx
<BeachPageStructuredData
  beachName={beach.name}
  description={description}
  latitude={beach.lat}
  longitude={beach.lon}
  city={beach.city}
  state={beach.state}
  country={beach.country}
  amenities={amenities}
/>
```

The root layout already supplies Organization and WebSite identity, so beach
components must not duplicate them.

## Application schema

Application schema is route-owned rather than globally configurable. Before
emitting `SoftwareApplication`, confirm the page supplies:

- an application-specific entity;
- a concrete `Offer` or `AggregateOffer` price and currency;
- a genuine `AggregateRating` or `Review` when Google requires one;
- values visible to users and backed by current source data.

Do not add placeholder ratings, reviews, prices, or third-party product claims
to satisfy a validator. If required data is unavailable, omit the application
schema.

## Other route schemas

- Use `BreadcrumbStructuredData` for visible navigation hierarchy.
- Use `WebPageSchema` for the page entity.
- Use `ArticleSchema` or `BlogSchema` only on editorial content.
- Use dataset schemas only when the page exposes the described dataset.
- Prefer a dedicated builder or component over a generic type selector.

All JSON-LD is server-rendered without client state or effects.

## Testing and validation

Relevant regression coverage lives in:

- `__tests__/lib/seo/structured-data.test.ts`
- `__tests__/components/seo/structured-data.test.tsx`
- `__tests__/app/ahrefs-structured-data-regressions.test.ts`

Tests must assert the emitted semantic object, including prohibited entity
types, instead of only checking that a JSON-LD script exists. Before shipping
schema changes, run the focused unit tests, TypeScript, ESLint, a production
build, and validate representative rendered URLs with Google Rich Results,
Schema.org, and the next Ahrefs crawl.
