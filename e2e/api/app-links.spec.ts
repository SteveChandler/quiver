/**
 * App-link manifest request contracts.
 *
 * Native handoff behavior stays out of web Playwright scope; these request
 * tests validate the deployed manifest shape that iOS/Android consume.
 *
 * @project guest
 */

import { expect, test } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const REQUIRE_ANDROID_FINGERPRINTS =
  process.env.TEST_ENV === 'dev' ||
  BASE_URL.includes('dev.quiversurf.app') ||
  BASE_URL.includes('vercel.app');
const SHA256_FINGERPRINT_PATTERN = /^(?:[A-F0-9]{2}:){31}[A-F0-9]{2}$/;

const REQUIRED_APPLE_PATHS = [
  '/auth/*',
  '/sessions/*',
  '/beach/*',
  '/profile/*',
  '/map*',
  '/invite/*',
  '/settings*',
  '/app/spot/*',
  // Regression: partner QR links require prefix expansion and the nudge CTA
  // must be claimed as the exact /app path, not its subpaths.
  '/p',
  '/p/*',
  '/app',
] as const;

type AndroidAssetLink = {
  relation?: string[];
  target?: {
    namespace?: string;
    package_name?: string;
    sha256_cert_fingerprints?: string[];
  };
};

function expectNoPlaceholder(value: string): void {
  expect(value).not.toMatch(/your|replace|placeholder|todo/i);
}

function expectValidAndroidFingerprints(fingerprints: string[]): void {
  if (REQUIRE_ANDROID_FINGERPRINTS) {
    expect(fingerprints.length).toBeGreaterThan(0);
  }

  for (const fingerprint of fingerprints) {
    expectNoPlaceholder(fingerprint);
    expect(fingerprint).toMatch(SHA256_FINGERPRINT_PATTERN);
  }
}

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('App-link manifests', () => {
  test('/.well-known/apple-app-site-association exposes iOS app-link details', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/apple-app-site-association');
    const json = await response.json();

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toContain('max-age=3600');
    expect(json.applinks?.apps).toEqual([]);
    expect(Array.isArray(json.applinks?.details)).toBe(true);

    const details = json.applinks.details as Array<{
      appID?: string;
      paths?: string[];
    }>;
    const primaryApp = details.find((entry) =>
      entry.appID?.endsWith('.app.quiversurf.mobile')
    );

    expect(primaryApp, 'primary Quiver iOS appID').toBeTruthy();
    expect(primaryApp?.appID).toMatch(/^[A-Z0-9]{10}\.app\.quiversurf\.mobile$/);
    expectNoPlaceholder(primaryApp?.appID ?? '');

    for (const path of REQUIRED_APPLE_PATHS) {
      expect(primaryApp?.paths).toContain(path);
    }
  });

  test('/.well-known/assetlinks.json exposes Android package and fingerprints', async ({
    request,
  }) => {
    const response = await request.get('/.well-known/assetlinks.json');
    const json = await response.json();

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(response.headers()['cache-control']).toContain('max-age=3600');
    expect(Array.isArray(json)).toBe(true);

    const entries = json as AndroidAssetLink[];
    const target = entries.find(
      (entry) => entry.target?.package_name === 'app.quiversurf.surf'
    );

    expect(target, 'primary Quiver Android package').toBeTruthy();
    expect(target?.relation).toContain('delegate_permission/common.handle_all_urls');
    expect(target?.target?.namespace).toBe('android_app');
    expectNoPlaceholder(target?.target?.package_name ?? '');

    const fingerprints = target?.target?.sha256_cert_fingerprints ?? [];
    expect(Array.isArray(fingerprints)).toBe(true);
    expectValidAndroidFingerprints(fingerprints);
  });
});
