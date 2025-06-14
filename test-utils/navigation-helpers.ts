import { Page } from "@playwright/test";

/**
 * Simulates user activity to show the bottom navigation
 * In test mode, navigation should stay visible automatically
 */
export async function showBottomNavigation(page: Page) {
  // Simple mouse movement to trigger activity (if auto-hide is still active)
  await page.mouse.move(100, 100);

  // Small wait to ensure navigation is visible
  await page.waitForTimeout(100);
}

/**
 * Ensures bottom navigation is visible and returns the element
 * Simplified for test mode where navigation stays visible
 */
export async function getBottomNavigation(page: Page) {
  // In test mode, navigation should be visible by default
  // Just find the navigation element
  const bottomNav = page.getByTestId("bottom-navigation").first();

  // Wait for it to be visible with a reasonable timeout
  await bottomNav.waitFor({ state: "visible", timeout: 5000 });

  return bottomNav;
}

/**
 * Clicks a navigation item by name after ensuring navigation is visible
 */
export async function clickNavigationItem(page: Page, itemName: string) {
  // Get the navigation element first
  const bottomNav = await getBottomNavigation(page);

  // Find and click the navigation item within the navigation container
  const navItem = bottomNav.getByText(new RegExp(itemName, "i")).first();

  // Wait for the item to be clickable and click it
  await navItem.waitFor({ state: "visible", timeout: 3000 });
  await navItem.click();
}
