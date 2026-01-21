# SEO Redirect Middleware Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add slug-based redirect logic to middleware to recover 48 Google Search Console 404s.

**Architecture:** Extend existing `middleware.ts` with a new `SeoRedirectHandler` module that performs database lookups to find beaches by slug and redirects to canonical URLs. Fails open (passes through to normal routing) on errors.

**Tech Stack:** Next.js Middleware, Supabase (direct fetch to avoid SSR client overhead), TypeScript

---

## Task 1: Create SEO Redirect Handler Module

**Files:**
- Create: `lib/middleware/seo-redirect-handler.ts`
- Test: `__tests__/lib/middleware/seo-redirect-handler.test.ts`

**Step 1: Write the failing test for slug extraction**

```typescript
// __tests__/lib/middleware/seo-redirect-handler.test.ts
import { extractBeachSlugFromPath, isOldBeachUrlPattern } from '@/lib/middleware/seo-redirect-handler';

describe('SeoRedirectHandler', () => {
  describe('isOldBeachUrlPattern', () => {
    it('matches 3-segment state/city/beach URLs', () => {
      expect(isOldBeachUrlPattern('/ca/orange-county/huntington-pier')).toBe(true);
      expect(isOldBeachUrlPattern('/pr/rincn/indicators-rincon-pr')).toBe(true);
    });

    it('matches 4-segment mexico URLs', () => {
      expect(isOldBeachUrlPattern('/mexico/baja-california/rosarito/alfonsos')).toBe(true);
    });

    it('rejects non-beach patterns', () => {
      expect(isOldBeachUrlPattern('/api/health')).toBe(false);
      expect(isOldBeachUrlPattern('/auth/sign-in')).toBe(false);
      expect(isOldBeachUrlPattern('/ca/san-diego')).toBe(false); // only 2 segments after state
      expect(isOldBeachUrlPattern('/')).toBe(false);
    });
  });

  describe('extractBeachSlugFromPath', () => {
    it('extracts slug from 3-segment URL', () => {
      expect(extractBeachSlugFromPath('/ca/orange-county/huntington-pier')).toBe('huntington-pier');
    });

    it('extracts slug from 4-segment URL', () => {
      expect(extractBeachSlugFromPath('/mexico/baja-california/rosarito/alfonsos')).toBe('alfonsos');
    });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: FAIL with "Cannot find module"

**Step 3: Write minimal implementation**

```typescript
// lib/middleware/seo-redirect-handler.ts
import { isValidStateSlug, stateToSlug, cityToSlug } from '@/lib/utils/beach-url-utils';

/**
 * SEO Redirect Handler
 *
 * Handles 404 recovery for old beach URLs by looking up beaches by slug
 * and redirecting to canonical URLs.
 */

// Reserved first-segment paths that should never be treated as state/country
const RESERVED_PATHS = new Set([
  'api', '_next', 'auth', 'admin', 'app', 'beach', 'beaches', 'discover',
  'features', 'forecast', 'inbox', 'journal', 'map', 'privacy', 'profile',
  'sessions', 'share', 'spots', 's', 'user', 'error', '.well-known', 'about',
  'plan-session',
]);

/**
 * Check if a pathname matches the old beach URL pattern that might 404
 */
export function isOldBeachUrlPattern(pathname: string): boolean {
  const segments = pathname.split('/').filter(Boolean);

  // Must have 3 or 4 segments
  if (segments.length < 3 || segments.length > 4) {
    return false;
  }

  const firstSegment = segments[0]?.toLowerCase() || '';

  // Skip reserved paths
  if (RESERVED_PATHS.has(firstSegment)) {
    return false;
  }

  // 3 segments: /{state}/{city}/{beach} - state must be valid 2-letter code
  if (segments.length === 3) {
    return isValidStateSlug(firstSegment);
  }

  // 4 segments: /{country}/{region}/{city}/{beach} - for mexico URLs
  if (segments.length === 4) {
    return firstSegment === 'mexico';
  }

  return false;
}

/**
 * Extract the beach slug from an old URL pattern
 */
