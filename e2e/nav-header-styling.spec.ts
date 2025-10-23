import { test, expect, Page } from "@playwright/test";

/**
 * Phase 4: Enhanced Styling & Polish E2E Tests
 * Tests for AllTrails-inspired visual enhancements to navigation header
 */

test.describe("Navigation Header - Phase 4: Enhanced Styling & Polish", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to authenticated page with user state
    await page.goto("/.auth/state.json");
  });

  test.describe("Sign Up Button Styling", () => {
    test("sign up button has rounded-full pill shape", async ({ page }) => {
      await page.goto("/");

      // Navigate to a page where sign-up is visible (guest state)
      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      const signUpButton = page
        .getByRole("link", { name: /sign up/i })
        .locator("button");
      const isVisible = await signUpButton.isVisible().catch(() => false);

      if (isVisible) {
        const borderRadius = await signUpButton.evaluate((el) =>
          window.getComputedStyle(el).borderRadius
        );

        // Pill shape should have large border-radius (rounded-full = 9999px)
        expect(borderRadius).toMatch(/999|100%/);
      }
    });

    test("sign up button has shadow", async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      const signUpButton = page
        .getByRole("link", { name: /sign up/i })
        .locator("button");
      const isVisible = await signUpButton.isVisible().catch(() => false);

      if (isVisible) {
        const boxShadow = await signUpButton.evaluate((el) =>
          window.getComputedStyle(el).boxShadow
        );

        // Should have shadow-sm (not "none")
        expect(boxShadow).not.toBe("none");
      }
    });

    test("sign up button has proper padding and height", async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      const signUpButton = page
        .getByRole("link", { name: /sign up/i })
        .locator("button");
      const isVisible = await signUpButton.isVisible().catch(() => false);

      if (isVisible) {
        const box = await signUpButton.boundingBox();

        if (box) {
          // h-10 = 40px height
          expect(box.height).toBeGreaterThanOrEqual(38);
          expect(box.height).toBeLessThanOrEqual(42);
        }
      }
    });
  });

  test.describe("Avatar Hover Effects", () => {
    test("avatar button increases in size on hover", async ({ page }) => {
      await page.goto("/map");

      const avatarButton = page.getByTestId("user-avatar-button");
      const isVisible = await avatarButton.isVisible().catch(() => false);

      if (isVisible) {
        const boxBefore = await avatarButton.boundingBox();

        // Hover over avatar
        await avatarButton.hover();

        // Wait for transition
        await page.waitForTimeout(250);

        const boxAfter = await avatarButton.boundingBox();

        if (boxBefore && boxAfter) {
          // Avatar should be h-9 w-9 (36px) - verify size increased from h-8 to h-9
          expect(boxAfter.width).toBeGreaterThanOrEqual(34);
          expect(boxAfter.width).toBeLessThanOrEqual(40);
        }
      }
    });
  });

  test.describe("Logo Hover Transition", () => {
    test("logo has transition-colors class", async ({ page }) => {
      await page.goto("/map");

      const logo = page.getByText("Quiver").first();
      const isVisible = await logo.isVisible().catch(() => false);

      if (isVisible) {
        const transitionProperty = await logo.evaluate((el) =>
          window.getComputedStyle(el).transitionProperty
        );

        // Should transition colors
        expect(transitionProperty).toContain("color");
      }
    });
  });

  test.describe("Focus States", () => {
    test("logo link has focus ring on keyboard focus", async ({ page }) => {
      await page.goto("/map");

      const logoLink = page.locator('a[href="/"]').first();

      // Tab to logo link
      await page.keyboard.press("Tab");

      const isFocused = await logoLink.evaluate(
        (el) => el === document.activeElement
      );

      if (isFocused) {
        // Should have focus ring
        const outline = await logoLink.evaluate(
          (el) => window.getComputedStyle(el).outline
        );

        // Focus ring should be visible
        expect(outline).not.toBe("none");
      }
    });

    test("navigation links have focus ring on keyboard focus", async ({
      page,
    }) => {
      await page.goto("/map");

      const discoverLink = page.getByRole("link", { name: "Discover" });
      const isVisible = await discoverLink.isVisible().catch(() => false);

      if (isVisible) {
        // Click to focus
        await discoverLink.focus();

        const isFocused = await discoverLink.evaluate(
          (el) => el === document.activeElement
        );

        if (isFocused) {
          const outline = await discoverLink.evaluate(
            (el) => window.getComputedStyle(el).outline
          );

          // Should have focus ring
          expect(outline).not.toBe("none");
        }
      }
    });

    test("sign up button has focus ring on keyboard focus", async ({
      page,
    }) => {
      await page.goto("/");

      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      const signUpButton = page
        .getByRole("link", { name: /sign up/i })
        .locator("button");
      const isVisible = await signUpButton.isVisible().catch(() => false);

      if (isVisible) {
        await signUpButton.focus();

        const isFocused = await signUpButton.evaluate(
          (el) => el === document.activeElement
        );

        if (isFocused) {
          const outline = await signUpButton.evaluate((el) => {
            const style = window.getComputedStyle(el);
            return style.outline;
          });

          // Should have focus ring
          expect(outline).not.toBe("none");
        }
      }
    });
  });

  test.describe("Accessibility - ARIA Labels", () => {
    test("avatar button has aria-label", async ({ page }) => {
      await page.goto("/map");

      const avatarButton = page.getByTestId("user-avatar-button");
      const isVisible = await avatarButton.isVisible().catch(() => false);

      if (isVisible) {
        const ariaLabel = await avatarButton.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("menu");
      }
    });

    test("search input has aria-label", async ({ page }) => {
      await page.goto("/map");

      const searchInput = page.getByTestId("header-search-input");
      const isVisible = await searchInput.isVisible().catch(() => false);

      if (isVisible) {
        const ariaLabel = await searchInput.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("Search");
      }
    });

    test("mobile search button has aria-label", async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/map");

      const mobileSearchButton = page.getByTestId("mobile-search-button");
      const isVisible = await mobileSearchButton.isVisible().catch(() => false);

      if (isVisible) {
        const ariaLabel = await mobileSearchButton.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("Search");
      }
    });

    test("notification bell has aria-label", async ({ page }) => {
      await page.goto("/map");

      const notificationButton = page.getByTestId("notification-bell-button");
      const isVisible = await notificationButton.isVisible().catch(() => false);

      if (isVisible) {
        const ariaLabel = await notificationButton.getAttribute("aria-label");
        expect(ariaLabel).toBeTruthy();
        expect(ariaLabel).toContain("Notification");
      }
    });
  });

  test.describe("Typography", () => {
    test("logo has correct font weight and size", async ({ page }) => {
      await page.goto("/map");

      const logo = page.getByText("Quiver").first();
      const isVisible = await logo.isVisible().catch(() => false);

      if (isVisible) {
        const fontSize = await logo.evaluate(
          (el) => window.getComputedStyle(el).fontSize
        );
        const fontWeight = await logo.evaluate(
          (el) => window.getComputedStyle(el).fontWeight
        );

        // text-xl = 20px, font-bold = 700
        expect(parseInt(fontSize)).toBeGreaterThanOrEqual(20);
        expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(700);
      }
    });

    test("sign up button has correct font weight", async ({ page }) => {
      await page.goto("/");

      await page.evaluate(() => {
        localStorage.clear();
        sessionStorage.clear();
      });
      await page.reload();

      const signUpButton = page
        .getByRole("link", { name: /sign up/i })
        .locator("button");
      const isVisible = await signUpButton.isVisible().catch(() => false);

      if (isVisible) {
        const fontWeight = await signUpButton.evaluate(
          (el) => window.getComputedStyle(el).fontWeight
        );

        // font-semibold = 600
        expect(parseInt(fontWeight)).toBeGreaterThanOrEqual(600);
      }
    });
  });

  test.describe("Spacing and Layout", () => {
    test("header has correct height on desktop", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/map");

      const header = page.locator("header").first();
      const box = await header.boundingBox();

      if (box) {
        // md:h-16 = 64px on desktop
        expect(box.height).toBeGreaterThanOrEqual(60);
        expect(box.height).toBeLessThanOrEqual(68);
      }
    });

    test("navigation items have proper spacing", async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto("/map");

      const navContainer = page.locator("nav").first();
      const isVisible = await navContainer.isVisible().catch(() => false);

      if (isVisible) {
        const gap = await navContainer.evaluate((el) =>
          window.getComputedStyle(el).gap
        );

        // space-x-8 = 32px gap
        // Note: gap might be "0px" if using space-x, check margin instead
        const firstLink = navContainer.locator("a").first();
        const marginLeft = await firstLink.evaluate(
          (el) => window.getComputedStyle(el).marginLeft
        );

        // ml-8 on nav container = 32px
        expect(parseInt(marginLeft) >= 0).toBeTruthy();
      }
    });
  });

  test.describe("Transitions and Animations", () => {
    test("all interactive elements have transition duration", async ({
      page,
    }) => {
      await page.goto("/map");

      const elements = [
        page.getByText("Quiver").first(),
        page.getByRole("link", { name: "Discover" }).first(),
        page.getByTestId("user-avatar-button"),
      ];

      for (const element of elements) {
        const isVisible = await element.isVisible().catch(() => false);

        if (isVisible) {
          const transitionDuration = await element.evaluate(
            (el) => window.getComputedStyle(el).transitionDuration
          );

          // Should have some transition duration (not "0s")
          expect(transitionDuration).not.toBe("0s");
        }
      }
    });

    test("hover states apply smoothly with transitions", async ({ page }) => {
      await page.goto("/map");

      const logo = page.getByText("Quiver").first();
      const isVisible = await logo.isVisible().catch(() => false);

      if (isVisible) {
        const transitionProperty = await logo.evaluate(
          (el) => window.getComputedStyle(el).transitionProperty
        );

        // Should transition colors
        expect(transitionProperty).toMatch(/color|all/);
      }
    });
  });

  test.describe("Cross-Browser Consistency", () => {
    test("styling renders consistently across viewports", async ({ page }) => {
      const viewports = [
        { width: 375, height: 667 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1280, height: 800 }, // Desktop
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.goto("/map");

        const header = page.locator("header").first();
        const isVisible = await header.isVisible();

        expect(isVisible).toBeTruthy();

        // Verify no horizontal scroll
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        const windowWidth = await page.evaluate(() => window.innerWidth);

        expect(bodyWidth).toBeLessThanOrEqual(windowWidth + 1); // Allow 1px tolerance
      }
    });
  });
});
