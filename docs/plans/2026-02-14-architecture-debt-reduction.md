# Architecture Debt Reduction Plan

**Date:** 2026-02-14
**Status:** Ready for Implementation
**Estimated Total Duration:** 24 weeks (4 workstreams running in parallel)
**Methodology:** TDD -- every workstream writes failing tests first, then implements

---

## Workstream Overview

Four independent workstreams that can execute **simultaneously** with minimal cross-dependencies.

```
Week  1  2  3  4  5  6  7  8  9  10 11 12 13 14 15 16 ... 24
WS-A  [==========]                                            Connection Pool Monitoring
WS-B        [==========================]                      Forecast Column Deprecation
WS-C              [==========================================] Coordinate Schema Migration
WS-D  [===============================================================] State Mgmt Consolidation
```

### Dependency Map

```
WS-A (Connection Pool)  -- fully independent, no blockers
WS-B (Forecast Columns) -- fully independent, no blockers
WS-C (Coordinates)      -- fully independent, no blockers
WS-D (State Management) -- fully independent, no blockers

Cross-workstream sync point:
  - WS-B Phase 4 (drop columns) and WS-C Phase 6 (drop columns) should
    NOT run in the same week to limit blast radius of schema changes.
```

---

## WS-A: Connection Pool Monitoring & Configuration

**Duration:** 3 weeks
**Agent:** `supabase-db-expert`
**Risk:** Low
**Research:** `docs/research/supabase-connection-pooling-research.md`

### A.1 -- Verify Transaction Mode (Week 1, Day 1)

**TDD:**
```
1. Write test: assert DATABASE_URL uses port 6543
2. Write test: assert server-side Supabase clients set persistSession: false
3. Write test: assert no singleton pattern in server client creation
4. Run tests (expect failures on any misconfiguration)
5. Fix configuration
6. Tests pass
```

**Tasks:**
- [ ] Write Jest test in `lib/__tests__/supabase-client-config.test.ts` that imports server/client creation functions and asserts correct configuration patterns
- [ ] Audit `lib/supabase/server.ts` -- verify `createServerClient` follows Supabase SSR docs (no singleton, `getAll`/`setAll` cookies)
- [ ] Audit `lib/supabase/client.ts` -- verify `createBrowserClient` uses singleton pattern
- [ ] Verify Vercel env var `DATABASE_URL` uses `pooler.supabase.com:6543` (transaction mode)
- [ ] If any direct connections exist (port 5432), document why and whether they can migrate

**Acceptance:** All config tests green. Transaction mode confirmed in production.

### A.2 -- Connection Monitoring Dashboard (Week 1-2)