export function extractBeachSlugFromPath(pathname: string): string | null {
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 3 || segments.length === 4) {
    return segments[segments.length - 1] || null;
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/middleware/seo-redirect-handler.ts __tests__/lib/middleware/seo-redirect-handler.test.ts
git commit -m "feat(middleware): add SEO redirect handler with URL pattern detection"
```

---

## Task 2: Add Beach Lookup Function

**Files:**
- Modify: `lib/middleware/seo-redirect-handler.ts`
- Test: `__tests__/lib/middleware/seo-redirect-handler.test.ts`

**Step 1: Write the failing test for beach lookup**

```typescript
// Add to __tests__/lib/middleware/seo-redirect-handler.test.ts

describe('lookupBeachBySlug', () => {
  it('returns beach data when found', async () => {
    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { slug: 'doheny-state-beach', state: 'CA', city: 'Dana Point', name: 'Doheny State Beach' }
      ]),
    });

    const { lookupBeachBySlug } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await lookupBeachBySlug('doheny-state-beach');

    expect(result).toEqual({
      slug: 'doheny-state-beach',
      state: 'CA',
      city: 'Dana Point',
      name: 'Doheny State Beach',
    });
  });

  it('returns null when not found', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { lookupBeachBySlug } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await lookupBeachBySlug('nonexistent-beach');

    expect(result).toBeNull();
  });

  it('returns null on fetch error', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const { lookupBeachBySlug } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await lookupBeachBySlug('any-beach');

    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: FAIL with "lookupBeachBySlug is not a function"

**Step 3: Write implementation**

```typescript
// Add to lib/middleware/seo-redirect-handler.ts

export interface BeachLookupResult {
  slug: string;
  state: string | null;
  city: string | null;
  name: string;
}

/**
 * Lookup beach by slug using direct Supabase REST API
 * Uses fetch instead of Supabase client to avoid SSR overhead in middleware
 */
export async function lookupBeachBySlug(slug: string): Promise<BeachLookupResult | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('[SEO Redirect] Missing Supabase credentials');
      return null;
    }

    // Query beaches table for exact slug match
    const url = `${supabaseUrl}/rest/v1/beaches?slug=eq.${encodeURIComponent(slug)}&select=slug,state,city,name&limit=1`;

    const response = await fetch(url, {
      headers: {
        'apikey': supabaseAnonKey,
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      // Short timeout to avoid blocking requests
      signal: AbortSignal.timeout(500),
    });

    if (!response.ok) {
      console.warn('[SEO Redirect] Supabase query failed:', response.status);
      return null;
    }

    const data = await response.json();

    if (Array.isArray(data) && data.length > 0) {
      return data[0] as BeachLookupResult;
    }

    return null;
  } catch (error) {
    // Fail open - don't block requests on lookup errors
    console.warn('[SEO Redirect] Lookup error:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/middleware/seo-redirect-handler.ts __tests__/lib/middleware/seo-redirect-handler.test.ts
git commit -m "feat(middleware): add beach slug lookup via Supabase REST API"
```

---

## Task 3: Add Canonical URL Builder

**Files:**
- Modify: `lib/middleware/seo-redirect-handler.ts`
- Test: `__tests__/lib/middleware/seo-redirect-handler.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to __tests__/lib/middleware/seo-redirect-handler.test.ts

describe('buildCanonicalBeachUrl', () => {
  it('builds URL for US beach', () => {
    const { buildCanonicalBeachUrl } = require('@/lib/middleware/seo-redirect-handler');

    const result = buildCanonicalBeachUrl({
      slug: 'doheny-state-beach',
      state: 'CA',
      city: 'Dana Point',
      name: 'Doheny State Beach',
    });

    expect(result).toBe('/ca/dana-point/doheny-state-beach');
  });

  it('builds URL for Mexico beach (falls back to /spots/)', () => {
    const { buildCanonicalBeachUrl } = require('@/lib/middleware/seo-redirect-handler');

    const result = buildCanonicalBeachUrl({
      slug: 'alfonsos',
      state: 'Baja California',
      city: 'Rosarito',
      name: 'Alfonsos',
    });

    expect(result).toBe('/spots/alfonsos');
  });

  it('returns null for beach with missing data', () => {
    const { buildCanonicalBeachUrl } = require('@/lib/middleware/seo-redirect-handler');

    const result = buildCanonicalBeachUrl({
      slug: 'some-beach',
      state: null,
      city: null,
      name: 'Some Beach',
    });

    expect(result).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

```typescript
// Add to lib/middleware/seo-redirect-handler.ts

/**
 * Build canonical URL for a beach
 * Returns null if beach data is insufficient
 */
export function buildCanonicalBeachUrl(beach: BeachLookupResult): string | null {
  if (!beach.slug) {
    return null;
  }

  const stateSlug = stateToSlug(beach.state);
  const citySlug = cityToSlug(beach.city);

  // For US states, build hierarchical URL
  if (stateSlug && isValidStateSlug(stateSlug) && citySlug) {
    return `/${stateSlug}/${citySlug}/${beach.slug}`;
  }

  // For international beaches or missing data, fall back to /spots/ route
  if (beach.slug) {
    return `/spots/${beach.slug}`;
  }

  return null;
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/middleware/seo-redirect-handler.ts __tests__/lib/middleware/seo-redirect-handler.test.ts
git commit -m "feat(middleware): add canonical beach URL builder"
```

---

## Task 4: Add Main Handler Function

**Files:**
- Modify: `lib/middleware/seo-redirect-handler.ts`
- Test: `__tests__/lib/middleware/seo-redirect-handler.test.ts`

**Step 1: Write the failing test**

```typescript
// Add to __tests__/lib/middleware/seo-redirect-handler.test.ts

describe('handleSeoRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns redirect URL for city mismatch', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { slug: 'doheny-state-beach', state: 'CA', city: 'Dana Point', name: 'Doheny State Beach' }
      ]),
    });

    const { handleSeoRedirect } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await handleSeoRedirect('/ca/orange-county/doheny-state-beach');

    expect(result).toEqual({
      redirect: true,
      url: '/ca/dana-point/doheny-state-beach',
    });
  });

  it('returns no redirect when URL is already canonical', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([
        { slug: 'doheny-state-beach', state: 'CA', city: 'Dana Point', name: 'Doheny State Beach' }
      ]),
    });

    const { handleSeoRedirect } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await handleSeoRedirect('/ca/dana-point/doheny-state-beach');

    expect(result).toEqual({ redirect: false });
  });

  it('returns no redirect for non-beach URLs', async () => {
    const { handleSeoRedirect } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await handleSeoRedirect('/api/health');

    expect(result).toEqual({ redirect: false });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('returns no redirect when beach not found', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
    });

    const { handleSeoRedirect } = await import('@/lib/middleware/seo-redirect-handler');
    const result = await handleSeoRedirect('/ca/orange-county/nonexistent-beach');

    expect(result).toEqual({ redirect: false });
  });
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: FAIL

