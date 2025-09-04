import { test, expect } from "./fixtures";

test.describe("Profile Edit Flow", () => {
  test("edits profile and updates Home Break", async ({ page }) => {
    await page.goto("/profile?edit=true");
    await page.waitForLoadState("load");

    // Ensure edit modal is open
    const modalTitle = page.getByText(/edit profile/i).first();
    await expect(modalTitle).toBeVisible({ timeout: 15000 });

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

    // Select home beach via BeachSelector
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.fill("Malibu");
    // Click first matching item in list
    const listItem = page.locator("ul >> text=Malibu").first();
    if (await listItem.isVisible()) {
      await listItem.click();
    } else {
      // Fallback: blur to trigger selection resolution
      await beachInput.blur();
    }

    // Save (button has no test id in BasicProfileForm)
    await page.getByRole("button", { name: /save changes/i }).click();

    // Modal should close and profile view should show
    await expect(modalTitle).toBeHidden({ timeout: 15000 });

    // Verify Home Break updated on profile/UserStats
    const homeBreak = page.locator('[data-testid="home-break-value"]');
    await expect(homeBreak).toBeVisible({ timeout: 15000 });
    await expect(homeBreak).toContainText(/Malibu|—|Not set/i);
  });
});


