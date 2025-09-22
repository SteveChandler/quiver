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

export async function grantGeolocation(page: Page, latitude = 32.7503, longitude = -117.2534) {
  const context = page.context();
  await context.grantPermissions(['geolocation']);
  await context.setGeolocation({ latitude, longitude });
}

export async function denyGeolocation(page: Page) {
  const context = page.context();
  await context.clearPermissions();
}

