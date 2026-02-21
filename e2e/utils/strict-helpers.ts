import { expect, type Locator } from "@playwright/test";

/**
 * Assert that an element is visible. Fails the test if the element is not found.
 * Use this instead of .isVisible().catch(() => false) + if/else.
 */
export async function expectVisible(
  locator: Locator,
  options?: { timeout?: number; message?: string }
) {
  await expect(locator).toBeVisible({
    timeout: options?.timeout ?? 10_000,
  });
}

/**
 * Safely check if an element exists without failing.
 * Use ONLY for genuinely environment-dependent features (e.g., features behind
 * feature flags, auth-gated content in guest tests).
 * Returns true if visible, false otherwise.
 */
export async function isVisibleSafe(
  locator: Locator,
  options?: { timeout?: number }
): Promise<boolean> {
  try {
    await expect(locator).toBeVisible({ timeout: options?.timeout ?? 3_000 });
    return true;
  } catch {
    return false;
  }
}
