/**
 * @jest-environment node
 */

describe("RevenueCat web checkout URL", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("builds an identified HTTPS purchase link", async () => {
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL =
      "https://pay.rev.cat/quiver-pro/";

    const { buildRevenueCatWebCheckoutUrl } = await import(
      "@/lib/subscription/revenuecat-web-checkout"
    );

    expect(buildRevenueCatWebCheckoutUrl("user/with spaces")).toBe(
      "https://pay.rev.cat/quiver-pro/user%2Fwith%20spaces"
    );
  });

  it("passes the app user ID to a published Funnel as a query parameter", async () => {
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL =
      "https://signup.cat/funnel-token/";

    const { buildRevenueCatWebCheckoutUrl } = await import(
      "@/lib/subscription/revenuecat-web-checkout"
    );

    expect(buildRevenueCatWebCheckoutUrl("user-1")).toBe(
      "https://signup.cat/funnel-token/?app_user_id=user-1",
    );
  });

  it("fails closed when the URL is missing, malformed, or not HTTPS", async () => {
    const missing = await import(
      "@/lib/subscription/revenuecat-web-checkout"
    );
    expect(missing.buildRevenueCatWebCheckoutUrl("user-1")).toBeNull();

    jest.resetModules();
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL =
      "http://pay.rev.cat/quiver-pro";
    const insecure = await import(
      "@/lib/subscription/revenuecat-web-checkout"
    );
    expect(insecure.buildRevenueCatWebCheckoutUrl("user-1")).toBeNull();
  });

  it("does not create a link without an app user ID", async () => {
    process.env.NEXT_PUBLIC_REVENUECAT_WEB_CHECKOUT_URL =
      "https://pay.rev.cat/quiver-pro";

    const { buildRevenueCatWebCheckoutUrl } = await import(
      "@/lib/subscription/revenuecat-web-checkout"
    );

    expect(buildRevenueCatWebCheckoutUrl("")).toBeNull();
  });
});
