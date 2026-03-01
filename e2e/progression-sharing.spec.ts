/**
 * Progression Sharing OG Route Tests
 *
 * Validates that the progression and streak OG image endpoints
 * return 200 with image content when called with valid params.
 *
 * @project guest (public API routes)
 */

import { test, expect } from '@playwright/test';
import { setupErrorDetection, assertNoErrors, ErrorCapture } from './utils/error-detection';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

test.describe('Progression OG Image Routes', () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: 'Progression OG Image Routes' });
  });

  test('progression OG route returns 200 with valid params', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/progression?sessions=12&hours=18.5&avgRating=4.2&topSkill=Pop-ups&topSkillRating=4.8&streak=5&month=March+2026`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('progression OG route returns 200 with minimal required params', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/progression?sessions=8&hours=12&avgRating=3.5&month=February+2026`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('progression OG route returns 200 when optional params are missing', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/progression?sessions=1&hours=1.5&avgRating=4.0&month=January+2026`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('streak OG route returns 200 with valid params', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/streak?streak=7&userName=Steven`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('streak OG route returns 200 without userName', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/streak?streak=14`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('streak OG route returns 200 with streak=1', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/streak?streak=1`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });

  test('streak OG route returns 200 with high streak (renders max 10 fire emojis)', async ({ request }) => {
    const res = await request.get(
      `${BASE_URL}/api/og/streak?streak=30&userName=Alex`
    );
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image');
  });
});
