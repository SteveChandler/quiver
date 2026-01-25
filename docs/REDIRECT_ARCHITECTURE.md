# Redirect Architecture

This document describes the SEO redirect system in Quiver, including all active redirect rules, canonical URL formats, and guidelines for adding new redirects without creating conflicts.

## Table of Contents

- [Overview](#overview)
- [Canonical URL Formats](#canonical-url-formats)
- [Active Redirect Rules](#active-redirect-rules)
- [URL Pattern Classification](#url-pattern-classification)
- [Adding New Redirects](#adding-new-redirects)
- [Testing Requirements](#testing-requirements)
- [Incident History](#incident-history)
- [File Reference](#file-reference)

## Overview

The redirect system handles URL canonicalization for SEO purposes. It converts legacy, non-canonical URLs to their canonical equivalents using 301 redirects.

**Key Principles:**

1. **Single Source of Truth**: Each content type has exactly one canonical URL format
2. **No Bidirectional Redirects**: If A redirects to B, B must NEVER redirect to A
3. **Maximum 2 Hops**: No redirect chain should exceed 2 hops
4. **Fail Open**: If anything goes wrong, don't redirect (let request pass through)

## Canonical URL Formats

### Intent Pages (City-level)

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Canonical** | `/{intent}/{city}` | `/beginner/san-diego` | Used in sitemap |
| Legacy | `/{intent}/{state}/{city}` | `/beginner/ca/san-diego` | Redirects to canonical |
| Legacy | `/{intent}/{state}/{city}/{beach}` | `/beginner/ca/san-diego/blacks` | Redirects to canonical |

### Intent Pages (State-level)

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Canonical** | `/{intent}/{state}` | `/beginner/ca` | Used in sitemap |

### State Index Pages

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Canonical** | `/beaches/usa/{state}` | `/beaches/usa/ca` | Used in sitemap |
| Legacy | `/{state}` | `/ca` | Redirects to canonical |

### City Location Pages

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Canonical (USA)** | `/beaches/usa/{state}/{city}` | `/beaches/usa/ca/san-diego` | Used in sitemap |
| **Canonical (Intl)** | `/beaches/{country}/{region}/{city}` | `/beaches/mexico/baja-california/rosarito` | Used in sitemap |

### Beach Detail Pages

| Type | Format | Example | Notes |
|------|--------|---------|-------|
| **Canonical (Complete)** | `/{state}/{city}/{beach}` | `/ca/san-diego/blacks` | When city+state known |
| **Canonical (Incomplete)** | `/spots/{beach}` | `/spots/mystery-break` | When city/state missing |
| Legacy (Mexico) | `/mexico/{region}/{city}/{beach}` | `/mexico/baja-california/rosarito/alfonsos` | Redirects to /spots/ |

## Active Redirect Rules

### Rule 1: State-Only URLs

**Pattern:** `/{state}` (where state is a valid 2-letter US state code)
**Target:** `/beaches/usa/{state}`
**Example:** `/ca` → `/beaches/usa/ca`

```typescript
// Classification: "state-only"
// Handler: handleStateOnlyRedirect()
```

### Rule 2: Intent City Legacy (3-segment)

**Pattern:** `/{intent}/{state}/{city}`
**Target:** `/{intent}/{city}`
**Example:** `/sunset/ca/san-diego` → `/sunset/san-diego`

```typescript
// Classification: "intent-city-legacy"
// Handler: handleIntentCityLegacyRedirect()
```

### Rule 3: Intent Beach Legacy (4-segment)

**Pattern:** `/{intent}/{state}/{city}/{beach}`
**Target:** `/{intent}/{city}`
**Example:** `/sunset/ca/san-diego/blacks` → `/sunset/san-diego`

```typescript
// Classification: "intent-beach-legacy"
// Handler: handleIntentBeachLegacyRedirect()
```

### Rule 4: US Beach City Correction

**Pattern:** `/{state}/{wrong-city}/{beach}`
**Target:** `/{state}/{correct-city}/{beach}` (via DB lookup)
**Example:** `/ca/orange-county/doheny-state-beach` → `/ca/dana-point/doheny-state-beach`

```typescript
// Classification: "us-beach"
// Handler: handleUsBeachRedirect()
```

### Rule 5: Mexico Beach URLs

**Pattern:** `/mexico/{region}/{city}/{beach}`
**Target:** `/spots/{beach}`
**Example:** `/mexico/baja-california/rosarito/alfonsos` → `/spots/alfonsos`

```typescript
// Classification: "mexico-beach"
// Handler: handleMexicoBeachRedirect()
```

### Deleted Rules (Historical)

> **WARNING:** These rules were removed because they caused redirect loops.
> Do NOT re-implement them.

#### ~~Legacy Intent Redirect (REMOVED in b9ac3fd8)~~

**Pattern:** ~~`/{intent}/{city}` → `/{intent}/{state}/{city}`~~

This rule was removed because it conflicted with Rule 2, creating a bidirectional redirect loop:
- `/water-temp/santa-cruz` → `/water-temp/ca/santa-cruz` (this rule)
- `/water-temp/ca/santa-cruz` → `/water-temp/santa-cruz` (Rule 2)

Result: 826 redirect loops detected by Ahrefs crawl.

## URL Pattern Classification

The `classifyUrlPattern()` function determines how each URL should be handled:

| Pattern Type | Segment Count | First Segment | Example |
|--------------|---------------|---------------|---------|
| `state-only` | 1 | Valid state slug | `/ca` |
| `us-beach` | 3 | Valid state slug | `/ca/san-diego/blacks` |
| `mexico-beach` | 4 | `mexico` | `/mexico/baja/rosarito/spot` |
| `intent-city-legacy` | 3 | Intent slug + valid state in pos 2 | `/sunset/ca/san-diego` |
| `intent-beach-legacy` | 4 | Intent slug + valid state in pos 2 | `/sunset/ca/san-diego/blacks` |
| `none` | - | Reserved path or no match | `/api/health`, `/beginner/san-diego` |

**Valid Intent Slugs:**
- `beginner`
- `longboard`
- `tide`
- `water-temp`
- `dawn-patrol`
- `sunset`
- `least-crowded`

**Valid State Slugs:**
- All 50 US states (2-letter codes, lowercase)
- Puerto Rico (`pr`)
- US Virgin Islands (`vi`)

## Adding New Redirects

### Pre-Implementation Checklist

Before adding any new redirect rule:

- [ ] **Check for inverse redirect**: Does the target URL currently redirect anywhere?
- [ ] **Check for existing rules**: Does a rule already handle this pattern?
- [ ] **Verify canonical format**: Is the target URL the documented canonical format?
- [ ] **Consider sitemap impact**: Will this require sitemap changes?

### Implementation Steps

1. **Document the rule** in this file first (add to Active Redirect Rules section)
2. **Add classification** in `classifyUrlPattern()` if needed
3. **Implement handler** following existing patterns
4. **Add tests** in `redirect-chain-validation.test.ts`:
   - Test the redirect works correctly
   - Test the target URL does NOT redirect
   - Test the redirect chain has no loops
5. **Update sitemap** if canonical format changes

### Code Template

```typescript
// In seo-redirect-handler.ts

/**
 * Rule N: [Rule Name]
 * Pattern: /{old}/{format}
 * Target: /{new}/{format}
 * Example: /old/path → /new/path
 */
function handleNewRedirect(pathname: string): SeoRedirectResult {
  // 1. Parse the URL
  const segments = pathname.split("/").filter(Boolean);

  // 2. Validate the pattern
  if (!isValidPattern(segments)) {
    return { redirect: false };
  }

  // 3. Build the canonical URL
  const redirectUrl = `/${segments[x]}/${segments[y]}`;

  // 4. Return redirect
  console.log(`[SEO Redirect] ${pathname} → ${redirectUrl}`);
  return { redirect: true, url: redirectUrl };
}
```

## Testing Requirements

### Required Tests for New Redirects

1. **Basic redirect test**: Verify the redirect returns correct target URL
2. **Inverse test**: Verify the target URL does NOT redirect
3. **Chain test**: Follow the complete chain and verify no loops
4. **Sitemap test**: Verify canonical URLs are in sitemap, legacy URLs are not

### Running Tests

```bash
# Run redirect validation tests
yarn test redirect-chain-validation

# Run sitemap validation tests
yarn test sitemap-redirect-validation

# Run all redirect-related tests
yarn test redirect
```

### Manual Verification

After deploying redirect changes:

```bash
# Test specific URLs with curl
curl -I https://quiversurf.com/water-temp/santa-cruz
# Should return: HTTP/2 200

curl -I https://quiversurf.com/water-temp/ca/santa-cruz
# Should return: HTTP/2 301, Location: /water-temp/santa-cruz

# Verify no redirect loop
curl -IL https://quiversurf.com/water-temp/ca/santa-cruz
# Should show only 2 responses (301 then 200)
```

## Incident History

### 2025-01-24: 826 Redirect Loops

**Detection:** Ahrefs crawl report
**Root Cause:** Bidirectional redirect between `/{intent}/{city}` ↔ `/{intent}/{state}/{city}`
**Fix:** Removed `handleLegacyIntentRedirect` (commit b9ac3fd8)
**Canonical Format:** 2-segment (`/{intent}/{city}`) established as canonical
**Prevention:** Added `redirect-chain-validation.test.ts` with loop detection

## File Reference

| File | Purpose |
|------|---------|
| `lib/middleware/seo-redirect-handler.ts` | Redirect logic implementation |
| `__tests__/lib/middleware/seo-redirect-handler.test.ts` | Unit tests for redirect handlers |
| `__tests__/lib/middleware/redirect-chain-validation.test.ts` | Loop detection and chain validation |
| `__tests__/app/sitemap-redirect-validation.test.ts` | Sitemap canonical URL validation |
| `app/sitemap.ts` | Sitemap generation (must use canonical URLs) |
| `docs/REDIRECT_ARCHITECTURE.md` | This documentation |

---

**Last Updated:** 2025-01-25
**Maintainers:** @engineering-team
