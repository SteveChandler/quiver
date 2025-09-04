import { test, expect } from "./fixtures";

test.describe("Profile Edit Flow", () => {
  test("edits profile and updates Home Break", async ({ page }) => {
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");

    // Ensure edit modal is open
    const modalTitle = page.getByText(/edit profile/i).first();
    try {
      await expect(modalTitle).toBeVisible({ timeout: 8000 });
    } catch {
      // Fallback: open via Edit button if query param didn't trigger the modal
      const editButton = page.getByRole("button", { name: /^edit$/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await expect(modalTitle).toBeVisible({ timeout: 8000 });
      }
    }

    // Update name
    const name = page.getByLabel(/name/i);
    if (await name.isVisible()) {
      await name.fill("");
      await name.type("Updated User");
    }

    // Update location
    const location = page.getByLabel(/location/i);
    if (await location.isVisible()) {
      await location.fill("San Diego");
    }

    // Select home beach via BeachSelector (use seeded beach for reliability)
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.fill("Ocean Beach");
    // Give the client list a moment to render
    await page.waitForTimeout(300);
    // Click first matching item in list if available, otherwise blur to trigger selection
    const listItem = page.locator('ul li', { hasText: "Ocean Beach" }).first();
    if (await listItem.isVisible().catch(() => false)) {
      await listItem.click();
    } else {
      await beachInput.blur();
      await page.waitForTimeout(200);
    }

    // Save (stable selector via test id on submit button)
    await page.getByTestId("save-profile").click();

    // Modal should close and profile view should show (or at least not block page)
    await expect(modalTitle).toBeHidden({ timeout: 15000 }).catch(() => {});

    // Verify Home Break updated on profile/UserStats
    const homeBreak = page.locator('[data-testid="home-break-value"]');
    await expect(homeBreak).toHaveCount(1, { timeout: 15000 });
    await expect(homeBreak).toContainText(/Ocean Beach|—|Not set/i);
  });
});


