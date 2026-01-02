/**
 * Landing Page Forecast Section Tests
 *
 * Tests the forecast section on the landing page for guest users.
 * Validates:
 * - Feature switcher interaction (Forecast, Journal, Intel)
 * - "Your Best Spot Today" phone mock rendering
 * - Session Journal phone mock
 * - Local Intel phone mock
 * - Best Window tiles (Time, Tide, Wind, Confidence)
 * - Wave/Match stats display
 * - Match badge display
 * - CTA buttons navigation
 * - Arrow button navigation
 * - Keyboard navigation (ARIA tablist pattern)
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

  test.describe("Feature Switcher", () => {
    test("displays all three features in rail", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check that all three feature tabs are visible
      await expect(
        page.getByRole("tab", { name: "Personalized Forecast" })
      ).toBeVisible();
      await expect(page.getByRole("tab", { name: "Session Journal" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Local Intel" })).toBeVisible();
    });

    test("default feature is Personalized Forecast", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Personalized Forecast should be selected by default
      const forecastTab = page.getByRole("tab", { name: "Personalized Forecast" });
      await expect(forecastTab).toHaveAttribute("aria-selected", "true");

      // Forecast phone mock should be visible
      await expect(page.getByTestId("phone-mock-forecast")).toBeVisible();
    });

    test("clicking Session Journal switches content", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Session Journal tab
      const journalTab = page.getByRole("tab", { name: "Session Journal" });
      await journalTab.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Session Journal should now be selected
      await expect(journalTab).toHaveAttribute("aria-selected", "true");

      // Journal phone mock should be visible
      await expect(page.getByTestId("phone-mock-journal")).toBeVisible();

      // Body copy should update
      await expect(forecastSection).toContainText(
        "Log sessions. Unlock better forecasts."
      );

      // Headline should update
      await expect(forecastSection).toContainText("Track your surf story");
    });

    test("clicking Local Intel switches content", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Local Intel tab
      const intelTab = page.getByRole("tab", { name: "Local Intel" });
      await intelTab.click();

      // Wait for animation
      await page.waitForTimeout(300);

      // Local Intel should now be selected
      await expect(intelTab).toHaveAttribute("aria-selected", "true");

      // Intel phone mock should be visible
      await expect(page.getByTestId("phone-mock-intel")).toBeVisible();

      // Body copy should update
      await expect(forecastSection).toContainText(
        "Real-time posts, photos, and crowd reports"
      );

      // Headline should update
      await expect(forecastSection).toContainText("Real conditions from real surfers");
    });

    test("arrow navigation cycles through features", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default is Forecast
      await expect(
        page.getByRole("tab", { name: "Personalized Forecast" })
      ).toHaveAttribute("aria-selected", "true");

      // Click Next button
      const nextButton = page.getByLabel("Next feature");
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole("tab", { name: "Session Journal" })
      ).toHaveAttribute("aria-selected", "true");

      // Click Next again
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should move to Local Intel
      await expect(
        page.getByRole("tab", { name: "Local Intel" })
      ).toHaveAttribute("aria-selected", "true");

      // Click Next again to wrap around
      await nextButton.click();
      await page.waitForTimeout(300);

      // Should wrap back to Forecast
      await expect(
        page.getByRole("tab", { name: "Personalized Forecast" })
      ).toHaveAttribute("aria-selected", "true");
    });

    test("previous arrow navigation cycles backwards", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default is Forecast
      const previousButton = page.getByLabel("Previous feature");

      // Click Previous button
      await previousButton.click();
      await page.waitForTimeout(300);

      // Should wrap to Local Intel
      await expect(
        page.getByRole("tab", { name: "Local Intel" })
      ).toHaveAttribute("aria-selected", "true");

      // Click Previous again
      await previousButton.click();
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole("tab", { name: "Session Journal" })
      ).toHaveAttribute("aria-selected", "true");
    });

    test("CTA link changes with active feature", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Default: Forecast CTA
      let ctaLink = forecastSection.locator('a[href="/map"]');
      await expect(ctaLink).toBeVisible();

      // Switch to Session Journal
      await page.getByRole("tab", { name: "Session Journal" }).click();
      await page.waitForTimeout(300);

      // CTA should now link to /sessions/new
      ctaLink = forecastSection.locator('a[href="/sessions/new"]');
      await expect(ctaLink).toBeVisible();
      await expect(ctaLink).toContainText("Start your journal");

      // Switch to Local Intel
      await page.getByRole("tab", { name: "Local Intel" }).click();
      await page.waitForTimeout(300);

      // CTA should link to /map
      ctaLink = forecastSection.locator('a[href="/map"]');
      await expect(ctaLink).toBeVisible();
      await expect(ctaLink).toContainText("Explore the map");
    });
  });

  test.describe("Keyboard Navigation", () => {
    test("ArrowDown navigates to next feature", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus the first tab
      const forecastTab = page.getByRole("tab", { name: "Personalized Forecast" });
      await forecastTab.focus();

      // Press ArrowDown
      await page.keyboard.press("ArrowDown");
      await page.waitForTimeout(300);

      // Should move to Session Journal
      await expect(
        page.getByRole("tab", { name: "Session Journal" })
      ).toHaveAttribute("aria-selected", "true");
    });

    test("ArrowUp navigates to previous feature", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus the first tab
      const forecastTab = page.getByRole("tab", { name: "Personalized Forecast" });
      await forecastTab.focus();

      // Press ArrowUp
      await page.keyboard.press("ArrowUp");
      await page.waitForTimeout(300);

      // Should wrap to Local Intel
      await expect(
        page.getByRole("tab", { name: "Local Intel" })
      ).toHaveAttribute("aria-selected", "true");
    });

    test("Home key navigates to first feature", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Switch to Local Intel first
      await page.getByRole("tab", { name: "Local Intel" }).click();
      await page.waitForTimeout(300);

      // Focus current tab and press Home
      const intelTab = page.getByRole("tab", { name: "Local Intel" });
      await intelTab.focus();
      await page.keyboard.press("Home");
      await page.waitForTimeout(300);

      // Should move to Personalized Forecast
      await expect(
        page.getByRole("tab", { name: "Personalized Forecast" })
      ).toHaveAttribute("aria-selected", "true");
    });

    test("End key navigates to last feature", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Focus first tab and press End
      const forecastTab = page.getByRole("tab", { name: "Personalized Forecast" });
      await forecastTab.focus();
      await page.keyboard.press("End");
      await page.waitForTimeout(300);

      // Should move to Local Intel
      await expect(
        page.getByRole("tab", { name: "Local Intel" })
      ).toHaveAttribute("aria-selected", "true");
    });
  });

  test.describe("Responsive Feature Switcher", () => {
    test("mobile: displays horizontal segmented control", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // All three tabs should be visible in horizontal layout
      await expect(
        page.getByRole("tab", { name: "Personalized Forecast" })
      ).toBeVisible();
      await expect(page.getByRole("tab", { name: "Session Journal" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Local Intel" })).toBeVisible();
    });

    test("mobile: feature switching works", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Click Session Journal
      await page.getByRole("tab", { name: "Session Journal" }).click();
      await page.waitForTimeout(300);

      // Should show journal mock
      await expect(page.getByTestId("phone-mock-journal")).toBeVisible();
    });

    test("desktop: displays vertical rail navigation", async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Arrow buttons should be visible on desktop
      await expect(page.getByLabel("Previous feature")).toBeVisible();
      await expect(page.getByLabel("Next feature")).toBeVisible();
    });
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
    test("default Explore Map button has correct link", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Find the map CTA link (default for forecast feature)
      const mapLink = forecastSection.locator('a[href="/map"]');
      await expect(mapLink).toBeVisible();

      // Verify the link text
      const linkText = await mapLink.textContent();
      expect(linkText?.length).toBeGreaterThan(0);
    });

    test("CTA button has correct styling", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Primary button should have ocean-blue styling
      const ctaButton = page.getByTestId("forecast-cta-forecast");
      const buttonClasses = await ctaButton.getAttribute("class");
      expect(buttonClasses).toContain("bg-ocean-blue");
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

    test("CTA button visible on mobile", async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize(VIEWPORTS.mobile);
      await page.goto("/");
      await waitForPageLoad(page);

      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // CTA button should be visible on mobile
      const ctaButton = page.getByTestId("forecast-cta-forecast");
      await expect(ctaButton).toBeVisible();
    });
  });

  test.describe("Accessibility", () => {
    test("CTA button is focusable via keyboard", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Tab to the CTA button
      const ctaButton = page.getByTestId("forecast-cta-forecast");
      await ctaButton.focus();

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

    test("CTA button has accessible text", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // CTA should have visible text
      const ctaButton = page.getByTestId("forecast-cta-forecast");
      const ctaButtonText = await ctaButton.textContent();
      expect(ctaButtonText?.length).toBeGreaterThan(0);
    });

    test("feature tabs have accessible ARIA attributes", async ({ page }) => {
      const forecastSection = page.getByTestId("forecast-section");
      await expect(forecastSection).toBeVisible({ timeout: 5000 });

      // Check tablist has proper role
      const tablist = page.getByRole("tablist");
      await expect(tablist).toBeVisible();

      // Each tab should have proper ARIA attributes
      const forecastTab = page.getByRole("tab", { name: "Personalized Forecast" });
      await expect(forecastTab).toHaveAttribute("aria-controls", "phone-mock-panel");
      await expect(forecastTab).toHaveAttribute("aria-selected");

      // Tabpanel should exist
      const tabpanel = page.locator('[role="tabpanel"]');
      await expect(tabpanel).toBeVisible();
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
