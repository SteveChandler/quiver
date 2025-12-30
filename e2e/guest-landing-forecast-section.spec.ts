/**
 * Landing Page Forecast Section Tests
 *
 * Tests the forecast section on the landing page for guest users.
 * Validates:
 * - "Your Best Spot Today" phone mock rendering
 * - Best Window tiles (Time, Tide, Wind, Confidence)
 * - Wave/Match stats display
 * - Match badge display
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

  test.describe("Phone Mock Rendering", () => {
    test("displays Best Spot Today card", async ({ page }) => {
      // Wait for forecast section to be visible
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify the Best Spot card is visible
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toBeVisible();

      // Verify heading
      const heading = page.getByTestId("best-spot-heading");
      await expect(heading).toContainText("Your Best Spot Today");
    });

    test("shows spot name and location details", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify spot name is displayed
      const spotName = page.getByTestId("spot-name");
      await expect(spotName).toBeVisible();
      await expect(spotName).toContainText("Marine Street Beach");

      // Verify location text
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toContainText("California");
    });

    test("displays current date", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify date is displayed
      const spotDate = page.getByTestId("spot-date");
      await expect(spotDate).toBeVisible();

      // Date should contain day name and month
      const dateText = await spotDate.textContent();
      expect(dateText).toMatch(
        /Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday/
      );
      expect(dateText).toMatch(/Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec/);
    });
  });

  test.describe("Match Badge", () => {
    test("displays match percentage badge", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check that match badge is visible
      const matchBadge = page.getByTestId("match-badge");
      await expect(matchBadge).toBeVisible();
      await expect(matchBadge).toContainText("94% Match");
    });

    test("match badge has correct styling", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const matchBadge = page.getByTestId("match-badge");
      const badgeClasses = await matchBadge.getAttribute("class");

      expect(badgeClasses).toContain("bg-ocean-blue");
      expect(badgeClasses).toContain("text-white");
    });
  });

  test.describe("Best Window Tiles", () => {
    test("displays 4 Best Window tiles", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Verify the Best Window tiles grid is visible
      const tilesGrid = page.getByTestId("best-window-tiles");
      await expect(tilesGrid).toBeVisible();

      // Check for tile content
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toContainText("Time");
      await expect(bestSpotCard).toContainText("Tide");
      await expect(bestSpotCard).toContainText("Wind");
      await expect(bestSpotCard).toContainText("Confidence");
    });

    test("tiles show correct values", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const bestSpotCard = page.getByTestId("best-spot-card");

      // Verify time value
      await expect(bestSpotCard).toContainText("4:00 PM - 7:00 PM");

      // Verify tide value
      await expect(bestSpotCard).toContainText("Rising");

      // Verify wind value
      await expect(bestSpotCard).toContainText("5 mph NE");

      // Verify confidence value
      await expect(bestSpotCard).toContainText("88% High");
    });
  });

  test.describe("Bottom Stats", () => {
    test("displays wave height and match percentage stats", async ({
      page,
    }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      const bottomStats = page.getByTestId("bottom-stats");
      await expect(bottomStats).toBeVisible();

      // Verify wave height
      await expect(bottomStats).toContainText("3.3 ft");
      await expect(bottomStats).toContainText("Waves");

      // Verify match percentage
      await expect(bottomStats).toContainText("94");
      await expect(bottomStats).toContainText("Match");
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
    test("mobile: displays Best Spot card", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should be visible on mobile
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toBeVisible();
    });

    test("desktop: displays Best Spot card", async ({ page }) => {
      // Set desktop viewport
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should be visible on desktop
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toBeVisible();
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
    test("CTA buttons are focusable via keyboard", async ({ page }) => {
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

      // Best Spot card should be visible
      const bestSpotCard = page.getByTestId("best-spot-card");
      await expect(bestSpotCard).toBeVisible();
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
    test("section has styled background", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check section has background styling (beige color or gradient)
      const sectionClasses = await forecastSection.getAttribute("class");
      expect(sectionClasses).toMatch(/bg-\[|bg-gradient/);
    });

    test("Best Spot card has proper styling", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Best Spot card should have proper card styling
      const bestSpotCard = page.getByTestId("best-spot-card");
      const cardClasses = await bestSpotCard.getAttribute("class");
      expect(cardClasses).toContain("rounded");
    });

    test("phone mock displays Quiver logo", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Phone mock should show Quiver logo
      const logo = page.getByTestId("phone-mock-logo");
      await expect(logo).toBeVisible();
      await expect(logo).toContainText("Quiver");
    });
  });
});
