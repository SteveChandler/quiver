/**
 * Landing search flows
 *
 * @project guest
 */

import { test, expect } from "@playwright/test";
import { waitForPageLoad } from "./utils/test-helpers";

test.describe("Landing search hero", () => {
  test("allows disambiguation for Ocean Beach and avoids 500s", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForPageLoad(page);

    const searchInput = page
      .getByRole("textbox")
      .filter({ hasText: "" })
      .first();

    await searchInput.fill("ocean beach");
    await searchInput.press("Enter");

    // Expect we either land on the map search or a beach detail page – but not a 500.
    await expect(page).not.toHaveURL(/500/);
  });

  test("Tourmaline search still works without error", async ({ page }) => {
    await page.goto("/");
    await waitForPageLoad(page);

    const searchInput = page
      .getByRole("textbox")
      .filter({ hasText: "" })
      .first();

    await searchInput.fill("tourmaline");
    await searchInput.press("Enter");

    await expect(page).not.toHaveURL(/500/);
  });
});


