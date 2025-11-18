import { test, expect, Page } from '@playwright/test';
import { ensureAuthenticated, waitForPageLoad } from '../utils/test-helpers';

/**
 * Visual Regression Tests - Session Share Cards
 *
 * Creates visual snapshots for all 6 session card variants to detect
 * unintended design changes. These tests establish baselines and fail
 * if visual differences exceed acceptable thresholds.
 *
 * @project auth
 */

type ShareVariant = '1' | '2' | '3' | '4' | '5' | '6';

const VARIANTS: ShareVariant[] = ['1', '2', '3', '4', '5', '6'];

const VARIANT_NAMES = {
  '1': 'Classic Overlay',
  '2': 'Split Layout',
  '3': 'Minimal Dark',
  '4': 'Glass Morphism',
  '5': 'Info Grid',
  '6': 'Card Overlay',
};

/**
 * Helper: Get a test session ID
 */
async function getTestSessionId(page: Page): Promise<string | null> {
  // Navigate to profile sessions tab instead of /sessions (which shows community sessions)
  await page.goto('/profile?tab=sessions');
  await waitForPageLoad(page);

  // Wait for sessions to load
  await page.waitForTimeout(3000);

  // Find session links (excluding "new" session links)
  const sessionLink = page.locator('a[href^="/sessions/"]:not([href*="/sessions/new"])').first();
  const href = await sessionLink.getAttribute('href').catch(() => null);

  if (!href) {
    return null;
  }

  const match = href.match(/\/sessions\/([^\/]+)/);
  return match ? match[1] : null;
}

test.describe('Visual Regression - Session Share Cards', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();

    if (!sessionId) {
      throw new Error('No test session available for visual regression tests');
    }
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  // Create snapshot for each variant at 1:1 aspect ratio (most common)
  for (const variant of VARIANTS) {
    test(`should match snapshot for Variant ${variant} (${VARIANT_NAMES[variant]})`, async ({ page }) => {
      if (!sessionId) {
        test.skip(true, 'No session ID available');
        return;
      }

      // Navigate to preview page
      await page.goto(`/share/${sessionId}/${variant}/1:1`);
      await waitForPageLoad(page);

      // Wait for card to load and render
      await page.waitForTimeout(3000); // Allow time for rendering

      // Find the session card container (it's a div with relative overflow-hidden)
      // The card is inside a scaled container div
      const cardContainer = page.locator('div.relative.overflow-hidden').first();
      await expect(cardContainer).toBeVisible({ timeout: 10000 });

      // Take screenshot of the preview card
      await expect(cardContainer).toHaveScreenshot(`variant-${variant}-1x1.png`, {
        maxDiffPixels: 100, // Allow small differences (fonts, anti-aliasing)
        threshold: 0.2,     // 20% difference threshold
      });

      console.log(`✓ Snapshot created for Variant ${variant} (${VARIANT_NAMES[variant]})`);
    });
  }

  test('should match snapshot for full preview page layout - Variant 1', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/1:1`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    // Screenshot of entire page
    await expect(page).toHaveScreenshot('preview-page-full.png', {
      fullPage: true,
      maxDiffPixels: 200,
      threshold: 0.3,
    });

    console.log('✓ Full page snapshot created');
  });

  test('should match snapshot for variant grid/navigation', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/1:1`);
    await waitForPageLoad(page);

    // Look for variant navigation grid
    const variantGrid = page.locator('[data-testid*="variant-grid"], [data-testid*="variant-nav"], nav').first();
    const hasGrid = await variantGrid.isVisible().catch(() => false);

    if (hasGrid) {
      await expect(variantGrid).toHaveScreenshot('variant-navigation.png', {
        maxDiffPixels: 50,
      });
      console.log('✓ Variant navigation snapshot created');
    } else {
      test.skip(true, 'Variant navigation UI not found or different implementation');
    }
  });
});

