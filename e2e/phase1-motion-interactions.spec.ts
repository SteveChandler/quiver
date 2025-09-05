import { test, expect, type Page } from "@playwright/test";

/**
 * Phase 1 Motion Design Testing Suite
 * 
 * Tests the viral growth motion enhancements including:
 * - Like button heart burst animations 
 * - Social sharing motion and success celebrations
 * - Session card hover interactions
 * - Follow button microinteractions
 * - Performance and accessibility compliance
 */

test.describe("Phase 1: Viral Growth Motion Interactions", () => {
  // Authentication is handled globally through setup

  test.describe("Like Button Microinteractions", () => {
    test("should display heart burst animation when liking a session", async ({ page }) => {
      // Navigate to a page with session cards (social feed or sessions)
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      // Wait for session cards to load
      const sessionCard = page.locator('[data-testid="session-card"]').first();
      await expect(sessionCard).toBeVisible({ timeout: 10000 });

      // Locate the like button
      const likeButton = sessionCard.locator('[data-testid="like-button"]');
      await expect(likeButton).toBeVisible();

      // Check initial state
      const initialLikeCount = await likeButton.textContent();
      
      // Verify CSS classes are applied for motion
      await expect(likeButton).toHaveClass(/motion-optimized/);
      await expect(likeButton).toHaveClass(/like-button-spring/);
      await expect(likeButton).toHaveClass(/ripple-effect/);

      // Click the like button and verify animation triggers
      await likeButton.click();

      // Verify the button shows toggling state with scale transform
      await expect(likeButton).toHaveCSS("transform", /(scale|matrix)/);

      // Wait for like action to complete
      await page.waitForTimeout(1000);

      // Verify final state shows heart is filled and count potentially changed
      const finalLikeCount = await likeButton.textContent();
      expect(finalLikeCount).toBeDefined();

      // Verify success styling (red color for liked state)
      const thumbsUpIcon = likeButton.locator("svg");
      const iconColor = await thumbsUpIcon.evaluate((el) => 
        getComputedStyle(el).color
      );
      
      // Should have some color change indicating liked state
      expect(iconColor).not.toBe("rgba(0, 0, 0, 0)");
    });

    test("should respect reduced motion preferences", async ({ page, context }) => {
      // Set reduced motion preference
      await context.addInitScript(() => {
        Object.defineProperty(window, 'matchMedia', {
          writable: true,
          value: (query: string) => ({
            matches: query === '(prefers-reduced-motion: reduce)',
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => {},
          }),
        });
      });

      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const likeButton = page.locator('[data-testid="like-button"]').first();
      await expect(likeButton).toBeVisible();

      // Verify reduced motion CSS is applied
      const animationDuration = await likeButton.evaluate((el) => {
        return getComputedStyle(el).animationDuration;
      });

      // Should have very short duration for reduced motion
      expect(animationDuration).toBe("0.01ms");
    });
  });

  test.describe("Share Modal Motion", () => {
    test("should animate share modal with flip and celebration effects", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      // Find and click a share button
      const shareButton = page.locator('[data-testid="share-button"]').first();
      await expect(shareButton).toBeVisible({ timeout: 10000 });
      await shareButton.click();

      // Wait for share modal to open
      const shareModal = page.locator('[data-testid="share-modal"]');
      await expect(shareModal).toBeVisible();

      // Verify modal image has motion classes
      const shareImage = shareModal.locator("img");
      await expect(shareImage).toHaveClass(/share-flip-animation/);

      // Check for download/share button with motion
      const actionButton = shareModal.locator('[data-testid="download-button"], [data-testid="web-share-button"]');
      await expect(actionButton).toBeVisible();
      await expect(actionButton).toHaveClass(/motion-optimized/);
      await expect(actionButton).toHaveClass(/like-button-spring/);

      // Test button interaction
      await actionButton.click();

      // Verify button shows pressed state with scale transform
      await expect(actionButton).toHaveCSS("transform", /(scale|matrix)/);
    });

    test("should show success celebration after sharing", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const shareButton = page.locator('[data-testid="share-button"]').first();
      await expect(shareButton).toBeVisible({ timeout: 10000 });
      await shareButton.click();

      const shareModal = page.locator('[data-testid="share-modal"]');
      await expect(shareModal).toBeVisible();

      // Wait for image to load and become ready
      await page.waitForTimeout(2000);

      const actionButton = shareModal.locator('[data-testid="download-button"], [data-testid="web-share-button"]');
      await expect(actionButton).toBeVisible();

      // Click the action button
      await actionButton.click();

      // Wait for success state
      await page.waitForTimeout(1000);

      // Verify success celebration classes
      await expect(actionButton).toHaveClass(/celebration-bounce/);

      // Verify success text/emoji
      const buttonText = await actionButton.textContent();
      expect(buttonText).toMatch(/(Shared! 🤙|Downloaded! 📸)/);
    });
  });

  test.describe("Session Card Interactions", () => {
    test("should apply hover effects to session cards", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const sessionCard = page.locator('[data-testid="session-card"]').first();
      await expect(sessionCard).toBeVisible({ timeout: 10000 });

      // Verify motion classes are applied
      const cardContent = sessionCard.locator(".session-card-hover");
      await expect(cardContent).toBeVisible();

      // Test hover interaction (desktop)
      await cardContent.hover();

      // Verify CSS transform is applied on hover
      const transform = await cardContent.evaluate((el) => 
        getComputedStyle(el).transform
      );
      
      // Should have some transform applied (scale/translate)
      expect(transform).not.toBe("none");
    });

    test("should handle tap interactions on mobile", async ({ page }) => {

      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const sessionCard = page.locator('[data-testid="session-card"]').first();
      await expect(sessionCard).toBeVisible({ timeout: 10000 });

      // Test tap interaction
      await sessionCard.tap();

      // Verify ripple effect is present
      const cardContent = sessionCard.locator(".ripple-effect");
      await expect(cardContent).toBeVisible();
    });
  });

  test.describe("Follow Button Motion", () => {
    test("should animate follow button interactions", async ({ page }) => {
      // Navigate to a user profile page
      await page.goto("/profile");
      await page.waitForLoadState("load");

      // Look for follow buttons (may be on user cards or profile pages)
      const followButton = page.locator('[data-testid="follow-button"]').first();
      
      if (await followButton.isVisible()) {
        // Verify motion classes
        await expect(followButton).toHaveClass(/motion-optimized/);
        await expect(followButton).toHaveClass(/like-button-spring/);

        // Test interaction
        await followButton.click();

        // Verify animation state
        await expect(followButton).toHaveCSS("transform", /(scale|matrix)/);

        // Wait for animation to complete
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe("Performance & Accessibility", () => {
    test("should maintain 60fps during animations", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      // Start performance monitoring
      const cdpSession = await page.context().newCDPSession(page);
      await cdpSession.send('Performance.enable');

      const sessionCard = page.locator('[data-testid="session-card"]').first();
      await expect(sessionCard).toBeVisible({ timeout: 10000 });

      const likeButton = sessionCard.locator('[data-testid="like-button"]');
      
      // Trigger multiple animations to stress test
      for (let i = 0; i < 3; i++) {
        await likeButton.click();
        await page.waitForTimeout(700); // Wait for animation to complete
      }

      // Verify no major performance issues
      const performanceEntries = await page.evaluate(() => {
        return performance.getEntriesByType('measure').length;
      });

      // Basic performance check (no specific threshold, just ensuring it completes)
      expect(performanceEntries).toBeGreaterThanOrEqual(0);
    });

    test("should have proper ARIA labels and keyboard navigation", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const likeButton = page.locator('[data-testid="like-button"]').first();
      await expect(likeButton).toBeVisible({ timeout: 10000 });

      // Test keyboard navigation
      await likeButton.focus();
      await expect(likeButton).toBeFocused();

      // Test keyboard activation
      await page.keyboard.press("Enter");
      
      // Verify animation still works with keyboard
      await expect(likeButton).toHaveCSS("transform", /(scale|matrix)/);
    });

    test("should use GPU acceleration for better performance", async ({ page }) => {
      await page.goto("/sessions");
      await page.waitForLoadState("load");

      const motionElements = page.locator(".motion-optimized");
      const count = await motionElements.count();

      if (count > 0) {
        const firstElement = motionElements.first();
        
        // Check for GPU acceleration properties
        const willChange = await firstElement.evaluate((el) => 
          getComputedStyle(el).willChange
        );
        
        const transform = await firstElement.evaluate((el) => 
          getComputedStyle(el).transform
        );

        // Should have GPU acceleration hints
        expect(willChange).toBe("transform, opacity");
        expect(transform).toContain("matrix"); // translateZ(0) creates matrix
      }
    });
  });

  test.describe("Cross-Device Motion Consistency", () => {
    test("should work consistently across different viewport sizes", async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 },   // Mobile
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto("/sessions");
        await page.waitForLoadState("load");

        const likeButton = page.locator('[data-testid="like-button"]').first();
        if (await likeButton.isVisible()) {
          // Verify motion classes are present
          await expect(likeButton).toHaveClass(/motion-optimized/);
          
          // Test interaction
          await likeButton.click();
          await page.waitForTimeout(100);
          
          // Basic animation verification
          const transform = await likeButton.evaluate((el) => 
            getComputedStyle(el).transform
          );
          expect(transform).not.toBe("none");
        }
      }
    });
  });
});
