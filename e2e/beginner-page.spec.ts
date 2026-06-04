import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

const PAGE_LOAD_TIMEOUT = 20_000;

interface BeginnerRouteExpectation {
  path: string;
  h1: string;
  titleTerms: string[];
  metaTerms: string[];
  spots: string[];
  caveats: string[];
  internalLinks: string[];
}

const BEGINNER_ROUTES: BeginnerRouteExpectation[] = [
  {
    path: "/beginner/san-diego",
    h1: "Beginner Surf Spots in San Diego",
    titleTerms: ["beginner", "san diego"],
    metaTerms: ["beginner", "san diego"],
    spots: ["La Jolla Shores", "Tourmaline", "Mission Beach"],
    caveats: ["overhead sets", "strong drift", "fast closeouts"],
    internalLinks: ["/beginner/orange-county", "/beginner/los-angeles"],
  },
  {
    path: "/beginner/orange-county",
    h1: "Beginner Surf Spots in Orange County",
    titleTerms: ["beginner", "orange county"],
    metaTerms: ["beginner", "orange county"],
    spots: ["Bolsa Chica", "Blackies", "Doheny", "Old Man's"],
    caveats: ["Newland", "Huntington St.", "Cliffs"],
    internalLinks: [
      "/beginner/huntington-beach",
      "/beginner/san-onofre",
      "/beginner/san-diego",
      "/beginner/los-angeles",
      "/beginner/ventura",
    ],
  },
  {
    path: "/beginner/huntington-beach",
    h1: "Beginner Surf Spots in Huntington Beach",
    titleTerms: ["beginner", "huntington beach"],
    metaTerms: ["beginner", "huntington beach"],
    spots: ["Bolsa Chica", "Huntington State Beach", "Goldenwest", "Blackies"],
    caveats: ["pier", "Newland", "Huntington St.", "Cliffs"],
    internalLinks: [
      "/beginner/orange-county",
      "/beginner/los-angeles",
      "/beginner/san-onofre",
    ],
  },
  {
    path: "/beginner/los-angeles",
    h1: "Beginner Surf Spots in Los Angeles",
    titleTerms: ["beginner", "los angeles"],
    metaTerms: ["beginner", "los angeles"],
    spots: [
      "Santa Monica",
      "Will Rogers",
      "Dockweiler",
      "Venice",
      "Torrance/RAT Beach",
      "72nd Place",
    ],
    caveats: ["El Porto", "Zuma", "Leo Carrillo", "conditional"],
    internalLinks: [
      "/beginner/orange-county",
      "/beginner/san-diego",
      "/beginner/ventura",
      "/beginner/santa-barbara",
    ],
  },
  {
    path: "/beginner/ventura",
    h1: "Beginner Surf Spots in Ventura",
    titleTerms: ["beginner", "ventura"],
    metaTerms: ["beginner", "ventura"],
    spots: ["Mondos", "Ventura Pier", "C Street"],
    caveats: ["rocks", "crowd etiquette", "Solimar-style reef"],
    internalLinks: [
      "/beginner/los-angeles",
      "/beginner/santa-barbara",
      "/beginner/orange-county",
    ],
  },
  {
    path: "/beginner/santa-barbara",
    h1: "Beginner Surf Spots in Santa Barbara",
    titleTerms: ["beginner", "santa barbara"],
    metaTerms: ["beginner", "santa barbara"],
    spots: ["Refugio", "Mondos", "Leadbetter"],
    caveats: ["Refugio is conditional", "point-wave rotations", "reef/rock"],
    internalLinks: ["/beginner/ventura", "/beginner/los-angeles"],
  },
  {
    path: "/beginner/san-onofre",
    h1: "Beginner Surf Spots in San Onofre",
    titleTerms: ["beginner", "san onofre"],
    metaTerms: ["beginner", "san onofre"],
    spots: ["Old Man's", "San Onofre State Beach", "Middles", "Trails"],
    caveats: ["Bigger south swell", "crowding the main takeoff"],
    internalLinks: [
      "/beginner/orange-county",
      "/beginner/san-diego",
      "/beginner/los-angeles",
    ],
  },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ");
}

async function getMetaDescription(page: Page): Promise<string> {
  return (await page.locator('meta[name="description"]').getAttribute("content")) ?? "";
}

async function getJsonLdTypes(page: Page): Promise<Set<string>> {
  const scripts = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  const types = new Set<string>();

  for (const text of scripts) {
    const data = JSON.parse(text) as { "@type"?: string; itemListElement?: unknown };
    if (typeof data["@type"] === "string") types.add(data["@type"]);
  }

  return types;
}

async function scrollPageToLoadImages(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.max(window.innerHeight * 0.75, 400);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    window.scrollTo(0, 0);
  });
}

async function getBrokenImages(page: Page): Promise<string[]> {
  return page.locator("img").evaluateAll((images) =>
    (images as HTMLImageElement[])
      .filter((image) => !image.complete || image.naturalWidth === 0)
      .map((image) => image.currentSrc || image.src || image.getAttribute("src") || ""),
  );
}

test.describe("Beginner SEO funnel pages", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "Beginner SEO funnel pages",
    });
  });

  for (const route of BEGINNER_ROUTES) {
    test(`${route.path} renders current SEO content, links, and schema`, async ({
      page,
    }) => {
      await page.goto(route.path, { timeout: PAGE_LOAD_TIMEOUT });
      await page.waitForLoadState("load");

      await expect(page.locator(".seo-paper-page")).toBeVisible();
      await expect(
        page.getByRole("heading", { level: 1, name: route.h1 }),
      ).toBeVisible();

      const title = normalizeText(await page.title());
      for (const term of route.titleTerms) {
        expect(title).toContain(term);
      }

      const metaDescription = normalizeText(await getMetaDescription(page));
      for (const term of route.metaTerms) {
        expect(metaDescription).toContain(term);
      }

      for (const spot of route.spots) {
        await expect(page.getByText(spot, { exact: false }).first()).toBeVisible();
      }

      for (const caveat of route.caveats) {
        await expect(
          page.getByText(caveat, { exact: false }).first(),
        ).toBeVisible();
      }

      for (const href of route.internalLinks) {
        await expect(page.locator(`a[href="${href}"]`).first()).toBeVisible();
      }

      const faq = page.locator('section[aria-label^="FAQ about surfing in"]');
      await expect(faq).toBeVisible();
      await expect(faq.getByRole("button")).toHaveCount(4);

      const schemaTypes = await getJsonLdTypes(page);
      expect(Array.from(schemaTypes)).toEqual(
        expect.arrayContaining(["BreadcrumbList", "WebPage", "ItemList"]),
      );
      expect(schemaTypes.has("FAQPage")).toBe(false);

      await scrollPageToLoadImages(page);
      await expect.poll(() => getBrokenImages(page)).toEqual([]);
    });

    test(`${route.path} has sane mobile layout`, async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(route.path, { timeout: PAGE_LOAD_TIMEOUT });
      await page.waitForLoadState("load");

      await expect(
        page.getByRole("heading", { level: 1, name: route.h1 }),
      ).toBeVisible();
      await expect(page.getByRole("heading", { name: "Nearby backup spots" })).toBeVisible();
      await expect(page.locator("img").first()).toBeVisible();

      const horizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(horizontalOverflow).toBeLessThanOrEqual(2);
    });
  }
});
