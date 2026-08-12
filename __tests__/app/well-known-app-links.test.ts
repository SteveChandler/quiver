/**
 * @jest-environment node
 */

const VALID_ANDROID_FINGERPRINT_1 =
  '11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00';
const VALID_ANDROID_FINGERPRINT_2 =
  'AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99:AA:BB:CC:DD:EE:FF:00:11:22:33:44:55:66:77:88:99';

describe('.well-known app-link manifests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.APPLE_TEAM_ID;
    delete process.env.APPLE_APP_ID;
    delete process.env.APPLE_APP_BUNDLE_IDS;
    delete process.env.APPLE_APP_BUNDLE_ID;
    delete process.env.APPLE_APP_SITE_ASSOCIATION_PATHS;
    delete process.env.ANDROID_APP_PACKAGES;
    delete process.env.ANDROID_APP_PACKAGE;
    delete process.env.ANDROID_SHA256_FINGERPRINTS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('emits only the approved native app-link path contract by default', async () => {
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');

    const response = GET();
    const body = await response.json();

    expect(body.applinks.details).toEqual([
      {
        appID: 'QBA8TA48NG.app.quiversurf.mobile',
        paths: [
          '/invite',
          '/invite/*',
          '/beach',
          '/beach/*',
          '/sessions',
          '/sessions/*',
          '/profile',
          '/profile/*',
          // Regression: partner QR URLs need prefix coverage.
          '/p',
          '/p/*',
          '/auth',
          '/auth/*',
          '/settings',
          '/map',
          '/alerts',
          '/alerts/*',
          // Regression: the nudge-email CTA must claim only the exact /app route.
          '/app',
          '/app/handoff',
          '/app/spot/*',
          '/app/forecast',
        ],
      },
    ]);
  });

  it('does not let an environment override broaden the approved app-link contract', async () => {
    process.env.APPLE_APP_SITE_ASSOCIATION_PATHS = '/app*,/roadmap/*';
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');

    const response = GET();
    const body = await response.json();
    const paths = body.applinks.details[0].paths;

    expect(paths).not.toContain('/app*');
    expect(paths).not.toContain('/roadmap/*');
    expect(paths).toEqual(expect.arrayContaining([
      '/alerts',
      '/map',
      '/app/handoff',
      '/app/forecast',
    ]));
  });

  it('does not emit placeholder Apple team IDs as live app-link evidence', async () => {
    process.env.APPLE_TEAM_ID = 'YOUR_TEAM_ID';
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');

    const response = GET();
    const body = await response.json();

    expect(body.applinks.details[0].appID).toBe('QBA8TA48NG.app.quiversurf.mobile');
    expect(body.applinks.details[0].appID).not.toContain('YOUR');
  });

  it('emits the Android app-link package with configured fingerprints', async () => {
    process.env.ANDROID_SHA256_FINGERPRINTS = `${VALID_ANDROID_FINGERPRINT_1},${VALID_ANDROID_FINGERPRINT_2}`;
    const { GET } = await import('@/app/.well-known/assetlinks.json/route');

    const response = GET();
    const body = await response.json();

    expect(body).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.quiversurf.surf',
          sha256_cert_fingerprints: [
            VALID_ANDROID_FINGERPRINT_1,
            VALID_ANDROID_FINGERPRINT_2,
          ],
        },
      },
    ]);
  });

  it('filters obvious placeholder Android fingerprints from live app-link evidence', async () => {
    process.env.ANDROID_SHA256_FINGERPRINTS = [
      'AA:BB:CC',
      'YOUR_SHA256_FINGERPRINT',
      VALID_ANDROID_FINGERPRINT_1,
      'REPLACE_ME',
    ].join(',');
    const { GET } = await import('@/app/.well-known/assetlinks.json/route');

    const response = GET();
    const body = await response.json();

    expect(body[0].target.sha256_cert_fingerprints).toEqual([
      VALID_ANDROID_FINGERPRINT_1,
    ]);
  });
});
