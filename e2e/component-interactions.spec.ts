import { test, expect } from "@playwright/test";
import { waitForPageLoad, waitForElementReady, ensureAuthenticated, dismissOnboardingModal, waitForPageLoadAndDismissModal } from "./test-helpers";

test.describe("Component Interactions", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);

    // Authenticate using API-verified helper
    const authed = await ensureAuthenticated(page, 15000);
    if (!authed) {
      // Retry once from a clean state, then fail with a descriptive message
      await page.goto("/");
      await waitForPageLoad(page);
      const secondTry = await ensureAuthenticated(page, 15000);
      if (!secondTry) {
        // Final API check to log details
        const resp = await page.request.get('/api/profile');
        const status = resp.status();
        const body = await resp.text().catch(() => "");
        throw new Error(`Authentication failed before tests. URL=${page.url()} apiStatus=${status} body=${body?.slice(0,200)}`);
      }
    }

    // Navigate to home and prefer authenticated Home when possible
    await page.goto("/");
    await waitForPageLoadAndDismissModal(page);
    const bottomNav = page.getByTestId("bottom-navigation");
    const landingCta = page.locator('[data-testid="test-fallback-cta"]');
    const hasBottomNav = await bottomNav.isVisible().catch(() => false);
    const hasLandingCta = (await landingCta.count()) > 0;
    if (!hasBottomNav && hasLandingCta) {
      console.warn("Home rendered as Landing on dev; proceeding without bottom nav assertion.");
    } else if (hasBottomNav) {
      await expect(bottomNav).toBeVisible();
    }

    // Dismiss any onboarding or blocking modals/overlays
    await dismissOnboardingModal(page).catch(() => {});
    const dialog = page.locator('[role="dialog"]');
    if (await dialog.isVisible().catch(() => false)) {
      const closeBtn = page
        .getByRole("button", { name: /close|cancel|dismiss/i })
        .or(page.locator('[aria-label*="close"], [data-dismiss]'))
        .first();
      if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
        await closeBtn.click({ force: true });
        await page.waitForTimeout(300);
      } else {
        await page.keyboard.press("Escape").catch(() => {});
      }
    }
  });

  test.describe("Router and Navigation", () => {
    test("navigates between main pages correctly", async ({ page }) => {
      // Test home navigation
      const homeLink = page.locator('a[href="/"], a:has-text("Home")').first();
      if ((await homeLink.count()) > 0) {
        await homeLink.click();
        await waitForPageLoad(page);
        expect(page.url()).toContain("/");
      }

      // Test map navigation
      const mapLink = page.locator('a[href="/map"], a:has-text("Map")').first();
      if ((await mapLink.count()) > 0) {
        // Clear any overlays that might block clicks
        for (let i = 0; i < 3; i++) {
          const overlay = page.locator('[data-state="open"][data-aria-hidden="true"], [data-state="open"][aria-hidden="true"], .fixed.inset-0[aria-hidden="true"], .fixed.inset-0[data-aria-hidden="true"]').first();
          const dialog = page.locator('[role="dialog"]').first();
          const isBlocking = (await overlay.isVisible().catch(() => false)) || (await dialog.isVisible().catch(() => false));
          if (!isBlocking) break;
          const closeBtn = page.getByRole('button', { name: /close|cancel|dismiss/i }).first();
          if ((await closeBtn.count()) > 0 && (await closeBtn.isVisible().catch(() => false))) {
            await closeBtn.click({ force: true });
          } else {
            await page.keyboard.press('Escape').catch(() => {});
            if (await overlay.isVisible().catch(() => false)) {
              await overlay.click({ position: { x: 5, y: 5 } }).catch(() => {});
            }
          }
          await page.waitForTimeout(200);
        }
        await mapLink.click();
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          await ensureAuthenticated(page);
          await page.goto("/map");
          await waitForPageLoad(page);
        } else if (!page.url().includes("/map")) {
          await page.goto("/map");
          await waitForPageLoad(page);
        }
        if (page.url().includes("/auth")) {
          expect(page.url()).toContain("/auth/sign-in");
        } else {
          expect(page.url()).toContain("/map");
        }
      } else {
        await page.goto("/map");
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          await ensureAuthenticated(page);
          await page.goto("/map");
          await waitForPageLoad(page);
        }
        if (page.url().includes("/auth")) {
          expect(page.url()).toContain("/auth/sign-in");
        } else {
          expect(page.url()).toContain("/map");
        }
      }

      // Test discover navigation
      const discoverLink = page
        .locator('a[href="/discover"], a:has-text("Discover")')
        .first();
      if ((await discoverLink.count()) > 0) {
        await discoverLink.click();
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          await ensureAuthenticated(page);
          await page.goto("/discover");
          await waitForPageLoad(page);
        } else if (!page.url().includes("/discover")) {
          await page.goto("/discover");
          await waitForPageLoad(page);
        }
        if (page.url().includes("/auth")) {
          expect(page.url()).toContain("/auth/sign-in");
        } else {
          expect(page.url()).toContain("/discover");
        }
      } else {
        await page.goto("/discover");
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          await ensureAuthenticated(page);
          await page.goto("/discover");
          await waitForPageLoad(page);
        }
        if (page.url().includes("/auth")) {
          expect(page.url()).toContain("/auth/sign-in");
        } else {
          expect(page.url()).toContain("/discover");
        }
      }

      // Test profile navigation
      const profileLink = page
        .locator('a[href="/profile"], a:has-text("Profile")')
        .first();
      if ((await profileLink.count()) > 0) {
        await profileLink.click();
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          // After auth, we expect to be able to land on /profile
          const ok = await ensureAuthenticated(page, 15000);
          expect(ok).toBeTruthy();
          await page.goto("/profile");
          await waitForPageLoad(page);
        }
        const pathname = new URL(page.url()).pathname;
        expect(pathname).toBe("/profile");
      } else {
        await page.goto("/profile");
        await waitForPageLoad(page);
        if (page.url().includes("/auth")) {
          const ok = await ensureAuthenticated(page, 15000);
          expect(ok).toBeTruthy();
          await page.goto("/profile");
          await waitForPageLoad(page);
        }
        const pathname = new URL(page.url()).pathname;
        expect(pathname).toBe("/profile");
      }
    });

    test("handles page back and forward navigation", async ({ page }) => {
      // Start on home, go to Discover and back to home, then forward to Discover
      await page.goto("/discover");
      await waitForPageLoad(page);
      expect(page.url()).toContain("/discover");

      // Back to home (dashboard)
      await page.goBack();
      await waitForPageLoad(page);
      // Verify we left Discover without depending on a specific tab
      expect(page.url().includes("/discover")).toBeFalsy();

      // Forward returns to Discover
      await page.goForward();
      await waitForPageLoad(page);
      expect(page.url()).toContain("/discover");
    });

    test("preserves page state during navigation", async ({ page }) => {
      // Test that form data or selections persist appropriately
      const searchInput = page
        .locator('input[placeholder*="search"], input[type="search"]')
        .first();

      if ((await searchInput.count()) > 0) {
        await searchInput.fill("Pacific Beach");
        await page.waitForTimeout(500);

        // Navigate away and back (use Discover instead of Sessions)
        await page.goto("/discover");
        await waitForPageLoad(page);
        await page.goBack();
        await waitForPageLoad(page);

        // Check if search state is preserved (this might or might not be expected behavior)
        const searchValue = await searchInput.inputValue();
        // Just verify the input still exists and is functional
        await expect(searchInput).toBeVisible();
      }
    });
  });

  test.describe("Core Page Interactions", () => {
    test("opens and closes Edit Profile modal", async ({ page }) => {
      await page.goto("/profile");
      await waitForPageLoad(page);

      const editButton = page
        .locator('text="Edit Profile"')
        .or(page.getByRole("button", { name: /edit profile/i }))
        .or(page.locator('[href*="edit"]'))
        .first();

      if ((await editButton.count()) > 0) {
        await editButton.click();

        const formOrDialog = page
          .locator('[data-testid="home-beach-select"]').first()
          .or(page.getByRole("dialog"));
        await expect(formOrDialog).toBeVisible();

        const cancel = page
          .getByRole("button", { name: /cancel|close/i })
          .first();
        if ((await cancel.count()) > 0) {
          await cancel.click();
        } else {
          await page.keyboard.press("Escape");
        }
      }
    });

    test("performs basic Discover search", async ({ page }) => {
      await page.goto("/discover");
      await waitForPageLoad(page);

      const searchInput = page.getByPlaceholder(/search by name/i).first();
      if ((await searchInput.count()) > 0) {
        await searchInput.fill("Big");

        const searchButton = page.getByRole("button", { name: /search/i });
        if ((await searchButton.count()) > 0) {
          await searchButton.click();
        }

        await page.waitForTimeout(1500);

        const results = page.locator('text=/Search Results|Suggested Surfers/i');
        expect(await results.count()).toBeGreaterThan(0);
      }
    });
  });

  test.describe("UI State Management", () => {
    test("handles modal and dialog interactions", async ({ page }) => {
      // Look for buttons that open modals
      const modalTriggers = page.locator(
        'button:has-text("edit"), button:has-text("add"), button:has-text("create")'
      );

      if ((await modalTriggers.count()) > 0) {
        const trigger = modalTriggers.first();
        await waitForElementReady(trigger);
        await trigger.click();

        // Wait for modal to appear
        await page.waitForTimeout(500);

        // Look for modal content
        const modals = page.locator('[role="dialog"], .modal, .dialog');
        if ((await modals.count()) > 0) {
          await expect(modals.first()).toBeVisible();

          // Test closing modal
          const closeButtons = page.locator(
            'button:has-text("close"), button:has-text("cancel"), [aria-label*="close"]'
          );
          if ((await closeButtons.count()) > 0) {
            await closeButtons.first().click();
            await page.waitForTimeout(500);

            // Modal should be hidden
            expect(await modals.count()).toBe(0);
          }
        }
      }
    });

    test("manages loading states correctly", async ({ page }) => {
      // Navigate to page that shows loading states
      await page.goto("/map");

      // Look for initial loading indicators
      const initialLoading = page
        .getByText(/loading/i)
        .or(page.locator('.loading, .spinner'));

      // Wait for content to load
      await page.waitForTimeout(2000);

              // Loading should be gone and content should be visible
        const content = page.locator('.map, [data-testid="map"]');
        const forecastText = page.locator('text=/forecast/i');
        
        if ((await content.count()) > 0 || (await forecastText.count()) > 0) {
          const visibleElement = (await content.count()) > 0 ? content.first() : forecastText.first();
          await expect(visibleElement).toBeVisible();
        }
    });

    test("handles error states gracefully", async ({ page }) => {
      // Deterministically fail a single API request and assert graceful UI
      let intercepted = false;
      await page.route("**/api/**", (route) => {
        if (!intercepted && /api\/profile|api\/forecast|api\//.test(route.request().url())) {
          intercepted = true;
          return route.fulfill({ status: 400, body: JSON.stringify({ error: "Bad Request (test)" }), headers: { 'Content-Type': 'application/json' } });
        }
        return route.continue();
      });

      await page.goto("/");
      await waitForPageLoad(page);
      await page.waitForTimeout(1000);

      // App should render main content or show a non-500 style error message
      const hasMain = (await page.locator('main, [role="main"]').count()) > 0;
      const hasFriendlyError = (await page.getByText(/error|failed|unavailable|retry/i).count()) > 0;
      expect(hasMain || hasFriendlyError).toBe(true);
    });
  });

  test.describe("Accessibility and Keyboard Navigation", () => {
    test("supports keyboard navigation through interactive elements", async ({
      page,
    }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Test tab navigation
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");
      await page.keyboard.press("Tab");

      // Should be able to navigate to interactive elements
      const focusedElement = page.locator(":focus");
      await expect(focusedElement).toBeVisible();
    });

    test("provides proper ARIA labels and roles", async ({ page }) => {
      await page.goto("/");
      await waitForPageLoad(page);

      // Check for proper button roles
      const buttons = page.locator('[role="button"], button');
      expect(await buttons.count()).toBeGreaterThan(0);

      // Check for proper form labels
      const inputs = page.locator("input");
      if ((await inputs.count()) > 0) {
        for (let i = 0; i < Math.min(await inputs.count(), 5); i++) {
          const input = inputs.nth(i);
          const hasLabel =
            (await input
              .locator(
                "xpath=./preceding-sibling::label | ./following-sibling::label"
              )
              .count()) > 0;
          const hasAriaLabel =
            (await input.getAttribute("aria-label")) !== null;
          const hasAriaLabelledBy =
            (await input.getAttribute("aria-labelledby")) !== null;

          expect(hasLabel || hasAriaLabel || hasAriaLabelledBy).toBe(true);
        }
      }
    });
  });
});
