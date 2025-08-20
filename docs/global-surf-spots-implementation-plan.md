## 📋 IMPLEMENTATION PLAN — Global Surf Spots (Typeahead + Hubs + Hierarchies)

This plan implements global surf spot support with a clean, fast, and scalable selection UX, seeded “Global Hubs,” and database/query enhancements. It follows Quiver’s documented architecture patterns and the visual/interaction standards in `docs/STYLE_GUIDE.md`.

### What I Need to Do

- Add global surf coverage with curated “Hubs,” hierarchical filters (Country → Region → Spot), and a high‑performance typeahead.
- Keep free‑typed input acceptance to preserve current flexibility.
- Update the database and indexes for fast global search, aliases, and future expansion.
- Provide a clean, minimal UI consistent with the brand style guide (semantic tokens, shadcn/ui, accessible interactions, motion standards).

### Milestone 1 — Buoy Association First (Execution Order)

1. Schema for station association
   - Add `tide_station`, distance columns, `primary_wave_source`, `station_updated_at` to `public.beaches` (idempotent migration).
   - Verify `buoys` table with coordinates exists; add indexes if needed.
2. Resolver services (server‑side only)
   - Use `CDIPService`, `getNearestNDBCStation`, and `getNearestTideStation` with configurable radii; respect overrides; enforce stale‑data TTLs.
3. Admin APIs
   - Extend existing single resolve endpoint; add bulk preview and assign endpoints with centralized API utils and proper auth.
4. Batch backfill
   - Script/admin job to resolve and persist stations for all beaches (rate‑limited, resumable), writing station ids and distances.
5. Transparency
   - Surface station name + distance in beach/forecast views; indicate fallback source when used.
6. Tests & docs
   - Unit/integration/E2E for resolution/overrides/TTL; update ARCHITECTURE docs and CHANGELOG.

### Files I’ll Need to Examine/Modify

- supabase/migrations/
  - New migration: columns (`country`, `region`, `popularity_score`, `is_hub`) + trigram/unaccent indexes + optional `beach_aliases` table, RLS
- supabase/migrations/
  - Buoy association columns: `tide_station`, `cdip_distance_km`, `ndbc_distance_km`, `tide_distance_km`, `primary_wave_source`, `station_updated_at`
- scripts/
  - Global seeds and idempotent loaders derived from `docs/global-surfing-hubs.md`
- app/api/beaches/
  - `route.ts` or new `search/route.ts`, `hubs/route.ts`, `countries/route.ts` endpoints using centralized API utils
- app/api/admin/resolve-stations/
  - Extend with bulk resolution endpoint and assign endpoint (admin‑only)
- actions/beach/beach-query-actions.ts
  - Add `searchBeaches`, `getHubs`, `getCountriesWithRegions`
- hooks/use-beach-search.ts
  - Refactor to use new API + `useDataFetcher` pattern with filters, debounce
- components/beach/
  - New `global-beach-combobox.tsx` (grouped, virtualized results; country/region filters)
- components/home-screen/beach-search-bar.tsx, components/session-forms/\*, components/map/beach-list.tsx
  - Replace old input/search flows with the new combobox + filters
- types/database.ts
  - Extend `Beach` type to include `country`, `region`, `popularity_score`, `is_hub`
- lib/map-utils.ts & lib/constants/beach-coordinates.ts
  - Prefer DB coordinates; keep hardcoded list as last‑resort fallback
- Documentation
  - `components/beach/ARCHITECTURE.md`, `app/api/ARCHITECTURE.md`, `hooks/ARCHITECTURE.md` updates
  - `CHANGELOG.md`

### Implementation Steps

1. Schema & Indexes (idempotent)

   - Add columns to `public.beaches` if missing:
     - `country text`, `region text`
     - `popularity_score integer default 0 not null`
     - `is_hub boolean default false not null`
   - Optional aliases table (improves search for nicknames):
     - `public.beach_aliases (id uuid pk, beach_id uuid fk, alias text unique)`
   - Enable extensions (safe if already present): `unaccent`, `pg_trgm`, `postgis`
   - Indexes for fast search and filters:
     - `create index if not exists beaches_name_trgm on public.beaches using gin ( (unaccent(lower(name))) gin_trgm_ops );`
     - `create index if not exists beaches_country_region on public.beaches (country, region);`
     - `create unique index if not exists beaches_name_region_unique on public.beaches (lower(name), lower(coalesce(region,'')), lower(coalesce(country,'')));`
     - If aliases: `create index if not exists beach_aliases_trgm on public.beach_aliases using gin ( (unaccent(lower(alias))) gin_trgm_ops );`
   - RLS: public read for non‑private beaches; owners/admins manage writes (follow existing RLS patterns).

