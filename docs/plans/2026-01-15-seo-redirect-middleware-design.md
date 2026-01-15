# SEO Redirect Middleware Design

**Date:** 2026-01-15
**Status:** Ready for implementation
**Related:** [SEO 404 Recovery Analysis](./2026-01-15-seo-404-recovery-analysis.md)

## Problem

Google Search Console shows 48 pages returning 404 errors. These broken links hurt SEO rankings and user experience. The 404s are caused by:
1. URL city mismatches (e.g., `/orange-county/` but beach is in `huntington-beach`)
2. URL typos (e.g., `/pr/rincn/` instead of `/pr/rincon/`)
3. Unsupported route patterns (e.g., `/mexico/` URLs)
4. Deleted beaches (only 2: Seal Beach, Bolsa Chica)

## Solution

Next.js middleware that intercepts requests matching old URL patterns, looks up the beach by slug, and issues 301 redirects to canonical URLs.

### Redirect Cascade

1. **Exact slug match** - redirect to `/{state}/{city}/{slug}`
2. **Fuzzy name match** - redirect to closest beach if slug not found
3. **Region fallback** - redirect to `/{state}/{city}` listing page
4. **State fallback** - redirect to `/beaches/usa/{state}` listing page
5. **No match** - pass through to show existing 404 page

---

## Architecture

### File Location

`middleware.ts` (root level, Next.js convention)

### Trigger Pattern

Only URLs matching:
- `/{state}/{city}/{beach}` - 3 segments, first is 2-letter state code
- `/{country}/{region}/{city}/{beach}` - 4 segments, first is `mexico`

### Bypass Conditions

Pass through immediately without DB lookup:
- Static assets (`/_next/`, `/images/`, `/favicon.ico`, etc.)
- API routes (`/api/`)
- Auth routes (`/auth/`)
- App routes (`/app`, `/profile`, `/inbox`, `/discover`, etc.)
- Already-valid URLs (beach found with matching state+city)

### Database Query

Single lightweight query per request:

```sql
SELECT slug, state, city, name
FROM beaches
WHERE slug = $extracted_slug
   OR slug ILIKE $fuzzy_pattern
LIMIT 5
```

### Response Types

- `NextResponse.redirect(canonicalUrl, 301)` - permanent redirect for SEO
- `NextResponse.next()` - pass through to normal routing

---

## Redirect Logic

### Step 1: Extract URL Segments

```
/ca/orange-county/huntington-pier
 ↓
state = "ca", city = "orange-county", slug = "huntington-pier"
```

### Step 2: Exact Slug Lookup

- Query: `WHERE slug = 'huntington-pier'`
- If found: redirect to `/{beach.state}/{beach.city}/{beach.slug}`
- Example: `/ca/orange-county/huntington-pier` → `/ca/huntington-beach/huntington-beach-pier-southside`

### Step 3: Fuzzy Slug Matching

If exact match fails:
- Strip common suffixes: `-ca`, `-pr`, `-hi`, state names
- Try partial match: `WHERE slug ILIKE '%huntington-pier%'`
- Try name match: `WHERE LOWER(name) LIKE '%huntington pier%'`
- Pick best match (prefer same state)

### Step 4: City Typo Correction

- If slug found but city doesn't match URL, still redirect to canonical
- Handles: `/pr/rincn/beach` → `/pr/rincon/beach`

### Step 5: State/Region Fallback

- No beach found but state is valid: redirect to `/beaches/usa/{state}`
- City segment matches known city: redirect to `/{state}/{city}` listing

### Step 6: Pass Through

- No match found → `NextResponse.next()` → shows existing 404 page

---

## Special Cases

### Mexico Beaches

- Pattern: `/mexico/baja-california/rosarito/alfonsos`
- Extract slug from last segment: `alfonsos`
- Lookup beach, redirect to `/spots/{slug}`
- Example: `/mexico/baja-california/rosarito/alfonsos` → `/spots/alfonsos`

### State-Only URLs

- Pattern: `/ca`, `/nj`, `/pr`
- No slug to lookup
- Redirect to `/beaches/usa/{state}` if route exists
- Otherwise pass through to 404

### City-Only URLs

- Pattern: `/ca/malibu`, `/hi/honolulu`
- No beach slug
- Pass through to existing `app/[intent]/[city]/page.tsx` route

### Query Parameters

- Preserve during redirect
- Example: `/ca/orange-county/huntington-pier?tab=forecast` → `/ca/huntington-beach/huntington-beach-pier-southside?tab=forecast`

---

## Performance & Error Handling

### Database Connection

- Use existing Supabase client from `@/lib/supabase/server`
- Single query per request, indexed on `slug` column
- Query timeout: 500ms max, fail open on timeout

### Caching

- Leverage Vercel Edge caching for redirect responses
- 301 redirects cached by browsers (permanent)
- No in-memory cache needed

### Error Handling

```typescript
try {
  // slug lookup + redirect logic
} catch (error) {
  console.error('[SEO Middleware] Error:', error)
  return NextResponse.next()  // fail open, show normal 404
}
```

### Logging

- Redirects: `[SEO Redirect] /old/url → /new/url`
- Failures: `[SEO Redirect] No match for slug: xyz`
- Structured logging for Vercel/monitoring

### Graceful Degradation

- DB unavailable → pass through to 404
- Malformed URL → pass through to 404
- Multiple matches → pick first by state match, then alphabetically

---

## Testing Strategy

### Unit Tests (Jest)

```typescript
// __tests__/middleware.test.ts
describe('SEO Redirect Middleware', () => {
  it('redirects exact slug match to canonical URL')
  it('redirects city mismatch to correct city')
  it('handles URL typos (rincn → rincon)')
  it('redirects Mexico URLs to /spots/{slug}')
  it('passes through valid current URLs')
  it('passes through non-beach routes')
  it('fails open on database error')
  it('preserves query parameters')
})
```

### E2E Tests (Playwright)

```typescript
// e2e/seo-redirects.spec.ts
test('404 recovery redirects', async ({ page }) => {
  // City mismatch
  await page.goto('/ca/orange-county/doheny-state-beach')
  await expect(page).toHaveURL(/\/ca\/dana-point\/doheny-state-beach/)

  // Typo correction
  await page.goto('/pr/rincn/indicators-rincon-pr')
  await expect(page).toHaveURL(/\/pr\/rincon\//)

  // Mexico redirect
  await page.goto('/mexico/baja-california/rosarito/alfonsos')
  await expect(page).toHaveURL(/\/spots\/alfonsos/)
})
```

### Manual Verification

1. Test each of the 48 URLs from Search Console
2. Verify 301 status code (not 302)
3. Check redirect preserves SEO value

### Post-Deploy Monitoring

- Watch Search Console for 404 count decrease
- Monitor Vercel logs for redirect patterns
- Track any new 404s that appear

---

## Implementation Checklist

- [ ] Create `middleware.ts` with URL pattern matching
- [ ] Add slug lookup query to Supabase
- [ ] Implement redirect cascade logic
- [ ] Handle Mexico route special case
- [ ] Add logging and error handling
- [ ] Write unit tests
- [ ] Write E2E tests
- [ ] Deploy and monitor Search Console

---

## Future Considerations

1. **Add missing beaches:** Seal Beach and Bolsa Chica should be added to the database
2. **Mexico route support:** Consider adding proper `/mexico/` route if traffic warrants
3. **State landing pages:** Consider adding `/ca`, `/or` etc. as proper listing pages
4. **Redirect analytics:** Track which old URLs are most frequently hit
