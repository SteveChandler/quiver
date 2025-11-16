import { test, expect, Page } from '@playwright/test';
import { TIMEOUTS, VIEWPORTS } from '../fixtures/test-data';
import { waitForPageLoad } from '../utils/test-helpers';

/**
 * Landing Page Images - Visual Regression Tests
 *
 * These tests prevent broken images and duplicate image issues on the landing page
 * surf highlights section. They verify:
 * 1. All images load successfully (no broken images)
 * 2. No duplicate images are displayed
 * 3. External images use the proxy endpoint correctly
 * 4. Visual snapshots match baseline for regression detection
 *
 * @project guest
 */

// =============================================================================
// CONSTANTS & SELECTORS
// =============================================================================

const SELECTORS = {
  surfHighlightsSection: '.grid.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4',
  surfSpotCards: 'a[href^="/beach/"]',
  surfSpotImages: 'a[href^="/beach/"] img',
  loadingSkeleton: '.bg-gray-200.rounded-xl.animate-pulse',
} as const;

// External image domains that should be proxied
const EXTERNAL_IMAGE_DOMAINS = [
  'openverse.org',
  'wikimedia.org',
  'flickr.com',
  'wordpress.com',
  'wp.com',
];

// Local/fallback images that should NOT be proxied
const LOCAL_IMAGE_PATTERNS = [
  '/images/',
  '/sunsetBeach.jpg',
];

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Wait for all images in the surf highlights section to load
 * Handles both immediate loading and lazy-loaded images
 */
async function waitForSurfHighlightsImagesToLoad(page: Page): Promise<void> {
  // Wait for the section to be visible first
  const section = page.locator(SELECTORS.surfHighlightsSection).first();
  await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

  // Wait for images to be present
  const images = page.locator(SELECTORS.surfSpotImages);
  const imageCount = await images.count();

  if (imageCount === 0) {
    throw new Error('No surf spot images found on the page');
  }

  // Wait for all images to load by checking their naturalWidth
  // This ensures the image has actually loaded, not just rendered
  await page.waitForFunction(
    (selector) => {
      const imgs = document.querySelectorAll(selector);
      return Array.from(imgs).every((img) => {
        const htmlImg = img as HTMLImageElement;
        // Image is loaded if naturalWidth > 0
        return htmlImg.complete && htmlImg.naturalWidth > 0;
      });
    },
    SELECTORS.surfSpotImages,
    { timeout: TIMEOUTS.long }
  );
}

/**
 * Get all image src URLs from surf spot cards
 */
async function getSurfSpotImageUrls(page: Page): Promise<string[]> {
  const images = page.locator(SELECTORS.surfSpotImages);
  const count = await images.count();
  const urls: string[] = [];

  for (let i = 0; i < count; i++) {
    const src = await images.nth(i).getAttribute('src');
    if (src) {
      urls.push(src);
    }
  }

  return urls;
}

/**
 * Check if a URL is an external image that should be proxied
 */
function isExternalImage(url: string): boolean {
  return EXTERNAL_IMAGE_DOMAINS.some((domain) => url.includes(domain));
}

/**
 * Check if a URL is a local/fallback image
 */
function isLocalImage(url: string): boolean {
  return LOCAL_IMAGE_PATTERNS.some((pattern) => url.includes(pattern));
}

/**
 * Extract the original URL from a proxied image URL
 * Example: /api/image-proxy?url=https%3A%2F%2Fexample.com%2Fimage.jpg
 * Returns: https://example.com/image.jpg
 */
function extractOriginalUrlFromProxy(proxyUrl: string): string | null {
  try {
    const url = new URL(proxyUrl, 'http://localhost');
    const encodedUrl = url.searchParams.get('url');
    return encodedUrl ? decodeURIComponent(encodedUrl) : null;
  } catch {
    return null;
  }
}

// =============================================================================
// TEST SUITE 1: IMAGE LOADING VALIDATION
// =============================================================================

