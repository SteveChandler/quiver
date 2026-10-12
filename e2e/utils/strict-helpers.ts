import { expect, type Locator } from "@playwright/test";

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
