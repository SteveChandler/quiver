> Archived after the coordinate-column migration was completed; canonical guidance is in [Coordinate Conventions](../../COORDINATE_CONVENTIONS.md).

# Coordinate Column Migration Research Report

**Date**: 2026-02-14
**Status**: Research Completed
**Author**: Data Researcher Agent

---

## Executive Summary

This document provides comprehensive research on best practices for safely migrating database coordinate column names in production PostgreSQL/Supabase databases with PostGIS. The specific use case is renaming `center_lat`/`center_lng` to `latitude`/`longitude` in the Quiver beaches table.

**Key Findings:**
- **Recommended approach**: Expand-Contract pattern with dual-write phase (NOT direct rename)
- **PostGIS convention**: Use `geography(Point, 4326)` type with separate `latitude`/`longitude` columns
- **Zero-downtime**: Achievable via database views or multi-phase migration
- **TypeScript safety**: Branded types can prevent coordinate swap bugs at compile time
- **Migration tools**: pgroll automates expand-contract pattern with instant rollback

---

## 1. Zero-Downtime Column Rename Strategies

### 1.1 Comparison of Approaches

| Approach | Downtime | Rollback | Complexity | Risk | Recommended? |
|----------|----------|----------|------------|------|--------------|
| Direct `ALTER TABLE RENAME COLUMN` | ✅ Minimal (seconds) | ❌ Difficult | Low | **High** | ❌ No - breaks all queries |
| Expand-Contract (dual-write) | ✅ None | ✅ Easy | Medium | Low | ✅ **Yes - safest** |
| Database views | ✅ None | ✅ Easy | Medium | Low | ✅ Yes - good abstraction |
| Generated columns | ✅ None | ✅ Medium | Medium | Medium | ⚠️ Maybe - adds complexity |

### 1.2 Expand-Contract Pattern (RECOMMENDED)

The expand and contract pattern is the gold standard for zero-downtime schema migrations in production databases.

**Phase 1: Expand** - Add new columns alongside old ones
```sql
-- Add new columns (initially nullable)
ALTER TABLE beaches
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION;
```

**Phase 2: Dual Write** - Update application to write to both old and new columns
```typescript
// Update all INSERT/UPDATE queries to write both columns
await supabase
  .from('beaches')
  .update({
    center_lat: lat,    // Old column (keep for compatibility)
    center_lng: lon,    // Old column (keep for compatibility)
    latitude: lat,      // New column
    longitude: lon      // New column
  });
```

**Phase 3: Backfill** - Copy existing data to new columns
```sql
-- Backfill new columns from old columns
UPDATE beaches
SET
  latitude = center_lat,
  longitude = center_lng
WHERE latitude IS NULL OR longitude IS NULL;

-- Make new columns NOT NULL after backfill
ALTER TABLE beaches
  ALTER COLUMN latitude SET NOT NULL,
  ALTER COLUMN longitude SET NOT NULL;
```

**Phase 4: Read Switch** - Update application to read from new columns
```typescript
// Update all SELECT queries to use new columns
const beach = await supabase
  .from('beaches')
  .select('latitude, longitude, ...') // New columns
  .single();
```

**Phase 5: Contract** - Remove old columns after full deployment
```sql
-- Drop old columns (only after ALL clients updated)
ALTER TABLE beaches
  DROP COLUMN center_lat,
  DROP COLUMN center_lng;
```

**Timeline**: Each phase requires a full deployment cycle (typically 1-2 weeks between phases).