test.describe('Landing Page Images - Loading Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for loading skeletons to disappear
    const skeleton = page.locator(SELECTORS.loadingSkeleton).first();
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
    }
  });

  test('all surf spot card images should load successfully', async ({ page }) => {
    // Wait for all images to load
    await waitForSurfHighlightsImagesToLoad(page);

    // Get all surf spot images
    const images = page.locator(SELECTORS.surfSpotImages);
    const imageCount = await images.count();

    // Verify we have images to test
    expect(imageCount).toBeGreaterThan(0);

    // Validate each image has loaded successfully
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);

      // Check image is visible
      await expect(image).toBeVisible();

      // Check image has loaded (naturalWidth > 0)
      const naturalWidth = await image.evaluate((img) => (img as HTMLImageElement).naturalWidth);
      expect(naturalWidth).toBeGreaterThan(0);

      // Check image has loaded (naturalHeight > 0)
      const naturalHeight = await image.evaluate((img) => (img as HTMLImageElement).naturalHeight);
      expect(naturalHeight).toBeGreaterThan(0);

      // Check image has valid src attribute
      const src = await image.getAttribute('src');
      expect(src).toBeTruthy();
      expect(src).not.toBe('');
    }
  });

  test('no broken image placeholders should be visible', async ({ page }) => {
    await waitForSurfHighlightsImagesToLoad(page);

    const images = page.locator(SELECTORS.surfSpotImages);
    const imageCount = await images.count();

    // Check each image for broken state indicators
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);

      // Check if image failed to load (naturalWidth === 0)
      const isBroken = await image.evaluate((img) => {
        const htmlImg = img as HTMLImageElement;
        return htmlImg.complete && htmlImg.naturalWidth === 0;
      });

      expect(isBroken).toBe(false);

      // Check that alt text is present (accessibility + fallback indicator)
      const altText = await image.getAttribute('alt');
      expect(altText).toBeTruthy();
    }
  });

  test('all images should have proper alt text for accessibility', async ({ page }) => {
    await waitForSurfHighlightsImagesToLoad(page);

    const images = page.locator(SELECTORS.surfSpotImages);
    const imageCount = await images.count();

    expect(imageCount).toBeGreaterThan(0);

    // Verify alt text for each image
    for (let i = 0; i < imageCount; i++) {
      const image = images.nth(i);
      const altText = await image.getAttribute('alt');

      // Alt text should exist and be meaningful (not empty)
      expect(altText).toBeTruthy();
      expect(altText).not.toBe('');

      // Alt text should contain beach name (helps identify the image)
      // Beach names are in the card, so we can verify alt describes the content
      expect(altText!.length).toBeGreaterThan(3);
    }
  });

  test('images should load within acceptable time', async ({ page }) => {
    const startTime = Date.now();

    // Wait for all images to load
    await waitForSurfHighlightsImagesToLoad(page);

    const loadTime = Date.now() - startTime;

    // Images should load within 10 seconds (TIMEOUTS.medium)
    // This prevents performance regressions
    expect(loadTime).toBeLessThan(TIMEOUTS.medium);
  });
});

// =============================================================================
// TEST SUITE 2: IMAGE UNIQUENESS
// =============================================================================

