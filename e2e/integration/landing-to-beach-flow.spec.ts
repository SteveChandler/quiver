/**
 * Landing to Beach Detail - Navigation Integration Tests
 *
 * Tests the complete user journey from landing page to beach detail page,
 * validating URL structure, navigation correctness, and data integrity.
 *
 * This test suite catches routing regressions like beach cards routing to
 * incorrect URLs (e.g., /beaches/{uuid} instead of /ca/{city}/{beach-slug}).
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad } from "../utils/test-helpers";
import { TIMEOUTS, VIEWPORTS } from "../fixtures/test-data";

test.describe("Landing to Beach Detail - Navigation Integration", () => {
  test.beforeEach(async ({ page, context }) => {
    // Grant geolocation for Best Conditions section to populate
    await context.grantPermissions(["geolocation"]);
    await context.setGeolocation({ latitude: 32.8473, longitude: -117.275 }); // La Jolla area

    await page.goto("/");
    await waitForPageLoad(page);
  });

  test.describe("Beach Card Click Navigation", () => {
    test("should navigate to correct beach detail page when clicking beach card", async ({
      page,
    }) => {
      // Wait for Best Conditions section to load
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      // Get first beach card
      const firstCard = page.getByTestId("best-conditions-card").first();
      await expect(firstCard).toBeVisible({ timeout: TIMEOUTS.medium });

      // Extract beach name before clicking
      const beachNameElement = firstCard.locator("h4").first();
      const beachName = await beachNameElement.textContent();
      expect(beachName).toBeTruthy();

      // Click the card
      await firstCard.click();

      // Wait for navigation to complete
      await waitForPageLoad(page);

      // Verify we navigated away from home page
      expect(page.url()).not.toBe("/");
      expect(page.url()).not.toMatch(/^\/$|\?/);

      // Verify URL follows hierarchical structure (NOT /beaches/{uuid})
      const url = page.url();
      expect(url).not.toMatch(/\/beaches\/[0-9a-f-]+/i); // Should NOT be /beaches/{uuid}
      expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i); // Should be /ca/{city}/{slug}

      // Verify beach detail page loaded
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();

      // Verify we're on the same beach detail page
      const headingText = await heading.textContent();
      expect(headingText).toContain(beachName || "");

      // Verify no 404 or error page
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toMatch(/404|not found|page not found/i);
    });

    test("should navigate correctly from multiple beach cards", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();

      // Test up to 3 cards
      const cardsToTest = Math.min(cardCount, 3);
      expect(cardsToTest).toBeGreaterThan(0);

      for (let i = 0; i < cardsToTest; i++) {
        // Navigate back to home
        await page.goto("/");
        await waitForPageLoad(page);

        // Wait for section
        await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

        // Get nth card
        const card = cards.nth(i);
        await expect(card).toBeVisible();

        // Get beach name
        const beachNameElement = card.locator("h4").first();
        const beachName = await beachNameElement.textContent();

        // Click card
        await card.click();
        await waitForPageLoad(page);

        // Verify URL structure
        const url = page.url();
        expect(url).not.toMatch(/\/beaches\/[0-9a-f-]+/i); // NOT /beaches/{uuid}
        expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i); // IS /ca/{city}/{slug}

        // Verify page loaded
        const heading = page.getByRole("heading").first();
        const headingText = await heading.textContent();
        expect(headingText).toContain(beachName || "");

        console.log(`✓ Card ${i + 1}: ${beachName} → ${url}`);
      }
    });

    test("should not result in 404 when navigating to beach detail", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await expect(firstCard).toBeVisible();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify no 404 error
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toMatch(/404|not found|page not found/i);

      // Verify page status is 200 (check response status)
      const response = await page.goto(page.url());
      expect(response?.status()).toBe(200);
    });

    test("should handle navigation from last beach card", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Get last card
      const lastCard = cards.last();
      await expect(lastCard).toBeVisible();

      // Get beach name
      const beachNameElement = lastCard.locator("h4").first();
      const beachName = await beachNameElement.textContent();

      // Click last card
      await lastCard.click();
      await waitForPageLoad(page);

      // Verify URL structure
      const url = page.url();
      expect(url).not.toMatch(/\/beaches\/[0-9a-f-]+/i);
      expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i);

      // Verify beach detail page loaded
      const heading = page.getByRole("heading").first();
      const headingText = await heading.textContent();
      expect(headingText).toContain(beachName || "");
    });
  });

  test.describe("URL Format Validation", () => {
    test("should use hierarchical URL format in beach card links", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);

      // Check each card (cards use onClick, so we check the actual navigation behavior)
      // We can verify by clicking and checking the resulting URL

      // Get first card and click it
      const firstCard = cards.first();
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify URL format
      const url = page.url();
      expect(url).not.toMatch(/\/beaches\/[0-9a-f-]+/i); // Should NOT use /beaches/{uuid}
      expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i); // Should use /ca/{city}/{slug}

      console.log(`✓ Beach card navigates to: ${url}`);
    });

    test("should NOT contain raw UUIDs in URLs", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await expect(firstCard).toBeVisible();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify URL does NOT contain UUID pattern
      const url = page.url();
      const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      expect(url).not.toMatch(uuidPattern);

      console.log(`✓ URL contains no UUIDs: ${url}`);
    });

    test("should use consistent URL format across all beach cards", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();
      expect(cardCount).toBeGreaterThan(0);

      const urlFormats: string[] = [];

      // Test up to 3 cards
      const cardsToTest = Math.min(cardCount, 3);

      for (let i = 0; i < cardsToTest; i++) {
        // Navigate home
        await page.goto("/");
        await waitForPageLoad(page);
        await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

        // Click nth card
        const card = cards.nth(i);
        await card.click();
        await waitForPageLoad(page);

        // Extract URL pattern
        const url = page.url();
        const pattern = url.replace(/[^/]+$/, "{slug}"); // Replace last segment with placeholder
        urlFormats.push(pattern);

        console.log(`Card ${i + 1} URL pattern: ${pattern}`);
      }

      // All URLs should follow same pattern: /ca/{city}/{slug}
      const uniquePatterns = new Set(urlFormats);
      expect(uniquePatterns.size).toBe(1); // All should have same format
    });

    test("should match expected hierarchical URL structure", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await expect(firstCard).toBeVisible();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Parse URL structure
      const url = new URL(page.url());
      const pathSegments = url.pathname.split("/").filter(Boolean);

      // Should have 3 segments: state, city, beach-slug
      expect(pathSegments.length).toBe(3);

      // First segment should be state (e.g., "ca")
      expect(pathSegments[0]).toMatch(/^[a-z]{2}$/); // 2-letter state code

      // Second segment should be city slug (e.g., "san-diego")
      expect(pathSegments[1]).toMatch(/^[a-z-]+$/);

      // Third segment should be beach slug (e.g., "ocean-beach")
      expect(pathSegments[2]).toMatch(/^[a-z-]+$/);

      console.log(`✓ URL structure: /${pathSegments.join("/")}`);
    });
  });

  test.describe("Beach Detail Page Loading", () => {
    test("should load beach detail page successfully", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      const beachName = await firstCard.locator("h4").first().textContent();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify beach detail page elements are present
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible();

      // Verify beach name appears
      const headingText = await heading.textContent();
      expect(headingText).toContain(beachName || "");

      // Verify no error page
      const bodyText = await page.textContent("body");
      expect(bodyText).not.toMatch(/404|error|not found/i);
    });

    test("should display correct beach information on detail page", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();

      // Extract beach info from card
      const beachName = await firstCard.locator("h4").first().textContent();
      const locationText = await firstCard
        .locator("p")
        .filter({ hasText: /📍/ })
        .first()
        .textContent();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify beach name on detail page
      const detailPageText = await page.textContent("body");
      expect(detailPageText).toContain(beachName || "");

      // Verify it's the SAME beach (name matches)
      const heading = page.getByRole("heading").first();
      const headingText = await heading.textContent();
      expect(headingText?.toLowerCase()).toContain(beachName?.toLowerCase() || "");

      console.log(`✓ Beach detail page for: ${beachName}`);
    });

    test("should not show error messages or 404 page", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await firstCard.click();
      await waitForPageLoad(page);

      // Check for error indicators
      const bodyText = await page.textContent("body");

      // Should NOT contain error messages
      expect(bodyText).not.toMatch(/404/);
      expect(bodyText).not.toMatch(/page not found/i);
      expect(bodyText).not.toMatch(/something went wrong/i);
      expect(bodyText).not.toMatch(/error loading/i);

      // Should have substantial content (not a blank error page)
      expect(bodyText!.length).toBeGreaterThan(200);
    });

    test("should render beach detail page within reasonable time", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();

      // Measure navigation time
      const startTime = Date.now();
      await firstCard.click();
      await waitForPageLoad(page);

      // Wait for heading to appear
      const heading = page.getByRole("heading").first();
      await expect(heading).toBeVisible({ timeout: TIMEOUTS.medium });

      const loadTime = Date.now() - startTime;

      // Should load within 3 seconds
      expect(loadTime).toBeLessThan(3000);

      console.log(`✓ Beach detail page loaded in ${loadTime}ms`);
    });
  });

  test.describe("Back Navigation", () => {
    test("should return to landing page when clicking back", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();

      // Save current URL
      const landingUrl = page.url();

      // Click card
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify we navigated away
      expect(page.url()).not.toBe(landingUrl);

      // Go back
      await page.goBack();
      await waitForPageLoad(page);

      // Verify we're back on landing page
      const currentUrl = page.url();
      expect(currentUrl).toBe(landingUrl);

      // Verify landing page is still functional
      await expect(section).toBeVisible({ timeout: TIMEOUTS.medium });
    });

    test("should preserve landing page state after back navigation", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      // Get initial card count
      const cards = page.getByTestId("best-conditions-card");
      const initialCardCount = await cards.count();

      const firstCard = cards.first();

      // Navigate to beach detail
      await firstCard.click();
      await waitForPageLoad(page);

      // Go back
      await page.goBack();
      await waitForPageLoad(page);

      // Verify Best Conditions section is still present
      await expect(section).toBeVisible({ timeout: TIMEOUTS.medium });

      // Verify cards are still rendered
      const newCardCount = await cards.count();
      expect(newCardCount).toBe(initialCardCount);

      console.log(`✓ Landing page state preserved (${newCardCount} cards)`);
    });

    test("should handle multiple back/forward navigations", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const landingUrl = page.url();
      const firstCard = page.getByTestId("best-conditions-card").first();

      // Navigate to beach detail
      await firstCard.click();
      await waitForPageLoad(page);
      const beachUrl = page.url();

      // Go back
      await page.goBack();
      await waitForPageLoad(page);
      expect(page.url()).toBe(landingUrl);

      // Go forward
      await page.goForward();
      await waitForPageLoad(page);
      expect(page.url()).toBe(beachUrl);

      // Go back again
      await page.goBack();
      await waitForPageLoad(page);
      expect(page.url()).toBe(landingUrl);

      // Verify landing page still works
      await expect(section).toBeVisible({ timeout: TIMEOUTS.medium });

      console.log("✓ Multiple back/forward navigations successful");
    });
  });

  test.describe("Mobile Navigation", () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
    });

    test("should navigate correctly on mobile viewport", async ({ page }) => {
      // Navigate to home
      await page.goto("/");
      await waitForPageLoad(page);

      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await expect(firstCard).toBeVisible();

      // Get beach name
      const beachName = await firstCard.locator("h4").first().textContent();

      // Click card (touch event)
      await firstCard.click();
      await waitForPageLoad(page);

      // Verify navigation
      const url = page.url();
      expect(url).not.toMatch(/\/beaches\/[0-9a-f-]+/i);
      expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i);

      // Verify beach detail page
      const heading = page.getByRole("heading").first();
      const headingText = await heading.textContent();
      expect(headingText).toContain(beachName || "");

      console.log(`✓ Mobile navigation successful: ${url}`);
    });

    test("should support swipe and tap gestures on mobile", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      // Get cards container (should be scrollable)
      const cardsContainer = page.getByTestId("best-conditions-cards-container");
      await expect(cardsContainer).toBeVisible();

      // Verify container is scrollable
      const containerClasses = await cardsContainer.getAttribute("class");
      expect(containerClasses).toContain("overflow-x-auto");

      // Tap on first card
      const firstCard = page.getByTestId("best-conditions-card").first();
      await firstCard.tap();
      await waitForPageLoad(page);

      // Verify navigation occurred
      expect(page.url()).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i);
    });

    test("should handle back navigation on mobile", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const landingUrl = page.url();
      const firstCard = page.getByTestId("best-conditions-card").first();

      // Navigate to beach
      await firstCard.tap();
      await waitForPageLoad(page);

      // Go back
      await page.goBack();
      await waitForPageLoad(page);

      // Verify back on landing
      expect(page.url()).toBe(landingUrl);
      await expect(section).toBeVisible({ timeout: TIMEOUTS.medium });
    });
  });

  test.describe("Error Scenarios", () => {
    test("should handle missing beach data gracefully", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      const sectionVisible = await section
        .isVisible({ timeout: TIMEOUTS.long })
        .catch(() => false);

      if (!sectionVisible) {
        test.skip(true, "Best Conditions section not visible - expected with no data");
        return;
      }

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();

      if (cardCount === 0) {
        // No cards available - this is acceptable
        console.log("⊘ No beach cards available - skipping test");
        return;
      }

      // If cards exist, test navigation
      const firstCard = cards.first();
      await firstCard.click();
      await waitForPageLoad(page);

      // Should navigate successfully or show appropriate error
      const bodyText = await page.textContent("body");

      // Either page loaded or shows user-friendly error
      if (bodyText?.match(/404|not found/i)) {
        // This would be a regression - beach cards should only appear for valid beaches
        throw new Error("Beach card navigated to 404 - routing regression detected");
      }

      expect(bodyText!.length).toBeGreaterThan(0);
    });

    test("should not show broken beach card links", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      const sectionVisible = await section
        .isVisible({ timeout: TIMEOUTS.long })
        .catch(() => false);

      if (!sectionVisible) {
        test.skip(true, "Best Conditions section not visible");
        return;
      }

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();

      if (cardCount === 0) {
        return; // No cards to test
      }

      // Test each card navigates successfully
      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        // Reset to home
        await page.goto("/");
        await waitForPageLoad(page);
        await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

        // Click card
        const card = cards.nth(i);
        await card.click();
        await waitForPageLoad(page);

        // Verify not broken
        const response = await page.goto(page.url());
        expect(response?.status()).toBe(200);

        console.log(`✓ Card ${i + 1} navigation: ${response?.status()}`);
      }
    });
  });

  test.describe("Regression Prevention", () => {
    test("should NOT use /beaches/{uuid} URL format (regression test)", async ({ page }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const firstCard = page.getByTestId("best-conditions-card").first();
      await firstCard.click();
      await waitForPageLoad(page);

      const url = page.url();

      // PRIMARY REGRESSION CHECK: Ensure we're NOT using /beaches/{uuid}
      expect(url).not.toMatch(/\/beaches\/[0-9a-f-]{36}/i);
      expect(url).not.toMatch(/\/beaches\/[a-z0-9-]+/i);

      // VERIFY: We're using the correct hierarchical format
      expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i);

      console.log(`✓ Regression check passed: ${url}`);
    });

    test("should consistently use hierarchical URLs across all beach cards", async ({
      page,
    }) => {
      const section = page.getByTestId("best-conditions-section");
      await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

      const cards = page.getByTestId("best-conditions-card");
      const cardCount = await cards.count();

      const testedUrls: string[] = [];

      for (let i = 0; i < Math.min(cardCount, 3); i++) {
        await page.goto("/");
        await waitForPageLoad(page);
        await expect(section).toBeVisible({ timeout: TIMEOUTS.long });

        const card = cards.nth(i);
        await card.click();
        await waitForPageLoad(page);

        const url = page.url();
        testedUrls.push(url);

        // Each URL should be hierarchical
        expect(url).toMatch(/\/ca\/[a-z-]+\/[a-z-]+/i);
        expect(url).not.toMatch(/\/beaches\//i);
      }

      console.log(`✓ Tested ${testedUrls.length} URLs - all hierarchical`);
      testedUrls.forEach((url, i) => {
        console.log(`  Card ${i + 1}: ${url}`);
      });
    });
  });
});