**Sources:**
- [Zero-downtime Schema Migrations for PostgreSQL](https://xata.io/blog/zero-downtime-schema-migrations-postgresql)
- [Implementing Zero-Downtime Schema Migrations in PostgreSQL](https://observabilityguy.medium.com/implementing-zero-downtime-schema-migrations-in-postgresql-b8c0dd7ddf61)
- [Rename Tables and Columns in Postgres with Zero Downtime](https://www.turfemon.com/rename-tables-columns-postgres-no-downtime)

### 1.3 Database Views as Abstraction Layer (ALTERNATIVE)

Use PostgreSQL views to provide both old and new column names simultaneously.

```sql
-- Rename physical table
ALTER TABLE beaches RENAME TO beaches_internal;

-- Create view with NEW column names
CREATE VIEW beaches AS
SELECT
  id,
  name,
  center_lat AS latitude,     -- Map old → new
  center_lng AS longitude,    -- Map old → new
  slug,
  -- ... other columns
FROM beaches_internal;

-- Optionally create legacy view for backward compatibility
CREATE VIEW beaches_legacy AS
SELECT
  id,
  name,
  latitude AS center_lat,     -- Map new → old
  longitude AS center_lng,    -- Map new → old
  slug,
  -- ... other columns
FROM beaches_internal;
```

**Advantages:**
- Instant deployment (no dual-write phase needed)
- Both old and new names work simultaneously
- Easy rollback (drop view, rename table back)

**Limitations:**
- Views with `NOT NULL` constraints can fail on INSERT if new columns added
- Performance overhead (minimal, but exists)
- RLS policies need to be updated for views

**PostgreSQL Automatic Updates:**
When you rename a column, PostgreSQL automatically updates column names in dependent objects like views, foreign key constraints, triggers, and user-defined functions via its internal OID system.

**Sources:**
- [Using PostgreSQL Views for Backwards-Compatible Migrations](https://medium.com/ovrsea/using-postgresql-views-to-ensure-backwards-compatible-non-breaking-migrations-017288e77f06)
- [Postgres: Safely Renaming a Table with Updatable Views](https://brandur.org/fragments/postgres-table-rename)
- [PostgreSQL Table Rename and Views – An OID Story](https://databaserookies.wordpress.com/2026/01/05/postgresql-table-rename-and-views-an-oid-story/comment-page-1/)

### 1.4 pgroll - Automated Expand-Contract Tool

pgroll is an open-source CLI tool that automates the expand-contract pattern for PostgreSQL migrations.

**Key Features:**
- Creates versioned schemas (`public_01_initial`, `public_02_add_column`)
- Schemas are views pointing to underlying tables
- Instant rollback with `pgroll rollback` command
- Both old and new schemas work simultaneously during migration

**Installation:**
```bash
# Install pgroll
brew install pgroll  # macOS
# or
go install github.com/xataio/pgroll@latest
```

**Example Migration:**
```json
{
  "name": "rename_coordinate_columns",
  "operations": [
    {
      "rename_column": {
        "table": "beaches",
        "from": "center_lat",
        "to": "latitude"
      }
    },
    {
      "rename_column": {
        "table": "beaches",
        "from": "center_lng",
        "to": "longitude"
      }
    }
  ]
}
```

**Benefits:**
- Automatic view creation and management
- Safe, reversible migrations
- No table locking
- Zero downtime guaranteed

**Sources:**
- [pgroll GitHub Repository](https://github.com/xataio/pgroll)
- [Zero downtime schema migrations with pgroll - Neon Guides](https://neon.com/guides/pgroll)
- [pgroll: Zero-downtime, reversible schema migrations for Postgres](https://xata.io/blog/pgroll-schema-migrations-postgres)

---

## 2. PostGIS Coordinate Conventions

### 2.1 Standard Column Naming

PostGIS does NOT enforce specific column names for latitude/longitude. Common patterns in production:

| Pattern | Usage | Example |
|---------|-------|---------|
| `latitude`, `longitude` | ✅ **Most common** | Supabase docs, modern apps |
| `lat`, `lon` | Common (short form) | APIs, mobile apps |
| `center_lat`, `center_lng` | Legacy PostGIS | Quiver (current) |
| `showed_at_latitude`, `showed_at_longitude` | Domain-specific | Event tracking |

**Recommendation**: Use `latitude` and `longitude` as the standard for new tables and migrations.

### 2.2 Coordinate Order (CRITICAL)

**PostGIS coordinate order is LONGITUDE, LATITUDE** (X, Y) - the opposite of common usage.

```sql
-- CORRECT: longitude first, then latitude
ST_Point(longitude, latitude)  -- longitude is X-axis
ST_MakePoint(-117.1611, 32.7157)  -- longitude first

-- PostGIS uses (X, Y) = (longitude, latitude)
-- Geographic coords: X=longitude, Y=latitude
```

**Common bug**: Mixing up coordinate order leads to locations appearing on wrong continents.

**Fix**: Use `ST_FlipCoordinates(geometry)` to swap if needed.

**Sources:**
- [Is it Lon/Lat or Lat/Lon? | PostGIS](https://postgis.net/documentation/tips/lon-lat-or-lat-lon/)
- [PostGIS: Projecting Data](https://postgis.net/workshops/postgis-intro/projection.html)

### 2.3 Data Types: Geography vs Geometry

PostGIS offers two spatial types:

#### `geography` Type (RECOMMENDED for lat/lon)
- Understands spherical coordinates
- Uses WGS84 spheroid (SRID 4326)
- Accurate distance calculations on Earth's surface
- Performance: Slower but accurate

```sql
-- geography type for global lat/lon data
CREATE TABLE beaches (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location geography(Point, 4326)  -- Spherical earth
);

-- Create geography point
UPDATE beaches
SET location = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography;
```

#### `geometry` Type
- Planar/Cartesian coordinates
- Faster but less accurate for global distances
- Use for projected coordinate systems (not lat/lon)

**SRID 4326**: Standard for GPS coordinates (WGS84 datum)

**Best Practice**: Store both separate columns (`latitude`, `longitude`) AND a `geography` point for spatial queries.

```sql
CREATE TABLE beaches (
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  location geography(Point, 4326),  -- For spatial queries
  CONSTRAINT check_coordinates CHECK (
    latitude BETWEEN -90 AND 90 AND
    longitude BETWEEN -180 AND 180
  )
);

-- Index for fast spatial queries
CREATE INDEX idx_beaches_location ON beaches USING GIST(location);
```

**Sources:**
- [PostGIS and the Geography Type | Crunchy Data Blog](https://www.crunchydata.com/blog/postgis-and-the-geography-type)
- [Introduction to PostGIS: Geography](http://postgis.net/workshops/postgis-intro/geography.html)
- [Getting Started with PostGIS Geography Data Type](https://learnsql.com/blog/getting-started-with-postgis-your-first-steps-with-the-geography-data-type/)

---

## 3. TypeScript Branded Types for Coordinate Safety

### 3.1 What Are Branded Types?

Branded types (also called nominal or opaque types) create unique types in TypeScript that prevent accidental misuse, despite having identical structure.

**Problem**: TypeScript's structural typing allows dangerous mistakes:
```typescript
// Both are just numbers - TypeScript can't catch swap bugs
type Latitude = number;
type Longitude = number;

function createPoint(lat: Latitude, lon: Longitude) { ... }

// COMPILES BUT WRONG - coordinates swapped!
createPoint(-117.1611, 32.7157);  // longitude passed as latitude
```

**Solution**: Branded types add a hidden "brand" field:
```typescript
type Latitude = number & { readonly __brand: 'Latitude' };
type Longitude = number & { readonly __brand: 'Longitude' };

// Now this fails at compile time!
createPoint(-117.1611, 32.7157);
// Error: Type 'number' is not assignable to type 'Latitude'
```

### 3.2 Implementation Pattern

```typescript
// Define branded types
declare const LatitudeBrand: unique symbol;
declare const LongitudeBrand: unique symbol;

export type Latitude = number & { readonly [LatitudeBrand]: 'Latitude' };
export type Longitude = number & { readonly [LongitudeBrand]: 'Longitude' };

// Smart constructors with validation
export function latitude(value: number): Latitude {
  if (value < -90 || value > 90) {
    throw new Error(`Invalid latitude: ${value}. Must be between -90 and 90.`);
  }
  return value as Latitude;
}

export function longitude(value: number): Longitude {
  if (value < -180 || value > 180) {
    throw new Error(`Invalid longitude: ${value}. Must be between -180 and 180.`);
  }
  return value as Longitude;
}

// Usage
const lat = latitude(32.7157);   // Latitude type
const lon = longitude(-117.1611); // Longitude type

// Type-safe function
function createPoint(lat: Latitude, lon: Longitude): Point {
  return { lat, lon };
}

// Compile-time error if swapped
createPoint(lon, lat);  // ❌ Error: Type mismatch!
createPoint(lat, lon);  // ✅ OK
```

### 3.3 Effect Framework Integration

The [Effect](https://effect.website/) framework provides built-in branded type support:

```typescript
import { Brand } from 'effect';

// Using Effect's Brand module
type Latitude = number & Brand.Brand<'Latitude'>;
type Longitude = number & Brand.Brand<'Longitude'>;

const Latitude = Brand.refined<Latitude>(
  (n) => n >= -90 && n <= 90,
  (n) => Brand.error(`Invalid latitude: ${n}`)
);

const Longitude = Brand.refined<Longitude>(
  (n) => n >= -180 && n <= 180,
  (n) => Brand.error(`Invalid longitude: ${n}`)
);

// Create validated branded values
const lat = Latitude(32.7157);   // Either<Latitude, BrandError>
const lon = Longitude(-117.1611); // Either<Longitude, BrandError>
```

### 3.4 Practical Example: Coordinate Interface

```typescript
// types/coordinates.ts
export type Latitude = number & { readonly __brand: 'Latitude' };
export type Longitude = number & { readonly __brand: 'Longitude' };

export interface Coordinates {
  latitude: Latitude;
  longitude: Longitude;
}

// Validation helpers
export function assertLatitude(value: number): asserts value is Latitude {
  if (value < -90 || value > 90) {
    throw new Error(`Invalid latitude: ${value}`);
  }
}

export function assertLongitude(value: number): asserts value is Longitude {
  if (value < -180 || value > 180) {
    throw new Error(`Invalid longitude: ${value}`);
  }
}

// Safe coordinate creation
export function createCoordinates(lat: number, lon: number): Coordinates {
  assertLatitude(lat);
  assertLongitude(lon);
  return { latitude: lat, longitude: lon };
}

// Usage in components
interface BeachMarkerProps {
  beach: Beach;
  // Instead of: latitude: number, longitude: number
  // Use: coordinates: Coordinates (type-safe)
}

function BeachMarker({ beach }: BeachMarkerProps) {
  const coords = createCoordinates(beach.center_lat, beach.center_lng);
  return <Marker {...coords} />;
}
```

**Sources:**
- [Branded Types in TypeScript: From Structural to Nominal Typing](https://nanamanu.com/posts/branded-types-typescript/)
- [Understanding Branded Types in TypeScript](https://typescript.tv/hands-on/understanding-branded-types-in-typescript/)
- [Nominal Typing | TypeScript Deep Dive](https://basarat.gitbook.io/typescript/main-1/nominaltyping)
- [Effect Framework: Branded Types Documentation](https://effect.website/docs/code-style/branded-types/)
- [TypeScript: Nominal Typing and Branded Types](https://medium.com/@maciej.osytek/typescript-nominal-typing-and-branded-types-38ec8160f7b4)

---

## 4. Migration Rollback Strategy

### 4.1 Expand-Contract Rollback Points

The expand-contract pattern provides safe rollback at each phase:

| Phase | Rollback Action | Data Loss Risk | Downtime |
|-------|----------------|----------------|----------|
| **1. Expand** (new columns added) | `ALTER TABLE DROP COLUMN` | ✅ None | Seconds |
| **2. Dual Write** (app writes both) | Revert code, keep columns | ✅ None | None (redeploy) |
| **3. Backfill** (data copied) | No action needed | ✅ None | None |
| **4. Read Switch** (app reads new) | Revert code | ✅ None | None (redeploy) |
| **5. Contract** (old columns dropped) | ❌ **Cannot rollback** | ❌ **Data lost** | Restore from backup |

**Critical**: Phase 5 (dropping old columns) is irreversible. Only execute after 100% confidence.

### 4.2 Rollback Script Template

```sql
-- ROLLBACK PHASE 1: Drop new columns
BEGIN;

ALTER TABLE beaches
  DROP COLUMN IF EXISTS latitude,
  DROP COLUMN IF EXISTS longitude;

COMMIT;

-- ROLLBACK PHASE 5: Restore from backup (if old columns dropped)
BEGIN;

-- Re-add old columns
ALTER TABLE beaches
  ADD COLUMN center_lat DOUBLE PRECISION,
  ADD COLUMN center_lng DOUBLE PRECISION;

-- Restore from backup or copy from remaining source
UPDATE beaches
SET
  center_lat = latitude,  -- If new columns still exist
  center_lng = longitude;

-- Or restore from pg_dump backup
-- psql -d quiver < backup_pre_migration.sql

COMMIT;
```

### 4.3 Backward Compatibility Window

**Best Practice**: Maintain backward compatibility for 1-2 release cycles (1-4 weeks) before contracting.

```typescript
// During compatibility window, support BOTH column sets
interface Beach {
  // New columns (preferred)
  latitude?: number;
  longitude?: number;

  // Old columns (deprecated but supported)
  center_lat?: number;
  center_lng?: number;
}

// Adapter helper
function getBeachCoordinates(beach: Beach): { lat: number; lon: number } {
  return {
    lat: beach.latitude ?? beach.center_lat ?? 0,
    lon: beach.longitude ?? beach.center_lng ?? 0,
  };
}
```

### 4.4 pgroll Instant Rollback

With pgroll, rollback is a single command:

```bash
# Rollback migration before completion
pgroll rollback

# This instantly reverts to previous schema version
# No manual SQL needed
```

**Sources:**
- [Backward Compatible Database Changes - PlanetScale](https://planetscale.com/blog/backward-compatible-databases-changes)
- [Update Database Schema Without Downtime](https://thorben-janssen.com/update-database-schema-without-downtime/)
- [Zero downtime schema migrations with pgroll - Neon Guides](https://neon.com/guides/pgroll)

---

## 5. Impact on Indexes and RLS Policies

### 5.1 Spatial Index Recreation

PostgreSQL **automatically updates column references** in indexes when columns are renamed.

```sql
-- Before rename
CREATE INDEX idx_beaches_location
  ON beaches USING GIST(ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography);

-- After ALTER TABLE RENAME COLUMN, index reference updates automatically
-- But for expand-contract, you need TWO indexes during transition:

-- Phase 1: Add new index for new columns
CREATE INDEX idx_beaches_location_new
  ON beaches USING GIST(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography);

-- Phase 5: Drop old index (after full migration)
DROP INDEX idx_beaches_location;

-- Rename new index to standard name
ALTER INDEX idx_beaches_location_new RENAME TO idx_beaches_location;
```

**Performance Impact**: Running two spatial indexes temporarily increases:
- Storage (both indexes exist)
- Write performance (both indexes updated on INSERT/UPDATE)

**Duration**: Only during expand-contract transition (1-4 weeks typical).

### 5.2 Index Maintenance

```sql
-- After creating new spatial index, update statistics
VACUUM ANALYZE beaches;

-- Verify index is being used
EXPLAIN ANALYZE
SELECT * FROM beaches
WHERE ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint(-117.1611, 32.7157), 4326)::geography,
  8000  -- 8km radius
);
```

**Sources:**
- [How To Create A Spatial Index In PostGIS](https://mapscaping.com/create-a-spatial-index-in-postgis/)
- [The Many Spatial Indexes of PostGIS | Crunchy Data Blog](https://www.crunchydata.com/blog/the-many-spatial-indexes-of-postgis)
- [Spatial Indexing — Introduction to PostGIS](http://postgis.net/workshops/postgis-intro/indexing.html)

### 5.3 RLS Policies

Supabase Row Level Security (RLS) policies reference column names. During expand-contract migration:

**Current RLS policies** (example):
```sql
-- Policy references center_lat, center_lng
CREATE POLICY "Public beaches are viewable by everyone"
  ON beaches FOR SELECT
  USING (
    ST_DWithin(
      ST_SetSRID(ST_MakePoint(center_lng, center_lat), 4326)::geography,
      current_user_location(),
      50000
    )
  );
```

**Migration approach**:

**Option 1**: Update policies to use new columns (requires testing)
```sql
-- Drop old policy
DROP POLICY "Public beaches are viewable by everyone" ON beaches;

-- Create new policy with new column names
CREATE POLICY "Public beaches are viewable by everyone"
  ON beaches FOR SELECT
  USING (
    ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      current_user_location(),
      50000
    )
  );
```

**Option 2**: Use COALESCE during transition (supports both)
```sql
CREATE POLICY "Public beaches are viewable by everyone"
  ON beaches FOR SELECT
  USING (
    ST_DWithin(
      ST_SetSRID(
        ST_MakePoint(
          COALESCE(longitude, center_lng),  -- Try new, fallback to old
          COALESCE(latitude, center_lat)
        ),
        4326
      )::geography,
      current_user_location(),
      50000
    )
  );
```

**Known Limitation**: Supabase schema diff tool doesn't track `ALTER POLICY` statements well - test policies manually.

**Sources:**
- [Row Level Security | Supabase Docs](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Declarative Database Schemas | Supabase Docs](https://supabase.com/docs/guides/local-development/declarative-database-schemas)

---

## 6. Application-Layer Mapping Patterns

### 6.1 Current Quiver Pattern (Manual Mapping)

```typescript
// Database type (matches schema exactly)
interface Beach {
  center_lat: number;  // Database column
  center_lng: number;  // Database column
}

// Component props (normalized names)
interface BeachMarkerProps {
  latitude: number;
  longitude: number;
}

// Manual mapping (current approach)
<BeachMarker
  latitude={beach.center_lat}   // Explicit mapping
  longitude={beach.center_lng}  // Explicit mapping
/>
```

**Pros**: Explicit, no magic, easy to debug
**Cons**: Repetitive, error-prone, no compile-time safety

### 6.2 Drizzle ORM Column Aliases

Drizzle ORM provides automatic column name mapping:

```typescript
// schema.ts
import { pgTable, doublePrecision, text, uuid } from 'drizzle-orm/pg-core';

export const beaches = pgTable('beaches', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),

  // TypeScript property: latitude → Database column: center_lat
  latitude: doublePrecision('center_lat').notNull(),
  longitude: doublePrecision('center_lng').notNull(),
});

// Usage (automatic mapping)
const beach = await db.select().from(beaches).where(...);
// beach.latitude exists (TypeScript)
// Maps to beaches.center_lat (database)

// Component usage (no manual mapping needed)
<BeachMarker
  latitude={beach.latitude}   // TypeScript property
  longitude={beach.longitude} // TypeScript property
/>
```

**Alternative**: Use Drizzle's `casing` option for automatic snake_case ↔ camelCase conversion:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';

const db = drizzle({
  connection: process.env.DATABASE_URL,
  casing: 'snake_case'  // Auto-convert camelCase ↔ snake_case
});

// Now define schema with camelCase
export const beaches = pgTable('beaches', {
  centerlat: doublePrecision('centerlat'),  // → center_lat in DB
  centerLng: doublePrecision('centerLng'),  // → center_lng in DB
});
```

**Sources:**
- [Drizzle ORM - Schema Declaration](https://orm.drizzle.team/docs/sql-schema-declaration)
- [Optional column names in drizzle schema · Discussion #2834](https://github.com/drizzle-team/drizzle-orm/discussions/2834)

### 6.3 TypeScript Mapped Types (No ORM)

Create a mapping layer without changing database queries:

```typescript
// Database type (generated from Supabase)
interface BeachDB {
  center_lat: number;
  center_lng: number;
}

// Application type (normalized)
interface Beach {
  latitude: number;
  longitude: number;
}

// Mapper function
function mapBeachFromDB(db: BeachDB): Beach {
  return {
    latitude: db.center_lat,
    longitude: db.center_lng,
  };
}

// Use in data fetching
const { data } = await supabase.from('beaches').select('*');
const beaches: Beach[] = data.map(mapBeachFromDB);

// Now components use normalized types
<BeachMarker
  latitude={beach.latitude}   // No mapping needed
  longitude={beach.longitude}
/>
```

**Pros**: Type-safe, centralized mapping, works with any database client
**Cons**: Runtime overhead, must maintain mapper functions

### 6.4 Eliminating Mapping Layer Entirely

**Goal**: After migration completes, database and application use same names.

```sql
-- After expand-contract migration completes
CREATE TABLE beaches (
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  -- Old columns dropped
);
```

```typescript
// Database type matches application type (no mapping needed)
interface Beach {
  latitude: number;   // Matches DB column
  longitude: number;  // Matches DB column
}

// Direct usage (no mapper)
const { data } = await supabase.from('beaches').select('*');
const beach: Beach = data[0];  // Types match exactly

<BeachMarker {...beach} />  // Spread works perfectly
```

**This is the ideal end state** - zero mapping, zero confusion, zero bugs.

---

## 7. Recommended Migration Plan for Quiver

### 7.1 Situation Analysis

**Current State:**
- 352 migration files in `supabase/migrations/`
- `center_lat`/`center_lng` used in beaches table and ~7 migrations
- Coordinate conventions documented in `docs/COORDINATE_CONVENTIONS.md`
- Active production database with users

**Risk Factors:**
- Production database (cannot afford downtime)
- Multiple RLS policies reference coordinate columns
- Spatial indexes on coordinate expressions
- 7+ migrations reference old column names
- Client applications expect current schema

### 7.2 Recommended Approach: Expand-Contract with Views

**Phase 0: Preparation** (1 week)
```sql
-- Migration: 20260215000000_add_coordinate_columns.sql
BEGIN;

-- Add new columns (nullable during transition)
ALTER TABLE beaches
  ADD COLUMN latitude DOUBLE PRECISION,
  ADD COLUMN longitude DOUBLE PRECISION;

-- Create index for new columns
CREATE INDEX idx_beaches_location_new
  ON beaches USING GIST(
    ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography
  )
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

COMMIT;
```

**Phase 1: Backfill** (immediate, runs in background)
```sql
-- Migration: 20260215000001_backfill_coordinates.sql
BEGIN;

-- Copy data from old columns to new columns
UPDATE beaches
SET
  latitude = center_lat,
  longitude = center_lng
WHERE latitude IS NULL OR longitude IS NULL;

-- Add NOT NULL constraints
ALTER TABLE beaches
  ALTER COLUMN latitude SET NOT NULL,
  ALTER COLUMN longitude SET NOT NULL;

-- Add check constraint
ALTER TABLE beaches
  ADD CONSTRAINT check_coordinates
  CHECK (
    latitude BETWEEN -90 AND 90 AND
    longitude BETWEEN -180 AND 180
  );

COMMIT;
```

**Phase 2: Application Dual-Write** (1-2 weeks)
```typescript
// Update all write operations to write BOTH columns
const { error } = await supabase
  .from('beaches')
  .upsert({
    center_lat: lat,    // Old (keep for backward compat)
    center_lng: lon,    // Old (keep for backward compat)
    latitude: lat,      // New
    longitude: lon,     // New
    ...otherFields
  });
```

**Phase 3: Create Adapter View** (deploy immediately after Phase 2)
```sql
-- Migration: 20260222000000_create_beaches_adapter_view.sql
BEGIN;

-- Rename physical table
ALTER TABLE beaches RENAME TO beaches_internal;

-- Create view that exposes BOTH old and new names
CREATE VIEW beaches AS
SELECT
  id,
  name,
  slug,
  -- New columns (canonical)
  latitude,
  longitude,
  -- Old columns (aliases for backward compatibility)
  latitude AS center_lat,
  longitude AS center_lng,
  -- ... all other columns
FROM beaches_internal;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON beaches TO authenticated;
GRANT SELECT ON beaches TO anon;

COMMIT;
```

This view allows:
- Old code to use `center_lat`/`center_lng` (reads from `latitude`/`longitude`)
- New code to use `latitude`/`longitude` directly
- Zero breaking changes

**Phase 4: Application Read Switch** (2-4 weeks)
```typescript
// Gradually update queries to use new column names
const { data } = await supabase
  .from('beaches')
  .select('latitude, longitude, ...'); // New columns
```

Update:
- All component props
- All TypeScript types
- All hooks
- All API routes
- All tests

**Phase 5: Update RLS Policies** (after Phase 4 completes)
```sql
-- Migration: 20260308000000_update_rls_policies.sql
BEGIN;

-- Drop old policies
DROP POLICY IF EXISTS "policy_name" ON beaches_internal;

-- Create new policies using new column names
CREATE POLICY "Public beaches are viewable by everyone"
  ON beaches_internal FOR SELECT
  USING (
    ST_DWithin(
      ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography,
      current_user_location(),
      50000
    )
  );

COMMIT;
```

**Phase 6: Contract** (after 100% confidence, 4-8 weeks)
```sql
-- Migration: 20260322000000_finalize_coordinate_migration.sql
BEGIN;

-- Drop adapter view
DROP VIEW beaches;

-- Rename internal table back to beaches
ALTER TABLE beaches_internal RENAME TO beaches;

-- Drop old indexes
DROP INDEX IF EXISTS idx_beaches_location;

-- Rename new index
ALTER INDEX idx_beaches_location_new RENAME TO idx_beaches_location;

-- Update statistics
VACUUM ANALYZE beaches;

COMMIT;
```

**Rollback Plan**:
- **Before Phase 6**: Simply revert code deployments (data is safe)
- **After Phase 6**: Restore from backup taken before Phase 6 execution

### 7.3 Testing Strategy

**Phase 0 Testing:**
- ✅ Verify new columns added
- ✅ Check indexes created
- ✅ Confirm no breaking changes

**Phase 1 Testing:**
- ✅ Verify all rows backfilled
- ✅ Check constraints enforced
- ✅ Query performance unchanged

**Phase 3 Testing:**
- ✅ View returns correct data for both old and new column names
- ✅ RLS policies still enforce correctly
- ✅ Writes through view work (INSERT/UPDATE/DELETE)

**Phase 4 Testing:**
- ✅ All E2E tests pass with new column names
- ✅ No console errors or warnings
- ✅ Coordinate validation passes
- ✅ Map rendering works correctly

**Phase 6 Testing:**
- ✅ All queries use new column names
- ✅ No references to old column names in code
- ✅ Spatial queries perform well
- ✅ Backup verified and tested

### 7.4 Timeline

| Phase | Duration | Cumulative |
|-------|----------|------------|
| Phase 0: Add columns | 1 day | 1 day |
| Phase 1: Backfill | 1 day | 2 days |
| Phase 2: Dual-write | 1-2 weeks | 2-3 weeks |
| Phase 3: Adapter view | 1 day | 2-3 weeks |
| Phase 4: Read switch | 2-4 weeks | 4-7 weeks |
| Phase 5: Update RLS | 1 week | 5-8 weeks |
| Phase 6: Contract | 1 week | 6-9 weeks |

**Total**: 6-9 weeks for complete, safe migration.

---

## 8. TypeScript Branded Types Implementation for Quiver

### 8.1 New Type Definitions

Create `/types/coordinates.ts`:

```typescript
/**
 * Coordinate branded types for type-safe latitude/longitude handling.
 *
 * These types prevent coordinate swap bugs at compile time by ensuring
 * latitude and longitude values cannot be accidentally mixed up.
 */

// Branded type symbols
declare const LatitudeBrand: unique symbol;
declare const LongitudeBrand: unique symbol;

/**
 * Latitude type: restricted to -90 to 90 degrees
 */
export type Latitude = number & { readonly [LatitudeBrand]: 'Latitude' };

/**
 * Longitude type: restricted to -180 to 180 degrees
 */
export type Longitude = number & { readonly [LongitudeBrand]: 'Longitude' };

/**
 * Type-safe coordinate pair
 */
export interface Coordinates {
  latitude: Latitude;
  longitude: Longitude;
}

/**
 * Create validated Latitude value
 * @throws {Error} if value is outside valid range (-90 to 90)
 */
export function latitude(value: number): Latitude {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid latitude: ${value} (must be finite number)`);
  }
  if (value < -90 || value > 90) {
    throw new Error(
      `Invalid latitude: ${value} (must be between -90 and 90 degrees)`
    );
  }
  return value as Latitude;
}

/**
 * Create validated Longitude value
 * @throws {Error} if value is outside valid range (-180 to 180)
 */
export function longitude(value: number): Longitude {
  if (!Number.isFinite(value)) {
    throw new Error(`Invalid longitude: ${value} (must be finite number)`);
  }
  if (value < -180 || value > 180) {
    throw new Error(
      `Invalid longitude: ${value} (must be between -180 and 180 degrees)`
    );
  }
  return value as Longitude;
}

/**
 * Create validated Coordinates object
 * @throws {Error} if either coordinate is invalid
 */
export function coordinates(lat: number, lon: number): Coordinates {
  return {
    latitude: latitude(lat),
    longitude: longitude(lon),
  };
}

/**
 * Type guard for Latitude
 */
export function isLatitude(value: number): value is Latitude {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

/**
 * Type guard for Longitude
 */
export function isLongitude(value: number): value is Longitude {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

/**
 * Assertion helpers for type narrowing
 */
export function assertLatitude(value: number): asserts value is Latitude {
  if (!isLatitude(value)) {
    throw new Error(`Invalid latitude: ${value}`);
  }
}

export function assertLongitude(value: number): asserts value is Longitude {
  if (!isLongitude(value)) {
    throw new Error(`Invalid longitude: ${value}`);
  }
}
```

### 8.2 Usage in Components

```typescript
// components/map/beach-marker.tsx
import type { Coordinates } from '@/types/coordinates';
import { coordinates } from '@/types/coordinates';

interface BeachMarkerProps {
  beach: Beach;
  onClick?: () => void;
}

export function BeachMarker({ beach, onClick }: BeachMarkerProps) {
  // Create type-safe coordinates from database values
  const coords = coordinates(beach.center_lat, beach.center_lng);

  return (
    <Marker
      latitude={coords.latitude}    // Type: Latitude (not number)
      longitude={coords.longitude}  // Type: Longitude (not number)
      onClick={onClick}
    />
  );
}
```

### 8.3 Usage in Hooks

```typescript
// hooks/use-nearby-beaches.ts
import type { Latitude, Longitude } from '@/types/coordinates';
import { latitude, longitude } from '@/types/coordinates';

interface UseNearbyBeachesParams {
  lat: number;
  lon: number;
  radiusMiles?: number;
}

export function useNearbyBeaches({ lat, lon, radiusMiles = 5 }: UseNearbyBeachesParams) {
  // Validate and brand coordinates
  const centerLat = latitude(lat);
  const centerLon = longitude(lon);

  const fetchBeaches = useCallback(async () => {
    return await supabase.rpc('get_nearby_beaches', {
      center_lat: centerLat,   // Branded type ensures no swap
      center_lng: centerLon,   // Branded type ensures no swap
      radius_miles: radiusMiles,
    });
  }, [centerLat, centerLon, radiusMiles]);

  return useDataFetcher(fetchBeaches);
}
```

### 8.4 Benefits for Quiver

1. **Compile-time safety**: Prevents `latitude`/`longitude` swap bugs
2. **Runtime validation**: Ensures all coordinates are within valid ranges
3. **Self-documenting**: Types make coordinate expectations explicit
4. **Gradual adoption**: Can be added incrementally to critical code paths
5. **Zero runtime overhead**: Brands are type-level only (erased at runtime)

**Critical paths to protect with branded types:**
- Map marker positioning
- Distance calculations
- Geographic queries (RPC calls)
- Session location recording
- Beach search by location

---

## 9. Alternative Considerations

### 9.1 Keep Current Schema (Do Nothing)

**Pros:**
- Zero migration risk
- No development time needed
- No testing overhead

**Cons:**
- Continued confusion between `lng` and `lon`
- Mapping layer required forever
- Documentation burden
- Onboarding friction for new developers

**Verdict**: ❌ Not recommended. Technical debt compounds over time.

### 9.2 Generated Columns (PostgreSQL 12+)

Use PostgreSQL generated columns to alias old to new:

```sql
ALTER TABLE beaches
  ADD COLUMN latitude DOUBLE PRECISION GENERATED ALWAYS AS (center_lat) STORED,
  ADD COLUMN longitude DOUBLE PRECISION GENERATED ALWAYS AS (center_lng) STORED;
```

**Pros:**
- No dual-write logic needed
- Automatic synchronization
- Both column sets always consistent

**Cons:**
- Storage overhead (data duplicated)
- Cannot index generated columns efficiently
- Confusion about which column is "source of truth"

**Verdict**: ⚠️ Not ideal for Quiver. Adds complexity without clear benefit.

### 9.3 Direct ALTER TABLE RENAME (Fast but Risky)

```sql
BEGIN;
ALTER TABLE beaches RENAME COLUMN center_lat TO latitude;
ALTER TABLE beaches RENAME COLUMN center_lng TO longitude;
COMMIT;
```

**Pros:**
- ✅ Executes in seconds
- ✅ Simple, no multi-phase complexity

**Cons:**
- ❌ Breaks ALL existing queries instantly
- ❌ Requires synchronized code deployment
- ❌ No rollback if issues found
- ❌ High risk in production

**Verdict**: ❌ Too risky for production Supabase database. Only viable for new projects.

---

## 10. Key Takeaways & Recommendations

### 10.1 Executive Summary

**Primary Recommendation**: Use **Expand-Contract pattern with database views** for Quiver's coordinate column migration.

**Why this approach?**
1. ✅ Zero downtime guaranteed
2. ✅ Easy rollback at every phase
3. ✅ Backward compatibility maintained
4. ✅ Low risk of production issues
5. ✅ Gradual migration allows thorough testing

**Timeline**: 6-9 weeks for complete migration
**Risk Level**: Low (if followed carefully)
**Downtime**: Zero

### 10.2 Critical Success Factors

1. **Take database backup before Phase 6** (contract phase)
2. **Test each phase in staging environment first**
3. **Monitor query performance during transition** (dual indexes temporarily)
4. **Update RLS policies carefully** (test with real user contexts)
5. **Maintain backward compatibility for 2+ weeks** before dropping old columns
6. **Run E2E tests after each phase deployment**

### 10.3 Quick Decision Matrix

| If you need... | Use this approach |
|----------------|-------------------|
| Zero downtime | ✅ Expand-Contract or Views |
| Instant rollback | ✅ pgroll or Views |
| Simplest migration | ⚠️ Direct ALTER (only if non-prod) |
| Compile-time coordinate safety | ✅ TypeScript Branded Types |
| Eliminate mapping layer | ✅ Complete migration to new names |
| Automated migration | ✅ pgroll tool |

### 10.4 PostGIS Best Practices

1. **Always use** `geography(Point, 4326)` for lat/lon data
2. **Store both** separate columns (`latitude`, `longitude`) AND a geography point
3. **Remember**: PostGIS uses `(longitude, latitude)` order (X, Y)
4. **Create spatial indexes** with `USING GIST` on geography columns
5. **Run** `VACUUM ANALYZE` after index creation or bulk updates

### 10.5 TypeScript Best Practices

1. **Use branded types** for critical coordinate handling
2. **Validate at system boundaries** (API inputs, database reads)
3. **Centralize coordinate validation** in utility functions
4. **Prefer compile-time safety** over runtime checks where possible
5. **Document coordinate expectations** in type definitions

### 10.6 Migration Anti-Patterns to Avoid

| ❌ Don't Do This | ✅ Do This Instead |
|-----------------|-------------------|
| Direct ALTER in production | Expand-Contract pattern |
| Drop old columns immediately | Wait 2-4 weeks for verification |
| Skip backup before contract phase | Always backup before irreversible changes |
| Rename without updating RLS policies | Update policies in same migration |
| Assume PostgreSQL auto-updates everything | Explicitly update indexes, policies, functions |
| Mix coordinate order (lat/lon vs lon/lat) | Document and enforce consistent order |
| Use `lng` in new code | Always use `lon` or `longitude` |

---

## 11. Additional Resources

### Documentation
- [PostgreSQL ALTER TABLE Documentation](https://www.postgresql.org/docs/current/sql-altertable.html)
- [PostGIS Official Documentation](https://postgis.net/documentation/)
- [Supabase Database Migrations Guide](https://supabase.com/docs/guides/local-development/overview)
- [TypeScript Handbook: Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)

### Tools
- [pgroll - Zero-downtime migrations tool](https://github.com/xataio/pgroll)
- [Effect Framework - Branded types library](https://effect.website/docs/code-style/branded-types/)
- [Drizzle ORM - TypeScript ORM with column mapping](https://orm.drizzle.team/)

### Research Sources

This research compiled findings from 30+ authoritative sources:

**Zero-Downtime Migrations:**
- [Zero-downtime Schema Migrations for PostgreSQL | Xata](https://xata.io/blog/zero-downtime-schema-migrations-postgresql)
- [Implementing Zero-Downtime Schema Migrations in PostgreSQL | Medium](https://observabilityguy.medium.com/implementing-zero-downtime-schema-migrations-in-postgresql-b8c0dd7ddf61)
- [Rename Tables and Columns in Postgres with Zero Downtime | Turfemon](https://www.turfemon.com/rename-tables-columns-postgres-no-downtime)
- [Zero‑Downtime Migrations — expand/contract | Caduh](https://www.caduh.com/blog/zero-downtime-migrations)

**PostGIS Conventions:**
- [Is it Lon/Lat or Lat/Lon? | PostGIS](https://postgis.net/documentation/tips/lon-lat-or-lat-lon/)
- [PostGIS and the Geography Type | Crunchy Data](https://www.crunchydata.com/blog/postgis-and-the-geography-type)
- [Introduction to PostGIS: Geography](http://postgis.net/workshops/postgis-intro/geography.html)

**Database Views:**
- [Using PostgreSQL Views for Backwards-Compatible Migrations | Medium](https://medium.com/ovrsea/using-postgresql-views-to-ensure-backwards-compatible-non-breaking-migrations-017288e77f06)
- [Postgres: Safely Renaming a Table with Updatable Views | Brandur](https://brandur.org/fragments/postgres-table-rename)

**TypeScript Branded Types:**
- [Branded Types in TypeScript: From Structural to Nominal Typing | Nana Adjei Manu](https://nanamanu.com/posts/branded-types-typescript/)
- [Understanding Branded Types in TypeScript | TypeScript.tv](https://typescript.tv/hands-on/understanding-branded-types-in-typescript/)
- [Effect Framework: Branded Types Documentation](https://effect.website/docs/code-style/branded-types/)

**Spatial Indexes:**
- [How To Create A Spatial Index In PostGIS | Mapscaping](https://mapscaping.com/create-a-spatial-index-in-postgis/)
- [The Many Spatial Indexes of PostGIS | Crunchy Data](https://www.crunchydata.com/blog/the-many-spatial-indexes-of-postgis)

**Rollback Strategies:**
- [Backward Compatible Database Changes | PlanetScale](https://planetscale.com/blog/backward-compatible-databases-changes)
- [Update Database Schema Without Downtime | Thorben Janssen](https://thorben-janssen.com/update-database-schema-without-downtime/)

---

## 12. Next Steps

### Immediate Actions
1. ✅ Review this research document with team
2. ✅ Decide on migration approach (recommend: Expand-Contract with Views)
3. ✅ Schedule migration planning session
4. ✅ Set up staging environment for testing

### Short-term (1-2 weeks)
1. 📝 Write detailed migration plan with rollback procedures
2. 📝 Create Phase 0 and Phase 1 migration SQL scripts
3. 🧪 Test migrations in local development environment
4. 📊 Benchmark query performance before migration (baseline)
5. 🔍 Audit all code for coordinate column references

### Medium-term (3-6 weeks)
1. 🚀 Execute Phase 0-3 migrations (expand, backfill, create views)
2. 💻 Update application code to use new column names
3. 🧪 Run comprehensive E2E test suite
4. 📚 Update TypeScript type definitions
5. 🎯 Implement branded types for critical paths

### Long-term (7-10 weeks)
1. 🏁 Execute Phase 4-6 migrations (contract, cleanup)
2. 📝 Update all documentation
3. 🗑️ Remove mapping layer from codebase
4. ✅ Verify zero references to old column names
5. 🎉 Migration complete!

---

**Report prepared by**: Data Researcher Agent
**Date**: 2026-02-14
**Project**: Quiver Coordinate Column Migration
**Status**: Research Complete - Ready for Team Review