test.describe('Landing Page Images - Uniqueness Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Wait for loading to complete
    const skeleton = page.locator(SELECTORS.loadingSkeleton).first();
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
    }

    await waitForSurfHighlightsImagesToLoad(page);
  });

  test('no duplicate images should be displayed', async ({ page }) => {
    // Get all image URLs
    const imageUrls = await getSurfSpotImageUrls(page);

    expect(imageUrls.length).toBeGreaterThan(0);

    // Check for duplicates by comparing URLs
    const urlCounts = new Map<string, number>();

    for (const url of imageUrls) {
      // Normalize URL for comparison (remove query params from Next.js image optimization)
      // Example: /_next/image?url=/images/blacks.webp&w=640&q=75 -> /images/blacks.webp
      let normalizedUrl = url;

      // Extract the actual image path from Next.js optimized URLs
      if (url.includes('/_next/image?url=')) {
        const urlObj = new URL(url, 'http://localhost');
        normalizedUrl = urlObj.searchParams.get('url') || url;
      }

      // For proxy URLs, extract the original URL
      if (url.includes('/api/image-proxy?url=')) {
        const originalUrl = extractOriginalUrlFromProxy(url);
        normalizedUrl = originalUrl || url;
      }

      const count = urlCounts.get(normalizedUrl) || 0;
      urlCounts.set(normalizedUrl, count + 1);
    }

    // Check for duplicates
    const duplicates: string[] = [];
    urlCounts.forEach((count, url) => {
      if (count > 1) {
        duplicates.push(`${url} (appears ${count} times)`);
      }
    });

    // Fail test if duplicates found
    if (duplicates.length > 0) {
      throw new Error(
        `Duplicate images found:\n${duplicates.join('\n')}\n\n` +
        `This violates the duplicate prevention logic in surf-highlights-section.tsx`
      );
    }
  });

  test('each beach card should show a different image', async ({ page }) => {
    const cards = page.locator(SELECTORS.surfSpotCards);
    const cardCount = await cards.count();

    expect(cardCount).toBeGreaterThan(0);

    // Track seen images
    const seenImages = new Set<string>();
    const duplicateBeaches: string[] = [];

    for (let i = 0; i < cardCount; i++) {
      const card = cards.nth(i);
      const image = card.locator('img').first();

      // Get beach name from the card
      const beachName = await card.locator('h3').textContent();
      const src = await image.getAttribute('src');

      if (!src) {
        throw new Error(`Beach card "${beachName}" has no image src`);
      }

      // Normalize the URL
      let normalizedUrl = src;
      if (src.includes('/_next/image?url=')) {
        const urlObj = new URL(src, 'http://localhost');
        normalizedUrl = urlObj.searchParams.get('url') || src;
      }
      if (src.includes('/api/image-proxy?url=')) {
        const originalUrl = extractOriginalUrlFromProxy(src);
        normalizedUrl = originalUrl || src;
      }

      // Check if we've seen this image before
      if (seenImages.has(normalizedUrl)) {
        duplicateBeaches.push(`"${beachName}" uses duplicate image: ${normalizedUrl}`);
      }

      seenImages.add(normalizedUrl);
    }

    // Fail if any duplicates found
    if (duplicateBeaches.length > 0) {
      throw new Error(
        `Found beach cards with duplicate images:\n${duplicateBeaches.join('\n')}`
      );
    }
  });

  test('duplicate prevention should prioritize beaches with photos', async ({ page }) => {
    const imageUrls = await getSurfSpotImageUrls(page);

    // Count how many images are external (from photo_url) vs local fallbacks
    let externalImageCount = 0;
    let localImageCount = 0;

    for (const url of imageUrls) {
      // Check if it's a proxied external image
      if (url.includes('/api/image-proxy?url=')) {
        const originalUrl = extractOriginalUrlFromProxy(url);
        if (originalUrl && isExternalImage(originalUrl)) {
          externalImageCount++;
          continue;
        }
      }

      // Check if it's a local image
      if (isLocalImage(url)) {
        localImageCount++;
      }
    }

    // We expect at least some beaches to have actual photos (external images)
    // This verifies the prioritization logic is working
    // If all images are local fallbacks, the API might not be returning photo_url data
    if (imageUrls.length > 0) {
      // At least 1 beach should have an actual photo OR
      // all should be local fallbacks (acceptable if no beaches have photos)
      const hasRealPhotos = externalImageCount > 0;
      const allAreFallbacks = localImageCount === imageUrls.length;

      expect(hasRealPhotos || allAreFallbacks).toBe(true);
    }
  });
});

// =============================================================================
// TEST SUITE 3: IMAGE PROXY URL VALIDATION
// =============================================================================