**TDD:**
```
1. Write test: monitoring SQL functions return expected shape
2. Write test: API route /api/admin/connections returns pool stats
3. Implement monitoring queries
4. Implement API route
5. Tests pass
```

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_add_connection_monitoring_functions.sql`:
  ```sql
  -- Function: get_connection_stats()
  -- Returns: current_connections, max_connections, utilization_percent,
  --          idle_count, active_count, by_role breakdown
  ```
- [ ] Write Jest tests for the monitoring function return shape
- [ ] Create API route `app/api/admin/connections/route.ts` using `withAuth` wrapper
- [ ] Write Playwright E2E test: admin can view connection stats page
- [ ] Add connection stats to existing admin dashboard (if one exists) or create `/admin/connections` page

**Acceptance:** Connection utilization visible in admin UI. Tests green.

### A.3 -- Alerting & Documentation (Week 2-3)

**Tasks:**
- [ ] Configure Sentry alert rule: trigger on `"Max client connections"` or `"too many clients"` error messages
- [ ] Add `pg_stat_activity` monitoring query to the `ml-stats` or `dashboard` skill
- [ ] Document connection pool limits and upgrade thresholds in `docs/CONNECTION_POOL_GUIDE.md`:
  - Current plan limits (Free: 60 direct / 200 pooled)
  - Warning threshold: 60% utilization (120 connections)
  - Critical threshold: 80% utilization (160 connections)
  - Upgrade trigger: sustained >60% utilization
  - Cost: Pro + Small = ~$35/mo for 400 pooled connections
- [ ] Add `withConnectionRetry` utility to `lib/api-utils.ts` (exponential backoff on connection exhaustion)
- [ ] Write unit tests for `withConnectionRetry` (success, retry on connection error, max retries exceeded)

**Acceptance:** Sentry alerts configured. Retry utility tested. Documentation complete.

---

## WS-B: Forecast Column Deprecation (`forecast_date` / `forecast_time`)

**Duration:** 6 weeks
**Agent:** `supabase-db-expert` (migrations), `fullstack-engineer` (app code)
**Risk:** Medium
**Research:** `docs/research/DATABASE_COLUMN_DEPRECATION_RESEARCH.md`, `docs/research/FORECAST_COLUMN_DEPRECATION_CHECKLIST.md`

### B.1 -- Audit Current Usage (Week 1)

**TDD:**
```
1. Write grep-based audit test: zero application code writes to forecast_date/forecast_time
2. Run test -- expect it to find violations (or confirm zero)
3. Fix any code still writing to deprecated columns
4. Test passes
```

**Tasks:**
- [ ] Write shell script `scripts/audit-deprecated-columns.sh` that greps for `forecast_date` and `forecast_time` in app code (excluding migrations, docs, tests)
- [ ] Create migration `YYYYMMDDHHMMSS_add_deprecated_column_audit.sql`:
  - Create `audit` schema
  - Create `audit.deprecated_column_access` table
  - Create audit trigger on `forecasts` table
  - See research doc Phase 1 for exact SQL
- [ ] Apply migration to dev, monitor for 3+ days
- [ ] Fix any code paths still writing to deprecated columns (update to use `forecast_at`)
- [ ] Write Jest test asserting audit trigger captures writes correctly (test against local Supabase)

**Acceptance:** Audit trigger deployed. Zero writes to deprecated columns for 3+ consecutive days.

### B.2 -- Block Writes + TypeScript Safety (Week 2-3)

**TDD:**
```
1. Write test: inserting forecast_date into forecasts table raises exception
2. Write test: inserting forecast_time into forecasts table raises exception
3. Write test: inserting forecast_at succeeds
4. Write TypeScript compilation test: ForecastInsert type excludes deprecated fields
5. Deploy blocking trigger
6. Tests pass
```

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_block_deprecated_forecast_columns.sql`:
  - Drop audit trigger (replace with blocking trigger)
  - Create `prevent_deprecated_forecast_column_writes()` function
  - BEFORE trigger raises EXCEPTION with helpful message
  - See research doc Phase 2 for exact SQL
- [ ] Create `lib/types/forecast-safe.ts`:
  ```typescript
  export type ForecastSafe = Omit<Forecast, 'forecast_date' | 'forecast_time'>;
  export type ForecastInsert = Omit<ForecastInsertRaw, 'forecast_date' | 'forecast_time'>;
  ```
- [ ] Write type-level test (tsd or ts-expect-error) confirming deprecated fields rejected
- [ ] Update `CLAUDE.md` to reference `ForecastSafe` type
- [ ] Monitor for trigger exceptions for 7+ days

**Acceptance:** Write-blocking trigger active. TypeScript types enforce deprecation. Zero exceptions for 7 days.

### B.3 -- Make Nullable + Column Comments (Week 3-4)

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_make_deprecated_columns_nullable.sql`:
  - `ALTER COLUMN forecast_date DROP NOT NULL, SET DEFAULT NULL`
  - `ALTER COLUMN forecast_time DROP NOT NULL, SET DEFAULT NULL`
  - Add `COMMENT ON COLUMN` documenting deprecation
- [ ] Write SQL test verifying columns are nullable post-migration
- [ ] Wait 7+ days before Phase B.4

**Acceptance:** Columns nullable. Comments visible in schema inspection.

### B.4 -- Drop Columns (Week 5-6)

**Prerequisites:** B.3 complete for 14+ days. Fresh backup taken.

**TDD:**
```
1. Write test: forecasts table schema does NOT include forecast_date or forecast_time
2. Write test: all app queries using forecast_at work correctly
3. Write E2E test: forecast page loads without errors
4. Apply drop migration
5. Regenerate TypeScript types
6. All tests pass
```

**Tasks:**
- [ ] Take manual database backup via Supabase dashboard
- [ ] Create migration `YYYYMMDDHHMMSS_drop_deprecated_forecast_columns.sql`:
  - Drop blocking trigger and function
  - `ALTER TABLE forecasts DROP COLUMN forecast_date, DROP COLUMN forecast_time`
- [ ] Regenerate TypeScript types: `npx supabase gen types typescript`
- [ ] Remove `lib/types/forecast-safe.ts` (no longer needed -- types are clean)
- [ ] Search codebase for `ForecastSafe` and revert to standard `Forecast` type
- [ ] Run full test suite (Jest + Playwright)
- [ ] Update `CHANGELOG.md`

**Acceptance:** Columns dropped. Types regenerated. All tests pass. No regressions for 24h.

### B.5 -- Data Retention (Parallel with B.1-B.4)

**TDD:**
```
1. Write test: forecast_daily_aggregates table exists and has correct schema
2. Write test: pg_cron jobs are scheduled
3. Write test: aggregation produces expected row count for a given day
4. Deploy retention migrations
5. Tests pass
```

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_add_forecast_retention_policies.sql`:
  - Create `forecast_daily_aggregates` table (beach_id, date, avg/max wave stats)
  - Schedule daily aggregation via `pg_cron` (2am)
  - Schedule weekly deletion of forecasts >90 days (Sunday 3am)
  - Schedule monthly deletion of aggregates >2 years (1st of month 4am)
  - Set aggressive autovacuum on `forecasts` table
  - See research doc Phase 5 Option A for exact SQL
