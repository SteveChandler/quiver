import { test, expect } from "@playwright/test";

test.describe("State root pages (DB-gated)", () => {
  test("should load a supported state root page", async ({ page }) => {
    const response = await page.goto("/ca");
    expect(response?.status()).toBe(200);

    await expect(
      page.getByRole("heading", {
        name: /best surf beaches in ca/i,
      })
    ).toBeVisible();
  });

  test("should canonicalize uppercase state to lowercase", async ({ page }) => {
    await page.goto("/CA");
    await expect(page).toHaveURL(/\/ca$/);
  });

  test("should return 404 for unsupported state", async ({ page }) => {
    const response = await page.goto("/zz");
    expect(response?.status()).toBe(404);
  });

  test("should not collide with reserved one-segment routes", async ({
    page,
  }) => {
    const response = await page.goto("/map");
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(/\/map\/?$/);
  });
});