**Step 3: Write implementation**

```typescript
// Add to lib/middleware/seo-redirect-handler.ts

export interface SeoRedirectResult {
  redirect: boolean;
  url?: string;
}

/**
 * Main handler for SEO redirects
 * Returns redirect info if the URL should be redirected, otherwise { redirect: false }
 */
export async function handleSeoRedirect(pathname: string): Promise<SeoRedirectResult> {
  // Only process URLs matching old beach patterns
  if (!isOldBeachUrlPattern(pathname)) {
    return { redirect: false };
  }

  const slug = extractBeachSlugFromPath(pathname);
  if (!slug) {
    return { redirect: false };
  }

  // Lookup beach in database
  const beach = await lookupBeachBySlug(slug);
  if (!beach) {
    return { redirect: false };
  }

  // Build canonical URL
  const canonicalUrl = buildCanonicalBeachUrl(beach);
  if (!canonicalUrl) {
    return { redirect: false };
  }

  // Check if current URL matches canonical
  if (pathname.toLowerCase() === canonicalUrl.toLowerCase()) {
    return { redirect: false };
  }

  console.log(`[SEO Redirect] ${pathname} → ${canonicalUrl}`);
  return { redirect: true, url: canonicalUrl };
}
```

**Step 4: Run test to verify it passes**

```bash
yarn test __tests__/lib/middleware/seo-redirect-handler.test.ts
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/middleware/seo-redirect-handler.ts __tests__/lib/middleware/seo-redirect-handler.test.ts
git commit -m "feat(middleware): add main SEO redirect handler function"
```

---

## Task 5: Integrate into Middleware

**Files:**
- Modify: `middleware.ts:100-110` (add after diacritics redirect, before route classification)

**Step 1: Read current middleware location**

The SEO redirect should be inserted around line 108, after the `/pr/rinc-n` redirect and before the state root casing normalization.

**Step 2: Write the integration code**