- [ ] Write monitoring query tests for cron job health
- [ ] Add cron job status to `dashboard` skill
- [ ] Verify after 24h: `forecast_daily_aggregates` has yesterday's data
- [ ] Verify after 1 week: cron jobs show 100% success rate

**Acceptance:** Retention policy active. Table growth bounded. Cron jobs healthy.

---

## WS-C: Coordinate Schema Migration (`center_lat`/`center_lng` -> `latitude`/`longitude`)

**Duration:** 9 weeks
**Agent:** `supabase-db-expert` (migrations), `fullstack-engineer` (app code), `react-nextjs-expert` (components)
**Risk:** Medium-High (many code touchpoints)
**Research:** `docs/COORDINATE_COLUMN_MIGRATION_RESEARCH.md`

### C.1 -- Branded Types + Validation (Week 1-2)

**TDD:**
```
1. Write test: latitude(32.7) returns Latitude type
2. Write test: latitude(200) throws RangeError
3. Write test: longitude(-117) returns Longitude type
4. Write test: longitude(300) throws RangeError
5. Write test: createPoint(lon, lat) fails type check (compile-time)
6. Implement branded types
7. Tests pass
```

**Tasks:**
- [ ] Create `types/coordinates.ts` with branded `Latitude` and `Longitude` types
  - Smart constructors: `latitude(n)`, `longitude(n)` with range validation
  - Type guards: `isLatitude(n)`, `isLongitude(n)`
  - Assertion functions: `assertLatitude(n)`, `assertLongitude(n)`
  - Coordinate pair: `coordinates(lat, lon)` factory
  - See research doc Section 8 for implementation
- [ ] Write comprehensive Jest tests in `types/__tests__/coordinates.test.ts`:
  - Valid values pass (boundary: -90, 0, 90 for lat; -180, 0, 180 for lon)
  - Invalid values throw (NaN, Infinity, out of range)
  - Type-level tests with `@ts-expect-error` for swap prevention
- [ ] Integrate with existing `lib/coordinate-validation.ts` (`assertValidCoordinates`)
- [ ] Update `docs/COORDINATE_CONVENTIONS.md` to reference branded types

**Acceptance:** Branded types available. Full test coverage. Documentation updated.

### C.2 -- Expand: Add New Columns (Week 2-3)

