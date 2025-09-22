import { test, expect } from '@playwright/test';

// Creates a Local Intel post on a beach page and verifies it appears
// Runs under the `auth` project to ensure create is allowed

const BEACH_ID = process.env.TEST_BEACH_ID || '15c7337e-5258-4339-9dc3-c435c666926b';

test.describe('@intel @beach - Create intel on beach page', () => {
  const isDev = (process.env.BASE_URL || '').includes('dev.quiversurf.app');

  test.skip(isDev, 'Skipping intel create on dev due to environment restrictions.');

  test('creates intel and shows it in Local Intel list', async ({ page }) => {
    // Run on dev now that mock-user RLS is allowed
    // Navigate directly to the beach detail page
    await page.goto(`/beach/${BEACH_ID}?section=intel`, { waitUntil: 'domcontentloaded' });

    // Expand Local Intel section if collapsed
    const intelTrigger = page.getByRole('button', { name: /local intel/i });
    if (await intelTrigger.isVisible().catch(() => false)) {
      await intelTrigger.click();
    }

    // Open the Share Intel dialog
    const addIntel = page.getByRole('button', { name: /add intel|add first intel/i });
    await expect(addIntel).toBeVisible({ timeout: 20000 });
    await addIntel.click();

    // The dialog should appear
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 20000 });

    // Fill required fields (default tag is "other")
    await page.getByLabel(/title/i).fill('E2E Crowd Check');
    const desc = `E2E crowd at ${Date.now()}`;
    await page.getByLabel(/description/i).fill(desc);

    // Capture displayed coordinates (approximate) before submit to use with API verification
    const coordText = await page.getByText(/-?\d+\.\d{3,},\s*-?\d+\.\d{3,}/).first().textContent().catch(() => null);
    let lat = 32.75, lng = -117.25;
    if (coordText) {
      const m = coordText.match(/(-?\d+\.\d{3,})\s*,\s*(-?\d+\.\d{3,})/);
      if (m) { lat = parseFloat(m[1]); lng = parseFloat(m[2]); }
    }

    // Submit
    await page.getByRole('button', { name: /share intel/i }).click();

    // Dialog may stay open while toast shows; assert success toast within container as primary signal
    const toast = page.locator('#toast-container').getByText(/post created|intel post created successfully/i);
    await expect(toast).toBeVisible({ timeout: 20000 });
    // Close dialog explicitly to proceed
    const closeBtn = page.getByRole('button', { name: /close|cancel/i }).last();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click();
    }
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Verify via API that the new post exists near the same coordinates (dev uses this API)
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      radius: '50',
      tag: 'all',
      limit: '100',
    });
    const res = await page.request.get(`/api/intel?${params.toString()}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    const posts = body?.data?.posts || [];
    expect(Array.isArray(posts)).toBeTruthy();
    expect(posts.some((p: any) => (p?.title || '').includes('E2E Crowd Check'))).toBeTruthy();

    // As a secondary check, reload the page and confirm it shows up in UI (best-effort)
    await page.reload({ waitUntil: 'domcontentloaded' });
    const uiHit = page.getByText('E2E Crowd Check').first();
    await expect(uiHit).toBeVisible({ timeout: 20000 });
  });
});