Add this import at the top of `middleware.ts`:

```typescript
import { handleSeoRedirect } from "@/lib/middleware/seo-redirect-handler";
```

Add this block after line 107 (after the `/pr/rinc-n` redirect):

```typescript
  /**
   * SEO 404 Recovery
   *
   * Intercepts old beach URLs that return 404 due to:
   * - City name changes (e.g., orange-county → dana-point)
   * - URL typos (e.g., rincn → rincon)
   * - Mexico route structure changes
   *
   * Looks up beach by slug and redirects to canonical URL.
   */
  const seoResult = await handleSeoRedirect(pathname);
  if (seoResult.redirect && seoResult.url) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = seoResult.url;
    return NextResponse.redirect(redirectUrl, { status: 301 });
  }
```

**Step 3: Run existing middleware tests**

```bash
yarn test __tests__/middleware.test.ts
```

Expected: PASS (existing tests should still pass)

**Step 4: Commit**

```bash
git add middleware.ts
git commit -m "feat(middleware): integrate SEO redirect handler for 404 recovery"
```

---

## Task 6: Add E2E Tests

**Files:**
- Create: `e2e/seo-redirects.spec.ts`

**Step 1: Write E2E test**

```typescript
// e2e/seo-redirects.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SEO Redirect Recovery', () => {
  test('redirects city mismatch to canonical URL', async ({ page }) => {
    // This test requires the beach to exist in the database
    // Doheny State Beach is in Dana Point, not Orange County
    const response = await page.goto('/ca/orange-county/doheny-state-beach');

    // Should redirect with 301
    expect(response?.status()).toBe(200); // Final response after redirect
    expect(page.url()).toContain('/ca/dana-point/doheny-state-beach');
  });

  test('redirects Mexico beach to /spots/', async ({ page }) => {
    const response = await page.goto('/mexico/baja-california/rosarito/alfonsos');

    expect(response?.status()).toBe(200);
    expect(page.url()).toContain('/spots/alfonsos');
  });

  test('shows 404 for truly nonexistent beach', async ({ page }) => {
    const response = await page.goto('/ca/san-diego/definitely-not-a-real-beach-xyz');

    // Should show 404 page
    expect(response?.status()).toBe(404);
  });

  test('preserves query parameters on redirect', async ({ page }) => {
    await page.goto('/ca/orange-county/doheny-state-beach?tab=forecast');

    expect(page.url()).toContain('tab=forecast');
  });
});
```

**Step 2: Run E2E test (may need dev server)**

```bash
yarn test:e2e e2e/seo-redirects.spec.ts
```

Expected: Tests should pass against local dev server with seeded database

**Step 3: Commit**

```bash
git add e2e/seo-redirects.spec.ts
git commit -m "test(e2e): add SEO redirect recovery tests"
```

---

## Task 7: Manual Verification

**Step 1: Start dev server**

```bash
yarn dev
```

**Step 2: Test each category of 404 URL**

Open browser and verify these redirects:

| Test URL | Expected Redirect |
|----------|-------------------|
| `http://localhost:3000/ca/orange-county/doheny-state-beach` | `/ca/dana-point/doheny-state-beach` |
| `http://localhost:3000/ca/san-diego/blacks` | `/ca/la-jolla/blacks` |
| `http://localhost:3000/mexico/baja-california/rosarito/alfonsos` | `/spots/alfonsos` |
| `http://localhost:3000/ca/orange-county/nonexistent-beach` | 404 page |

**Step 3: Verify 301 status codes**

```bash
curl -I "http://localhost:3000/ca/orange-county/doheny-state-beach"
```

Expected: `HTTP/1.1 301 Moved Permanently` with `Location:` header

**Step 4: Final commit with verification notes**

```bash
git add -A
git commit -m "docs: add SEO redirect verification notes"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | URL pattern detection | `lib/middleware/seo-redirect-handler.ts` |
| 2 | Beach slug lookup | `lib/middleware/seo-redirect-handler.ts` |
| 3 | Canonical URL builder | `lib/middleware/seo-redirect-handler.ts` |
| 4 | Main handler function | `lib/middleware/seo-redirect-handler.ts` |
| 5 | Middleware integration | `middleware.ts` |
| 6 | E2E tests | `e2e/seo-redirects.spec.ts` |
| 7 | Manual verification | - |

**Total estimated commits:** 7