**TDD:**
```
1. Write SQL test: beaches table has latitude and longitude columns
2. Write SQL test: spatial index exists on new columns
3. Write SQL test: CHECK constraint validates coordinate ranges
4. Apply migration
5. Tests pass
```

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_add_coordinate_columns.sql`:
  ```sql
  ALTER TABLE beaches
    ADD COLUMN latitude DOUBLE PRECISION,
    ADD COLUMN longitude DOUBLE PRECISION;

  CREATE INDEX idx_beaches_location_new ON beaches
    USING GIST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography)
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
  ```
- [ ] Create migration `YYYYMMDDHHMMSS_backfill_coordinates.sql`:
  ```sql
  UPDATE beaches SET latitude = center_lat, longitude = center_lng
    WHERE latitude IS NULL;
  ALTER TABLE beaches ALTER COLUMN latitude SET NOT NULL;
  ALTER TABLE beaches ALTER COLUMN longitude SET NOT NULL;
  ADD CONSTRAINT check_coordinates CHECK (latitude BETWEEN -90 AND 90 AND longitude BETWEEN -180 AND 180);
  ```
- [ ] Write SQL tests verifying backfill correctness: `latitude = center_lat` for all rows
- [ ] Verify spatial index is used: `EXPLAIN ANALYZE` on nearby-beach query

**Acceptance:** New columns populated. Indexes created. Constraints enforced.

### C.3 -- Dual-Write in Application (Week 3-5)

**TDD:**
```
1. Write test: beach INSERT writes to both center_lat AND latitude
2. Write test: beach UPDATE writes to both center_lng AND longitude
3. Write test: new and old columns stay in sync after write
4. Update all write paths
5. Tests pass
```

**Tasks:**
- [ ] Audit all beach write operations (grep for `from('beaches').insert`, `from('beaches').update`, `from('beaches').upsert`)
- [ ] Update each write to dual-write both old and new columns
- [ ] Write integration tests verifying both column sets are populated after writes
- [ ] Deploy and monitor for 1-2 weeks
- [ ] Verify: `SELECT COUNT(*) FROM beaches WHERE latitude != center_lat OR longitude != center_lng` returns 0

**Acceptance:** All writes populate both column sets. Zero drift between old and new columns.

### C.4 -- Read Switch: Application Uses New Columns (Week 5-8)

**TDD:**
```
1. For EACH component using center_lat/center_lng:
   a. Write test asserting component renders with latitude/longitude props
   b. Update component to use new props
   c. Test passes
2. For EACH hook/action using center_lat/center_lng:
   a. Write test asserting function returns latitude/longitude
   b. Update function
   c. Test passes
```

**Tasks:**
- [ ] Audit all reads: grep for `center_lat`, `center_lng`, `beach.center_lat`, `beach.center_lng`
- [ ] Create tracking spreadsheet/checklist of every file needing updates
- [ ] Migrate reads in priority order:
  1. **Map components** (highest risk -- visible to users)
  2. **API routes** (data layer)
  3. **Server actions** (data layer)
  4. **Hooks** (abstraction layer)
  5. **UI components** (presentation layer)
  6. **Tests** (update assertions)
- [ ] For each file:
  - Write/update test FIRST (TDD)
  - Update code to use `latitude`/`longitude`
  - Use branded types at system boundaries
  - Run tests
- [ ] Update `.select()` queries to use `latitude, longitude` instead of `center_lat, center_lng`
- [ ] Run full Playwright E2E suite -- especially map-related tests
- [ ] Verify map markers render in correct positions

**Acceptance:** Zero references to `center_lat`/`center_lng` in application code (excluding migrations, docs). All tests green.

### C.5 -- Update RLS Policies & Indexes (Week 8)

**Tasks:**
- [ ] Create migration `YYYYMMDDHHMMSS_update_coordinate_rls_policies.sql`:
  - Drop old spatial policies
  - Create new policies using `latitude`/`longitude`
  - Test with real user contexts (anon, authenticated, service_role)
- [ ] Write SQL tests verifying RLS policies work with new column names
- [ ] Run `VACUUM ANALYZE beaches` after policy changes

**Acceptance:** RLS policies use new columns. Query plans confirm index usage.

### C.6 -- Contract: Drop Old Columns (Week 9)

**Prerequisites:** C.4 complete for 14+ days. Fresh backup. Zero code references to old columns.

**TDD:**
```
1. Write test: beaches table has NO center_lat or center_lng columns
2. Write test: all queries work with latitude/longitude only
3. Write E2E: beach pages load correctly, maps render correctly
4. Apply drop migration
5. Regenerate types
6. Tests pass
```

**Tasks:**
- [ ] Take manual database backup
- [ ] Create migration `YYYYMMDDHHMMSS_drop_old_coordinate_columns.sql`:
  - Drop old spatial index
  - Rename new index to standard name
  - `ALTER TABLE beaches DROP COLUMN center_lat, DROP COLUMN center_lng`
  - `VACUUM ANALYZE beaches`
- [ ] Regenerate TypeScript types
- [ ] Remove coordinate mapping helpers (e.g., `getBeachCoordinates` adapter)
- [ ] Update `docs/COORDINATE_CONVENTIONS.md` -- remove legacy column references
- [ ] Run full test suite
- [ ] Update `CHANGELOG.md`
- [ ] Update `CLAUDE.md` -- remove "Critical pitfall" mapping note

**Acceptance:** Old columns dropped. Types clean. All tests pass. No regressions for 24h.

---

## WS-D: State Management Consolidation

**Duration:** 24 weeks (phased, low intensity)
**Agent:** `react-nextjs-expert` (components), `fullstack-engineer` (data layer)
**Risk:** Low (incremental, no big-bang)
**Research:** `docs/research/STATE_MANAGEMENT_CONSOLIDATION_RESEARCH.md`

### D.1 -- Establish Patterns & Freeze Legacy (Week 1-2)

**Tasks:**
- [ ] Create `docs/DATA_FETCHING_PATTERNS.md` documenting the target architecture:

  | Use Case | Pattern | Library |
  |----------|---------|---------|
  | Server data (initial load) | Server Components | None (native async/await) |
  | Client data (real-time, revalidation) | SWR | `swr` |
  | Forms & mutations | Server Actions | `useActionState` + `useFormStatus` |
  | Complex client state | Zustand | `zustand` |
  | Simple global state | React Context | React built-in |
  | **DEPRECATED** | useDataFetcher | Custom hook |
  | **DEPRECATED** | TanStack Query | `@tanstack/react-query` |

- [ ] Add `// @deprecated Use SWR or Server Components instead` JSDoc to `useDataFetcher`
- [ ] Create ESLint rule or code review checklist:
  - Reject new `useDataFetcher` usage
  - Reject new `useQuery`/`useMutation` from TanStack Query
  - Approve SWR for client-side fetching
  - Approve Server Components for server data
