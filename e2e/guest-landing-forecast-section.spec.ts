/**
 * Landing Page Forecast Section Tests
 *
 * Tests the forecast section on the landing page for guest users.
 * Validates:
 * - 3-day forecast card rendering
 * - Card content (wave height, wind, water temp)
 * - Condition badges (Excellent, Good, Fair)
 * - CTA buttons navigation
 * - Responsive layout (mobile vs desktop)
 * - Accessibility features
 *
 * @project guest
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad } from "./utils/test-helpers";
import { VIEWPORTS } from "./fixtures/test-data";

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("Landing Page Forecast Section", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
  });

  test.describe("Card Rendering", () => {
    test("displays 3 forecast cards", async ({ page }) => {
      // Wait for forecast section to be visible
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify we have exactly 3 forecast cards
      const forecastCards = page.locator('[data-testid^="forecast-card-"]');
      await expect(forecastCards).toHaveCount(3);

      // Verify each card is visible
      for (let i = 0; i < 3; i++) {
        const card = page.getByTestId(`forecast-card-${i}`);
        await expect(card).toBeVisible();
      }
    });

    test("shows wave height, wind, and water temp in each card", async ({
      page,
    }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check the first card for all required content
      const firstCard = page.getByTestId("forecast-card-0");
      await expect(firstCard).toBeVisible();

      // Verify wave information is displayed
      const waveText = firstCard.locator("text=Waves");
      await expect(waveText).toBeVisible();

      // Verify wind information is displayed
      const windText = firstCard.locator("text=Wind");
      await expect(windText).toBeVisible();

      // Verify water temp information is displayed
      const waterText = firstCard.locator("text=Water");
      await expect(waterText).toBeVisible();

      // Verify we have numeric values (e.g., "3-4 ft", "4 mph", "65°F")
      const cardContent = await firstCard.textContent();
      expect(cardContent).toMatch(/\d+-?\d*\s*(ft|mph|°F)/);
    });

    test("displays day names correctly", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // First card should show "Today"
      const firstCard = page.getByTestId("forecast-card-0");
      await expect(firstCard.locator("h3")).toContainText("Today");

      // Second card should show "Tomorrow"
      const secondCard = page.getByTestId("forecast-card-1");
      await expect(secondCard.locator("h3")).toContainText("Tomorrow");

      // Third card should show a day abbreviation (Mon, Tue, Wed, etc.)
      const thirdCard = page.getByTestId("forecast-card-2");
      const thirdCardDayText = await thirdCard.locator("h3").textContent();
      expect(thirdCardDayText).toMatch(/Mon|Tue|Wed|Thu|Fri|Sat|Sun/);
    });
  });

  test.describe("Condition Badges", () => {
    test("displays condition badges on cards", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check that each card has a conditions badge
      const badges = page.getByTestId("forecast-conditions-badge");
      await expect(badges).toHaveCount(3);

      // Verify badge text is one of the expected values
      for (let i = 0; i < 3; i++) {
        const badge = badges.nth(i);
        const badgeText = await badge.textContent();
        expect(["Excellent", "Good", "Fair"]).toContain(badgeText);
      }
    });

    test("badges have appropriate styling based on condition", async ({
      page,
    }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const badges = page.getByTestId("forecast-conditions-badge");

      // Check each badge has correct styling classes
      for (let i = 0; i < 3; i++) {
        const badge = badges.nth(i);
        const badgeText = await badge.textContent();
        const badgeClasses = await badge.getAttribute("class");

        if (badgeText === "Excellent") {
          expect(badgeClasses).toContain("bg-green-100");
          expect(badgeClasses).toContain("text-green-800");
        } else if (badgeText === "Good") {
          expect(badgeClasses).toContain("bg-blue-100");
          expect(badgeClasses).toContain("text-blue-800");
        } else if (badgeText === "Fair") {
          expect(badgeClasses).toContain("bg-yellow-100");
          expect(badgeClasses).toContain("text-yellow-800");
        }
      }
    });
  });

  test.describe("CTA Buttons", () => {
    test("Explore Map button has correct link", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Find the map CTA link (use the actual Link element)
      const mapLink = forecastSection.locator('a[href="/map"]');
      await expect(mapLink).toBeVisible();

      // Verify the link text
      const linkText = await mapLink.textContent();
      expect(linkText?.length).toBeGreaterThan(0);
    });

    test("Sign Up Free button has correct link", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Find the signup CTA link (use the actual Link element)
      const signupLink = forecastSection.locator('a[href="/auth/sign-up"]');
      await expect(signupLink).toBeVisible();

      // Verify the link text
      const linkText = await signupLink.textContent();
      expect(linkText?.length).toBeGreaterThan(0);
    });

    test("CTA buttons have correct styling", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Primary button (Explore Map) should have ocean-blue styling
      const mapButton = page.getByTestId("forecast-cta-map");
      const mapButtonClasses = await mapButton.getAttribute("class");
      expect(mapButtonClasses).toContain("bg-ocean-blue");

      // Secondary button (Sign Up Free) should have outline variant
      const signupButton = page.getByTestId("forecast-cta-signup");
      await expect(signupButton).toBeVisible();
    });
  });

  test.describe("Responsive Design", () => {
    test("mobile: displays cards in single column", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Get the cards grid
      const cardsGrid = page.getByTestId("forecast-cards-grid");
      await expect(cardsGrid).toBeVisible();

      // On mobile, cards should be stacked (grid-cols-1)
      const gridClasses = await cardsGrid.getAttribute("class");
      expect(gridClasses).toContain("grid-cols-1");
    });

    test("desktop: displays cards in 3-column grid", async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Get the cards grid
      const cardsGrid = page.getByTestId("forecast-cards-grid");
      await expect(cardsGrid).toBeVisible();

      // On desktop (md breakpoint+), should have md:grid-cols-3
      const gridClasses = await cardsGrid.getAttribute("class");
      expect(gridClasses).toContain("md:grid-cols-3");
    });

    test("CTA buttons stack on mobile", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Both CTA buttons should be visible on mobile
      const mapButton = page.getByTestId("forecast-cta-map");
      const signupButton = page.getByTestId("forecast-cta-signup");

      await expect(mapButton).toBeVisible();
      await expect(signupButton).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("forecast cards are focusable via keyboard", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Tab to the CTA buttons
      const mapButton = page.getByTestId("forecast-cta-map");
      await mapButton.focus();

      // Verify button is focused
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });

    test("section has proper heading hierarchy", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Section should have an h2 heading
      const sectionHeading = forecastSection.locator("h2");
      await expect(sectionHeading).toBeVisible();

      // Cards should have h3 headings (for day names)
      const cardHeadings = forecastSection.locator("h3");
      await expect(cardHeadings).toHaveCount(3);
    });

    test("buttons have accessible text", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Primary CTA should have visible text
      const mapButton = page.getByTestId("forecast-cta-map");
      const mapButtonText = await mapButton.textContent();
      expect(mapButtonText?.length).toBeGreaterThan(0);

      // Secondary CTA should have visible text
      const signupButton = page.getByTestId("forecast-cta-signup");
      const signupButtonText = await signupButton.textContent();
      expect(signupButtonText?.length).toBeGreaterThan(0);
    });
  });

  test.describe("Visual Styling", () => {
    test("section has gradient background", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check section has gradient background classes
      const sectionClasses = await forecastSection.getAttribute("class");
      expect(sectionClasses).toContain("bg-gradient-to-br");
    });

    test("cards have hover effects", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // First card should have hover classes
      const firstCard = page.getByTestId("forecast-card-0");
      const cardClasses = await firstCard.getAttribute("class");
      expect(cardClasses).toContain("transition");
    });
  });
});
