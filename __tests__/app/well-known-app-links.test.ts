/**
 * @jest-environment node
 */

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

  it('emits the native iOS app id and beach paths by default', async () => {
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');

    const response = GET();
    const body = await response.json();

    expect(body.applinks.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          appID: 'QBA8TA48NG.app.quiversurf.mobile',
          paths: expect.arrayContaining(['/beach/*', '/settings*']),
        }),
      ]),
    );
  });

  it('keeps required native paths even when env paths are partial', async () => {
    process.env.APPLE_APP_SITE_ASSOCIATION_PATHS = '/auth/*';
    const { GET } = await import('@/app/.well-known/apple-app-site-association/route');

    const response = GET();
    const body = await response.json();
    const paths = body.applinks.details[0].paths;

    expect(paths).toEqual(expect.arrayContaining(['/auth/*', '/beach/*', '/settings*']));
  });

  it('emits the Android app-link package with configured fingerprints', async () => {
    process.env.ANDROID_SHA256_FINGERPRINTS = 'AA:BB:CC,11:22:33';
    const { GET } = await import('@/app/.well-known/assetlinks.json/route');

    const response = GET();
    const body = await response.json();

    expect(body).toEqual([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'app.quiversurf.surf',
          sha256_cert_fingerprints: ['AA:BB:CC', '11:22:33'],
        },
      },
    ]);
  });
});