- [ ] Audit current usage counts:
  ```bash
  grep -r "useDataFetcher" --include="*.ts" --include="*.tsx" | wc -l
  grep -r "useQuery\|useMutation" --include="*.ts" --include="*.tsx" | wc -l
  grep -r "useSWR" --include="*.ts" --include="*.tsx" | wc -l
  ```

**Acceptance:** Patterns documented. Legacy patterns marked deprecated. Usage baseline recorded.

### D.2 -- New Features Use Target Patterns Only (Week 3-6)

**TDD:**
```
For each new feature built during this period:
1. Write test using target pattern (SWR hook test, Server Component test, etc.)
2. Implement using target pattern
3. Test passes
4. Verify NO new useDataFetcher or TanStack Query usage added
```

**Tasks:**
- [ ] All new pages default to Server Components with async/await
- [ ] All new client-side data fetching uses SWR
- [ ] All new forms use `useActionState` + Server Actions
- [ ] Code review gates enforce pattern compliance
- [ ] Create example implementations for each pattern in `docs/examples/`:
  - `server-component-data-fetching.tsx`
  - `swr-client-fetching.tsx`
  - `server-action-form.tsx`

**Acceptance:** Zero new instances of deprecated patterns added during this period.

### D.3 -- Migrate High-Traffic Pages (Week 7-16)

**TDD:**
```
For each page being migrated:
1. Capture baseline Lighthouse score
2. Write Playwright E2E test for the page's data loading behavior
3. Migrate data fetching pattern
4. E2E test still passes
5. Lighthouse score maintained or improved
```

**Priority order (migrate one at a time):**

1. **Beach pages** (`app/[intent]/[city]/[beachSlug]/page.tsx`)
   - [ ] Convert forecast data fetch to Server Component
   - [ ] Wrap in Suspense with loading skeleton
   - [ ] Keep interactive elements (map, likes) as Client Components with SWR
   - [ ] Write Playwright test: page loads forecast data without client JS waterfall

2. **City pages** (`app/[intent]/[city]/page.tsx`)
   - [ ] Convert beach list fetch to Server Component
   - [ ] Write Playwright test: city page shows beach cards

3. **Session pages** (`app/sessions/`)
   - [ ] Convert session list to Server Component
   - [ ] Migrate session creation form to `useActionState`
   - [ ] Write tests for form submission flow

4. **Profile pages** (`app/profile/`)
   - [ ] Convert profile data fetch to Server Component
   - [ ] Migrate profile edit form to `useActionState`

5. **Remaining `useDataFetcher` instances**
   - [ ] For each: decide Server Component vs SWR based on decision tree
   - [ ] Write test, migrate, verify

6. **TanStack Query -> SWR migration**
   - [ ] For each `useQuery` instance: replace with `useSWR`
   - [ ] For each `useMutation`: replace with Server Action
   - [ ] Write equivalent tests
   - [ ] Remove `@tanstack/react-query` dependency when all instances migrated

