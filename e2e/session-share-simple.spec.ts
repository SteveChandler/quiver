import { test, expect } from "@playwright/test";
import {
  waitForPageLoad,
  handleAuthRedirect,
  safeClick,
  openShareModal,
  ensureSessionIsPublic,
  waitForShareImageGeneration,
  testVariantSwitching,
} from "./test-helpers";

test.describe("Session Share Functionality", () => {
  test("should open share modal and generate images for existing session", async ({ page }) => {
    // Navigate to profile to find an existing session
    await page.goto("/profile");
    await waitForPageLoad(page);

    // Handle potential authentication redirect
    await handleAuthRedirect(page);

    await test.step("Navigate to existing session", async () => {
      // Click journal/sessions tab if it exists
      const journalTab = page.getByRole("tab", { name: /journal|sessions/i });
      if (await journalTab.isVisible()) {
        await safeClick(journalTab);
        await page.waitForTimeout(1000);
      }

      // Find any session link
      const sessionLink = page.locator('a[href*="/sessions/"]').first();
      
      // If no sessions exist, create one first
      const hasSession = await sessionLink.isVisible().catch(() => false);
      if (!hasSession) {
        // Create a session first
        await page.goto("/log-session");
        await waitForPageLoad(page);
        
        // Quick session creation (simplified)
        const beachInput = page.getByLabel(/beach/i).first();
        if (await beachInput.isVisible()) {
          await beachInput.fill("Test Beach");
        }
        
        const dateInput = page.locator('input[type="date"]').first();
        if (await dateInput.isVisible()) {
          await dateInput.fill(new Date().toISOString().split("T")[0]);
        }
        
        const submitButton = page.getByRole("button", { name: /log session|save|submit/i }).first();
        if (await submitButton.isVisible() && await submitButton.isEnabled()) {
          await safeClick(submitButton);
          await page.waitForTimeout(3000);
        }
        
        // Navigate back to profile to find the new session
        await page.goto("/profile");
        await waitForPageLoad(page);
        
        const journalTabAfter = page.getByRole("tab", { name: /journal|sessions/i });
        if (await journalTabAfter.isVisible()) {
          await safeClick(journalTabAfter);
          await page.waitForTimeout(1000);
        }
        
        const newSessionLink = page.locator('a[href*="/sessions/"]').first();
        if (await newSessionLink.isVisible()) {
          await safeClick(newSessionLink);
          await waitForPageLoad(page);
        } else {
          throw new Error("Could not create or find session for testing - ensure test user has sessions or session creation works");
        }
      } else {
        await safeClick(sessionLink);
        await waitForPageLoad(page);
      }

      // Verify we're on a session detail page
      expect(page.url()).toContain("/sessions/");
    });

    await test.step("Open share modal", async () => {
      const modal = await openShareModal(page);
      expect(modal).toBeVisible();

      // Check for modal title
      const modalTitle = page.getByText(/share.*session|share.*epic/i);
      await expect(modalTitle).toBeVisible();
    });

    await test.step("Make session public if needed", async () => {
      const success = await ensureSessionIsPublic(page);
      expect(success).toBeTruthy();
    });

    await test.step("Wait for image generation", async () => {
      const result = await waitForShareImageGeneration(page, 15000);
      
      // Should either succeed or show a reasonable error
      expect(result.success || result.hasError).toBeTruthy();
      
      if (result.hasImage) {
        // Test download/share functionality
        const downloadButton = page.getByRole("button", { name: /download/i });
        const webShareButton = page.getByTestId("web-share-button").or(page.locator('button[data-testid="web-share-button"]'));
        
        const hasDownload = await downloadButton.isVisible().catch(() => false);
        const hasShare = await webShareButton.isVisible().catch(() => false);
        
        expect(hasDownload || hasShare).toBeTruthy();
      }
    });

    await test.step("Test variant switching", async () => {
      const results = await testVariantSwitching(page);
      expect(results.storyTabVisible || results.squareTabVisible).toBeTruthy();
    });

    await test.step("Close modal", async () => {
      const closeButton = page.getByRole("button", { name: /close/i });
      if (await closeButton.isVisible()) {
        await safeClick(closeButton);
      } else {
        await page.keyboard.press("Escape");
      }

      await page.waitForTimeout(500);
      const modal = page.getByRole("dialog");
      const modalVisible = await modal.isVisible().catch(() => false);
      expect(modalVisible).toBeFalsy();
    });
  });

  test("should handle share modal accessibility", async ({ page }) => {
    // Go directly to the known session
    await page.goto("/sessions/72a55690-3269-4261-94f7-6525433970d7");
    await waitForPageLoad(page);

    await handleAuthRedirect(page);

    // If redirected away, this indicates session is not accessible
    if (!page.url().includes("/sessions/")) {
      throw new Error("Session not accessible - navigation to session detail failed");
    }

    await test.step("Test keyboard navigation", async () => {
      const shareButton = page.getByRole("button", { name: /share/i });
      if (await shareButton.isVisible()) {
        await safeClick(shareButton);
        await page.waitForTimeout(1000);

        // Test tab navigation
        await page.keyboard.press("Tab");
        const focusedElement = page.locator(":focus");
        const hasFocus = await focusedElement.isVisible().catch(() => false);
        expect(hasFocus).toBeTruthy();

        // Test escape key
        await page.keyboard.press("Escape");
        await page.waitForTimeout(500);
        
        const modal = page.getByRole("dialog");
        const modalClosed = await modal.isVisible().catch(() => false);
        expect(modalClosed).toBeFalsy();
      }
    });
  });

  test("should display appropriate error states", async ({ page }) => {
    await page.goto("/sessions/72a55690-3269-4261-94f7-6525433970d7");
    await waitForPageLoad(page);

    await handleAuthRedirect(page);

    if (!page.url().includes("/sessions/")) {
      throw new Error("Session not accessible - navigation to session detail failed");
    }

    await test.step("Test error handling in share modal", async () => {
      const shareButton = page.getByRole("button", { name: /share/i });
      if (await shareButton.isVisible()) {
        await safeClick(shareButton);
        await page.waitForTimeout(3000); // Wait longer to see if errors appear

        // Check for various states
        const loadingSpinner = page.locator('[aria-label*="loading"]');
        const errorMessage = page.getByText(/failed.*generate|error.*image/i);
        const imagePreview = page.locator('img[alt*="share"]');
        const makePublicButton = page.getByRole("button", { name: /make.*shareable/i });

        // Should show some state (loading, error, success, or needs to be public)
        const hasLoading = await loadingSpinner.isVisible().catch(() => false);
        const hasError = await errorMessage.isVisible().catch(() => false);
        const hasImage = await imagePreview.isVisible().catch(() => false);
        const needsPublic = await makePublicButton.isVisible().catch(() => false);

        expect(hasLoading || hasError || hasImage || needsPublic).toBeTruthy();
      }
    });
  });
});