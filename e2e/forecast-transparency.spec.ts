import { test, expect } from "@playwright/test";

test.describe("Forecast Transparency Features", () => {
  // Use a known beach with forecast data
  const TEST_BEACH_SLUG = "blacks";

  test.describe("Forecast guest page", () => {
    // Explicitly run as a guest (no storage state)
    test.use({ storageState: { cookies: [], origins: [] } });

    test("Old /forecast/[beachId] URL redirects to beach detail page with Forecast tab", async ({
      page,
      request,
    }) => {
      // Resolve a real beachId from the public beaches API
      const beachesRes = await request.get("/api/beaches");
      expect(beachesRes.ok()).toBeTruthy();
      const beachesJson = (await beachesRes.json()) as {
        success: boolean;
        data?: { beaches?: Array<{ id: string; slug: string | null; name: string }> };
      };
      expect(beachesJson.success).toBe(true);
      const beaches = beachesJson.data?.beaches ?? [];

      const blacks = beaches.find((b) => b?.slug === TEST_BEACH_SLUG);
      expect(
        blacks?.id,
        `Couldn't find beach slug "${TEST_BEACH_SLUG}" in /api/beaches (got ${beaches.length} beaches)`
      ).toBeTruthy();

      // Navigate to deprecated forecast URL (blacks is guaranteed to exist after expect)
      await page.goto(`/forecast/${blacks!.id}`);
      await page.waitForLoadState("load");

      // Should redirect to canonical beach detail page with ?tab=forecast
      expect(page.url()).toContain("?tab=forecast");
      expect(page.url()).not.toContain("/forecast/");

      // Forecast tab should be selected
      await expect(page.getByRole("tab", { name: "Forecast", selected: true })).toBeVisible({
        timeout: 15000,
      });
    });
  });

});
