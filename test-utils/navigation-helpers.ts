import { Page } from "@playwright/test";

/**
 * Opens the mobile navigation menu (hamburger menu)
 * @param page - Playwright page object
 */
export async function openMobileMenu(page: Page) {
  const hamburger = page.getByTestId("mobile-menu-button");
  await hamburger.click();

  // Wait for drawer to be visible
  const drawer = page.getByRole("dialog");
  await drawer.waitFor({ state: "visible", timeout: 3000 });
}

/**
 * Clicks a navigation item in the mobile menu
 * @param page - Playwright page object
 * @param itemName - Name of the navigation item (e.g., "Home", "Map", "Sessions")
 */
export async function clickMobileMenuItem(page: Page, itemName: string) {
  // Ensure mobile menu is open
  const drawer = page.getByRole("dialog");
  const isVisible = await drawer.isVisible().catch(() => false);

  if (!isVisible) {
    await openMobileMenu(page);
  }

  // Click the navigation item
  const navItem = page.getByTestId(`mobile-nav-${itemName.toLowerCase()}`);
  await navItem.click();

  // Wait for drawer to close
  await drawer.waitFor({ state: "hidden", timeout: 3000 });
}

/**
 * @deprecated Bottom navigation has been removed. Use openMobileMenu() instead.
 * This function is kept temporarily for backwards compatibility.
 */
export async function showBottomNavigation(page: Page) {
  console.warn(
    "showBottomNavigation is deprecated - bottom navigation removed in Phase 5. Use openMobileMenu() instead."
  );
  // Simple mouse movement to trigger activity (legacy behavior)
  await page.mouse.move(100, 100);
  await page.waitForTimeout(100);
}

/**
 * @deprecated Bottom navigation has been removed. Use openMobileMenu() instead.
 * This function will throw an error to alert developers to update their tests.
 */
export async function getBottomNavigation(page: Page) {
  throw new Error(
    "Bottom navigation removed in Phase 5 - use openMobileMenu() and page.getByRole('dialog') instead."
  );
}

/**
 * @deprecated Bottom navigation has been removed. Use clickMobileMenuItem() instead.
 * This function will throw an error to alert developers to update their tests.
 */
export async function clickNavigationItem(page: Page, itemName: string) {
  throw new Error(
    "Bottom navigation removed in Phase 5 - use clickMobileMenuItem() instead."
  );
}

/**
 * Wait for realtime-driven UI to settle (e.g., after Supabase changes)
 * Uses a generic data-loading flag pattern used across the app/tests
 */
export async function waitForRealtimeUpdate(page: Page, timeout = 5000) {
  await page.waitForFunction(
    () => !document.querySelector('[data-loading="true"]'),
    { timeout }
  );
}

/**
 * Safely fill a form using data-testid-based selectors, with visibility checks
 */
export async function fillFormSafely(
  page: Page,
  formData: Record<string, string>
) {
  await page.waitForLoadState("load");
  for (const [field, value] of Object.entries(formData)) {
    const selector = `[data-testid="${field}"]`;
    await page.waitForSelector(selector);
    await page.fill(selector, value);
  }
}