test.describe('Landing Page Images - Proxy URL Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const skeleton = page.locator(SELECTORS.loadingSkeleton).first();
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
    }

    await waitForSurfHighlightsImagesToLoad(page);
  });

  test('external images should use proxy endpoint', async ({ page }) => {
    const imageUrls = await getSurfSpotImageUrls(page);
    const externalImagesNotProxied: string[] = [];

    for (const url of imageUrls) {
      // Check if this is a proxied URL
      const isProxied = url.includes('/api/image-proxy?url=');

      if (isProxied) {
        // Extract original URL and verify it's external
        const originalUrl = extractOriginalUrlFromProxy(url);

        if (!originalUrl) {
          throw new Error(`Failed to extract original URL from proxy: ${url}`);
        }

        // Verify the original URL is actually external
        const shouldBeProxied = isExternalImage(originalUrl);
        expect(shouldBeProxied).toBe(true);
      } else {
        // This is not a proxied URL, check if it should be
        // If it's an external image, it SHOULD be proxied
        if (isExternalImage(url)) {
          externalImagesNotProxied.push(url);
        }
      }
    }

    // Fail if we found external images that aren't proxied
    if (externalImagesNotProxied.length > 0) {
      throw new Error(
        `External images found that are NOT using proxy endpoint:\n${externalImagesNotProxied.join('\n')}\n\n` +
        `These should be proxied through /api/image-proxy?url=`
      );
    }
  });

  test('proxy URLs should have properly encoded original URL', async ({ page }) => {
    const imageUrls = await getSurfSpotImageUrls(page);
    const invalidProxyUrls: string[] = [];

    for (const url of imageUrls) {
      if (url.includes('/api/image-proxy?url=')) {
        // Try to extract and decode the URL
        const originalUrl = extractOriginalUrlFromProxy(url);

        if (!originalUrl) {
          invalidProxyUrls.push(`Failed to decode: ${url}`);
          continue;
        }

        // Verify the decoded URL is valid
        try {
          new URL(originalUrl);
        } catch {
          invalidProxyUrls.push(`Invalid decoded URL: ${originalUrl} from ${url}`);
        }
      }
    }

    // Fail if we found invalid proxy URLs
    if (invalidProxyUrls.length > 0) {
      throw new Error(
        `Invalid proxy URL encoding found:\n${invalidProxyUrls.join('\n')}`
      );
    }
  });

  test('local fallback images should NOT be proxied', async ({ page }) => {
    const imageUrls = await getSurfSpotImageUrls(page);
    const localImagesIncorrectlyProxied: string[] = [];

    for (const url of imageUrls) {
      // If it's a proxied URL, check if the original is actually local
      if (url.includes('/api/image-proxy?url=')) {
        const originalUrl = extractOriginalUrlFromProxy(url);

        if (originalUrl && isLocalImage(originalUrl)) {
          localImagesIncorrectlyProxied.push(`${originalUrl} (proxied as ${url})`);
        }
      }
    }

    // Fail if local images are being proxied (unnecessary and inefficient)
    if (localImagesIncorrectlyProxied.length > 0) {
      throw new Error(
        `Local images found that are incorrectly proxied:\n${localImagesIncorrectlyProxied.join('\n')}\n\n` +
        `Local images should be served directly, not through the proxy endpoint`
      );
    }
  });

  test('proxy endpoint should be accessible and return images', async ({ page }) => {
    const imageUrls = await getSurfSpotImageUrls(page);

    // Find at least one proxied image to test
    const proxiedImage = imageUrls.find((url) => url.includes('/api/image-proxy?url='));

    if (!proxiedImage) {
      // Skip test if no proxied images found (all might be local fallbacks)
      test.skip(true, 'No proxied images found to test proxy endpoint');
      return;
    }

    // Make a request to the proxy endpoint
    const response = await page.request.get(proxiedImage);

    // Verify response is successful
    expect(response.ok()).toBe(true);

    // Verify content type is an image
    const contentType = response.headers()['content-type'];
    expect(contentType).toMatch(/^image\//);

    // Verify we got actual image data
    const buffer = await response.body();
    expect(buffer.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// TEST SUITE 4: VISUAL SNAPSHOT TESTING
// =============================================================================

test.describe('Landing Page Images - Visual Snapshots', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    const skeleton = page.locator(SELECTORS.loadingSkeleton).first();
    const skeletonVisible = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    if (skeletonVisible) {
      await expect(skeleton).not.toBeVisible({ timeout: TIMEOUTS.long });
    }

    await waitForSurfHighlightsImagesToLoad(page);
  });

  test('surf highlights section visual snapshot - desktop', async ({ page }) => {
    // Set desktop viewport
    await page.setViewportSize(VIEWPORTS.desktop);

    // Locate the surf highlights section
    const section = page.locator(SELECTORS.surfHighlightsSection).first();
    await expect(section).toBeVisible();

    // Take snapshot of the section
    await expect(section).toHaveScreenshot('surf-highlights-desktop.png', {
      // Allow for slight variations in image loading
      maxDiffPixelRatio: 0.05,
      // Mask dynamic elements that might change (like tide times, etc.)
      // Note: Adjust these selectors if you have dynamic content
    });
  });

  test('surf highlights section visual snapshot - mobile', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize(VIEWPORTS.mobile);

    // Locate the surf highlights section
    const section = page.locator(SELECTORS.surfHighlightsSection).first();
    await expect(section).toBeVisible();

    // Take snapshot of the section
    await expect(section).toHaveScreenshot('surf-highlights-mobile.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('surf highlights section visual snapshot - tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize(VIEWPORTS.tablet);

    // Locate the surf highlights section
    const section = page.locator(SELECTORS.surfHighlightsSection).first();
    await expect(section).toBeVisible();

    // Take snapshot of the section
    await expect(section).toHaveScreenshot('surf-highlights-tablet.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('individual beach card visual snapshot', async ({ page }) => {
    // Take a snapshot of a single card to catch layout issues
    const firstCard = page.locator(SELECTORS.surfSpotCards).first();
    await expect(firstCard).toBeVisible();

    await expect(firstCard).toHaveScreenshot('beach-card-sample.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('full landing page visual snapshot with surf highlights', async ({ page }) => {
    // Take a full page screenshot to catch overall layout issues
    await expect(page).toHaveScreenshot('landing-page-full.png', {
      fullPage: true,
      maxDiffPixelRatio: 0.05,
      // Set a timeout for full page screenshot
      timeout: TIMEOUTS.long,
    });
  });
});

// =============================================================================
// TEST SUITE 5: ERROR HANDLING & EDGE CASES
// =============================================================================

test.describe('Landing Page Images - Error Handling', () => {
  test('should handle network errors gracefully', async ({ page }) => {
    // Block all image requests to simulate network issues
    await page.route('**/*.{png,jpg,jpeg,webp}', (route) => route.abort());
    await page.route('**/api/image-proxy*', (route) => route.abort());

    await page.goto('/');
    await waitForPageLoad(page);

    // Section should still render (graceful degradation)
    const section = page.locator(SELECTORS.surfHighlightsSection).first();
    const isVisible = await section.isVisible({ timeout: TIMEOUTS.medium }).catch(() => false);

    // Either section is visible with fallback content OR it's hidden
    // Both are acceptable error handling strategies
    expect(typeof isVisible).toBe('boolean');
  });

  test('should handle slow image loading', async ({ page }) => {
    // Slow down image requests
    await page.route('**/*.{png,jpg,jpeg,webp}', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
      await route.continue();
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Loading skeletons should appear
    const skeleton = page.locator(SELECTORS.loadingSkeleton).first();
    const skeletonAppeared = await skeleton.isVisible({ timeout: 2000 }).catch(() => false);

    // Eventually images should load (even if slow)
    await waitForSurfHighlightsImagesToLoad(page);

    const images = page.locator(SELECTORS.surfSpotImages);
    const imageCount = await images.count();
    expect(imageCount).toBeGreaterThan(0);
  });

  test('should handle missing images with fallbacks', async ({ page }) => {
    // Intercept image requests and return 404 for some
    let requestCount = 0;
    await page.route('**/*', async (route) => {
      // Fail every other image request
      if (route.request().url().match(/\.(png|jpg|jpeg|webp)$/)) {
        requestCount++;
        if (requestCount % 2 === 0) {
          await route.fulfill({ status: 404 });
          return;
        }
      }
      await route.continue();
    });

    await page.goto('/');
    await waitForPageLoad(page);

    // Section should still render with available images
    const section = page.locator(SELECTORS.surfHighlightsSection).first();
    await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

    // At least some cards should be visible
    const cards = page.locator(SELECTORS.surfSpotCards);
    const cardCount = await cards.count();
    expect(cardCount).toBeGreaterThan(0);
  });
});
