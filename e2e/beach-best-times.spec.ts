import { test, expect } from "@playwright/test";

// Give these tests more time on slower dev servers
test.setTimeout(60000);

// Assumes there is at least one beach detail page reachable at /beach/:id
// Uses flexible assertions to avoid flakiness.

test("Beach page shows Best Times and renders chips", async ({ page }) => {
  await page.goto("/beach/c97ef837-7fb5-4881-8dfb-7d750a9f97a5");
  await page.waitForLoadState("load");

  // Best Times section visible (allow extra time)
  const section = page.getByRole("heading", { name: /Best Times/i });
  await expect(section).toBeVisible({ timeout: 20000 });

  // Chips appear eventually (allow extra time)
  const chips = page.locator(".rounded-full.border.text-sm");
  await expect(chips.first()).toBeVisible({ timeout: 20000 });
});

test("Navigating away and back keeps Best Times functional", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("load");

  await page.goto("/beach/c97ef837-7fb5-4881-8dfb-7d750a9f97a5");
  await page.waitForLoadState("load");

  const section = page.getByRole("heading", { name: /Best Times/i });
  await expect(section).toBeVisible({ timeout: 20000 });

  const chips = page.locator(".rounded-full.border.text-sm");
  await expect(chips.first()).toBeVisible({ timeout: 20000 });
});