2. Data Seeding (derived from `docs/global-surfing-hubs.md`)

   - Countries (phase 1): US, Australia, Brazil, France, Spain, Portugal, UK, Indonesia, Mexico, Costa Rica, Peru, South Africa, Morocco.
   - Regions per country (examples):
     - US: Southern California, Hawaii (Oʻahu North Shore)
     - AU: Gold Coast (QLD), NSW, Victoria
     - BR: Rio de Janeiro, São Paulo, Santa Catarina
     - FR: SW France (Biarritz/Hossegor/Landes)
     - ES/PT: Basque Country, Cantabria, Galicia, Lisbon/Cascais/Ericeira, Peniche
     - UK: SW England (Cornwall/Devon)
     - ID: Bali (Uluwatu/Padang/Kuta), Mentawai
     - MX: Baja California, Oaxaca, Nayarit
     - CR: Guanacaste (Tamarindo/Avellanas/Nosara), Puntarenas (Jaco/Hermosa/Santa Teresa)
     - PE: Lima, La Libertad (Chicama)
     - ZA: Western Cape (J‑Bay prox), KZN (Durban)
     - MA: Souss‑Massa (Taghazout/Agadir), Safi
   - Seed 10–30 representative spots per region. Mark key ones `is_hub = true` and set `popularity_score` to drive ranking.
   - Seed common aliases (e.g., Huntington/HB; Pacific Beach/PB; Barra da Tijuca/Barra; Uluwatu/Ulu). Deduplicate by `(lower(name), region, country)`.
   - Provide idempotent loaders under `scripts/` (SQL/JSON upserts).

3. API (App Router) — Centralized utils

   - `GET /api/beaches/search?q=&country=&region=&limit=20`
     - Returns grouped results: hubs first (if fuzzy match or region), then regional matches, then all.
     - Use `unaccent` + trigram similarity for flexible matching, fall back to ILIKE.
     - Use `createSuccessResponse` and `handleApiError` from `@/lib/api-utils`.
   - `GET /api/beaches/hubs?country=`
     - Curated hub list for quick entry and “quick pick” chips.
   - `GET /api/beaches/countries`
     - Countries → Regions map for cascading filters.
   - Reads are public; protected writes follow existing auth wrappers.

4. Actions (Server‑side)

   - `actions/beach/beach-query-actions.ts`
     - `searchBeaches(query, { country?, region?, limit? })`
     - `getHubs({ country? })`
     - `getCountriesWithRegions()`
   - Use standardized error handling and types. Memoize on the client with `useDataFetcher`.

5. Hooks — Required data fetching pattern

   - Refactor `hooks/use-beach-search.ts` to use:

     ```ts
     const fetchData = useCallback(async () => {
       return await searchBeaches(query, { country, region, limit });
     }, [query, country, region, limit]);

     const { data, loading, error, refetch } = useDataFetcher(fetchData);
     ```

   - Debounce `query` updates, expose grouped sections, and provide `setCountry`, `setRegion`, `clearFilters` helpers.

6. UI/UX — Clean, minimal, accessible combobox

   - New `components/beach/global-beach-combobox.tsx`:
     - Single input with grouped typeahead results: **Global Hubs**, **Selected Region**, **All Matches**.
     - Country and Region dropdowns above the list (cascading).
     - Virtualized list for performance; keyboard navigation; visible focus ring (brand blue `--ring`).
     - Quick‑pick chips for top hubs (per selected country or global default).
     - “Use ‘{query}’ anyway” option to accept free‑typed values when no match (preserves current flexible behavior).
   - Integrations:
     - Replace beach inputs in session forms, home search bar, and map list search.
     - Default filters from user profile when available; otherwise show hubs.

