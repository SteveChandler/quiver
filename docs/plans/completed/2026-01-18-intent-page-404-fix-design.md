# Intent Page 404 Fix Design

**Date:** 2026-01-18
**Status:** Ready for implementation

## Problem

Google Search Console shows 105 pages returning 404 errors. The majority are **intent pages** like `/beginner/rincon` and `/tide/cardiff-by-the-sea` that should render but fail due to city lookup issues.

### Root Causes

1. **Accented characters** - Database has `Rincón` (with accent), URL slug is `rincon` (no accent). PostgreSQL `ILIKE` doesn't match across accents.

2. **Hyphenated city names** - Database has `Cardiff-by-the-Sea` (hyphens), slug resolver produces `cardiff by the sea` (spaces). Pattern doesn't match.

### Affected Pages

- All Rincón intent pages (~6 beaches × 7 intents = 42 pages)
- All Cardiff intent pages (~3 beaches × 7 intents = 21 pages)
- Total: ~63 pages currently 404ing

---

## Solution

Use PostgreSQL `unaccent` extension and normalize hyphens in queries.

### 1. Database Extension

Enable the `unaccent` extension to strip diacritics during queries:

```sql
CREATE EXTENSION IF NOT EXISTS unaccent;
```

**Why safe:**
- Trusted extension included in PostgreSQL core
- Read-only (doesn't modify data)
- Supabase supports it out of the box

### 2. Query Changes

**Current query in `findCityBySlug`:**
```typescript
.ilike("city", `%${cityPattern}%`)
```

**Updated query:**
```typescript
.or(`unaccent(city) ilike unaccent('%${cityPattern}%'), ` +
    `unaccent(replace(city, '-', ' ')) ilike unaccent('%${cityPattern}%')`)
```

**What this does:**
1. `unaccent(city)` - strips accents from database value
2. `unaccent('%pattern%')` - strips accents from search pattern
3. `replace(city, '-', ' ')` - normalizes hyphens to spaces

### 3. Slug Resolver Update

Add input normalization to handle edge cases where users paste accented URLs:

```typescript
// In resolveCityFromSlug, normalize input:
const normalizedSlug = slug
  .toLowerCase()
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, ""); // Strip diacritics
```

---

## Files to Modify

| File | Change |
|------|--------|
| `supabase/migrations/YYYYMMDDHHMMSS_enable_unaccent_extension.sql` | New migration |
| `actions/city/city-metadata-actions.ts` | Update `findCityBySlug` query |
| `lib/seo/city-slug-utils.ts` | Add input normalization |

---

## Testing Strategy

### Unit Tests

```typescript
// __tests__/lib/seo/city-slug-utils.test.ts
describe('resolveCityFromSlug', () => {
  it('normalizes accented input slugs', () => {
    expect(resolveCityFromSlug('rincón')).toEqual({
      cityPattern: 'rincon',
      stateFilter: null
    });
  });

  it('handles hyphenated city names', () => {
    expect(resolveCityFromSlug('cardiff-by-the-sea')).toEqual({
      cityPattern: 'cardiff by the sea',
      stateFilter: null
    });
  });
});
```

### Integration Tests

```typescript
// __tests__/actions/city-metadata-actions.test.ts
describe('findCityBySlug', () => {
  it('finds Rincón with unaccented slug', async () => {
    const result = await findCityBySlug('rincon');
    expect(result.success).toBe(true);
    expect(result.data?.cityName).toBe('Rincón');
  });

  it('finds Cardiff-by-the-Sea with hyphenated slug', async () => {
    const result = await findCityBySlug('cardiff-by-the-sea');
    expect(result.success).toBe(true);
    expect(result.data?.cityName).toBe('Cardiff-by-the-Sea');
  });
});
```

### Manual Verification

- `/beginner/rincon` → should render, not 404
- `/tide/cardiff-by-the-sea` → should render, not 404

---

## Rollout Plan

1. Deploy migration first (enable extension)
2. Deploy code changes
3. Verify pages render correctly
4. Monitor Search Console for 404 count decrease over next few days

---

## Rollback

If issues arise:

1. Revert code changes (query reverts to simple ILIKE)
2. Extension can remain enabled (no impact on other queries)

```sql
-- Only if needed:
DROP EXTENSION IF EXISTS unaccent;
```

---

## Success Criteria

- [ ] `/beginner/rincon` returns 200
- [ ] `/tide/cardiff-by-the-sea` returns 200
- [ ] All 7 intent pages work for both cities
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Search Console 404 count decreases within 1 week
