import { Page, expect } from '@playwright/test';

export async function waitForNetworkIdle(page: Page, timeout = 10_000) {
  // Wait for network to be quiet to reduce flakiness around navigations
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
}

export async function waitForURLContains(page: Page, fragment: string | RegExp, timeout = 10_000) {
  if (fragment instanceof RegExp) {
    await expect(page).toHaveURL(fragment, { timeout });
  } else {
    const pattern = new RegExp(fragment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    await expect(page).toHaveURL(pattern, { timeout });
  }
}

