# Visual Regression Tests

This directory contains visual regression tests for the Quiver application.

## Landing Page Images Test

**File:** `landing-page-images.spec.ts`

### Purpose

Comprehensive visual regression tests for the landing page surf highlights section to prevent:
- Broken images (images that fail to load)
- Duplicate images (same image appearing multiple times)
- Incorrect proxy routing (external images not using proxy endpoint)
- Visual regressions in layout and design

### Test Suites

#### 1. Image Loading Validation

Tests that verify all images load successfully:
- ✅ All surf spot card images load (naturalWidth > 0 and naturalHeight > 0)
- ✅ No broken image placeholders visible
- ✅ All images have proper alt text for accessibility
- ✅ Images load within acceptable time (< 10 seconds)

#### 2. Image Uniqueness Validation

Tests that prevent duplicate images:
- ✅ No duplicate images displayed across all cards
- ✅ Each beach card shows a different image
- ✅ Duplicate prevention logic prioritizes beaches with photos

#### 3. Proxy URL Validation

Tests for correct image proxy usage:
- ✅ External images (Openverse, Flickr, etc.) use `/api/image-proxy?url=`
- ✅ Proxy URLs have properly encoded original URLs
- ✅ Local fallback images NOT proxied (served directly)
- ✅ Proxy endpoint accessible and returns valid images

#### 4. Visual Snapshot Testing

Visual regression detection:
- ✅ Desktop viewport snapshot (1280x800)
- ✅ Mobile viewport snapshot (375x667)
- ✅ Tablet viewport snapshot (768x1024)
- ✅ Individual beach card snapshot
- ✅ Full landing page snapshot

#### 5. Error Handling & Edge Cases

Graceful degradation tests:
- ✅ Network errors handled gracefully
- ✅ Slow image loading shows skeletons
- ✅ Missing images handled with fallbacks

### Running the Tests

```bash
# Run all visual tests
yarn test:e2e e2e/visual/

# Run only landing page image tests
yarn test:e2e e2e/visual/landing-page-images.spec.ts

# Run with UI (helpful for debugging)
yarn test:e2e:ui e2e/visual/landing-page-images.spec.ts

# Update visual snapshots (after intentional UI changes)
yarn test:e2e e2e/visual/landing-page-images.spec.ts --update-snapshots
```

### Key Features

1. **Comprehensive Image Validation**: Checks every image's loading state, dimensions, and validity
2. **Duplicate Detection**: Prevents the bug where the same image appeared multiple times
3. **Proxy Verification**: Ensures external images are properly proxied for security and optimization
4. **Visual Regression**: Snapshots catch unintended layout or styling changes
5. **Error Handling**: Verifies graceful degradation when images fail to load

### Test Data

The tests use:
- Real landing page data (from `/api/beaches/featured`)
- Actual image URLs (both external and local fallbacks)
- No mocked data for authentic testing

### Selectors Used

```typescript
const SELECTORS = {
  surfHighlightsSection: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4',
  surfSpotCards: 'a[href^="/beach/"]',
  surfSpotImages: 'a[href^="/beach/"] img',
  loadingSkeleton: '.bg-gray-200.rounded-xl.animate-pulse',
};
```

### Expected Behavior

**✅ Passing Tests Indicate:**
- All images load successfully
- No duplicate images shown
- External images properly proxied
- Visual appearance matches baseline
- Error handling works correctly

**❌ Failing Tests Indicate:**
- Broken images (naturalWidth/Height = 0)
- Duplicate images displayed
- External images not proxied
- Visual regression detected
- Poor error handling

### Maintenance

**When to Update Snapshots:**
- After intentional UI/design changes
- When beach card layout changes
- When image loading logic changes

**How to Update:**
```bash
yarn test:e2e e2e/visual/landing-page-images.spec.ts --update-snapshots
```

**Important:** Review snapshot diffs carefully before updating to ensure changes are intentional.

### Troubleshooting

**Images Not Loading in Tests:**
1. Check if API endpoint `/api/beaches/featured` is working
2. Verify Supabase database has beach data with `photo_url`
3. Check network tab for failed image requests

**Duplicate Image Failures:**
1. Review `surf-highlights-section.tsx` duplicate prevention logic
2. Check if `usedImages` Set is working correctly
3. Verify fallback image assignment logic

**Proxy URL Failures:**
1. Check `getProxiedImageUrl()` function in `lib/utils/image-utils.ts`
2. Verify `/api/image-proxy/route.ts` is accessible
3. Check allowed domains in proxy route

**Visual Snapshot Failures:**
1. Review the diff in Playwright trace viewer
2. Determine if change is intentional or regression
3. Update snapshots if intentional, fix code if regression

### CI/CD Integration

These tests run automatically on:
- Pull requests (prevents broken images from merging)
- Main branch commits (catches regressions)
- Nightly builds (comprehensive validation)

### Related Files

- **Component:** `/components/landing-page/surf-highlights-section.tsx`
- **Card Component:** `/components/landing-page/surf-spot-card.tsx`
- **Image Proxy:** `/app/api/image-proxy/route.ts`
- **Image Utils:** `/lib/utils/image-utils.ts`
- **Image Proxy Utils:** `/lib/image-proxy.ts`

### Coverage

This test suite covers the bug that was previously missed:
- ✅ Broken images (images with invalid URLs or failed loads)
- ✅ Duplicate images (same image appearing on multiple cards)
- ✅ Incorrect routing (external images not proxied)

### Future Enhancements

Potential additions:
- [ ] Image performance metrics (LCP, image load time)
- [ ] Accessibility contrast ratio validation
- [ ] Image size optimization checks
- [ ] Lazy loading behavior verification
- [ ] WebP/AVIF format support verification
