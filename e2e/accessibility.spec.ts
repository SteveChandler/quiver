import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility Testing Suite
 * 
 * This test suite uses axe-core to automatically detect accessibility violations
 * on critical pages of the Quiver application. It checks for WCAG 2.1 AA compliance.
 * 
 * Tests include:
 * - Color contrast
 * - ARIA attributes
 * - Form labels
 * - Keyboard navigation
 * - Semantic HTML
 * - Screen reader compatibility
 */

test.describe("Accessibility Tests", () => {
  test("Landing page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Discover page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/discover");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Map page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/map");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .exclude("#map-container") // Mapbox has known accessibility issues
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Sign-in page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Sign-up page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/auth/sign-up");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Forms should have proper labels and ARIA attributes", async ({
    page,
  }) => {
    await page.goto("/auth/sign-in");
    await page.waitForLoadState("load");

    // Check email input has label
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toHaveAttribute("aria-label");

    // Check password input has label
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toHaveAttribute("aria-label");

    // Check submit button is accessible
    const submitButton = page.locator('button[type="submit"]');
    await expect(submitButton).toBeVisible();
  });

  test("Navigation should be keyboard accessible", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    // Tab through navigation elements
    await page.keyboard.press("Tab");
    
    // Check if focus is visible
    const focusedElement = await page.evaluate(() => {
      const element = document.activeElement;
      return element?.tagName;
    });

    expect(["A", "BUTTON", "INPUT"]).toContain(focusedElement);
  });

  test("Color contrast should meet WCAG AA standards", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2aa"])
      .include("body")
      .analyze();

    const contrastViolations = accessibilityScanResults.violations.filter(
      (violation) => violation.id === "color-contrast"
    );

    expect(contrastViolations).toEqual([]);
  });

  test("Images should have alt text", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const images = await page.locator("img").all();

    for (const image of images) {
      const alt = await image.getAttribute("alt");
      const ariaLabel = await image.getAttribute("aria-label");
      const role = await image.getAttribute("role");

      // Image should have alt text, aria-label, or be marked as decorative
      expect(
        alt !== null || ariaLabel !== null || role === "presentation"
      ).toBeTruthy();
    }
  });

  test("Headings should follow proper hierarchy", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const headings = await page
      .locator("h1, h2, h3, h4, h5, h6")
      .evaluateAll((elements) => {
        return elements.map((el) => ({
          level: parseInt(el.tagName.charAt(1)),
          text: el.textContent,
        }));
      });

    // Should have at least one h1
    const h1Count = headings.filter((h) => h.level === 1).length;
    expect(h1Count).toBeGreaterThanOrEqual(1);

    // Check hierarchy (no skipping levels)
    for (let i = 1; i < headings.length; i++) {
      const currentLevel = headings[i].level;
      const previousLevel = headings[i - 1].level;
      const levelDiff = currentLevel - previousLevel;

      // Should not skip more than 1 level
      expect(levelDiff).toBeLessThanOrEqual(1);
    }
  });

  test("Interactive elements should have accessible names", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();

    const nameViolations = accessibilityScanResults.violations.filter(
      (violation) =>
        violation.id === "button-name" ||
        violation.id === "link-name" ||
        violation.id === "label"
    );

    expect(nameViolations).toEqual([]);
  });
});

test.describe("Authenticated Accessibility Tests", () => {
  test.use({ storageState: "e2e/.auth/state.json" });

  test("Profile page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/profile");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });

  test("Session planning page should not have accessibility violations", async ({
    page,
  }) => {
    await page.goto("/sessions/new?mode=plan");
    await page.waitForLoadState("load");

    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();

    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

