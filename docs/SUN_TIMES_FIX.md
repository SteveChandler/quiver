# Sun Times Table Fix - Implementation Guide

## Problem Summary

The `sun_times` table is empty despite having code that should populate it. This document provides the root cause analysis and step-by-step fix.

## Root Cause Analysis

### Issue 1: Schema Constraint Conflict

Migration `20250820132500_ensure_sun_times_cache.sql` attempted to add a PRIMARY KEY on `(beach_id, date)`, conflicting with the existing UNIQUE constraint on `(beach_id, date, source)` from migration `20250808000110`.

**Schema conflict:**
- **Original design**: UUID `id` column as PRIMARY KEY
- **Unique constraint**: `sun_times_unique` on `(beach_id, date, source)` - allows multiple sources per beach/date
- **Problematic migration**: Tried to add PK on `(beach_id, date)` - only allows one row per beach/date
- **Code expectation**: Upsert with `onConflict: "beach_id,date,source"`

The schema ended up in an inconsistent state where the upsert operations fail silently.

### Issue 2: Silent Error Handling

The cron job code didn't log Supabase upsert errors, only JavaScript exceptions:

```javascript
const { error } = await supabase
  .from("sun_times")
  .upsert([row], { onConflict: "beach_id,date,source" });
if (!error) addedSun += 1;
// Error is silently ignored!
```

This meant that constraint violations and other database errors went unnoticed.

## Solution

### Part 1: Database Migration

**File**: `/supabase/migrations/20260118055525_fix_sun_times_constraints.sql`

This migration:
1. Ensures `id` is the PRIMARY KEY (not `beach_id, date`)
2. Ensures UNIQUE constraint exists on `(beach_id, date, source)` for upserts
3. Removes any conflicting PK on `(beach_id, date)` if it was added
4. Verifies source check constraint allows 'computed'
5. Adds index for efficient queries

**To apply:**

```bash
# Deploy to production (via Supabase CLI)
supabase db push

# OR via Supabase dashboard:
# Go to SQL Editor and run the migration file contents
```

### Part 2: Code Fix - Error Logging

**File**: `/app/api/cron/forecasts/refresh/route.ts` (lines 458-471)

Updated the sun times upsert to log detailed error information:

```javascript
if (error) {
  console.error("[Sun Times] Upsert error for beach", b.name, {
    beachId: b.id,
    date: row.date,
    lat: b.lat,
    lon: b.lon,
    error: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
} else {
  addedSun += 1;
}
```

This provides visibility into any future issues with the sun times population.

## Manual Population Steps

After applying the migration and code fix, populate the sun_times table:

### Option 1: Trigger via Cron Endpoint (Recommended)

```bash
# Trigger sun times population for all beaches
curl -X GET "https://your-domain.vercel.app/api/cron/forecasts/refresh?source=sun" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or trigger for a specific beach for testing
curl -X GET "https://your-domain.vercel.app/api/cron/forecasts/refresh?source=sun&beachId=YOUR_BEACH_ID" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Option 2: Via Vercel Cron Dashboard

1. Go to Vercel Dashboard > Your Project > Cron Jobs
2. Find the forecast refresh job
3. Click "Run Now" to trigger immediately

### Option 3: Wait for Scheduled Cron

The cron job runs daily at 2:30 AM UTC. After deploying the fix, it will automatically populate on the next run.

## Verification

### 1. Check Row Count

```sql
-- Should show rows after population
SELECT COUNT(*) as total_rows FROM public.sun_times;

-- Check by source
SELECT source, COUNT(*) as count
FROM public.sun_times
GROUP BY source;
```

### 2. Check Recent Data

```sql
-- Should show sun times for next 5 days
SELECT
  b.name,
  st.date,
  st.sunrise_utc,
  st.sunset_utc,
  st.source,
  st.created_at
FROM public.sun_times st
JOIN public.beaches b ON b.id = st.beach_id
WHERE st.date >= CURRENT_DATE
  AND st.date <= CURRENT_DATE + INTERVAL '5 days'
ORDER BY b.name, st.date
LIMIT 20;
```

### 3. Verify Constraints

```sql
-- Check constraints
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.sun_times'::regclass
ORDER BY contype, conname;

