import { test, expect } from '@playwright/test';

test.describe('Smoke (Guest)', () => {
  test('landing page shows primary CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const ctaLink = page.getByRole('link', { name: /join free today/i });
    await expect(ctaLink.first()).toBeVisible();
  });
});