test.describe('Visual Regression - Different Aspect Ratios', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('should match snapshot for Variant 1 at 4:5 (Instagram portrait)', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/4:5`);
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    const cardContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(cardContainer).toBeVisible({ timeout: 10000 });

    await expect(cardContainer).toHaveScreenshot('variant-1-4x5.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    console.log('✓ 4:5 aspect ratio snapshot created');
  });

  test('should match snapshot for Variant 1 at 9:16 (Instagram story)', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/9:16`);
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    const cardContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(cardContainer).toBeVisible({ timeout: 10000 });

    await expect(cardContainer).toHaveScreenshot('variant-1-9x16.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    console.log('✓ 9:16 aspect ratio snapshot created');
  });

  test('should match snapshot for Variant 1 at 16:9 (OpenGraph)', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/16:9`);
    await waitForPageLoad(page);
    await page.waitForTimeout(3000);

    const cardContainer = page.locator('div.relative.overflow-hidden').first();
    await expect(cardContainer).toBeVisible({ timeout: 10000 });

    await expect(cardContainer).toHaveScreenshot('variant-1-16x9.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    console.log('✓ 16:9 aspect ratio snapshot created');
  });
});

test.describe('Visual Regression - Public Share Page', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test('should match snapshot for public share page', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    // Public page - no auth required
    await page.goto(`/s/${sessionId}`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('public-share-page.png', {
      fullPage: true,
      maxDiffPixels: 200,
      threshold: 0.3,
    });

    console.log('✓ Public share page snapshot created');
  });
});

test.describe('Visual Regression - Responsive Design', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('should match snapshot for mobile viewport', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await page.goto(`/share/${sessionId}/1/1:1`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('preview-page-mobile.png', {
      fullPage: true,
      maxDiffPixels: 200,
      threshold: 0.3,
    });

    console.log('✓ Mobile viewport snapshot created');
  });

  test('should match snapshot for tablet viewport', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 }); // iPad

    await page.goto(`/share/${sessionId}/1/1:1`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    await expect(page).toHaveScreenshot('preview-page-tablet.png', {
      fullPage: true,
      maxDiffPixels: 200,
      threshold: 0.3,
    });

    console.log('✓ Tablet viewport snapshot created');
  });
});

test.describe('Visual Regression - Theme Variations', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('should match snapshot for dark theme variants', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    // Test Variant 3 (Minimal Dark) which is designed for dark theme
    await page.goto(`/share/${sessionId}/3/1:1`);
    await waitForPageLoad(page);
    await page.waitForTimeout(2000);

    const preview = page.locator('[data-testid*="preview"], img, canvas').first();
    await expect(preview).toBeVisible({ timeout: 10000 });

    await expect(preview).toHaveScreenshot('variant-3-dark-theme.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    console.log('✓ Dark theme variant snapshot created');
  });
});

test.describe('Visual Regression - Download Button UI', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test.beforeEach(async ({ page }) => {
    await ensureAuthenticated(page);
  });

  test('should match snapshot for download button and controls', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    await page.goto(`/share/${sessionId}/1/1:1`);
    await waitForPageLoad(page);

    // Find controls section (download button, aspect ratio selector, etc.)
    const controls = page.locator('[data-testid*="controls"], footer, .actions').first();
    const hasControls = await controls.isVisible().catch(() => false);

    if (hasControls) {
      await expect(controls).toHaveScreenshot('download-controls.png', {
        maxDiffPixels: 50,
      });
      console.log('✓ Download controls snapshot created');
    } else {
      // Fallback to just the download button
      const downloadButton = page.getByRole('button', { name: /download/i });
      if (await downloadButton.isVisible().catch(() => false)) {
        await expect(downloadButton).toHaveScreenshot('download-button.png');
        console.log('✓ Download button snapshot created');
      }
    }
  });
});

test.describe('Visual Regression - OpenGraph Images', () => {
  let sessionId: string | null = null;

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await ensureAuthenticated(page);
    sessionId = await getTestSessionId(page);
    await page.close();
  });

  test('should match snapshot for OG endpoint Variant 1', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    // Test the OG endpoint by fetching the image and comparing
    const ogUrl = `/api/og/session/${sessionId}?variant=1`;
    const response = await page.request.get(ogUrl);
    expect(response.status()).toBe(200);

    const imageBuffer = await response.body();

    // Create a temporary page to display the image for snapshot
    const tempPage = await page.context().newPage();

    // Create a data URL from the buffer
    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    // Navigate to a blank page and inject the image
    await tempPage.goto('about:blank');
    await tempPage.setContent(`
      <!DOCTYPE html>
      <html>
        <body style="margin: 0; padding: 0; background: white;">
          <img src="${dataUrl}" style="display: block; width: 1200px; height: 630px;" />
        </body>
      </html>
    `);

    // Wait for image to load
    await tempPage.waitForTimeout(1000);

    // Take screenshot of the image element
    const img = tempPage.locator('img');
    await expect(img).toHaveScreenshot('og-variant-1-16x9.png', {
      maxDiffPixels: 100,
      threshold: 0.2,
    });

    await tempPage.close();
    console.log('✓ OG endpoint snapshot created for Variant 1');
  });

  test('should match snapshot for all OG variants', async ({ page }) => {
    if (!sessionId) {
      test.skip(true, 'No session ID available');
      return;
    }

    const variants: ShareVariant[] = ['1', '2', '3', '4', '5', '6'];

    for (const variant of variants) {
      const ogUrl = `/api/og/session/${sessionId}?variant=${variant}`;
      const response = await page.request.get(ogUrl);
      expect(response.status()).toBe(200);

      const imageBuffer = await response.body();
      const base64 = imageBuffer.toString('base64');
      const dataUrl = `data:image/png;base64,${base64}`;

      const tempPage = await page.context().newPage();
      await tempPage.goto('about:blank');
      await tempPage.setContent(`
        <!DOCTYPE html>
        <html>
          <body style="margin: 0; padding: 0; background: white;">
            <img src="${dataUrl}" style="display: block; width: 1200px; height: 630px;" />
          </body>
        </html>
      `);

      await tempPage.waitForTimeout(1000);

      const img = tempPage.locator('img');
      await expect(img).toHaveScreenshot(`og-variant-${variant}-16x9.png`, {
        maxDiffPixels: 100,
        threshold: 0.2,
      });

      await tempPage.close();
      console.log(`✓ OG snapshot created for Variant ${variant}`);
    }
  });
});
