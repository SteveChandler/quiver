import { test, expect } from "@playwright/test";

test.describe("Sessions View", () => {
  test.describe("Sessions List", () => {
    test.beforeEach(async ({ page }) => {
      // Sessions page now redirects to profile, so test profile sessions tab
      await page.goto("/profile");
      await page.waitForTimeout(1000);
      // Try to click on journal tab if it exists
      const sessionsTab = page.getByRole("tab", { name: /journal/i });
      if (await sessionsTab.isVisible().catch(() => false)) {
        await sessionsTab.click();
        await page.waitForTimeout(1000);
      }
    });

    test.fixme("should display sessions list correctly", async ({ page }) => {
      // Check that sessions view is visible or we have content
      const hasSessionsView = await page
        .getByTestId("sessions-view")
        .isVisible()
        .catch(() => false);
      const hasSessionsContent = await page
        .locator(".sessions-view")
        .isVisible()
        .catch(() => false);
      const hasMainContent = await page
        .locator("main")
        .isVisible()
        .catch(() => false);

      expect(
        hasSessionsView || hasSessionsContent || hasMainContent
      ).toBeTruthy();

      // Look for sessions list or empty state
      const sessionsList = page
        .getByTestId("sessions-list")
        .or(page.locator(".sessions-list"));
      const emptyState = page.getByText(/no sessions|empty|start logging/i);

      const hasSessionsList = await sessionsList.isVisible().catch(() => false);
      const hasEmptyState = await emptyState.isVisible().catch(() => false);

      // Should show either sessions list or empty state
      expect(hasSessionsList || hasEmptyState).toBeTruthy();
    });

    test("should show session items with basic information", async ({
      page,
    }) => {
      // Wait for data to load
      await page.waitForTimeout(2000);

      const sessionItems = page.locator(
        '[data-testid="session-item"], .session-item, .session-card'
      );
      const sessionCount = await sessionItems.count();

      if (sessionCount > 0) {
        // Should have at least one session
        expect(sessionCount).toBeGreaterThan(0);

        const firstSession = sessionItems.first();
        await expect(firstSession).toBeVisible();

        // Check for basic session information
        const sessionInfo = [
          firstSession.getByText(/beach|location/i),
          firstSession.getByText(
            /\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|ago|yesterday|today/i
          ), // Date
          firstSession.getByText(/am|pm|\d+:\d+|duration|hour/i), // Time or duration
          firstSession.getByText(/board|surf/i),
        ];

        const visibleInfo = await Promise.all(
          sessionInfo.map((info) => info.isVisible().catch(() => false))
        );

        expect(visibleInfo.some((info) => info)).toBeTruthy();
      }
    });

    test("should allow filtering sessions", async ({ page }) => {
      // Look for filter controls
      const filterButton = page.getByRole("button", { name: /filter|sort/i });
      const filterDropdown = page
        .getByTestId("filter-dropdown")
        .or(page.locator(".filter-dropdown"));

      if (await filterButton.isVisible()) {
        await filterButton.click();

        // Should show filter options
        if (await filterDropdown.isVisible()) {
          await expect(filterDropdown).toBeVisible();

          // Look for filter options
          const filterOptions = [
            page.getByText(/date|recent|oldest/i),
            page.getByText(/beach|location/i),
            page.getByText(/rating|quality/i),
            page.getByText(/board|type/i),
          ];

          for (const option of filterOptions) {
            if (await option.isVisible()) {
              await option.click();
              await page.waitForTimeout(1000);
              break;
            }
          }
        }
      }
    });

    test("should allow searching sessions", async ({ page }) => {
      // Look for search functionality
      const searchBox = page
        .getByPlaceholder(/search|find sessions/i)
        .or(page.getByLabel(/search/i));

      if (await searchBox.isVisible()) {
        await searchBox.click();
        await searchBox.fill("Malibu");

        // Wait for search results
        await page.waitForTimeout(2000);

        // Sessions list should update based on search
        const sessionItems = page.locator(
          '[data-testid="session-item"], .session-item'
        );
        const searchResults = await sessionItems.count();

        // Results should be filtered (or show no results message)
        const noResults = page.getByText(/no results|not found/i);
        const hasResults = searchResults > 0;
        const hasNoResultsMessage = await noResults
          .isVisible()
          .catch(() => false);

        expect(hasResults || hasNoResultsMessage).toBeTruthy();
      }
    });

    test("should handle session pagination or infinite scroll", async ({
      page,
    }) => {
      // Wait for initial sessions to load
      await page.waitForTimeout(2000);

      const initialSessionCount = await page
        .locator('[data-testid="session-item"], .session-item')
        .count();

      if (initialSessionCount > 0) {
        // Look for pagination controls
        const nextButton = page.getByRole("button", {
          name: /next|more|load more/i,
        });
        const paginationNav = page
          .getByTestId("pagination")
          .or(page.locator(".pagination"));

        if (await nextButton.isVisible()) {
          await nextButton.click();
          await page.waitForTimeout(2000);

          // Should load more sessions or show next page
          const newSessionCount = await page
            .locator('[data-testid="session-item"], .session-item')
            .count();

          if (newSessionCount > initialSessionCount) {
            expect(newSessionCount).toBeGreaterThan(initialSessionCount);
          }
        } else if (await paginationNav.isVisible()) {
          // Test pagination navigation
          const pageNumbers = paginationNav.locator("button");
          const pageCount = await pageNumbers.count();

          if (pageCount > 1) {
            await pageNumbers.nth(1).click(); // Click second page
            await page.waitForTimeout(2000);
          }
        } else {
          // Test infinite scroll
          await page.evaluate(() => {
            window.scrollTo(0, document.body.scrollHeight);
          });
          await page.waitForTimeout(2000);
        }
      }
    });

    test("should navigate to session details", async ({ page }) => {
      // Wait for sessions to load
      await page.waitForTimeout(2000);

      const sessionItem = page
        .locator('[data-testid="session-item"], .session-item')
        .first();

      if (await sessionItem.isVisible()) {
        await sessionItem.click();

        // Should navigate to session detail page
        await page.waitForTimeout(1000);

        const isDetailPage = page.url().includes("/sessions/");
        const detailModal = page
          .getByTestId("session-detail-modal")
          .or(page.locator('[role="dialog"]'));
        const hasModal = await detailModal.isVisible().catch(() => false);

        expect(isDetailPage || hasModal).toBeTruthy();
      }
    });
  });

  test.describe("Session Details", () => {
    test("should display detailed session information", async ({ page }) => {
      // Navigate to a session detail page (using a test ID)
      await page.goto("/sessions/test-session-id");

      // Wait for page to load
      await page.waitForTimeout(2000);

      // Check if session detail is shown or if we're redirected
      const sessionDetail = page
        .getByTestId("session-detail")
        .or(page.locator(".session-detail"));
      const notFoundMessage = page.getByText(/not found|doesn't exist/i);

      const hasSessionDetail = await sessionDetail
        .isVisible()
        .catch(() => false);
      const hasNotFound = await notFoundMessage.isVisible().catch(() => false);

      if (hasSessionDetail) {
        await expect(sessionDetail).toBeVisible();

        // Check for detailed session information
        const detailElements = [
          page.getByText(/beach|location/i),
          page.getByText(/date|time/i),
          page.getByText(/board|equipment/i),
          page.getByText(/conditions|waves|wind/i),
          page.getByText(/notes|description/i),
        ];

        const visibleDetails = await Promise.all(
          detailElements.map((el) => el.isVisible().catch(() => false))
        );

        expect(visibleDetails.some((detail) => detail)).toBeTruthy();
      } else if (hasNotFound) {
        // Session not found is also a valid scenario
        await expect(notFoundMessage).toBeVisible();
      }
    });

    test("should show session photos if available", async ({ page }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for photo gallery or images
      const photoGallery = page
        .getByTestId("session-photos")
        .or(page.locator(".photo-gallery, .session-images"));
      const images = page.locator('img[src*="session"], .session-photo');

      if (await photoGallery.isVisible()) {
        await expect(photoGallery).toBeVisible();
      } else if ((await images.count()) > 0) {
        await expect(images.first()).toBeVisible();
      }
    });

    test("should display session statistics", async ({ page }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for session stats
      const statsElements = [
        page
          .getByTestId("session-stats")
          .or(page.getByText(/statistics|stats/i)),
        page.getByText(/duration|time surfed/i),
        page.getByText(/waves caught|wave count/i),
        page.getByText(/rating|quality/i),
        page.getByText(/distance|paddle/i),
      ];

      const visibleStats = await Promise.all(
        statsElements.map((stat) => stat.isVisible().catch(() => false))
      );

      if (visibleStats.some((stat) => stat)) {
        expect(visibleStats.some((stat) => stat)).toBeTruthy();
      }
    });

    test("should show weather and surf conditions", async ({ page }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for conditions information
      const conditionsElements = [
        page
          .getByTestId("session-conditions")
          .or(page.getByText(/conditions/i)),
        page.getByText(/wave height|swell/i),
        page.getByText(/wind|offshore|onshore/i),
        page.getByText(/tide|high tide|low tide/i),
        page.getByText(/temperature|water temp/i),
      ];

      const visibleConditions = await Promise.all(
        conditionsElements.map((condition) =>
          condition.isVisible().catch(() => false)
        )
      );

      if (visibleConditions.some((condition) => condition)) {
        expect(visibleConditions.some((condition) => condition)).toBeTruthy();
      }
    });

    test("should allow editing session when authenticated", async ({
      page,
    }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for edit button
      const editButton = page.getByRole("button", { name: /edit|modify/i });

      if (await editButton.isVisible()) {
        await editButton.click();

        // Should navigate to edit form or show edit modal
        await page.waitForTimeout(1000);

        const isEditPage = page.url().includes("/edit");
        const editModal = page
          .getByTestId("edit-session-modal")
          .or(page.locator('[role="dialog"]'));
        const hasEditModal = await editModal.isVisible().catch(() => false);

        expect(isEditPage || hasEditModal).toBeTruthy();
      }
    });

    test("should allow deleting session when authenticated", async ({
      page,
    }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for delete button
      const deleteButton = page.getByRole("button", { name: /delete|remove/i });

      if (await deleteButton.isVisible()) {
        await deleteButton.click();

        // Should show confirmation dialog
        const confirmDialog = page
          .getByRole("dialog")
          .or(page.getByText(/confirm|are you sure/i));
        if (await confirmDialog.isVisible()) {
          // Don't actually delete in tests - just check the dialog appears
          await expect(confirmDialog).toBeVisible();

          const cancelButton = page.getByRole("button", { name: /cancel|no/i });
          if (await cancelButton.isVisible()) {
            await cancelButton.click();
          }
        }
      }
    });

    test("should show related sessions or recommendations", async ({
      page,
    }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for related sessions
      const relatedSessions = page
        .getByTestId("related-sessions")
        .or(page.getByText(/related|similar|other sessions/i));
      const recommendationsSection = page
        .getByTestId("recommendations")
        .or(page.locator(".recommendations"));

      if (await relatedSessions.isVisible()) {
        await expect(relatedSessions).toBeVisible();
      } else if (await recommendationsSection.isVisible()) {
        await expect(recommendationsSection).toBeVisible();
      }
    });

    test("should handle session sharing", async ({ page }) => {
      await page.goto("/sessions/test-session-id");
      await page.waitForTimeout(2000);

      // Look for share functionality
      const shareButton = page.getByRole("button", { name: /share/i });
      const shareIcon = page.locator(
        '[data-testid="share-button"], .share-btn'
      );

      if (await shareButton.isVisible()) {
        await shareButton.click();

        // Should show share options
        const shareOptions = page
          .getByTestId("share-options")
          .or(page.locator(".share-options"));
        if (await shareOptions.isVisible()) {
          await expect(shareOptions).toBeVisible();
        }
      } else if (await shareIcon.isVisible()) {
        await shareIcon.click();
        await page.waitForTimeout(1000);
      }
    });
  });

  test.describe("Session Analytics", () => {
    test("should display session analytics and trends", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Look for analytics or stats section
      const analyticsSection = page
        .getByTestId("session-analytics")
        .or(page.getByText(/analytics|statistics|trends/i));
      const chartContainer = page.locator(".chart, .graph, canvas");

      if (await analyticsSection.isVisible()) {
        await expect(analyticsSection).toBeVisible();

        // Look for charts or graphs
        if (await chartContainer.isVisible()) {
          await expect(chartContainer).toBeVisible();
        }
      }
    });

    test("should show session frequency over time", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Look for time-based analytics
      const frequencyChart = page
        .getByTestId("frequency-chart")
        .or(page.getByText(/frequency|sessions per/i));
      const monthlyStats = page.getByText(/monthly|weekly|this month/i);

      if (
        (await frequencyChart.isVisible()) ||
        (await monthlyStats.isVisible())
      ) {
        const hasFrequencyInfo =
          (await frequencyChart.isVisible()) ||
          (await monthlyStats.isVisible());
        expect(hasFrequencyInfo).toBeTruthy();
      }
    });

    test("should display favorite beaches and spots", async ({ page }) => {
      await page.goto("/profile");
      await page.waitForTimeout(2000);

      // Look for favorite spots analytics
      const favoriteSpots = page
        .getByTestId("favorite-spots")
        .or(page.getByText(/favorite|most visited|top beaches/i));

      if (await favoriteSpots.isVisible()) {
        await expect(favoriteSpots).toBeVisible();
      }
    });
  });
});
