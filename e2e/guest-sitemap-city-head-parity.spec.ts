import { expect, test } from "@playwright/test";

const SITEMAP_CITY_ROUTES = [
  "/hi/waimea-big-island",
  "/hi/waimea-kauai",
] as const;

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("sitemap city GET/HEAD parity", () => {
  for (const route of SITEMAP_CITY_ROUTES) {
    test(`${route} returns 200 for GET and HEAD`, async ({ request }) => {
      const getResponse = await request.get(route, { maxRedirects: 0 });
      const headResponse = await request.fetch(route, {
        method: "HEAD",
        maxRedirects: 0,
      });

      expect(getResponse.status()).toBe(200);
      expect(headResponse.status()).toBe(200);
      expect(headResponse.headers()["location"]).toBeUndefined();
    });
  }
});
