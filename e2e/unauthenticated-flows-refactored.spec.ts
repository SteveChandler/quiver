import { test, expect } from "@playwright/test";

test.describe("Unauthenticated User Flows (Refactored)", () => {
  test.beforeEach(async ({ page, context }) => {
    // Ensure we start with a clean slate
    await context.clearCookies();
    await context.clearPermissions();
    await page.evaluate(() => {
      try {
        localStorage.clear();
        sessionStorage.clear();
      } catch (e) {
        // Ignore if storage is not accessible
      }
    });
  });

  test.describe("First-time Visitor Experience", () => {
    test("should display accessible landing page with clear value proposition", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Verify page loads successfully
      await expect(page.locator("body")).toBeVisible();

      // Check for main content - either landing page or auth redirect
      const mainContent = page.locator("main, [role='main'], .landing, .hero");
      await expect(mainContent.first()).toBeVisible();

      // Look for key elements that indicate value proposition
      const valueElements = page.locator("h1, h2, .hero-title, .headline");
      await expect(valueElements.first()).toBeVisible();

      // Verify text content exists
      const pageText = await page.locator("body").textContent();
      expect(pageText).toBeTruthy();
      expect(pageText!.length).toBeGreaterThan(50); // Should have meaningful content
    });

    test("should provide clear sign up pathway", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Look for sign up elements
      const signUpButton = page.getByRole("button", {
        name: /sign up|get started|join|create.*account/i,
      });
      const signUpLink = page.getByRole("link", {
        name: /sign up|get started|join|create.*account/i,
      });

      // At least one sign up element should be visible
      const hasSignUpButton = await signUpButton
        .first()
        .isVisible()
        .catch(() => false);
      const hasSignUpLink = await signUpLink
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasSignUpButton || hasSignUpLink).toBeTruthy();

      // Test sign up interaction
      if (hasSignUpButton) {
        await signUpButton.first().click();
      } else {
        await signUpLink.first().click();
      }

      // Should navigate to auth page or show sign up form
      await page.waitForLoadState("networkidle");

      // Check for auth page or sign up form
      const isOnAuthPage =
        page.url().includes("/auth") || page.url().includes("/sign");
      const hasSignUpForm = await page
        .locator("form, input[type='email'], input[type='password']")
        .isVisible()
        .catch(() => false);

      expect(isOnAuthPage || hasSignUpForm).toBeTruthy();
    });

    test("should allow browsing public content without authentication", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Verify public content is accessible
      await expect(page.locator("body")).toBeVisible();

      // Check for surf-related content
      const surfContent = page.getByText(
        /surf|wave|beach|forecast|conditions/i
      );
      await expect(surfContent.first()).toBeVisible();

      // Navigate to map page
      await page.goto("/map");
      await page.waitForLoadState("networkidle");

      // Should not be redirected to auth for public beach information
      const isRedirectedToAuth = page.url().includes("/auth");
      expect(isRedirectedToAuth).toBeFalsy();

      // Should see beach-related content
      const beachContent = page.locator(
        '.beach-card, .beach-info, [data-testid="beach-card"]'
      );
      const mapContent = page.locator(
        '.map-container, [data-testid="map-container"]'
      );

      const hasBeachContent = await beachContent
        .first()
        .isVisible()
        .catch(() => false);
      const hasMapContent = await mapContent.isVisible().catch(() => false);

      expect(hasBeachContent || hasMapContent).toBeTruthy();
    });

    test("should require authentication for protected features", async ({
      page,
    }) => {
      const protectedRoutes = [
        { path: "/profile", name: "profile" },
        { path: "/log-session", name: "session logging" },
        { path: "/plan-session", name: "session planning" },
      ];

      for (const route of protectedRoutes) {
        await page.goto(route.path);
        await page.waitForLoadState("networkidle");

        // Should be redirected to auth or home page
        const currentUrl = page.url();
        const isProtected =
          currentUrl.includes("/auth") ||
          currentUrl.includes("/sign") ||
          currentUrl === new URL("/", page.url()).href;

        expect(isProtected).toBeTruthy();
      }
    });
  });

  test.describe("Content Discovery Without Account", () => {
    test("should explore beach information as potential user", async ({
      page,
    }) => {
      await page.goto("/map");
      await page.waitForLoadState("networkidle");

      // Find beach information
      const beachCards = page.locator(
        '.beach-card, [data-testid="beach-card"]'
      );
      await expect(beachCards.first()).toBeVisible();

      // Click on first beach
      await beachCards.first().click();
      await page.waitForLoadState("networkidle");

      // Should see beach details (either new page or expanded card)
      const beachDetails = page.locator(
        '.beach-detail, [data-testid="beach-detail"]'
      );
      const beachInfo = page.locator(".beach-info, .forecast-info");

      const hasDetails = await beachDetails.isVisible().catch(() => false);
      const hasInfo = await beachInfo
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasDetails || hasInfo).toBeTruthy();
    });

    test("should view forecast information without account", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Look for forecast content on home page
      const forecastContent = page.locator(
        '.forecast, [data-testid="forecast-content"]'
      );
      const weatherInfo = page.getByText(
        /wave.*height|wind.*speed|conditions|forecast/i
      );

      const hasForecastSection = await forecastContent
        .isVisible()
        .catch(() => false);
      const hasWeatherInfo = await weatherInfo
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasForecastSection || hasWeatherInfo).toBeTruthy();

      // Navigate to map to see more forecast details
      await page.goto("/map");
      await page.waitForLoadState("networkidle");

      // Beach cards should show forecast previews
      const beachCard = page
        .locator('.beach-card, [data-testid="beach-card"]')
        .first();
      await expect(beachCard).toBeVisible();

      const forecastPreview = beachCard.locator(
        '.forecast, [data-testid="forecast-preview"]'
      );
      const conditionsText = beachCard.getByText(
        /good|fair|poor|excellent|\d+ft|\d+mph/i
      );

      const hasPreview = await forecastPreview.isVisible().catch(() => false);
      const hasConditions = await conditionsText
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasPreview || hasConditions).toBeTruthy();
    });

    test("should understand community features through preview", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Look for community/social content previews
      const communityTab = page.getByRole("tab", {
        name: /community|local.*intel|activity/i,
      });
      const socialContent = page.locator(".social, .community, .activity-feed");

      const hasCommunityTab = await communityTab.isVisible().catch(() => false);
      const hasSocialContent = await socialContent
        .isVisible()
        .catch(() => false);

      if (hasCommunityTab) {
        await communityTab.click();
        await page.waitForLoadState("networkidle");

        // Should see community content or auth prompt
        const communityPosts = page.locator(".post, .session-card, .activity");
        const authPrompt = page.getByText(/sign.*in|log.*in|join.*community/i);

        const hasPosts = await communityPosts
          .first()
          .isVisible()
          .catch(() => false);
        const hasAuthPrompt = await authPrompt.isVisible().catch(() => false);

        expect(hasPosts || hasAuthPrompt).toBeTruthy();
      }
    });
  });

  test.describe("Authentication Flow Discovery", () => {
    test("should find sign in options easily", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Look for sign in elements
      const signInButton = page.getByRole("button", {
        name: /sign.*in|log.*in|login/i,
      });
      const signInLink = page.getByRole("link", {
        name: /sign.*in|log.*in|login/i,
      });

      const hasSignInButton = await signInButton
        .first()
        .isVisible()
        .catch(() => false);
      const hasSignInLink = await signInLink
        .first()
        .isVisible()
        .catch(() => false);

      expect(hasSignInButton || hasSignInLink).toBeTruthy();

      // Test sign in navigation
      if (hasSignInButton) {
        await signInButton.first().click();
      } else {
        await signInLink.first().click();
      }

      await page.waitForLoadState("networkidle");

      // Should be on sign in page or see sign in form
      const isOnSignInPage =
        page.url().includes("/sign-in") || page.url().includes("/auth");
      const hasSignInForm = await page
        .locator('input[type="email"], input[type="password"]')
        .isVisible()
        .catch(() => false);

      expect(isOnSignInPage || hasSignInForm).toBeTruthy();
    });

    test("should discover value before requiring registration", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Should be able to see value propositions
      const valueContent = page.locator("h1, h2, .hero, .feature");
      await expect(valueContent.first()).toBeVisible();

      // Navigate through public content
      const publicPages = ["/", "/map"];

      for (const pagePath of publicPages) {
        await page.goto(pagePath);
        await page.waitForLoadState("networkidle");

        // Should not be immediately redirected to auth
        const isRedirectedToAuth = page.url().includes("/auth");
        expect(isRedirectedToAuth).toBeFalsy();

        // Should have meaningful content
        const pageContent = await page.locator("body").textContent();
        expect(pageContent).toBeTruthy();
        expect(pageContent!.length).toBeGreaterThan(100);
      }
    });

    test("should provide smooth onboarding experience", async ({ page }) => {
      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Look for onboarding elements
      const getStartedButton = page.getByRole("button", {
        name: /get.*started|start.*free|try.*now/i,
      });
      const learnMoreLink = page.getByRole("link", {
        name: /learn.*more|how.*it.*works|about/i,
      });

      const hasGetStarted = await getStartedButton
        .isVisible()
        .catch(() => false);
      const hasLearnMore = await learnMoreLink.isVisible().catch(() => false);

      expect(hasGetStarted || hasLearnMore).toBeTruthy();

      // Test getting started flow
      if (hasGetStarted) {
        await getStartedButton.click();
        await page.waitForLoadState("networkidle");

        // Should lead to registration or tutorial
        const isOnRegistration =
          page.url().includes("/auth") || page.url().includes("/sign");
        const hasTutorial = await page
          .getByText(/tutorial|guide|welcome|setup/i)
          .isVisible()
          .catch(() => false);

        expect(isOnRegistration || hasTutorial).toBeTruthy();
      }
    });
  });

  test.describe("Mobile Experience Without Account", () => {
    test("should be mobile-friendly for unauthenticated users", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForLoadState("networkidle");

      // Verify mobile layout
      await expect(page.locator("body")).toBeVisible();

      // Check for mobile navigation
      const mobileNav = page.locator(
        '.mobile-nav, .bottom-nav, [data-testid="mobile-nav"]'
      );
      const hamburgerMenu = page.locator(
        '.hamburger, .menu-toggle, [aria-label*="menu"]'
      );

      const hasMobileNav = await mobileNav.isVisible().catch(() => false);
      const hasHamburgerMenu = await hamburgerMenu
        .isVisible()
        .catch(() => false);

      expect(hasMobileNav || hasHamburgerMenu).toBeTruthy();

      // Test touch interactions
      const touchableElements = page.locator(
        'button, a, [role="button"], [role="link"]'
      );
      const firstTouchable = touchableElements.first();

      if (await firstTouchable.isVisible()) {
        const boundingBox = await firstTouchable.boundingBox();
        if (boundingBox) {
          // Touch targets should be at least 44px (iOS) or 48px (Android)
          expect(boundingBox.height).toBeGreaterThanOrEqual(40);
          expect(boundingBox.width).toBeGreaterThanOrEqual(40);
        }
      }
    });
  });
});
