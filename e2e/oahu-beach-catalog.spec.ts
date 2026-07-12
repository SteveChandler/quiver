import { expect, test } from "@playwright/test";
import { dismissMapEntryOverlay } from "./utils/map-helpers";
import { TIMEOUTS } from "./fixtures/test-data";

const MAKAHA_ID = "bb286d50-ad8d-4315-b966-5dbc31605a26";

const OAHU_PATHS = [
  "/hi/honolulu/ala-moana-bowls",
  "/hi/kahuku/backyards",
  "/hi/haleiwa/chuns-reef",
  "/hi/honolulu/diamond-head-cliffs",
  "/hi/haleiwa/haleiwa",
  "/hi/honolulu/kaisers",
  "/hi/honolulu/kewalo-basin",
  "/hi/haleiwa/laniakea",
  "/hi/waianae/makaha",
  "/hi/waimanalo/makapuu",
  "/hi/pupukea/off-the-wall",
  "/hi/honolulu/pops",
  "/hi/haleiwa/puaena-point",
  "/hi/honolulu/publics",
  "/hi/pupukea/rocky-point",
  "/hi/honolulu/sandy-beach",
  "/hi/pupukea/sunset-beach",
  "/hi/honolulu/threes",
  "/hi/kapolei/tracks",
  "/hi/kahuku/velzyland",
  "/hi/honolulu/waikiki-aquarium",
  "/hi/honolulu/waikiki-beach",
  "/hi/honolulu/waikiki-canoes",
  "/hi/honolulu/waikiki-queens",
  "/hi/pupukea/waimea-bay",
  "/hi/ewa-beach/white-plains",
  "/hi/pupukea/pipeline",
] as const;

test.describe("authenticated Oahu beach catalog", () => {
  test("publishes all 27 canonical routes in the sitemap", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const sitemap = await response.text();
    for (const path of OAHU_PATHS) expect(sitemap).toContain(path);
  });

  test("search finds every curated Oahu beach", async ({ request }) => {
    for (const path of OAHU_PATHS) {
      const slug = path.split("/").at(-1)!;
      const response = await request.get(`/api/beaches/search?query=${encodeURIComponent(slug)}&limit=50`);
      expect(response.ok(), `search request for ${slug}`).toBe(true);
      expect(await response.text(), `search result for ${slug}`).toContain(`\"slug\":\"${slug}\"`);
    }
  });

  test("nearby results include Ala Moana Bowls and Kewalo Basin", async ({ request }) => {
    const response = await request.get(
      "/api/beaches/nearby?lat=21.285&lon=-157.856&maxDistance=5&limit=20",
    );
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain("ala-moana-bowls");
    expect(body).toContain("kewalo-basin");
  });

  test("detail, map marker, and camera directory expose seeded spots", async ({ page }) => {
    await page.goto("/hi/honolulu/ala-moana-bowls");
    await expect(page.getByRole("heading", { level: 1, name: "Ala Moana Bowls" })).toBeVisible({ timeout: TIMEOUTS.long });

    await page.goto("/hi/waianae/makaha");
    await expect(page.getByRole("heading", { level: 1, name: "Makaha" })).toBeVisible({ timeout: TIMEOUTS.long });

    await page.goto("/map");
    await dismissMapEntryOverlay(page);
    const search = page.getByRole("combobox", { name: "Search beaches, spots, or cities" });
    await search.fill("Makaha");
    await page.getByRole("option", { name: /makaha/i }).click();
    await expect(page.locator(`[data-testid="beach-marker"][data-beach-id="${MAKAHA_ID}"]`)).toBeAttached({ timeout: TIMEOUTS.long });

    await page.goto("/cams");
    await expect(page.getByText("Ala Moana Bowls", { exact: true }).first()).toBeVisible({ timeout: TIMEOUTS.long });
  });
});