7. Visual/Interaction Design — `docs/STYLE_GUIDE.md` alignment

   - Typography: Roboto for headings, Open Sans for body; consistent sizes.
   - Color: semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`), `--primary` for focus rings and active states; minimal accent use.
   - Components: shadcn/ui inputs, labels, dropdowns; DRY form layout.
   - Motion: `fadeUpSlow`, small hover/press transitions (0.2–0.3s), respect reduced motion.
   - Accessibility: WCAG AA contrast, visible focus, keyboard‑first navigation, touch targets ≥44px.

8. Backward Compatibility

   - Keep direct beach ID flows intact.
   - Prefer DB coordinates; use hardcoded constants as fallback only.
   - Preserve acceptance of free‑typed beaches (required product preference).

9. Analytics

   - Track: search queries, filters, selection source (hub vs search vs free‑typed), zero‑result rates, selection success rate.
   - Use existing analytics actions; add events where needed.

10. Testing Strategy

- Unit: API query builders, ranking logic (hubs boosted), alias match coverage.
- Component: combobox (debounce, grouping, keyboard/ARIA, virtualization, “use anyway”).
- Integration: session planning/log flows choosing a spot; profile default beach interaction.
- E2E: home search, session forms, map selection—ensure fast interaction and no long scrolling.
- Follow existing test guidance for perf thresholds and robust API status expectations.

11. Phased Rollout

- Phase 1: Schema + indexes, hubs/countries/regions seeds, search API, combobox, replace in session forms and home search.
- Phase 2: Expand seeds (more spots), alias coverage, map search integration, analytics dashboards.
- Phase 3: Localization/internationalization, per‑country default units and date formats.

12. Risks & Mitigations

- Large dataset perf: mitigate with trigram/unaccent indexes, limits, pagination, and virtualization.
- Data quality/duplication: unique index by name/region/country; idempotent upserts; alias table for synonyms.
- UX complexity: keep filters optional; sensible defaults; hubs first to reduce effort.

13. Buoy Association (Wave & Tide Stations)

- Goals

  - Associate each beach with nearby wave and tide stations for real‑time and forecast transparency. Prefer CDIP where applicable; fall back to NDBC. Associate a NOAA CO‑OPS tide station for tides.

- Schema

  - Beaches already include `cdip_station`, `ndbc_station`. Add if missing:
    - `tide_station text`
    - `cdip_distance_km numeric`, `ndbc_distance_km numeric`, `tide_distance_km numeric`
    - `primary_wave_source text check (primary_wave_source in ('cdip','ndbc'))`
    - `station_updated_at timestamptz not null default now()`
  - Optional normalized table (future): `public.beach_stations (id, beach_id, source, station_id, distance_km, is_primary)` with unique `(beach_id, source, station_id)` and RLS.

- Resolution Logic

  - CDIP: use `CDIPService.getNearestStation(lat, lon, maxKm)` (region‑aware `maxKm`, e.g., 50–80 km in covered regions).
  - NDBC: use `getNearestNDBCStation(lat, lon, maxKm)` with cached `getActiveNDBCStations()`.
  - Tides: use `getNearestTideStation(lat, lon, maxKm)` from tide service.
  - Choose primary wave source: prefer CDIP if available within `maxKm`; else NDBC. Persist station ids and distances on beach rows; honor existing overrides (`cdip_station`, `ndbc_station`) when set.
  - Respect no‑stale‑data policy: if latest buoy observation is older than allowable TTL, mark conditions unavailable rather than returning stale data.

- APIs

  - Keep existing `GET /api/admin/resolve-stations?beachId=...` (single beach).
  - Add `GET /api/admin/resolve-stations/bulk?country=&region=&limit=` to preview suggested assignments with distances (admin‑only).
  - Add `POST /api/admin/assign-stations` to persist chosen stations and distances (admin‑only). Use centralized API utils and auth wrappers.

- Seeding & Jobs

  - During spot seeding, run a post‑seed resolver that batches station resolution and updates beach rows. Rate‑limit and cache station lists.
  - Add a periodic cron to re‑verify associations when beach coordinates change or stations are retired; update `station_updated_at` on changes.

- Transparency & UI

  - Show the station name and distance on spot/forecast views; indicate when using a fallback source.
  - Provide an admin UI to view/override associations per beach.

- Testing
  - Unit: nearest‑station selection logic (with/without overrides), distance calculations, TTL behavior for stale observations.
  - Integration: seeding pipeline populates station fields; admin bulk resolve assigns correctly.
  - E2E: forecast display shows associated station and handles fallback/no‑data states.

### Architecture Patterns I’ll Follow

- Data fetching: `useDataFetcher` with memoized `fetchData` to avoid infinite loops.
- API routes: `createSuccessResponse`, `handleApiError` with clear 400/404/405 handling.
- Server actions: authentication wrappers for protected writes; public reads for search.
- DRY UI: reusable combobox and filter components; consistent form layout.
- Realtime: no realtime subscriptions needed here; keep simple.

### Acceptance Criteria

- Users can quickly find spots worldwide without scrolling long lists.
- Country/Region filters narrow results; hubs appear prominently.
- Free‑typed inputs remain accepted with a clear “use anyway” path.
- Search is fast (<200ms server time on indexed queries for common filters; UI responsive with virtualization).
- All updated flows are accessible and match the style guide.
- Each beach has an associated primary wave station (CDIP or NDBC) and a tide station recorded with distance, or gracefully indicates none within range; stale observations are not surfaced.

### Post‑Implementation

- Update `CHANGELOG.md` with Added/Changed/Performance entries.
- Update directory `ARCHITECTURE.md` files to document the new patterns/components and endpoints.

—

Ready to proceed? Please review and approve or suggest changes (countries/regions prioritization, alias table in phase 1, default filter behavior for first‑time users).
