# Beach indexing eligibility

Beach catalog readiness, recommendation readiness, and search-engine indexing are separate release gates. Passing one does not imply the others.

| Gate | Purpose | Minimum result |
| --- | --- | --- |
| Catalog readiness | Allows a beach to exist in Quiver search, maps, and beach detail surfaces | Stable identity, usable locality and coordinates, timezone, active/public status, and safe display defaults |
| Recommendation readiness | Allows the recommendation system to score the beach | Skill floor, swell window, wind inputs, and either sourced tide guidance or an explicit neutral-tide policy |
| Editorial SEO eligibility | Allows the main beach editorial page to be indexed | Human approval, reviewed sources, and substantive location-specific content |

## Editorial beach-page gate

The database defaults `beaches.seo_indexable` to `false`. Set it to `true` only after a human SEO/editorial review confirms all of the following:

1. `editorial_reviewed_at` records the completed review.
2. `editorial_sources` contains at least one source with a URL, publisher, and retrieval timestamp.
3. The beach has a non-empty description.
4. At least one of `crowd_tips`, `wave_tips`, or `best_conditions_prose` contains substantive location-specific guidance.
5. The canonical beach identity and route are not duplicates or aliases of another page.
6. Coordinate, access, hazard, and media claims do not exceed their evidence. Generalized map pins and illustrative AI media must be disclosed and must not be presented as exact access or documentary evidence.
7. The rendered page has been checked for source attribution, generated-media disclosure, useful differentiation from nearby pages, and production-like routing.

The runtime contract is implemented in `lib/seo/indexability.ts`. If the review flag, reviewed timestamp, sources, or substantive content is missing, the main beach page remains unproven and receives noindex behavior. GSC-protected legacy routes are the explicit exception.

## Forecast-page gate

Forecast pages use a separate live-data contract. They require a valid canonical route plus an available, complete, fresh, non-quarantined forecast. Editorial approval does not substitute for missing forecast data, and forecast readiness does not automatically approve the main editorial beach page.

## Import policy

New bulk beach imports should default to `seo_indexable = false`, even when every record is recommendation-ready. The import package must document why the flag remains off and identify the later review needed to enable it. SEO activation should be a separate reviewed migration so catalog/recommendation rollout can proceed without implicitly publishing uncertain or repetitive pages to search engines.
