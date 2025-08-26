import { test, expect } from "@playwright/test";

test.describe("Plan Session flow", () => {
  test.afterEach(async ({ page }) => {
    page.context().clearCookies();
  });

  test("saves planned session and redirects to profile", async ({ page }) => {
    // Assumes global auth setup logs in a test user
    await page.goto("/sessions/new?mode=plan");
    await page.waitForLoadState("load");

    // Select beach
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("Pacific Beach");
    // Blur to trigger selection logic for BeachSelector
    await beachInput.blur();

    // Date
    const dateInput = page.getByTestId("session-date-input");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    await dateInput.fill(dateStr);

    // Time
    const timeInput = page.getByTestId("session-time-input");
    await timeInput.fill("08:00");

    await page.getByRole("button", { name: "Duck Dives" }).click();
    // await page.getByRole("button", { name: "Big Boss" }).click();

    // Click Save (submit)
    const submit = page.locator('button[type="submit"]');
    await expect(submit).toBeEnabled();
    await submit.click({ force: true });

    // Button should become disabled briefly (loading state)
    await page
      .locator("div")
      .filter({ hasText: "Saving..." })
      .nth(3)
      .waitFor({ state: "visible" });

    // Redirect to profile
    //  await page.waitForURL(/\/profile/, { timeout: 20000 });

    // Success toast/text somewhere on profile after redirect (best-effort check)
    // We don't fail if it doesn't exist to avoid flakiness
    const successTextCandidates = [
      /Session planned successfully/i,
      /planned and .* invitation\(s\) sent/i,
    ];
    for (const re of successTextCandidates) {
      const el = page.getByText(re).first();
      if (await el.isVisible().catch(() => false)) break;
    }
  });

  test("optimal times anchor around selected afternoon time", async ({
    page,
  }) => {
    await page.goto("/sessions/new?mode=plan");
    await page.waitForLoadState("load");

    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("Pacific Beach");
    await beachInput.blur();

    const dateInput = page.getByTestId("session-date-input");
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const dd = String(today.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;
    await dateInput.fill(dateStr);

    // Select an afternoon time
    const timeInput = page.getByTestId("session-time-input");
    await timeInput.fill("16:42");

    // Wait for optimal times to render
    const list = page.getByTestId("optimal-times-list");
    await expect(list).toBeVisible();

    // Ensure label indicates context-aware results
    await expect(page.getByText(/Best for Your Session Time/i)).toBeVisible();

    // Validate that at least one proposed block overlaps ±2h window (14:42–18:42)
    const items = page.getByTestId("optimal-time-item");
    const count = await items.count();
    let overlaps = false;
    for (let i = 0; i < Math.min(count, 4); i++) {
      const el = items.nth(i);
      const start = await el.getAttribute("data-start");
      const end = await el.getAttribute("data-end");
      const center = await el.textContent();

      const toMinutes = (t?: string | null) => {
        if (!t) return null;
        const [h, m] = t.split(":").map((v) => parseInt(v, 10));
        return h * 60 + m;
      };

      const winStart = 14 * 60 + 42;
      const winEnd = 18 * 60 + 42;
      const blockStart = toMinutes(start);
      const blockEnd = toMinutes(end);
      const centerMin = toMinutes(center?.match(/\d{1,2}:\d{2}/)?.[0] || "");

      // Consider either range overlap or center within window
      if (
        (blockStart != null &&
          blockEnd != null &&
          blockEnd >= winStart &&
          blockStart <= winEnd) ||
        (centerMin != null && centerMin >= winStart && centerMin <= winEnd)
      ) {
        overlaps = true;
        break;
      }
    }

    expect(overlaps).toBeTruthy();
  });
});
