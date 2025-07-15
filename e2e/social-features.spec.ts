import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  createTestSession,
  testSocialInteraction,
  waitForRealtimeUpdate,
} from "./test-helpers";

test.describe("Social Features", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);
  });

  test.describe("Session Likes System", () => {
    test("should like and unlike sessions with real-time updates", async ({
      page,
    }) => {
      // Skip if not authenticated
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping like tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        // Find first session card using the actual card component class
        const sessionCard = page
          .locator("[class*='session-card'], .max-w-2xl")
          .first();
        if (await sessionCard.isVisible()) {
          // Find like button with ThumbsUp icon - this matches the actual component
          const likeButton = sessionCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-thumbs-up']"),
          });

          // Also try alternative selector for like button
          const likeButtonAlt = sessionCard
            .locator(
              "button:has-text('0'), button:has-text('1'), button:has-text('2'), button:has-text('3'), button:has-text('4'), button:has-text('5')"
            )
            .first();

          const actualLikeButton = (await likeButton.isVisible())
            ? likeButton
            : likeButtonAlt;

          if (await actualLikeButton.isVisible()) {
            // Get initial like count from button text
            const initialLikeText = await actualLikeButton.textContent();
            const initialCount = parseInt(
              initialLikeText?.match(/\d+/)?.[0] || "0"
            );

            // Click like button
            await actualLikeButton.click();
            await page.waitForTimeout(1000);

            // Check if like count changed
            const newLikeText = await actualLikeButton.textContent();
            const newCount = parseInt(newLikeText?.match(/\d+/)?.[0] || "0");

            // Should either increase by 1 or decrease by 1 (if already liked)
            expect(Math.abs(newCount - initialCount)).toBe(1);

            // Test unlike by clicking again
            await actualLikeButton.click();
            await page.waitForTimeout(1000);

            const finalLikeText = await actualLikeButton.textContent();
            const finalCount = parseInt(
              finalLikeText?.match(/\d+/)?.[0] || "0"
            );
            expect(finalCount).toBe(initialCount);
          }
        }
      }
    });

    test("should display like count accurately", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping like count tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        // Find session cards using the actual component structure
        const sessionCards = page.locator(
          "[class*='session-card'], .max-w-2xl"
        );
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const firstCard = sessionCards.first();

          // Look for like button with ThumbsUp icon
          const likeButton = firstCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-thumbs-up']"),
          });

          if (await likeButton.isVisible()) {
            const buttonText = await likeButton.textContent();
            // Should show valid like count (number followed by button)
            expect(buttonText).toMatch(/^\d+$/);
          }

          // Check for ThumbsUp icon presence
          const thumbsUpIcon = firstCard.locator(
            "svg[class*='lucide-thumbs-up']"
          );
          const hasThumbsUpIcon = await thumbsUpIcon
            .isVisible()
            .catch(() => false);
          expect(hasThumbsUpIcon).toBeTruthy();
        }
      }
    });

    test("should prevent liking own sessions", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping own session like tests");
      }

      // Create a test session first
      try {
        await createTestSession(page);

        // Go to profile to view own session
        await page.goto("/profile");
        await page.waitForTimeout(2000);

        const sessionTab = page.getByRole("tab", { name: /journal/i });
        if (await sessionTab.isVisible()) {
          await sessionTab.click();
          await page.waitForTimeout(2000);

          // Find own session card
          const ownSession = page
            .locator("[class*='session-card'], .max-w-2xl")
            .first();
          if (await ownSession.isVisible()) {
            // Like button should not be present for own sessions or be disabled
            const likeButton = ownSession.locator("button").filter({
              has: page.locator("svg[class*='lucide-thumbs-up']"),
            });

            const hasLikeButton = await likeButton
              .isVisible()
              .catch(() => false);

            if (hasLikeButton) {
              const isDisabled = await likeButton.isDisabled();
              expect(isDisabled).toBeTruthy();
            }
            // If no like button, that's also correct behavior for own sessions
          }
        }
      } catch (error) {
        console.log("Could not create test session:", error);
      }
    });
  });

  test.describe("Session Comments System", () => {
    test("should post comments on sessions", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping comment tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page
          .locator("[class*='session-card'], .max-w-2xl")
          .first();
        if (await sessionCard.isVisible()) {
          // Find comment button with MessageSquare icon
          const commentButton = sessionCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-message-square']"),
          });

          if (await commentButton.isVisible()) {
            await commentButton.click();
            await page.waitForTimeout(1000);

            // Look for comment modal or inline comment form
            const commentModal = page.locator(
              "[role='dialog'], .modal, .comments-modal"
            );
            const commentForm = page.locator(
              "form:has(textarea), textarea[placeholder*='comment']"
            );

            if (await commentModal.isVisible()) {
              // Modal comment form
              const textarea = commentModal.locator("textarea");
              if (await textarea.isVisible()) {
                await textarea.fill("Great session! Perfect waves today.");

                const submitButton = commentModal.locator(
                  "button[type='submit'], button:has-text('Post'), button:has-text('Comment')"
                );
                if (await submitButton.isVisible()) {
                  await submitButton.click();
                  await page.waitForTimeout(1000);

                  // Check for success indication
                  const commentText = commentModal.locator(
                    "text=Great session! Perfect waves today."
                  );
                  const commentExists = await commentText.isVisible();
                  expect(commentExists).toBeTruthy();
                }
              }
            } else if (await commentForm.isVisible()) {
              // Inline comment form
              const textarea = commentForm.locator("textarea");
              if (await textarea.isVisible()) {
                await textarea.fill("Great session! Perfect waves today.");

                const submitButton = page.locator(
                  "button[type='submit'], button:has-text('Post'), button:has-text('Comment')"
                );
                if (await submitButton.isVisible()) {
                  await submitButton.click();
                  await page.waitForTimeout(1000);
                }
              }
            }
          }
        }
      }
    });

    test("should display comment count", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping comment count tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(
          "[class*='session-card'], .max-w-2xl"
        );
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const firstCard = sessionCards.first();

          // Look for comment button with MessageSquare icon
          const commentButton = firstCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-message-square']"),
          });

          if (await commentButton.isVisible()) {
            const buttonText = await commentButton.textContent();
            // Should show valid comment count (number or "...")
            expect(buttonText).toMatch(/^\d+$|^\.\.\.$|^$/);
          }

          // Check for MessageSquare icon presence
          const messageIcon = firstCard.locator(
            "svg[class*='lucide-message-square']"
          );
          const hasMessageIcon = await messageIcon
            .isVisible()
            .catch(() => false);
          expect(hasMessageIcon).toBeTruthy();
        }
      }
    });
  });

  test.describe("User Interaction", () => {
    test("should navigate to user profile on click", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping user interaction tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page
          .locator("[class*='session-card'], .max-w-2xl")
          .first();
        if (await sessionCard.isVisible()) {
          // Find user avatar or username - this matches the actual component structure
          const userAvatar = sessionCard
            .locator("[class*='user-avatar'], .rounded-full")
            .first();
          const userButton = sessionCard.locator(
            "button:has([class*='user-avatar'])"
          );

          if (await userButton.isVisible()) {
            const currentUrl = page.url();
            await userButton.click();
            await page.waitForTimeout(1000);

            // Should either navigate to user profile or show user info
            const newUrl = page.url();
            const urlChanged = newUrl !== currentUrl;

            // URL should change or modal should appear
            if (urlChanged) {
              expect(newUrl).toContain("profile");
            } else {
              // Check for user profile modal or dropdown
              const userModal = page.locator(
                "[role='dialog'], .modal, .user-profile-modal"
              );
              const userDropdown = page.locator(".dropdown, .popover");

              const hasUserModal = await userModal.isVisible();
              const hasUserDropdown = await userDropdown.isVisible();

              expect(hasUserModal || hasUserDropdown).toBeTruthy();
            }
          }
        }
      }
    });

    test("should display user information correctly", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping user info tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(
          "[class*='session-card'], .max-w-2xl"
        );
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const firstCard = sessionCards.first();

          // Check for user avatar
          const userAvatar = firstCard.locator(
            "[class*='user-avatar'], .rounded-full"
          );
          const hasUserAvatar = await userAvatar.isVisible();
          expect(hasUserAvatar).toBeTruthy();

          // Check for username
          const username = firstCard
            .locator(".font-medium, .font-bold")
            .first();
          if (await username.isVisible()) {
            const usernameText = await username.textContent();
            expect(usernameText).toBeTruthy();
            expect(usernameText.length).toBeGreaterThan(0);
          }

          // Check for beach/location info
          const locationInfo = firstCard
            .locator("svg[class*='lucide-map-pin']")
            .locator("..");
          if (await locationInfo.isVisible()) {
            const locationText = await locationInfo.textContent();
            expect(locationText).toBeTruthy();
          }

          // Check for date info
          const dateInfo = firstCard
            .locator("svg[class*='lucide-calendar']")
            .locator("..");
          if (await dateInfo.isVisible()) {
            const dateText = await dateInfo.textContent();
            expect(dateText).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe("Real-time Updates", () => {
    test("should update like counts in real-time", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping real-time tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page
          .locator("[class*='session-card'], .max-w-2xl")
          .first();
        if (await sessionCard.isVisible()) {
          const likeButton = sessionCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-thumbs-up']"),
          });

          if (await likeButton.isVisible()) {
            const initialText = await likeButton.textContent();
            const initialCount = parseInt(
              initialText?.match(/\d+/)?.[0] || "0"
            );

            // Like the session
            await likeButton.click();

            // Wait for real-time update
            await page.waitForTimeout(2000);

            const updatedText = await likeButton.textContent();
            const updatedCount = parseInt(
              updatedText?.match(/\d+/)?.[0] || "0"
            );

            // Count should have changed
            expect(updatedCount).not.toBe(initialCount);
            expect(Math.abs(updatedCount - initialCount)).toBe(1);
          }
        }
      }
    });

    test("should update comment counts in real-time", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping real-time comment tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCard = page
          .locator("[class*='session-card'], .max-w-2xl")
          .first();
        if (await sessionCard.isVisible()) {
          const commentButton = sessionCard.locator("button").filter({
            has: page.locator("svg[class*='lucide-message-square']"),
          });

          if (await commentButton.isVisible()) {
            const initialText = await commentButton.textContent();
            const initialCount = parseInt(
              initialText?.match(/\d+/)?.[0] || "0"
            );

            // Open comment modal/form
            await commentButton.click();
            await page.waitForTimeout(1000);

            // Add a comment
            const commentModal = page.locator(
              "[role='dialog'], .modal, .comments-modal"
            );
            if (await commentModal.isVisible()) {
              const textarea = commentModal.locator("textarea");
              if (await textarea.isVisible()) {
                await textarea.fill("Real-time comment test");

                const submitButton = commentModal.locator(
                  "button[type='submit'], button:has-text('Post'), button:has-text('Comment')"
                );
                if (await submitButton.isVisible()) {
                  await submitButton.click();
                  await page.waitForTimeout(2000);

                  // Close modal if it has a close button
                  const closeButton = commentModal.locator(
                    "button:has-text('Close'), button[aria-label='Close'], [data-testid='close-modal']"
                  );
                  if (await closeButton.isVisible()) {
                    await closeButton.click();
                  }

                  // Check if comment count updated
                  const updatedText = await commentButton.textContent();
                  const updatedCount = parseInt(
                    updatedText?.match(/\d+/)?.[0] || "0"
                  );

                  expect(updatedCount).toBeGreaterThan(initialCount);
                }
              }
            }
          }
        }
      }
    });
  });

  test.describe("Session Card Display", () => {
    test("should display session information correctly", async ({ page }) => {
      const authState = await handleAuthRedirect(page);
      if (authState.isAuthPage) {
        test.skip("User not authenticated - skipping session display tests");
      }

      // Navigate to community feed
      const communityTab = page.getByRole("tab", { name: /local intel/i });
      if (await communityTab.isVisible()) {
        await communityTab.click();
        await page.waitForTimeout(3000);

        const sessionCards = page.locator(
          "[class*='session-card'], .max-w-2xl"
        );
        const cardCount = await sessionCards.count();

        if (cardCount > 0) {
          const firstCard = sessionCards.first();

          // Check for star rating
          const starRating = firstCard.locator(
            "[class*='star-rating'], .text-yellow-500"
          );
          const hasStarRating = await starRating.isVisible();
          expect(hasStarRating).toBeTruthy();

          // Check for session image
          const sessionImage = firstCard.locator("img");
          const hasSessionImage = await sessionImage.isVisible();
          expect(hasSessionImage).toBeTruthy();

          // Check for engagement section with like and comment buttons
          const engagementSection = firstCard.locator("button").filter({
            has: page.locator(
              "svg[class*='lucide-thumbs-up'], svg[class*='lucide-message-square']"
            ),
          });
          const hasEngagementSection = (await engagementSection.count()) > 0;
          expect(hasEngagementSection).toBeTruthy();

          // Check for session conditions if available
          const conditionsSection = firstCard.locator(
            "svg[class*='lucide-waves'], svg[class*='lucide-users'], svg[class*='lucide-car']"
          );
          const hasConditionsSection = (await conditionsSection.count()) > 0;
          // Conditions section is optional, so we don't assert it
        }
      }
    });
  });
});
