/**
 * State Hub Intent Guides Grid E2E Tests
 *
 * Tests the IntentGuidesGrid component on state hub pages (/beaches/usa/[state]).
 * Verifies that all 7 intent links are present and navigate correctly.
 */

import { test, expect } from "@playwright/test";

test.describe("State Hub Intent Guides Grid", () => {
  test.describe("California State Page", () => {
    test.beforeEach(async ({ page }) => {
      await page.goto("/beaches/usa/ca");
      // Wait for the page to fully load
      await expect(
        page.getByRole("heading", { name: /Best surf beaches in California/i })
      ).toBeVisible();
    });

    test("should display intent guides grid heading", async ({ page }) => {
      await expect(
        page.getByRole("heading", { name: /Surf Guides for California/i })
      ).toBeVisible();
    });

    test("should display all 7 intent cards", async ({ page }) => {
      // Session group (3)
      await expect(page.getByText("Dawn Patrol")).toBeVisible();
      await expect(page.getByText("Sunset Sessions")).toBeVisible();
      await expect(page.getByText("Tide Windows")).toBeVisible();

      // Style group (4)
      await expect(page.getByText("Beginner Spots")).toBeVisible();
      await expect(page.getByText("Longboard Spots")).toBeVisible();
      await expect(page.getByText("Less Crowded")).toBeVisible();
      await expect(page.getByText("Water Temperature")).toBeVisible();
    });

    test("should display Session and Style group headings", async ({ page }) => {
      await expect(page.getByRole("heading", { name: "Session" })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Style" })).toBeVisible();
    });

    test("should have correct href for beginner intent link", async ({ page }) => {
      const beginnerLink = page.getByRole("link", {
        name: /Beginner Spots surf guide for California/i,
      });
      await expect(beginnerLink).toHaveAttribute("href", "/beginner/ca");
    });

    test("should navigate to intent page when clicking a card", async ({ page }) => {
      const beginnerLink = page.getByRole("link", {
        name: /Beginner Spots surf guide for California/i,
      });

      await beginnerLink.click();

      // Wait for navigation to complete
      await page.waitForURL(/\/beginner\/ca/, { timeout: 10000 });
      await expect(page).toHaveURL(/\/beginner\/ca/);
    });
  });

  test.describe("Hawaii State Page", () => {
    test("should display intent guides for Hawaii", async ({ page }) => {
      const response = await page.goto("/beaches/usa/hi");

      // Fail if page doesn't have data
      if (response?.status() === 404) {
        throw new Error('Not implemented: Hawaii state hub page returned 404 - page needs data');
      }

      // Wait for page header to ensure page loaded
      const header = page.getByRole("heading", { name: /Best surf beaches in Hawaii/i });
      const headerVisible = await header.isVisible().catch(() => false);

      if (!headerVisible) {
        throw new Error('Not implemented: Hawaii state page header not visible - page content missing');
      }

      await expect(
        page.getByRole("heading", { name: /Surf Guides for Hawaii/i })
      ).toBeVisible();

      // Verify sunset link for Hawaii
      const sunsetLink = page.getByRole("link", {
        name: /Sunset Sessions surf guide for Hawaii/i,
      });
      await expect(sunsetLink).toHaveAttribute("href", "/sunset/hi");
    });
  });
});

test.describe("Intent Grid SEO Verification", () => {
  test("intent links should be crawlable anchor tags with correct hrefs", async ({ page }) => {
    await page.goto("/beaches/usa/ca");

    // Wait for the intent grid to render
    await expect(
      page.getByRole("heading", { name: /Surf Guides for California/i })
    ).toBeVisible();

    // Get all intent card hrefs
    const hrefs = await page.locator('a[aria-label*="surf guide for California"]').evaluateAll(
      (links) => links.map((link) => link.getAttribute("href"))
    );

    // Should have exactly 7 intent links
    expect(hrefs).toHaveLength(7);

    // Verify all expected URLs are present
    expect(hrefs).toContain("/dawn-patrol/ca");
    expect(hrefs).toContain("/sunset/ca");
    expect(hrefs).toContain("/tide/ca");
    expect(hrefs).toContain("/beginner/ca");
    expect(hrefs).toContain("/longboard/ca");
    expect(hrefs).toContain("/least-crowded/ca");
    expect(hrefs).toContain("/water-temp/ca");
  });
});
