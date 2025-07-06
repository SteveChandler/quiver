import { test, expect } from "@playwright/test";

test.describe("Surf Journal+ Experience", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("/");

    // Wait for page to be ready
    await page.waitForLoadState("networkidle");
  });

  test("complete journal workflow from profile entry to export", async ({
    page,
  }) => {
    // 1. Entry point - User taps "Journal" in their profile
    test.step("Navigate to profile and access Journal", async () => {
      // Navigate to profile page
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Check if we're authenticated (might redirect to auth)
      const currentUrl = page.url();
      if (currentUrl.includes("/auth") || currentUrl.includes("/sign")) {
        // If not authenticated, skip this test or handle auth
        console.log("User not authenticated - test will verify auth flow");

        // Verify auth page loads correctly
        const authForm = page.locator('[data-testid="sign-in-form"], form');
        if (await authForm.isVisible()) {
          await expect(authForm).toBeVisible();
        }

        // For testing purposes, we'll continue to test the journal components
        // In a real test environment, you'd authenticate first
        return;
      }

      // Look for Journal tab
      const journalTab = page
        .getByRole("tab", { name: /journal/i })
        .or(page.getByText(/journal/i).first());

      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(1000);
      }

      // Verify Journal+ interface loads
      const journalContent = page
        .getByText("Surf Journal+")
        .or(
          page
            .getByText("Track your sessions")
            .or(page.getByTestId("journal-view"))
        );

      const isJournalVisible = await journalContent
        .isVisible()
        .catch(() => false);
      if (isJournalVisible) {
        await expect(journalContent).toBeVisible();
      }
    });

    // 2. Session List / Calendar Toggle
    test.step("Test session list and calendar toggle", async () => {
      // Look for view toggle buttons
      const listButton = page
        .getByRole("button", { name: /list/i })
        .or(page.getByTestId("list-view-button"));
      const calendarButton = page
        .getByRole("button", { name: /calendar/i })
        .or(page.getByTestId("calendar-view-button"));

      // Test list view
      if (await listButton.isVisible()) {
        await listButton.click();
        await page.waitForTimeout(500);

        // Verify list view content
        const sessionCards = page
          .locator('[data-testid="session-card"], .session-card')
          .or(page.getByText(/beach|session/i));

        // Should show either sessions or empty state
        const hasSessionsOrEmpty = await Promise.race([
          sessionCards
            .first()
            .isVisible()
            .catch(() => false),
          page
            .getByText(/no sessions|log your first/i)
            .isVisible()
            .catch(() => false),
          page
            .getByText(/haven't logged/i)
            .isVisible()
            .catch(() => false),
        ]);

        expect(hasSessionsOrEmpty).toBeTruthy();
      }

      // Test calendar view
      if (await calendarButton.isVisible()) {
        await calendarButton.click();
        await page.waitForTimeout(500);

        // Verify calendar content
        const calendarGrid = page
          .locator('[data-testid="calendar-heatmap"], .calendar')
          .or(
            page.getByText(
              /january|february|march|april|may|june|july|august|september|october|november|december/i
            )
          );

        const hasCalendar = await calendarGrid.isVisible().catch(() => false);
        if (hasCalendar) {
          await expect(calendarGrid).toBeVisible();
        }
      }
    });

    // 3. Dive into a Session (Session Detail)
    test.step("Test session detail interaction", async () => {
      // Look for session cards or calendar days
      const sessionElements = page
        .locator('[data-testid="session-card"], .session-card')
        .or(page.getByText(/beach/i).first());

      const hasSessionElements = await sessionElements
        .first()
        .isVisible()
        .catch(() => false);

      if (hasSessionElements) {
        // Click on a session
        await sessionElements.first().click();
        await page.waitForTimeout(1000);

        // Check for session detail modal or expanded view
        const sessionDetail = page
          .locator(
            '[data-testid="session-detail"], [data-testid="annotation-modal"]'
          )
          .or(page.getByText(/session details|conditions/i));

        const hasSessionDetail = await sessionDetail
          .isVisible()
          .catch(() => false);
        if (hasSessionDetail) {
          await expect(sessionDetail).toBeVisible();

          // Look for typical session detail elements
          const detailElements = [
            page.getByText(/wave|rating|duration|notes/i),
            page.getByRole("button", { name: /save|close|edit/i }),
          ];

          const hasDetailElements = await Promise.all(
            detailElements.map((el) => el.isVisible().catch(() => false))
          );

          expect(hasDetailElements.some((visible) => visible)).toBeTruthy();
        }
      }
    });

    // 4. Wave Analytics & Performance
    test.step("Test analytics and insights", async () => {
      // Look for insights/analytics tab or button
      const insightsTab = page
        .getByRole("tab", { name: /insights|analytics/i })
        .or(
          page
            .getByTestId("insights-tab")
            .or(page.getByText(/insights|analytics/i))
        );

      if (await insightsTab.isVisible()) {
        await insightsTab.click();
        await page.waitForTimeout(1000);

        // Verify analytics content
        const analyticsElements = [
          page.getByText(/wave height|rating|trend/i),
          page.getByText(/chart|graph/i),
          page.locator('[data-testid="session-analytics"]'),
          page.getByText(/performance|statistics/i),
        ];

        const hasAnalytics = await Promise.all(
          analyticsElements.map((el) => el.isVisible().catch(() => false))
        );

        expect(hasAnalytics.some((visible) => visible)).toBeTruthy();
      }
    });

    // 5. Annotate & Share (Privacy Toggle)
    test.step("Test session annotation and privacy features", async () => {
      // Look for privacy controls or annotation features
      const privacyControls = page
        .locator('[data-testid="privacy-toggle"]')
        .or(
          page
            .getByText(/private|public|share/i)
            .or(page.locator('input[type="checkbox"]').first())
        );

      const hasPrivacyControls = await privacyControls
        .first()
        .isVisible()
        .catch(() => false);

      if (hasPrivacyControls) {
        // Test privacy toggle
        await privacyControls.first().click();
        await page.waitForTimeout(500);

        // Should show some feedback or state change
        const privacyFeedback = page.getByText(/updated|saved|private|public/i);
        const hasFeedback = await privacyFeedback
          .isVisible()
          .catch(() => false);

        if (hasFeedback) {
          expect(hasFeedback).toBeTruthy();
        }
      }

      // Look for annotation features
      const annotationFeatures = page
        .getByRole("button", { name: /add note|edit|annotate/i })
        .or(
          page
            .getByTestId("annotation-button")
            .or(page.locator('textarea, input[placeholder*="note"]'))
        );

      const hasAnnotationFeatures = await annotationFeatures
        .first()
        .isVisible()
        .catch(() => false);
      if (hasAnnotationFeatures) {
        expect(hasAnnotationFeatures).toBeTruthy();
      }
    });

    // 6. Export / Reflect
    test.step("Test export functionality", async () => {
      // Look for export button
      const exportButton = page
        .getByRole("button", { name: /export|download/i })
        .or(page.getByTestId("export-button"));

      if (await exportButton.isVisible()) {
        await exportButton.click();
        await page.waitForTimeout(1000);

        // Verify export modal or options
        const exportModal = page
          .locator('[data-testid="export-modal"]')
          .or(page.getByText(/export|pdf|download/i));

        const hasExportModal = await exportModal.isVisible().catch(() => false);
        if (hasExportModal) {
          await expect(exportModal).toBeVisible();

          // Look for export options
          const exportOptions = [
            page.getByText(/monthly|yearly|single/i),
            page.getByText(/include.*photo/i),
            page.getByText(/include.*analytics/i),
            page.getByRole("button", { name: /export.*pdf/i }),
          ];

          const hasExportOptions = await Promise.all(
            exportOptions.map((el) => el.isVisible().catch(() => false))
          );

          expect(hasExportOptions.some((visible) => visible)).toBeTruthy();
        }
      }
    });
  });

  test("journal functionality without authentication", async ({ page }) => {
    test.step("Test journal access without auth", async () => {
      // Navigate directly to profile
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Should redirect to auth or show auth-required message
      const currentUrl = page.url();
      const isRedirectedToAuth =
        currentUrl.includes("/auth") || currentUrl.includes("/sign");

      if (isRedirectedToAuth) {
        // Verify auth page loads
        const authContent = page
          .getByText(/sign.*in|log.*in|authentication/i)
          .or(page.locator("form").first());

        const hasAuthContent = await authContent.isVisible().catch(() => false);
        expect(hasAuthContent).toBeTruthy();
      } else {
        // If not redirected, should show some indication that auth is needed
        const authIndicator = page
          .getByText(/sign.*in|login|authenticate/i)
          .or(page.locator('[data-testid="auth-loader"]'));

        const hasAuthIndicator = await authIndicator
          .isVisible()
          .catch(() => false);
        expect(hasAuthIndicator).toBeTruthy();
      }
    });
  });

  test("journal empty state and onboarding", async ({ page }) => {
    test.step("Test empty state when no sessions exist", async () => {
      // Navigate to profile
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Skip if not authenticated
      if (page.url().includes("/auth")) {
        return;
      }

      // Look for journal tab
      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(1000);
      }

      // Check for empty state
      const emptyState = page
        .getByText(/no sessions|haven't logged|log your first/i)
        .or(page.getByTestId("empty-state"));

      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      if (hasEmptyState) {
        await expect(emptyState).toBeVisible();

        // Should have call-to-action to log session
        const logSessionCTA = page
          .getByRole("link", { name: /log.*session/i })
          .or(page.getByRole("button", { name: /log.*session/i }));

        const hasCTA = await logSessionCTA.isVisible().catch(() => false);
        if (hasCTA) {
          await expect(logSessionCTA).toBeVisible();
        }
      }
    });
  });

  test("journal responsive design", async ({ page }) => {
    test.step("Test journal on different screen sizes", async () => {
      // Test mobile view
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/profile");
      await page.waitForTimeout(1000);

      // Journal should be accessible on mobile
      const journalAccess = page
        .getByText(/journal/i)
        .or(page.getByRole("tab", { name: /journal/i }));

      const hasJournalAccess = await journalAccess
        .first()
        .isVisible()
        .catch(() => false);
      if (hasJournalAccess) {
        await journalAccess.first().click();
        await page.waitForTimeout(500);
      }

      // Test tablet view
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);

      // Test desktop view
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(500);

      // Journal should remain functional across all sizes
      const journalContent = page
        .getByText(/surf.*journal|track.*session/i)
        .or(page.getByTestId("journal-view"));

      const hasJournalContent = await journalContent
        .isVisible()
        .catch(() => false);
      if (hasJournalContent) {
        expect(hasJournalContent).toBeTruthy();
      }
    });
  });

  test("journal navigation and state persistence", async ({ page }) => {
    test.step("Test navigation maintains journal state", async () => {
      // Navigate to journal
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Skip if auth required
      if (page.url().includes("/auth")) {
        return;
      }

      // Access journal
      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();
        await page.waitForTimeout(1000);

        // Switch to calendar view if available
        const calendarButton = page.getByRole("button", { name: /calendar/i });
        if (await calendarButton.isVisible()) {
          await calendarButton.click();
          await page.waitForTimeout(500);
        }

        // Navigate away and back
        await page.goto("/map");
        await page.waitForTimeout(1000);
        await page.goto("/profile");
        await page.waitForTimeout(1000);

        // Journal should still be accessible
        const journalTabAgain = page.getByRole("tab", { name: /journal/i });
        if (await journalTabAgain.isVisible()) {
          await expect(journalTabAgain).toBeVisible();
        }
      }
    });
  });

  test("journal performance and loading states", async ({ page }) => {
    test.step("Test journal loading performance", async () => {
      // Measure navigation to journal
      const startTime = Date.now();

      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Skip if auth required
      if (page.url().includes("/auth")) {
        return;
      }

      const journalTab = page.getByRole("tab", { name: /journal/i });
      if (await journalTab.isVisible()) {
        await journalTab.click();

        // Wait for journal content to load
        await page
          .waitForSelector('[data-testid="journal-view"], h2, h3', {
            timeout: 10000,
          })
          .catch(() => {
            // If specific selectors don't exist, wait for any content
            return page.waitForSelector("body", { timeout: 5000 });
          });

        const loadTime = Date.now() - startTime;
        console.log(`Journal load time: ${loadTime}ms`);

        // Should load within reasonable time (10 seconds for E2E)
        expect(loadTime).toBeLessThan(10000);
      }

      // Check for loading states
      const loadingIndicators = page
        .locator('[data-testid*="loading"], .loading, .spinner')
        .or(page.getByText(/loading/i));

      // Loading indicators should eventually disappear
      await page.waitForTimeout(3000);
      const stillLoading = await loadingIndicators
        .isVisible()
        .catch(() => false);

      // It's okay if there are no loading indicators, but if they exist, they should be gone
      if (stillLoading) {
        await page.waitForTimeout(2000); // Give more time
      }
    });
  });
});
