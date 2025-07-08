import { Page, expect } from "@playwright/test";

/**
 * Reliable page loading that doesn't depend on networkidle
 */
export async function waitForPageLoad(page: Page, timeout = 10000) {
  // Use load state instead of networkidle for reliability
  await page.waitForLoadState("load");

  // Wait for basic page structure
  await page.waitForSelector("body", { timeout });

  // Give a small buffer for React hydration
  await page.waitForTimeout(500);
}

/**
 * Wait for element to be ready for interaction
 */
export async function waitForElementReady(
  locator: any,
  options: { timeout?: number; state?: "visible" | "attached" | "hidden" } = {}
) {
  const { timeout = 5000, state = "visible" } = options;
  await locator.waitFor({ state, timeout });

  // If it's supposed to be visible, make sure it's actually clickable
  if (state === "visible") {
    // Wait a bit more for element to be stable
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
}

/**
 * Handle authentication redirects gracefully
 */
export async function handleAuthRedirect(page: Page) {
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const isAuthPage =
    currentUrl.includes("/auth") || currentUrl.includes("/sign");

  return {
    isAuthPage,
    isSignIn: currentUrl.includes("/sign-in"),
    isSignUp: currentUrl.includes("/sign-up"),
    isHome: currentUrl === new URL("/", page.url()).href,
  };
}

/**
 * Safe click that handles disabled states
 */
export async function safeClick(
  locator: any,
  options: { timeout?: number } = {}
) {
  const { timeout = 5000 } = options;

  // Wait for element to be attached
  await locator.waitFor({ state: "attached", timeout });

  // Check if element is enabled
  const isEnabled = await locator.isEnabled().catch(() => false);
  if (!isEnabled) {
    throw new Error("Element is disabled and cannot be clicked");
  }

  // Wait for element to be visible and stable
  await locator.waitFor({ state: "visible", timeout });
  await new Promise(resolve => setTimeout(resolve, 200)); // Stability buffer

  // Perform the click
  await locator.click();
}

/**
 * Find element with fallback selectors to avoid strict mode violations
 */
export function findElementWithFallbacks(page: Page, selectors: string[]) {
  // Try each selector until one works
  for (const selector of selectors) {
    try {
      const element = page.locator(selector).first();
      return element;
    } catch (error) {
      continue;
    }
  }

  // If all fail, return the first selector's result
  return page.locator(selectors[0]).first();
}

/**
 * Check if any of multiple elements are visible
 */
export async function isAnyElementVisible(locators: any[], timeout = 5000) {
  const promises = locators.map((locator) =>
    locator.isVisible().catch(() => false)
  );

  const results = await Promise.all(promises);
  return results.some((result) => result);
}

/**
 * Wait for navigation to complete
 */
export async function waitForNavigation(page: Page, expectedUrl?: string) {
  await page.waitForLoadState("load");
  await page.waitForTimeout(1000);

  if (expectedUrl) {
    const currentUrl = page.url();
    const urlMatches =
      currentUrl.includes(expectedUrl) ||
      currentUrl === new URL(expectedUrl, page.url()).href;
    return urlMatches;
  }

  return true;
}