-- Expected constraints:
-- PRIMARY KEY on id
-- UNIQUE on (beach_id, date, source)
-- CHECK on source IN ('open-meteo', 'computed')
-- FOREIGN KEY beach_id -> beaches(id)
```

### 4. Check Logs

After triggering the cron job, check Vercel logs:

```bash
vercel logs --app=your-app-name --since=10m
```

Look for:
- `[Forecast Refresh] Starting` - confirms cron ran
- `[Sun Times] Upsert error` - if any issues (should be none after fix)
- Log line showing `sun: X` in the summary - confirms rows added

## Testing

### Test Upsert Behavior

```sql
-- Test insert (should work)
INSERT INTO public.sun_times (beach_id, date, source, sunrise_utc, sunset_utc)
SELECT
  id,
  CURRENT_DATE,
  'computed',
  (CURRENT_DATE + TIME '06:00:00')::timestamptz,
  (CURRENT_DATE + TIME '18:00:00')::timestamptz
FROM public.beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL
LIMIT 1;

-- Test upsert (should update, not error)
INSERT INTO public.sun_times (beach_id, date, source, sunrise_utc, sunset_utc)
SELECT
  id,
  CURRENT_DATE,
  'computed',
  (CURRENT_DATE + TIME '06:30:00')::timestamptz,
  (CURRENT_DATE + TIME '18:30:00')::timestamptz
FROM public.beaches
WHERE lat IS NOT NULL AND lon IS NOT NULL
LIMIT 1
ON CONFLICT (beach_id, date, source) DO UPDATE SET
  sunrise_utc = EXCLUDED.sunrise_utc,
  sunset_utc = EXCLUDED.sunset_utc;

-- Verify update worked
SELECT * FROM public.sun_times
WHERE date = CURRENT_DATE
ORDER BY created_at DESC
LIMIT 1;
```

## Rollback Plan

If issues arise:

1. **Rollback migration** (if needed):
   ```sql
   -- This shouldn't be needed as the migration is idempotent
   -- But if you need to restore the conflicting state:
   -- DO NOT DO THIS unless you understand the implications
   ```

2. **Rollback code changes**:
   ```bash
   git revert HEAD  # Reverts the error logging changes
   ```

3. **Clear bad data** (if needed):
   ```sql
   TRUNCATE public.sun_times;
   ```

## Future Improvements

1. **Add monitoring**: Set up alerts for empty sun_times table
2. **Add data validation**: Verify lat/lon are not null before calling SunCalc
3. **Add retry logic**: Retry failed upserts with exponential backoff
4. **Add metrics**: Track sun_times population success rate

## Schema Reference

### Final sun_times Schema

```sql
CREATE TABLE public.sun_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  beach_id uuid NOT NULL REFERENCES public.beaches(id) ON DELETE CASCADE,
  date date NOT NULL,
  sunrise_utc timestamptz,
  sunset_utc timestamptz,
  source text NOT NULL CHECK (source IN ('open-meteo', 'computed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sun_times_unique UNIQUE (beach_id, date, source)
);

CREATE INDEX idx_sun_times_beach_date ON public.sun_times (beach_id, date);
```

## Migration History

- `20250808000100` - Initial sun_times table creation
- `20250808000110` - Added sun_times_unique constraint on (beach_id, date, source)
- `20250808124500` - Updated source check to allow 'computed'
- `20250820132500` - Attempted to add PK on (beach_id, date) - caused conflict
- `20260118055525` - **FIX**: Resolved constraint conflicts

## Related Files

- Migration: `/supabase/migrations/20260118055525_fix_sun_times_constraints.sql`
- Cron job: `/app/api/cron/forecasts/refresh/route.ts`
- Documentation: `/docs/SUN_TIMES_FIX.md` (this file)

## Contact

If you encounter issues after applying this fix, check:
1. Vercel logs for detailed error messages
2. Supabase logs in the dashboard
3. Run the verification SQL queries above

---

**Status**: Ready to deploy
**Created**: 2026-01-18
**Author**: Database fix for empty sun_times table