**Acceptance per page:** E2E tests pass. Lighthouse score >= baseline. No console errors.

### D.4 -- Legacy Elimination & Optimization (Week 17-24)

**TDD:**
```
1. Write test: no imports from @tanstack/react-query exist in codebase
2. Write test: no useDataFetcher calls exist in codebase
3. Remove dependencies
4. Tests pass
5. Bundle size reduced
```

**Tasks:**
- [ ] Final audit: `grep -r "useDataFetcher\|useQuery\|useMutation\|QueryClient"` returns 0 results
- [ ] Remove `@tanstack/react-query` from `package.json`
- [ ] Remove `QueryClientProvider` wrapper if it exists
- [ ] Delete `useDataFetcher` hook implementation
- [ ] Measure bundle size reduction (expect ~13kb from TanStack Query removal)
- [ ] Optimize Zustand stores:
  - [ ] Add selectors to prevent unnecessary re-renders
  - [ ] Split large stores if any exist
  - [ ] Add `persist` middleware for critical client state
- [ ] Final Lighthouse audit on all major pages
- [ ] Update `CLAUDE.md` -- remove `useDataFetcher` pattern, document SWR/Server Component patterns
- [ ] Update `CHANGELOG.md`

**Acceptance:** Zero deprecated pattern usage. Bundle size reduced. All Lighthouse scores >90.

---

## Cross-Cutting Concerns

### TDD Protocol (All Workstreams)

Every task follows this loop:

```
1. RED:   Write a failing test that specifies the desired behavior
2. GREEN: Write the minimum code to make the test pass
3. REFACTOR: Clean up without changing behavior
4. COMMIT: Commit the test and implementation together
```

**Test types by workstream:**
- **WS-A/B:** SQL function tests (Jest + Supabase local), API route tests, monitoring query assertions
- **WS-C:** SQL migration tests, component prop tests, Playwright map rendering tests, branded type compile-time tests
- **WS-D:** Lighthouse score assertions, Playwright page load tests, SWR hook tests, bundle size assertions

### Rollback Procedures

| Workstream | Phase | Rollback |
|-----------|-------|----------|
| WS-A | Any | Remove monitoring -- no schema changes |
| WS-B | B.1-B.3 | Drop trigger, revert code |
| WS-B | B.4 | Restore from backup (irreversible) |
| WS-C | C.1-C.5 | Drop new columns, revert code |
| WS-C | C.6 | Restore from backup (irreversible) |
| WS-D | Any | Revert code (no schema changes) |

### Schema Change Safety

For all migrations (WS-B and WS-C):
1. Wrap in `BEGIN; ... COMMIT;`
2. Test locally: `supabase db reset`
3. Review SQL for DELETE/TRUNCATE/DROP
4. Fresh backup within 24h before irreversible phases
5. Use `claude_migrator` role in production
6. Follow two-step PLAN -> APPROVE protocol

### Progress Tracking

Weekly sync checklist:
- [ ] WS-A: Connection monitoring status
- [ ] WS-B: Deprecation phase + audit log results
- [ ] WS-C: Migration phase + code audit count
- [ ] WS-D: Pattern migration count + bundle size delta

### Definition of Done

Each workstream is complete when:
1. All tests pass (Jest + Playwright)
2. No console errors or warnings
3. Performance targets met (Lighthouse >90, API P95 <500ms)
4. Documentation updated
5. `CHANGELOG.md` updated
6. Code reviewed by `code-reviewer` agent

---

## Appendix: File Reference

| Document | Path |
|----------|------|
| Connection Pool Research | `docs/research/supabase-connection-pooling-research.md` |
| Column Deprecation Research | `docs/research/DATABASE_COLUMN_DEPRECATION_RESEARCH.md` |
| Deprecation Checklist | `docs/research/FORECAST_COLUMN_DEPRECATION_CHECKLIST.md` |
| Coordinate Migration Research | `docs/COORDINATE_COLUMN_MIGRATION_RESEARCH.md` |
| State Management Research | `docs/research/STATE_MANAGEMENT_CONSOLIDATION_RESEARCH.md` |
| Coordinate Conventions | `docs/COORDINATE_CONVENTIONS.md` |
| Branded Coordinates | `docs/BRANDED_COORDINATES.md` |
| Existing Timezone Migration Plan | `docs/plans/2026-02-14-timezone-migration.md` |
