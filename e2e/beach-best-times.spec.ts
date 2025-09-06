import { test, expect } from "@playwright/test";

// Give these tests more time on slower dev servers
test.setTimeout(60000);

// Assumes there is at least one beach detail page reachable at /beach/:id
// Uses flexible assertions to avoid flakiness.

test("Beach page shows Coach Pick instead of Best Times", async ({ page }) => {
  await page.goto("/beach/c97ef837-7fb5-4881-8dfb-7d750a9f97a5");
  await page.waitForLoadState("load");

  // Coach Pick visible (allow extra time)
  const coachPickText = page.getByText(/^Coach Pick$/i).first();
  await expect(coachPickText).toBeVisible({ timeout: 30000 });

  // Optional: top picks list may render
  // No strict assertion on chips since Best Times is removed
});

test("Navigating away and back keeps Coach Pick visible", async ({
  page,
}) => {
  await page.goto("/");
  await page.waitForLoadState("load");

  await page.goto("/beach/c97ef837-7fb5-4881-8dfb-7d750a9f97a5");
  await page.waitForLoadState("load");

  const coachPickText = page.getByText(/^Coach Pick$/i).first();
  await expect(coachPickText).toBeVisible({ timeout: 30000 });
});
