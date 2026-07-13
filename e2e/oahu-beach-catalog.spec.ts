import { expect, test } from "@playwright/test";
import { dismissMapEntryOverlay } from "./utils/map-helpers";
import { TIMEOUTS } from "./fixtures/test-data";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const MAKAHA_ID = "bb286d50-ad8d-4315-b966-5dbc31605a26";

const OAHU_BEACHES = [
  { name: "Ala Moana Bowls", slug: "ala-moana-bowls", path: "/hi/honolulu/ala-moana-bowls" },
  { name: "Backyards", slug: "backyards", path: "/hi/kahuku/backyards" },
  { name: "Chun’s Reef", slug: "chuns-reef", path: "/hi/haleiwa/chuns-reef" },
  { name: "Diamond Head (Cliffs)", slug: "diamond-head-cliffs", path: "/hi/honolulu/diamond-head-cliffs" },
  { name: "Haleʻiwa Aliʻi Beach", slug: "haleiwa", path: "/hi/haleiwa/haleiwa" },
  { name: "Kaisers", slug: "kaisers", path: "/hi/honolulu/kaisers" },
  { name: "Kewalo Basin", slug: "kewalo-basin", path: "/hi/honolulu/kewalo-basin" },
  { name: "Laniakea", slug: "laniakea", path: "/hi/haleiwa/laniakea" },
  { name: "Makaha", slug: "makaha", path: "/hi/waianae/makaha" },
  { name: "Makapuʻu", slug: "makapuu", path: "/hi/waimanalo/makapuu" },
  { name: "Off the Wall", slug: "off-the-wall", path: "/hi/pupukea/off-the-wall" },
  { name: "Pipeline", slug: "pipeline", path: "/hi/haleiwa/pipeline" },
  { name: "Pops", slug: "pops", path: "/hi/honolulu/pops" },
  { name: "Puaʻena Point", slug: "puaena-point", path: "/hi/haleiwa/puaena-point" },
  { name: "Publics", slug: "publics", path: "/hi/honolulu/publics" },
  { name: "Rocky Point", slug: "rocky-point", path: "/hi/pupukea/rocky-point" },
  { name: "Sandy Beach", slug: "sandy-beach", path: "/hi/honolulu/sandy-beach" },
  { name: "Sunset Beach", slug: "sunset-beach", path: "/hi/pupukea/sunset-beach" },
  { name: "Threes", slug: "threes", path: "/hi/honolulu/threes" },
  { name: "Tracks", slug: "tracks", path: "/hi/kapolei/tracks" },
  { name: "Velzyland", slug: "velzyland", path: "/hi/kahuku/velzyland" },
  { name: "Waikiki (Aquarium)", slug: "waikiki-aquarium", path: "/hi/honolulu/waikiki-aquarium" },
  { name: "Waikiki Beach", slug: "waikiki-beach", path: "/hi/honolulu/waikiki-beach" },
  { name: "Waikiki – Canoes", slug: "waikiki-canoes", path: "/hi/honolulu/waikiki-canoes" },
  { name: "Waikiki – Queens", slug: "waikiki-queens", path: "/hi/honolulu/waikiki-queens" },
  { name: "Waimea Bay", slug: "waimea-bay", path: "/hi/pupukea/waimea-bay" },
  { name: "White Plains", slug: "white-plains", path: "/hi/ewa-beach/white-plains" },
] as const;

test.describe("authenticated Oahu beach catalog", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, { context: "Oahu beach catalog" });
  });

  test("publishes all 27 canonical routes in the sitemap", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const sitemap = await response.text();
    for (const beach of OAHU_BEACHES) expect(sitemap).toContain(beach.path);
  });

  test("search finds established and newly seeded Oahu beaches", async ({ request }) => {
    const searchExamples = OAHU_BEACHES.filter(
      (beach) => beach.slug === "ala-moana-bowls" || beach.slug === "makaha",
    );

    for (const beach of searchExamples) {
      const response = await request.get(
        `/api/beaches/search?query=${encodeURIComponent(beach.name)}&limit=50`,
      );
      expect(response.ok(), `search request for ${beach.name}`).toBe(true);
      expect(await response.text(), `search result for ${beach.name}`).toContain(
        `\"slug\":\"${beach.slug}\"`,
      );
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
