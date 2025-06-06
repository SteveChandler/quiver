import { test, expect } from "@playwright/test";

// Helper to get a date string YYYY-MM-DD for tomorrow
function getTomorrowDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const month = String(tomorrow.getMonth() + 1).padStart(2, "0");
  const day = String(tomorrow.getDate()).padStart(2, "0");
  return `${tomorrow.getFullYear()}-${month}-${day}`;
}

const EMAIL = process.env.TEST_USER ?? "saladfingers@duck.com";
const PASSWORD = process.env.TEST_PASSWORD ?? "SCquiver1!";

// Main flow test
test("Login, view community sessions, and plan a session", async ({
  page,
  baseURL,
}) => {
  // 1. Login
  await page.goto(`${baseURL}/auth/sign-in`);
  await page.fill("input#email", EMAIL);
  await page.fill("input#password", PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();

  // Wait for redirect to home page
  await page.waitForURL(`${baseURL}/`);
  await expect(page).toHaveURL(`${baseURL}/`);

  // 2. Switch to the Community tab and ensure content loads
  await page.getByRole("button", { name: /community/i }).click();

  // Either sessions load or the empty state appears — both are acceptable
  await expect(
    page
      .locator("text=/No community sessions found/i, div:has(.session-card)")
      .first()
  ).toBeVisible();

  // 3. Plan a session
  await page.goto(`${baseURL}/plan-session`);

  // Select a beach (type and blur to trigger selection)
  await page.fill("#beach-input", "Huntington Beach");
  // If the dropdown list appears, click the first matching item
  const beachOption = page
    .locator("li", { hasText: "Huntington Beach" })
    .first();
  if (await beachOption.count()) {
    await beachOption.click();
  }

  // Pick a date for tomorrow
  await page.fill("#session-date", getTomorrowDate());

  // Save the planned session
  const saveButton = page.getByRole("button", { name: /^save$/i });
  await expect(saveButton).toBeEnabled();
  await saveButton.click();

  // Confirmation: either toast notification or redirect to dashboard/sessions
  await Promise.race([
    page.waitForSelector("text=/Session planned successfully/i", {
      timeout: 10000,
    }),
    page.waitForURL(/dashboard|sessions|\//, { timeout: 10000 }),
  ]);
});
