/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";

import { GET } from "@/app/app-store/route";

describe("GET /app-store", () => {
  const originalProviderToken = process.env.IOS_APP_STORE_PROVIDER_TOKEN;

  afterEach(() => {
    if (originalProviderToken === undefined) {
      delete process.env.IOS_APP_STORE_PROVIDER_TOKEN;
    } else {
      process.env.IOS_APP_STORE_PROVIDER_TOKEN = originalProviderToken;
    }
  });

  it.each(["web", "email", "partner_qr"])(
    "redirects the %s campaign with provider attribution",
    (campaign) => {
      process.env.IOS_APP_STORE_PROVIDER_TOKEN = "123456";

      const response = GET(
        new NextRequest(`https://www.quiversurf.app/app-store?ct=${campaign}`),
      );
      const destination = new URL(response.headers.get("location") ?? "");

      expect(response.status).toBe(307);
      expect(destination.hostname).toBe("apps.apple.com");
      expect(destination.searchParams.get("pt")).toBe("123456");
      expect(destination.searchParams.get("ct")).toBe(campaign);
      expect(destination.searchParams.get("mt")).toBe("8");
    },
  );

  it("normalizes unknown campaigns to web", () => {
    const response = GET(
      new NextRequest("https://www.quiversurf.app/app-store?ct=one-off"),
    );
    const destination = new URL(response.headers.get("location") ?? "");

    expect(destination.searchParams.get("ct")).toBe("web");
  });
});
