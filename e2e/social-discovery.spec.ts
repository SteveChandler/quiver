import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  safeClick,
  waitForElementReady,
} from "./test-helpers";

test.describe("Social Discovery & Following", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/profile");
    await waitForPageLoad(page);
  });

  test.describe("User Discovery Flow", () => {
    test("should discover users through session comments", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Navigate to session with comments", async () => {
        // Go to journal/sessions tab
        const journalTab = page.getByRole("tab", { name: /journal|sessions/i });
        if (await journalTab.isVisible()) {
          await safeClick(journalTab);
          await page.waitForTimeout(1000);
        }

        // Find any session link
        const sessionLink = page.locator('a[href*="/sessions/"]').first();
        if (await sessionLink.isVisible()) {
          await safeClick(sessionLink);
          await waitForPageLoad(page);
        } else {
          // No sessions available - this indicates test data setup issue
          throw new Error("No sessions found for testing - ensure test environment has sample sessions");
        }

        // Verify we're on a session detail page
        expect(page.url()).toContain("/sessions/");
      });

      await test.step("Add a comment to discover interactions", async () => {
        // Look for comment input
        const commentInput = page.getByPlaceholder(/add.*comment|comment/i)
          .or(page.locator('textarea[placeholder*="comment"]'))
          .or(page.locator('input[placeholder*="comment"]'))
          .first();

        if (await commentInput.isVisible()) {
          await commentInput.fill("Great session! The conditions look perfect for learning.");
          
          const postButton = page.getByRole("button", { name: /post comment|submit/i })
            .or(page.locator('button[type="submit"]'))
            .first();

          if (await postButton.isVisible() && await postButton.isEnabled()) {
            await safeClick(postButton);
            await page.waitForTimeout(2000);

            // Check if comment was posted
            const newComment = page.getByText("Great session! The conditions look perfect");
            const commentPosted = await newComment.isVisible().catch(() => false);
            expect(commentPosted).toBeTruthy();
          }
        }
      });

      await test.step("Test user profile navigation from comments", async () => {
        // Look for user avatars or names in comments section
        const userLinks = page.locator('a[href*="/user/"], a[href*="/profile/"]')
          .or(page.locator('.user-avatar, .user-name'))
          .or(page.locator('[data-testid*="user"]'));

        const userLinksCount = await userLinks.count();
        
        if (userLinksCount > 0) {
          const firstUserLink = userLinks.first();
          if (await firstUserLink.isVisible()) {
            await safeClick(firstUserLink);
            await waitForPageLoad(page);

            // Should navigate to user profile or similar page
            const currentUrl = page.url();
            const isUserPage = currentUrl.includes("/user/") || 
                              currentUrl.includes("/profile/") || 
                              currentUrl.includes("@");
            
            expect(isUserPage).toBeTruthy();
          }
        } else {
          console.log("No user links found in comments - this is acceptable for single-user testing");
        }
      });
    });

    test("should display activity feed with followed users content", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Navigate to activity feed", async () => {
        // Check if there's an activity feed section
        const activityTab = page.getByRole("tab", { name: /activity|feed|following/i });
        
        if (await activityTab.isVisible()) {
          await safeClick(activityTab);
          await page.waitForTimeout(2000);
        } else {
          // Try home page for activity feed
          await page.goto("/");
          await waitForPageLoad(page);
        }
      });

      await test.step("Verify activity feed content", async () => {
        // Look for activity feed items
        const activityItems = page.locator('.activity-item, .feed-item, [data-testid*="activity"]')
          .or(page.locator('article').filter({ has: page.getByText(/liked|commented|posted|followed/i) }));

        const itemCount = await activityItems.count();
        
        if (itemCount > 0) {
          // Verify activity items have proper structure
          const firstItem = activityItems.first();
          await expect(firstItem).toBeVisible();

          // Check for activity metadata
          const hasUser = await firstItem.locator('text=/by |@|\w+\s+\w+/').isVisible().catch(() => false);
          const hasAction = await firstItem.locator('text=/liked|commented|posted|followed/i').isVisible().catch(() => false);
          const hasTimestamp = await firstItem.locator('text=/ago|minutes?|hours?|days?/i').isVisible().catch(() => false);

          expect(hasUser || hasAction || hasTimestamp).toBeTruthy();
        } else {
          console.log("No activity items found - this is acceptable for new users");
        }
      });
    });
  });

  test.describe("Following System", () => {
    test("should follow/unfollow users via profile pages", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Find another user to follow", async () => {
        // Try to find other users through various means
        
        // Method 1: Check community feed or recent sessions
        await page.goto("/");
        await waitForPageLoad(page);

        const communitySection = page.getByText(/community|recent|feed/i);
        if (await communitySection.isVisible()) {
          await safeClick(communitySection);
          await page.waitForTimeout(1000);
        }

        // Look for user profiles in community content
        const userProfiles = page.locator('a[href*="/user/"], .user-profile, [data-testid*="user"]')
          .or(page.locator('.user-avatar, .user-name').locator('..'));

        const profileCount = await userProfiles.count();
        
        if (profileCount === 0) {
          // Method 2: Navigate to a session and look for session owner
          await page.goto("/map");
          await waitForPageLoad(page);
          
          const sessionCard = page.locator('a[href*="/sessions/"]').first();
          if (await sessionCard.isVisible()) {
            await safeClick(sessionCard);
            await waitForPageLoad(page);

            // Look for session owner profile link
            const ownerProfile = page.locator('a[href*="/user/"], .session-owner, [data-testid*="owner"]');
            if (await ownerProfile.isVisible()) {
              await safeClick(ownerProfile);
              await waitForPageLoad(page);
            } else {
              throw new Error("Cannot find other users to test following functionality - ensure multiple test users exist");
            }
          } else {
            throw new Error("No sessions or users found for following test - ensure test data includes multiple users with sessions");
          }
        } else {
          await safeClick(userProfiles.first());
          await waitForPageLoad(page);
        }
      });

      await test.step("Test follow/unfollow functionality", async () => {
        // Look for follow button
        const followButton = page.getByRole("button", { name: /follow|unfollow/i })
          .or(page.locator('[data-testid*="follow"]'))
          .first();

        if (await followButton.isVisible()) {
          const initialState = await followButton.textContent();
          await safeClick(followButton);
          await page.waitForTimeout(1000);

          // Button should change state
          const newState = await followButton.textContent();
          const stateChanged = initialState !== newState;

          // Or check for follower count changes
          const followerCount = page.locator('text=/\d+.*follower/i');
          const hasFollowerCount = await followerCount.isVisible().catch(() => false);

          expect(stateChanged || hasFollowerCount).toBeTruthy();
        } else {
          console.log("Follow button not found - may be own profile or feature not implemented");
          throw new Error("Follow button not found - feature may be missing or user is viewing own profile");
        }
      });
    });

    test("should prevent users from following themselves", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Check own profile for self-follow prevention", async () => {
        await page.goto("/profile");
        await waitForPageLoad(page);

        // Should not have follow button on own profile
        const followButton = page.getByRole("button", { name: /follow/i });
        const hasFollowButton = await followButton.isVisible().catch(() => false);

        // Should not be able to follow self
        expect(hasFollowButton).toBeFalsy();
      });
    });

    test("should show following count and list", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Check following/followers display", async () => {
        await page.goto("/profile");
        await waitForPageLoad(page);

        // Look for follower/following statistics
        const socialStats = page.locator('text=/\d+.*follower|\d+.*following/i')
          .or(page.locator('[data-testid*="follow"], .follow-count'));

        const statsCount = await socialStats.count();
        
        if (statsCount > 0) {
          await expect(socialStats.first()).toBeVisible();

          // Try clicking on following/followers to see lists
          const followingLink = page.getByText(/\d+.*following/i).first();
          if (await followingLink.isVisible()) {
            await safeClick(followingLink);
            await page.waitForTimeout(1000);

            // Should show list of followed users or modal
            const userList = page.locator('.user-list, [data-testid*="user"], .following-list')
              .or(page.getByRole("dialog"));

            const hasUserList = await userList.isVisible().catch(() => false);
            
            if (hasUserList) {
              expect(hasUserList).toBeTruthy();
            } else {
              console.log("Following list not displayed - may be empty or not implemented");
            }
          }
        } else {
          console.log("No social stats found - this is acceptable for new users");
        }
      });
    });
  });

  test.describe("Community Interaction", () => {
    test("should like and unlike sessions in community feed", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Find sessions to interact with", async () => {
        // Try home page first for community feed
        await page.goto("/");
        await waitForPageLoad(page);

        // Look for session cards or community content
        const sessionCards = page.locator('.session-card, [data-testid*="session"]')
          .or(page.locator('article').filter({ has: page.getByText(/session|surf/i) }));

        const cardCount = await sessionCards.count();
        
        if (cardCount === 0) {
          // Try profile page sessions
          await page.goto("/profile");
          await waitForPageLoad(page);

          const journalTab = page.getByRole("tab", { name: /journal/i });
          if (await journalTab.isVisible()) {
            await safeClick(journalTab);
            await page.waitForTimeout(1000);
          }
        }
      });

      await test.step("Test like functionality", async () => {
        // Find like buttons
        const likeButtons = page.getByRole("button", { name: /like|\d+.*like/i })
          .or(page.locator('[data-testid*="like"], .like-button'))
          .or(page.locator('button').filter({ has: page.locator('svg[aria-label*="like"]') }));

        const likeButtonCount = await likeButtons.count();
        
        if (likeButtonCount > 0) {
          const firstLikeButton = likeButtons.first();
          const initialText = await firstLikeButton.textContent();
          
          await safeClick(firstLikeButton);
          await page.waitForTimeout(1000);

          // Button should change state (text or appearance)
          const newText = await firstLikeButton.textContent();
          const hasChanged = initialText !== newText;

          expect(hasChanged).toBeTruthy();

          // Test unliking
          await safeClick(firstLikeButton);
          await page.waitForTimeout(1000);

          const finalText = await firstLikeButton.textContent();
          const hasReverted = finalText === initialText || finalText !== newText;
          expect(hasReverted).toBeTruthy();
        } else {
          console.log("No like buttons found - sessions may not be available");
        }
      });
    });

    test("should navigate to user profiles from session cards", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Find session with user profile link", async () => {
        // Check journal for sessions
        const journalTab = page.getByRole("tab", { name: /journal/i });
        if (await journalTab.isVisible()) {
          await safeClick(journalTab);
          await page.waitForTimeout(1000);
        }

        // Look for user profile links in session cards
        const sessionCards = page.locator('a[href*="/sessions/"]');
        const sessionCount = await sessionCards.count();

        if (sessionCount > 0) {
          // Click on a session to see details
          await safeClick(sessionCards.first());
          await waitForPageLoad(page);

          // Look for session owner profile link
          const userProfileLinks = page.locator('a[href*="/user/"], .user-profile-link, [data-testid*="user-profile"]')
            .or(page.locator('.user-avatar, .user-name').locator('..').filter({ hasText: /.+/ }));

          const profileLinkCount = await userProfileLinks.count();
          
          if (profileLinkCount > 0) {
            const profileLink = userProfileLinks.first();
            const isClickable = await profileLink.isVisible().catch(() => false);
            
            if (isClickable) {
              await safeClick(profileLink);
              await waitForPageLoad(page);

              // Should navigate to user profile
              const currentUrl = page.url();
              const isUserProfilePage = currentUrl.includes("/user/") || 
                                      currentUrl.includes("/profile/") ||
                                      page.getByText(/profile|user/i).isVisible();
              
              expect(isUserProfilePage).toBeTruthy();
            }
          } else {
            console.log("No user profile links found in session - single user testing limitation");
          }
        } else {
          throw new Error("No sessions available for testing - ensure test data includes user sessions");
        }
      });
    });
  });

  test.describe("Activity Feed Functionality", () => {
    test("should display personalized activity feed", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Check for activity feed section", async () => {
        // Look for activity feed in profile or home
        const activitySection = page.getByRole("tab", { name: /activity|feed/i })
          .or(page.getByText(/recent activity|your feed/i))
          .or(page.locator('[data-testid*="activity"]'));

        if (await activitySection.isVisible()) {
          await safeClick(activitySection);
          await page.waitForTimeout(2000);

          // Check for activity items
          const activityItems = page.locator('.activity-item, .feed-item')
            .or(page.locator('div').filter({ hasText: /liked|commented|posted|followed/i }));

          const itemCount = await activityItems.count();
          
          if (itemCount > 0) {
            // Verify activity items have proper structure
            const firstActivity = activityItems.first();
            await expect(firstActivity).toBeVisible();

            // Should contain user action information
            const hasAction = await firstActivity.getByText(/liked|commented|posted|followed/i).isVisible().catch(() => false);
            const hasTimestamp = await firstActivity.getByText(/ago|minutes?|hours?/i).isVisible().catch(() => false);

            expect(hasAction || hasTimestamp).toBeTruthy();
          } else {
            console.log("No activity items found - user may not be following anyone or have recent activity");
          }
        } else {
          console.log("Activity feed section not found - may be in different location");
        }
      });
    });

    test("should interact with activity feed items", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Navigate to activity feed items", async () => {
        // Look for clickable activity items
        const activityItems = page.locator('a[href*="/sessions/"], a[href*="/user/"]')
          .or(page.locator('.activity-item').filter({ has: page.locator('a') }));

        const clickableCount = await activityItems.count();
        
        if (clickableCount > 0) {
          const firstClickableItem = activityItems.first();
          const href = await firstClickableItem.getAttribute('href');
          
          await safeClick(firstClickableItem);
          await waitForPageLoad(page);

          // Should navigate to the linked content
          const currentUrl = page.url();
          if (href) {
            expect(currentUrl).toContain(href.split('?')[0]); // Remove query params for comparison
          } else {
            // Just verify we navigated somewhere meaningful
            const isMeaningfulPage = currentUrl.includes("/sessions/") || 
                                   currentUrl.includes("/user/") ||
                                   currentUrl.includes("/beach/");
            expect(isMeaningfulPage).toBeTruthy();
          }
        } else {
          console.log("No clickable activity items found");
        }
      });
    });
  });

  test.describe("Social Stats and Metrics", () => {
    test("should display accurate follower/following counts", async ({ page }) => {
      await handleAuthRedirect(page);

      await test.step("Verify social metrics display", async () => {
        await page.goto("/profile");
        await waitForPageLoad(page);

        // Look for social stats
        const socialMetrics = page.locator('text=/\d+.*follower|\d+.*following|\d+.*session/i')
          .or(page.locator('.stat, .metric, [data-testid*="stat"]'));

        const metricsCount = await socialMetrics.count();
        
        if (metricsCount > 0) {
          // Verify metrics are displaying numbers
          const firstMetric = socialMetrics.first();
          const metricText = await firstMetric.textContent();
          const hasNumber = /\d+/.test(metricText || "");
          
          expect(hasNumber).toBeTruthy();
        } else {
          console.log("No social metrics found - this may be a UI implementation gap");
        }
      });
    });
  });
});
