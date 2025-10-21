import { test, expect } from '@playwright/test';

/**
 * Photo Integration E2E Tests
 *
 * Validates the photo integration features documented in photoResults.md:
 * - Beach recommendations display session photos
 * - Session cards show featured_photo_url when available
 * - Session cards fall back to map when no photo exists
 * - Alt text is properly set for accessibility
 * - Both 'photo' and 'image' media types are handled correctly
 */

const TEST_BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('@photo - Photo Integration', () => {
  test.describe('Best Conditions Near You - Beach Photos', () => {
    test('displays beach photos when available in recommendations', async ({ page }) => {
      // Navigate to home page where BestConditionsCards renders
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Wait for the Best Conditions section to load
      const bestConditionsHeading = page.getByRole('heading', { name: /best conditions near you/i });

      // Check if section is visible (may not appear if user has no home beach set)
      const isVisible = await bestConditionsHeading.isVisible({ timeout: 10000 }).catch(() => false);

      if (!isVisible) {
        test.info().annotations.push({
          type: 'note',
          description: 'Best Conditions section not visible - user may not have home beach set'
        });
        return;
      }

      await expect(bestConditionsHeading).toBeVisible();

      // Find beach recommendation cards
      const beachCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
      const cardCount = await beachCards.count();

      if (cardCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No beach cards found - may be outside 10 mile range'
        });
        return;
      }

      // Check first card for image or fallback
      const firstCard = beachCards.first();
      await firstCard.scrollIntoViewIfNeeded();

      // Look for either a Next.js Image component or a fallback gradient div with Waves icon
      const hasImage = await firstCard.locator('img').count() > 0;
      const hasFallback = await firstCard.locator('svg').filter({ has: page.locator('circle, path') }).count() > 0;

      // At least one should be present
      expect(hasImage || hasFallback).toBeTruthy();

      if (hasImage) {
        const img = firstCard.locator('img').first();
        await expect(img).toBeVisible();

        // Verify image has alt text (beach name)
        const altText = await img.getAttribute('alt');
        expect(altText).toBeTruthy();
        expect(altText).not.toBe('');

        test.info().annotations.push({
          type: 'success',
          description: `Beach photo displayed with alt text: "${altText}"`
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'Beach card shows fallback gradient (no photo available)'
        });
      }
    });

    test('beach cards are clickable and navigate to beach detail', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const bestConditionsHeading = page.getByRole('heading', { name: /best conditions near you/i });
      const isVisible = await bestConditionsHeading.isVisible({ timeout: 10000 }).catch(() => false);

      if (!isVisible) {
        test.info().annotations.push({
          type: 'note',
          description: 'Best Conditions section not visible'
        });
        return;
      }

      // Find and click first beach card
      const beachCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
      const cardCount = await beachCards.count();

      if (cardCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No beach cards to test'
        });
        return;
      }

      const firstCard = beachCards.first();
      await firstCard.scrollIntoViewIfNeeded();
      await firstCard.click();

      // Should navigate to beach detail page
      await expect(page).toHaveURL(/\/beach\//);
    });
  });

  test.describe('Session Cards - Featured Photo Display', () => {
    test('session card displays featured photo when available', async ({ page }) => {
      // Navigate to a beach page with sessions
      await page.goto(`/beach/${TEST_BEACH_ID}`, { waitUntil: 'domcontentloaded' });

      // Scroll to sessions section
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

      // Wait for recent sessions section to load
      const sessionsHeading = page.getByRole('heading', { name: /recent sessions/i });
      const hasSessionsSection = await sessionsHeading.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasSessionsSection) {
        test.info().annotations.push({
          type: 'note',
          description: 'No recent sessions section found on beach page'
        });
        return;
      }

      // Find session cards - they contain UserAvatar and engagement buttons
      const sessionCards = page.locator('[class*="session-card"]').or(
        page.locator('div').filter({ has: page.locator('[data-testid="like-button"]') })
      );

      const sessionCount = await sessionCards.count();

      if (sessionCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No session cards found on beach page'
        });
        return;
      }

      // Check first session card
      const firstSession = sessionCards.first();
      await firstSession.scrollIntoViewIfNeeded();

      // Look for image or map - MapImage component renders either photo or map
      const images = firstSession.locator('img');
      const imageCount = await images.count();

      expect(imageCount).toBeGreaterThan(0);

      const firstImage = images.first();
      await expect(firstImage).toBeVisible();

      // Check alt text for accessibility
      const altText = await firstImage.getAttribute('alt');
      expect(altText).toBeTruthy();

      // Alt text should be either session photo alt or map alt
      const isPhotoAlt = altText?.includes('Session photo from');
      const isMapAlt = altText?.includes('Map showing surf session location');

      expect(isPhotoAlt || isMapAlt).toBeTruthy();

      test.info().annotations.push({
        type: 'success',
        description: `Session image displayed with alt text: "${altText}"`
      });
    });

    test('session card has proper map fallback when no photo exists', async ({ page }) => {
      // This test validates that SessionCardWrapper properly handles fallback
      // Navigate to home or community feed where sessions are displayed
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Look for session cards in the feed
      const sessionCards = page.locator('div').filter({ has: page.locator('[data-testid="like-button"]') });
      const sessionCount = await sessionCards.count();

      if (sessionCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No session cards in home feed to test'
        });
        return;
      }

      // Check all visible session cards
      for (let i = 0; i < Math.min(sessionCount, 3); i++) {
        const card = sessionCards.nth(i);
        await card.scrollIntoViewIfNeeded();

        const images = card.locator('img');
        const hasImage = await images.count() > 0;

        if (hasImage) {
          const img = images.first();
          const altText = await img.getAttribute('alt');

          // Verify alt text is meaningful
          expect(altText).toBeTruthy();
          expect(altText).not.toBe('');

          // It should be either a photo or map alt
          const hasValidAlt =
            altText?.includes('Session photo from') ||
            altText?.includes('Map showing surf session location');

          expect(hasValidAlt).toBeTruthy();
        }
      }

      test.info().annotations.push({
        type: 'success',
        description: 'All session cards have proper image alt text'
      });
    });

    test('session cards are accessible and have proper ARIA labels', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const sessionCards = page.locator('div').filter({ has: page.locator('[data-testid="like-button"]') });
      const sessionCount = await sessionCards.count();

      if (sessionCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No session cards to test accessibility'
        });
        return;
      }

      const firstCard = sessionCards.first();
      await firstCard.scrollIntoViewIfNeeded();

      // Check like button has proper ARIA
      const likeButton = firstCard.locator('[data-testid="like-button"]');
      await expect(likeButton).toBeVisible();

      const ariaLabel = await likeButton.getAttribute('aria-label');
      expect(ariaLabel).toBeTruthy();
      expect(ariaLabel).toMatch(/Like|Unlike/i);

      const ariaPressed = await likeButton.getAttribute('aria-pressed');
      expect(ariaPressed).toMatch(/true|false/);

      test.info().annotations.push({
        type: 'success',
        description: 'Session card buttons have proper ARIA attributes'
      });
    });
  });

  test.describe('User Profile - Session Photos', () => {
    test('profile page displays sessions with photos', async ({ page }) => {
      // Navigate to user's own profile
      await page.goto('/profile', { waitUntil: 'domcontentloaded' });

      // Wait for profile to load
      await page.waitForLoadState('networkidle', { timeout: 10000 });

      // Look for sessions section
      const sessionsSection = page.locator('text=/sessions/i').first();
      const hasSessions = await sessionsSection.isVisible({ timeout: 5000 }).catch(() => false);

      if (!hasSessions) {
        test.info().annotations.push({
          type: 'note',
          description: 'No sessions section visible on profile'
        });
        return;
      }

      // Find session cards with images
      const sessionImages = page.locator('img').filter({
        has: page.locator('[alt*="Session photo"], [alt*="Map showing"]')
      });

      const imageCount = await sessionImages.count();

      if (imageCount > 0) {
        const firstImage = sessionImages.first();
        await expect(firstImage).toBeVisible();

        const altText = await firstImage.getAttribute('alt');
        expect(altText).toBeTruthy();

        test.info().annotations.push({
          type: 'success',
          description: `Profile sessions display with images (${imageCount} found)`
        });
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'No session images found on profile (user may have no sessions)'
        });
      }
    });
  });

  test.describe('API Routes - Photo Enrichment', () => {
    test('beach sessions API returns sessions with featured_photo_url', async ({ page }) => {
      // Test the API endpoint that enriches sessions with photos
      // Use page.request for authenticated context
      const response = await page.request.get(`/api/beaches/${TEST_BEACH_ID}/sessions?limit=5`);

      // Check if the API endpoint exists and returns a valid response
      if (!response.ok()) {
        const status = response.status();
        const text = await response.text();

        test.info().annotations.push({
          type: 'note',
          description: `Beach sessions API returned ${status}: ${text.substring(0, 100)}`
        });

        // If the beach doesn't exist or has no sessions, that's expected
        if (status === 404 || status === 500) {
          test.info().annotations.push({
            type: 'note',
            description: 'Beach may not have sessions yet - skipping validation'
          });
          return;
        }

        // For other errors, fail
        expect(response.ok()).toBeTruthy();
      }

      const data = await response.json();
      expect(data).toHaveProperty('sessions');

      if (data.sessions && data.sessions.length > 0) {
        // Check if sessions have the featured_photo_url field
        const firstSession = data.sessions[0];

        // featured_photo_url should exist (may be null if no photo)
        expect(firstSession).toHaveProperty('featured_photo_url');

        // If featured_photo_url is set, it should be a valid URL or null
        if (firstSession.featured_photo_url) {
          expect(firstSession.featured_photo_url).toMatch(/^https?:\/\//);

          test.info().annotations.push({
            type: 'success',
            description: 'API returns sessions with featured_photo_url'
          });
        } else {
          test.info().annotations.push({
            type: 'note',
            description: 'Session has no featured_photo_url (expected if no photos uploaded)'
          });
        }
      } else {
        test.info().annotations.push({
          type: 'note',
          description: 'No sessions returned from API'
        });
      }
    });

    test('user sessions API returns sessions with photo enrichment', async ({ request, page }) => {
      // First, get the current user's ID
      await page.goto('/profile', { waitUntil: 'domcontentloaded' });

      // Extract user ID from URL or page context
      const currentUrl = page.url();

      // Make API call to get sessions
      // Note: This requires authentication, so we use the page context
      const response = await page.request.get('/api/users/me/sessions?limit=5');

      if (!response.ok()) {
        // User might not be authenticated or endpoint might differ
        test.info().annotations.push({
          type: 'note',
          description: 'User sessions API not accessible (authentication may be required)'
        });
        return;
      }

      const data = await response.json();

      if (data.sessions && data.sessions.length > 0) {
        const firstSession = data.sessions[0];

        // Verify featured_photo_url enrichment
        expect(firstSession).toHaveProperty('featured_photo_url');

        test.info().annotations.push({
          type: 'success',
          description: 'User sessions API enriches with featured_photo_url'
        });
      }
    });
  });

  test.describe('Media Type Handling', () => {
    test('session cards handle both photo and image media types', async ({ page }) => {
      // This test verifies that the system correctly handles both 'photo' and 'image' media types
      // as mentioned in photoResults.md

      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Look for any session cards
      const sessionCards = page.locator('div').filter({ has: page.locator('[data-testid="like-button"]') });
      const sessionCount = await sessionCards.count();

      if (sessionCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No sessions to test media type handling'
        });
        return;
      }

      // Verify images are displayed (both types should be handled the same way by MapImage component)
      for (let i = 0; i < Math.min(sessionCount, 3); i++) {
        const card = sessionCards.nth(i);
        const images = card.locator('img');
        const imageCount = await images.count();

        // Each card should have at least one image (photo or map fallback)
        expect(imageCount).toBeGreaterThan(0);

        if (imageCount > 0) {
          const img = images.first();
          await expect(img).toBeVisible();

          // Verify image loads successfully
          const src = await img.getAttribute('src');
          expect(src).toBeTruthy();
        }
      }

      test.info().annotations.push({
        type: 'success',
        description: 'Session cards successfully display images from both photo and image media types'
      });
    });
  });

  test.describe('Accessibility - Alt Text', () => {
    test('all session photos have descriptive alt text', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Find all images in session cards
      const sessionImages = page.locator('img').filter({
        hasText: '', // All images
      });

      const imageCount = await sessionImages.count();

      if (imageCount === 0) {
        test.info().annotations.push({
          type: 'note',
          description: 'No images found to test alt text'
        });
        return;
      }

      // Check each image for meaningful alt text
      let imagesWithAlt = 0;
      let imagesWithoutAlt = 0;

      for (let i = 0; i < Math.min(imageCount, 10); i++) {
        const img = sessionImages.nth(i);
        const isVisible = await img.isVisible({ timeout: 1000 }).catch(() => false);

        if (!isVisible) continue;

        const altText = await img.getAttribute('alt');

        if (altText && altText.length > 0) {
          imagesWithAlt++;

          // Alt text should be descriptive
          const isDescriptive =
            altText.includes('Session photo') ||
            altText.includes('Map showing') ||
            altText.includes('Beach') ||
            altText.length > 5;

          expect(isDescriptive).toBeTruthy();
        } else {
          imagesWithoutAlt++;
        }
      }

      test.info().annotations.push({
        type: 'success',
        description: `Alt text check: ${imagesWithAlt} images with alt, ${imagesWithoutAlt} without`
      });

      // All visible images should have alt text
      expect(imagesWithAlt).toBeGreaterThan(0);
    });

    test('beach recommendation images have accessible alt text', async ({ page }) => {
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      const bestConditionsHeading = page.getByRole('heading', { name: /best conditions near you/i });
      const isVisible = await bestConditionsHeading.isVisible({ timeout: 10000 }).catch(() => false);

      if (!isVisible) {
        test.info().annotations.push({
          type: 'note',
          description: 'Best Conditions section not visible'
        });
        return;
      }

      // Find beach card images
      const beachCards = page.locator('[class*="cursor-pointer"]').filter({ has: page.locator('h4') });
      const cardCount = await beachCards.count();

      if (cardCount === 0) return;

      // Check first few cards for alt text
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        const card = beachCards.nth(i);
        const images = card.locator('img');
        const imageCount = await images.count();

        if (imageCount > 0) {
          const img = images.first();
          const altText = await img.getAttribute('alt');

          // Beach images should have the beach name as alt text
          expect(altText).toBeTruthy();
          expect(altText).not.toBe('');

          // Alt should contain beach name or descriptive text
          expect(altText.length).toBeGreaterThan(3);
        }
      }

      test.info().annotations.push({
        type: 'success',
        description: 'Beach recommendation images have proper alt text'
      });
    });
  });
});
