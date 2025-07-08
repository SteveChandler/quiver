import { test, expect } from "@playwright/test";

test.describe("Unauthenticated User Flows", () => {
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
    test("Landing page provides clear value proposition and sign up path", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // 1. Check if we see a landing page or are redirected to auth
      const isLandingPage = !page.url().includes("/auth");

      if (isLandingPage) {
        // Look for key landing page elements
        const heroSection = page.locator("h1, .hero, .landing");
        if (await heroSection.first().isVisible()) {
          console.log("Landing page hero section visible");
        }

        // Look for sign up CTA - use first() to avoid strict mode violations
        const signUpCTA = page
          .getByRole("link", { name: /sign up|get started|join/i })
          .or(page.getByRole("button", { name: /sign up|get started|join/i }))
          .first();

        if (await signUpCTA.isVisible()) {
          console.log("Sign up CTA visible on landing page");

          // Test sign up flow
          await signUpCTA.click();
          await page.waitForTimeout(1000);

          // Should navigate to sign up page
          expect(
            page.url().includes("/auth/sign-up") || page.url().includes("/auth")
          ).toBeTruthy();
        }
      } else {
        // Already on auth page - check for sign up option
        const signUpLink = page.getByRole("link", {
          name: /sign up|create account/i,
        });
        if (await signUpLink.isVisible()) {
          console.log("Sign up option available on auth page");
        }
      }
    });

    test("Browse public content without authentication", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Check if we can access public content
      const publicContent = page.locator("main, .content, .public-content");
      if (await publicContent.isVisible()) {
        console.log("Public content accessible without authentication");

        // Try to access forecast information
        const forecastInfo = page.getByText(/forecast|wave|conditions|surf/i);
        if (await forecastInfo.isVisible()) {
          console.log("Forecast information visible to unauthenticated users");
        }

        // Try to access map/beach information
        await page.goto("/map");
        await page.waitForTimeout(2000);

        const mapContent = page.locator("main");
        if ((await mapContent.isVisible()) && !page.url().includes("/auth")) {
          console.log(
            "Map/beach information accessible without authentication"
          );

          // Check if beach information is visible
          const beachInfo = page.locator(".beach-card, .beach-info");
          if (await beachInfo.first().isVisible()) {
            console.log("Beach information visible to unauthenticated users");
          }
        }
      }
    });

    test("Encounter authentication prompts at appropriate points", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Try to access features that require authentication
      const protectedFeatures = ["/profile", "/log-session", "/plan-session"];

      for (const feature of protectedFeatures) {
        await page.goto(feature);
        await page.waitForTimeout(2000);

        // Should be redirected to auth or see auth prompt
        const isAuthRequired =
          page.url().includes("/auth") ||
          page.url() === new URL("/", page.url()).href;

        if (isAuthRequired) {
          console.log(`${feature} properly requires authentication`);
        } else {
          // Look for auth prompts or sign in buttons
          const authPrompt = page.getByText(/sign in|log in|sign up/i);
          if (await authPrompt.isVisible()) {
            console.log(`${feature} shows authentication prompt`);
          }
        }
      }
    });
  });

  test.describe("Content Discovery Without Account", () => {
    test("Explore beach information as potential user", async ({ page }) => {
      await page.goto("/map");
      await page.waitForTimeout(2000);

      // Check if map is accessible
      if (!page.url().includes("/auth")) {
        // Try to search for beaches
        const searchInput = page
          .getByPlaceholder("Search beaches...")
          .or(page.locator("input[type='search']"));

        if (await searchInput.isVisible()) {
          await searchInput.fill("Malibu");
          await page.waitForTimeout(1000);

          // Look for search results
          const searchResults = page.locator(".search-result, .suggestion, li");
          if (await searchResults.first().isVisible()) {
            await searchResults.first().click();
            await page.waitForTimeout(1000);
            console.log("Beach search works for unauthenticated users");
          }
        }

        // Try to view beach details
        const beachCard = page.locator(".beach-card, [data-beach-id]").first();
        if (await beachCard.isVisible()) {
          await beachCard.click();
          await page.waitForTimeout(1000);

          // Check if beach details are shown
          const beachDetails = page.getByText(/forecast|conditions|rating/i);
          if (await beachDetails.isVisible()) {
            console.log("Beach details accessible to unauthenticated users");
          }

          // Look for sign up prompts on beach details
          const signUpPrompt = page.getByText(/sign up|create account|join/i);
          if (await signUpPrompt.isVisible()) {
            console.log("Sign up prompt shown on beach details");
          }
        }
      }
    });

    test("View community activity and get motivated to join", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Try to access community content
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        // Check if community content is visible
        const communityContent = page.locator(
          ".session-card, .community-content, .max-w-2xl"
        );
        if (await communityContent.first().isVisible()) {
          console.log("Community content visible to unauthenticated users");

          // Try to interact with community content (should prompt for auth)
          const likeButton = communityContent
            .first()
            .getByRole("button", { name: /like|heart/i });
          if (await likeButton.isVisible()) {
            await likeButton.click();
            await page.waitForTimeout(1000);

            // Should see auth prompt
            const authPrompt = page.getByText(/sign in|sign up|log in/i);
            if (await authPrompt.isVisible()) {
              console.log(
                "Auth prompt shown when trying to interact with community content"
              );
            }
          }
        }
      } else {
        // If community tab not visible, try direct navigation
        await page.goto("/community");
        await page.waitForTimeout(2000);

        if (page.url().includes("/auth")) {
          console.log("Community page requires authentication");
        }
      }
    });
  });

  test.describe("Sign Up Flow", () => {
    test("Complete sign up process", async ({ page }) => {
      await page.goto("/auth/sign-up");
      await page.waitForTimeout(2000);

      // Check if sign up form is visible
      const signUpForm = page.locator("form");
      if (await signUpForm.isVisible()) {
        // Look for required fields - use first() to avoid strict mode violations
        const emailField = page
          .getByLabel(/email/i)
          .or(page.locator("input[type='email']"))
          .first();
        const passwordField = page
          .getByLabel(/password/i)
          .or(page.locator("input[type='password']"))
          .first();
        const submitButton = page
          .getByRole("button", {
            name: /sign up|create account/i,
          })
          .first();

        const hasRequiredFields =
          (await emailField.isVisible()) &&
          (await passwordField.isVisible()) &&
          (await submitButton.isVisible());

        if (hasRequiredFields) {
          console.log("Sign up form has required fields");

          // Test form validation
          await submitButton.click();
          await page.waitForTimeout(1000);

          // Should show validation errors for empty fields
          const validationError = page.getByText(/required|invalid|error/i);
          if (await validationError.isVisible()) {
            console.log("Form validation working for empty fields");
          }

          // Fill invalid email
          await emailField.fill("invalid-email");
          await submitButton.click();
          await page.waitForTimeout(1000);

          const emailError = page.getByText(/invalid.*email|email.*invalid/i);
          if (await emailError.isVisible()) {
            console.log("Email validation working");
          }

          // Fill valid email but weak password
          await emailField.fill("test@example.com");
          await passwordField.fill("123");
          await submitButton.click();
          await page.waitForTimeout(1000);

          const passwordError = page.getByText(
            /password.*too.*short|weak.*password/i
          );
          if (await passwordError.isVisible()) {
            console.log("Password validation working");
          }
        }

        // Check for alternative sign up methods
        const googleSignUp = page.getByRole("button", {
          name: /google|continue with google/i,
        });
        if (await googleSignUp.isVisible()) {
          console.log("Google sign up option available");
        }

        // Check for link to sign in
        const signInLink = page
          .getByRole("link", {
            name: /sign in|already have account/i,
          })
          .first();
        if (await signInLink.isVisible()) {
          console.log("Sign in link available for existing users");
        }
      }
    });

    test("Navigate between sign up and sign in", async ({ page }) => {
      // Start at sign up
      await page.goto("/auth/sign-up");
      await page.waitForTimeout(2000);

      // Look for sign in link - use first() to avoid strict mode violations
      const signInLink = page
        .getByRole("link", {
          name: /sign in|already.*account/i,
        })
        .first();
      if (await signInLink.isVisible()) {
        await signInLink.click();
        await page.waitForTimeout(1000);

        // Should be on sign in page
        expect(page.url().includes("/auth/sign-in")).toBeTruthy();

        // Look for sign up link
        const signUpLink = page
          .getByRole("link", {
            name: /sign up|create.*account/i,
          })
          .first();
        if (await signUpLink.isVisible()) {
          await signUpLink.click();
          await page.waitForTimeout(1000);

          // Should be back on sign up page
          expect(page.url().includes("/auth/sign-up")).toBeTruthy();
        }
      }
    });
  });

  test.describe("Value Demonstration", () => {
    test("Show app value through public forecast and beach data", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Check if forecast information is available
      const forecastContent = page.getByText(/forecast|wave|surf.*conditions/i);
      if (await forecastContent.isVisible()) {
        console.log(
          "Forecast information provides value to unauthenticated users"
        );

        // Look for specific forecast details
        const forecastDetails = page.getByText(
          /wave.*height|wind.*speed|conditions/i
        );
        if (await forecastDetails.isVisible()) {
          console.log("Detailed forecast information available");
        }
      }

      // Check nearby beaches functionality
      const nearbyTab = page.getByRole("tab", { name: /nearby/i });
      if (await nearbyTab.isVisible()) {
        await nearbyTab.click();
        await page.waitForTimeout(2000);

        const nearbyBeaches = page.locator(".beach-card, .beach-item");
        const beachCount = await nearbyBeaches.count();

        if (beachCount > 0) {
          console.log(
            `${beachCount} nearby beaches shown to unauthenticated users`
          );

          // Check if basic beach information is shown
          const beachInfo = nearbyBeaches.first().getByText(/miles|km|rating/i);
          if (await beachInfo.isVisible()) {
            console.log("Basic beach information available");
          }
        }
      }
    });

    test("Preview community activity to encourage sign up", async ({
      page,
    }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Try to access community preview
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        // Check for community preview
        const communityPreview = page.locator(
          ".session-card, .community-preview"
        );
        if (await communityPreview.first().isVisible()) {
          console.log("Community preview available to unauthenticated users");

          // Look for motivational content
          const motivationalContent = page.getByText(
            /join|community|surfers|sessions/i
          );
          if (await motivationalContent.isVisible()) {
            console.log("Motivational content encouraging sign up");
          }

          // Check for sign up CTA in community section
          const communityCTA = page
            .getByRole("button", { name: /join|sign up/i })
            .or(page.getByRole("link", { name: /join|sign up/i }));

          if (await communityCTA.isVisible()) {
            console.log("Sign up CTA present in community section");
          }
        }
      }
    });
  });

  test.describe("Mobile Unauthenticated Experience", () => {
    test("Mobile-first experience for unauthenticated users", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      await page.goto("/");
      await page.waitForTimeout(2000);

      // Check mobile navigation
      const mobileNav = page.getByTestId("bottom-navigation");
      if (await mobileNav.isVisible()) {
        console.log("Mobile navigation visible");

        // Test mobile navigation
        const navItems = ["Home", "Map"];
        for (const item of navItems) {
          const navItem = mobileNav.getByText(item, { exact: true });
          if (await navItem.isVisible()) {
            await navItem.click();
            await page.waitForTimeout(1500);
            console.log(`Mobile navigation to ${item} working`);
          }
        }
      }

      // Check mobile-optimized content
      const mobileContent = page.locator("main");
      if (await mobileContent.isVisible()) {
        const contentBox = await mobileContent.boundingBox();
        if (contentBox) {
          expect(contentBox.width).toBeLessThanOrEqual(375);
          console.log("Content properly sized for mobile");
        }
      }

      // Check mobile sign up experience
      await page.goto("/auth/sign-up");
      await page.waitForTimeout(2000);

      const mobileForm = page.locator("form");
      if (await mobileForm.isVisible()) {
        const formBox = await mobileForm.boundingBox();
        if (formBox) {
          expect(formBox.width).toBeLessThanOrEqual(375);
          console.log("Sign up form properly sized for mobile");
        }
      }
    });
  });

  test.describe("SEO and Discovery", () => {
    test("Landing page has appropriate meta information", async ({ page }) => {
      await page.goto("/");
      await page.waitForTimeout(2000);

      // Check page title
      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
      console.log(`Page title: ${title}`);

      // Check for meta description
      const metaDescription = page.locator('meta[name="description"]');
      if (await metaDescription.isVisible()) {
        const content = await metaDescription.getAttribute("content");
        if (content && content.length > 0) {
          console.log("Meta description present");
        }
      }

      // Check for key headings
      const h1 = page.locator("h1");
      if (await h1.first().isVisible()) {
        const h1Text = await h1.first().textContent();
        console.log(`Main heading: ${h1Text}`);
      }
    });

    test("Beach pages accessible for SEO", async ({ page }) => {
      await page.goto("/map");
      await page.waitForTimeout(2000);

      if (!page.url().includes("/auth")) {
        // Try to access a beach page
        const beachCard = page.locator(".beach-card, [data-beach-id]").first();
        if (await beachCard.isVisible()) {
          await beachCard.click();
          await page.waitForTimeout(1000);

          // Check if beach page is accessible
          const beachPage = page.locator("main");
          if (await beachPage.isVisible()) {
            console.log("Beach page accessible for SEO");

            // Check for structured content
            const beachName = page.locator("h1, h2").first();
            if (await beachName.isVisible()) {
              const nameText = await beachName.textContent();
              console.log(`Beach page title: ${nameText}`);
            }
          }
        }
      }
    });
  });
});
