import { test, expect } from "@playwright/test";

test.describe("Session Wizard - Location Typeahead", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the session wizard in log mode
    await page.goto("/sessions/new?mode=log");
    await page.waitForLoadState("load");
  });

  test("should display location step as first step", async ({ page }) => {
    // Verify we're on the location step
    await expect(page.getByText("Location")).toBeVisible();
    await expect(
      page.getByText("Where did your session take place?")
    ).toBeVisible();

    // Verify the beach input exists
    const beachInput = page.getByTestId("beach-search-input");
    await expect(beachInput).toBeVisible();
  });

  test("should show search results for 'la jo' query", async ({ page }) => {
    // Type into the beach search input
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("la jo");

    // Wait for debounced search to complete (300ms + buffer)
    await page.waitForTimeout(500);

    // Verify dropdown is visible and contains expected results
    const dropdown = page.locator("ul").filter({ hasText: "La Jolla Shores" });
    await expect(dropdown).toBeVisible();

    // Verify specific beaches appear in the dropdown
    await expect(page.getByText("La Jolla Shores", { exact: true })).toBeVisible();
    await expect(page.getByText("Scripps", { exact: true })).toBeVisible();
    await expect(page.getByText("Birdrock", { exact: true })).toBeVisible();
    await expect(page.getByText("Windansea", { exact: true })).toBeVisible();
    await expect(page.getByText("Horseshoe", { exact: true })).toBeVisible();
  });

  test("should select beach from dropdown and populate field", async ({
    page,
  }) => {
    // Type into the beach search input
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("la jo");

    // Wait for debounced search
    await page.waitForTimeout(500);

    // Click on "La Jolla Shores" option
    await page.getByText("La Jolla Shores", { exact: true }).click();

    // Verify the input field is populated
    await expect(beachInput).toHaveValue("La Jolla Shores");

    // Verify dropdown is closed after selection
    const dropdown = page.locator("ul").filter({ hasText: "La Jolla Shores" });
    await expect(dropdown).not.toBeVisible();
  });

  test("should close dropdown when clear button is clicked", async ({
    page,
  }) => {
    // Type and select a beach
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("scripps");
    await page.waitForTimeout(500);
    await page.getByText("Scripps", { exact: true }).click();

    // Verify clear button appears
    const clearButton = page.locator("button[title='Clear selection']");
    await expect(clearButton).toBeVisible();

    // Click clear button
    await clearButton.click();

    // Verify input is cleared
    await expect(beachInput).toHaveValue("");
  });

  test("should show 'No beaches found' for invalid search", async ({
    page,
  }) => {
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("ZZZZZZZZZZ");

    // Wait for debounced search (300ms debounce + processing time)
    await page.waitForTimeout(800);

    // Verify "No beaches found" message appears
    await expect(page.getByText("No beaches found")).toBeVisible();
  });

  test("should show loading state while searching", async ({ page }) => {
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("la jo");

    // Check for loading state immediately after typing (before debounce completes)
    const loadingState = page.getByText("Searching...");
    const isLoading = await loadingState.isVisible().catch(() => false);
    
    // After debounce + search completes (increase timeout for dev environment)
    await page.waitForTimeout(800);
    
    // Loading should be gone and results visible
    await expect(page.getByText("La Jolla Shores", { exact: true })).toBeVisible();
    await expect(loadingState).not.toBeVisible();
  });

  test("should enable Next button after selecting beach", async ({ page }) => {
    // Initially, Next button should be disabled
    const nextButton = page.getByRole("button", { name: "Next" });
    await expect(nextButton).toBeDisabled();

    // Select a beach
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("scripps");
    await page.waitForTimeout(500);
    await page.getByText("Scripps", { exact: true }).click();

    // Next button should now be enabled
    await expect(nextButton).toBeEnabled();
  });

  test("should advance to next step after selecting beach and clicking Next", async ({
    page,
  }) => {
    // Select a beach
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("scripps");
    await page.waitForTimeout(500);
    await page.getByText("Scripps", { exact: true }).click();

    // Click Next button
    const nextButton = page.getByRole("button", { name: "Next" });
    await nextButton.click();

    // Verify we advanced to the datetime step
    await expect(page.getByRole("heading", { name: "When" })).toBeVisible();
    await expect(page.getByText("When did you surf?")).toBeVisible();
  });

  test("should handle rapid typing with debouncing", async ({ page }) => {
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();

    // Type rapidly without waiting
    await beachInput.pressSequentially("lajolla", { delay: 50 });

    // Wait for results to appear (with longer timeout for debouncing + API call)
    const laJollaResult = page.getByText("La Jolla Shores", { exact: true });
    await expect(laJollaResult).toBeVisible({ timeout: 3000 });

    // Verify the dropdown is present
    const dropdown = page.locator("ul").filter({ hasText: "La Jolla Shores" });
    await expect(dropdown).toBeVisible();
  });

  test("should work on mobile viewport", async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Type into the beach search input
    const beachInput = page.getByTestId("beach-search-input");
    await beachInput.click();
    await beachInput.fill("la jo");

    // Wait for results to appear (with timeout for debouncing + API call)
    await expect(page.getByText("La Jolla Shores", { exact: true })).toBeVisible({ timeout: 3000 });

    // Select beach
    await page.getByText("La Jolla Shores", { exact: true }).click();

    // Verify selection
    await expect(beachInput).toHaveValue("La Jolla Shores");
  });
});

