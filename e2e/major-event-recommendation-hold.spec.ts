import { test, expect } from "./fixtures/auth-fixture";
import type { Page } from "@playwright/test";
import {
  createMajorEventDiscoveryFixture,
  HOLD_TEST_BEACH_NAME,
  OBJECTIVE_WAVE_HEIGHT,
  type MajorEventHoldFixturePhase,
} from "./fixtures/major-event-recommendation-hold";
import { ensureAuthenticated } from "./utils/test-helpers";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

const DISCOVERY_URL_FRAGMENT = "/api/surf/discover";
const STALE_DISCOVERY_CACHE_KEY = "quiver_discovery_e2e-stale-positive";

// The authenticated user's experience level is loaded through a server action.
// Playwright cannot replace beginner/intermediate profile rows without mutating
// shared auth data or bypassing cohort resolution. Unit and API tests own that
// mapping; this browser test owns the post-resolution explicit-none contract.

async function navigateAndWaitForDiscovery(page: Page): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(DISCOVERY_URL_FRAGMENT) &&
      candidate.status() === 200,
  );
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await response;
}

async function reloadAndWaitForDiscovery(page: Page): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.url().includes(DISCOVERY_URL_FRAGMENT) &&
      candidate.status() === 200,
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await response;
}

async function expectOrdinaryRecommendation(page: Page): Promise<void> {
  const hero = page.locator(
    `section[role="banner"][aria-label="${HOLD_TEST_BEACH_NAME} surf conditions"]`,
  );

  await expect(hero).toBeVisible({ timeout: 20_000 });
  await expect(
    hero.getByLabel(`Wave height ${OBJECTIVE_WAVE_HEIGHT}`),
  ).toBeVisible();
  await expect(hero.getByText("Best time", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Today's Windows" }),
  ).toBeVisible();
}

async function expectExplicitNone(page: Page): Promise<void> {
  await expect(
    page.getByText("Session picks aren't available right now.", {
      exact: true,
    }),
  ).toBeVisible({ timeout: 20_000 });

  await expect(
    page.locator('section[role="banner"][aria-label*="surf conditions"]'),
  ).toHaveCount(0);
  await expect(page.getByText(HOLD_TEST_BEACH_NAME, { exact: true })).toHaveCount(
    0,
  );
  await expect(
    page.getByLabel(`Wave height ${OBJECTIVE_WAVE_HEIGHT}`),
  ).toHaveCount(0);
  await expect(page.getByText("Best time", { exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: /today's windows/i }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: /paddle out|share your session|set alarm|invite a friend/i,
    }),
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
  await expect(
    page.getByText(/low confidence|forecast confidence|confidence score/i),
  ).toHaveCount(0);
  await expect(
    page.getByText("Clean lines are worth the paddle.", { exact: true }),
  ).toHaveCount(0);
}

test.describe("authenticated home major-event recommendation hold", () => {
  let errorCapture: ErrorCapture;
  let phase: MajorEventHoldFixturePhase;
  let servedPhases: MajorEventHoldFixturePhase[];

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
    phase = "available";
    servedPhases = [];

    await page.route("**/api/surf/discover**", async (route) => {
      const requestPhase = phase;
      servedPhases.push(requestPhase);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(createMajorEventDiscoveryFixture(requestPhase)),
      });
    });
    await page.route("**/api/surf/call**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, data: null }),
      });
    });
    await page.route("**/api/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { ok: true, skipped: true, status: "tracking_disabled" },
        }),
      });
    });

    await ensureAuthenticated(page);
  });

  test.afterEach(async ({ page }) => {
    try {
      await assertNoErrors(page, errorCapture, {
        context: "Authenticated home major-event recommendation hold",
      });
    } finally {
      await page.unrouteAll({ behavior: "wait" });
    }
  });

  test("fresh explicit none evicts a prior positive and cancellation restores it", async ({
    page,
  }) => {
    await navigateAndWaitForDiscovery(page);
    await expectOrdinaryRecommendation(page);

    await page.evaluate(
      ({ cacheKey, cachedPositive }) => {
        localStorage.setItem(cacheKey, JSON.stringify(cachedPositive));
      },
      {
        cacheKey: STALE_DISCOVERY_CACHE_KEY,
        cachedPositive: createMajorEventDiscoveryFixture("available"),
      },
    );
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STALE_DISCOVERY_CACHE_KEY),
      )
      .not.toBeNull();

    phase = "held";
    await reloadAndWaitForDiscovery(page);
    await expectExplicitNone(page);
    await expect
      .poll(() =>
        page.evaluate((key) => localStorage.getItem(key), STALE_DISCOVERY_CACHE_KEY),
      )
      .toBeNull();

    phase = "cancelled";
    await reloadAndWaitForDiscovery(page);
    await expectOrdinaryRecommendation(page);

    expect(servedPhases).toEqual(
      expect.arrayContaining(["available", "held", "cancelled"]),
    );
  });
});
