/**
 * E2E tests for the calibration honesty layer on beach-detail pages.
 *
 * These tests assert the visible behavior of the wave-height honesty layer
 * (`components/ui/wave-height-display.tsx`) at calibrated and uncalibrated
 * beaches. They were previously misfiled inside `forecast-regional.spec.ts`
 * — the assertions hit beach-detail URLs (`/ca/san-diego/blacks`,
 * `/ca/bolinas/bolinas-bolinas-ca`, etc.), not regional forecast pages.
 *
 * Contract under test:
 * - **Calibrated beach path**: the page renders the calibrated "Face height"
 *   label and does not show uncalibrated honesty copy.
 * - **Uncalibrated beach**: tilde prefix, dotted underline, "Forecast height"
 *   label, and tooltip with the exact honesty copy.
 *
 * @project auth
 */

import type { Page } from "@playwright/test";
import { test, expect } from "./fixtures/auth-fixture";
import { dismissOnboardingWizard } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";
import { ensureLocalBeachForecastFixture } from "./utils/local-supabase-fixtures";
import { TEST_BEACHES, TIMEOUTS } from "./fixtures/test-data";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";

test.describe("calibration honesty layer @requires-data", () => {
  test.describe.configure({ mode: "serial" });

  // Exact copy from marketing spec (docs/marketing/calibration-launch-copy.md).
  // Any drift in the tooltip string should fail the assertion — this is
  // the whole point of the honesty layer.
  const UNCALIBRATED_TOOLTIP =
    "Buoy forecast. Haven't surfed this one enough to call face height.";

  // Beach fixtures: calibrated anchors have shoaling_factors populated; the
  // uncalibrated anchor has current local forecast rows and null factors.
  const CALIBRATED_BLACKS_PATH = buildBeachUrl(TEST_BEACHES.blacks);
  const CALIBRATED_LA_JOLLA_SHORES = {
    slug: "la-jolla-shores",
    city: "La Jolla",
    state: "CA",
    country: "USA",
  };
  const UNCALIBRATED_ASILOMAR = {
    slug: "asilomar-state-beach-pacific-grove-ca",
    city: "Pacific Grove",
    state: "CA",
    country: "USA",
  };
  const UNCALIBRATED_DISPLAY_PATH = buildBeachUrl(UNCALIBRATED_ASILOMAR);
  const SECOND_CALIBRATED_DISPLAY_PATH = `/ca/la-jolla/${CALIBRATED_LA_JOLLA_SHORES.slug}`;

  const MOBILE_VIEWPORT = { width: 375, height: 667 };
  const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

  let errorCapture: ErrorCapture;
  const cleanupFixtures: Array<() => Promise<void>> = [];

  test.beforeAll(async () => {
    cleanupFixtures.push(await ensureLocalBeachForecastFixture({
      dataSource: "e2e_calibration_fixture",
      forceUncalibrated: true,
      slug: UNCALIBRATED_ASILOMAR.slug,
    }));
    cleanupFixtures.push(await ensureLocalBeachForecastFixture({
      dataSource: "cdip_sig",
      slug: "blacks",
    }));
  });

  test.afterAll(async () => {
    for (const cleanup of cleanupFixtures.reverse()) {
      await cleanup();
    }
  });

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "calibration honesty layer",
    });
  });

  // Scoped locator: the numeric span inside the primary wave-height display.
  // The component renders face-height digits inside a child <span>, and the
  // testid is on the outer wrapper. Using `.locator("span").first()` gives us
  // the dotted-underline span for class assertions.
  const forecastPanel = (page: Page) =>
    page.getByRole("tabpanel", { name: /forecast/i }).first();
  const primaryWaveHeight = (page: Page) =>
    forecastPanel(page).locator('[data-testid="primary-wave-height"]').first();
  const faceHeightLabel = (page: Page) =>
    primaryWaveHeight(page).locator("xpath=..").getByText(/Face height/i).first();
  const forecastHeightLabel = (page: Page) =>
    primaryWaveHeight(page).locator("xpath=..").getByText(/Forecast height/i).first();
  const uncalibratedTooltip = (page: Page) =>
    page.locator('[role="tooltip"]').filter({
      hasText: UNCALIBRATED_TOOLTIP,
    });

  async function openForecastTab(page: Page, path: string): Promise<void> {
    await page.goto(path, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUTS.long,
    });
    await dismissOnboardingWizard(page);

    const forecastTab = page.getByRole("tab", { name: /^Forecast$/i });
    await expect(forecastTab).toBeVisible({ timeout: TIMEOUTS.long });
    if ((await forecastTab.getAttribute("aria-selected")) !== "true") {
      await forecastTab.click();
    }

    await expect(page.getByRole("tabpanel", { name: /forecast/i })).toBeVisible({
      timeout: TIMEOUTS.long,
    });
  }

  test("calibrated beach (Blacks) on desktop renders an honesty label", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, CALIBRATED_BLACKS_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    await expect(faceHeightLabel(page)).toBeVisible();
    await expect(forecastHeightLabel(page)).not.toBeVisible();
  });

  test("calibrated beach (Blacks) on mobile renders an honesty label", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openForecastTab(page, CALIBRATED_BLACKS_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    await expect(faceHeightLabel(page)).toBeVisible();
    await expect(forecastHeightLabel(page)).not.toBeVisible();
  });

  test("uncalibrated beach on desktop shows tilde and Forecast height label", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, UNCALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    const text = (await waveHeight.innerText()).trim();
    expect(text).toContain("~");

    await expect(forecastHeightLabel(page)).toBeVisible();
  });

  test("uncalibrated beach on mobile shows tilde and Forecast height label", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openForecastTab(page, UNCALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    const text = (await waveHeight.innerText()).trim();
    expect(text).toContain("~");

    await expect(forecastHeightLabel(page)).toBeVisible();
  });

  test("uncalibrated beach renders dotted-underline class on numeric span", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, UNCALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    // The uncalibrated render wraps digits in a span with
    // `border-b border-dotted border-muted-foreground/60`. Prefer asserting
    // on `border-dotted` — it's the stable marker across Tailwind versions.
    const dottedSpan = waveHeight.locator("span.border-dotted").first();
    await expect(dottedSpan).toBeVisible();
  });

  test("tooltip content appears on hover at uncalibrated beach (desktop)", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, UNCALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    await waveHeight.locator("span.border-dotted").first().hover();

    // Radix renders tooltip content in a portal with role="tooltip".
    const tooltip = uncalibratedTooltip(page);
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test("tooltip content appears on tap at uncalibrated beach (mobile)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await openForecastTab(page, UNCALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    // Radix tooltip listens for hover/focus, not raw tap. On a mobile viewport
    // Playwright's .hover() still synthesizes the mouseover sequence that
    // Radix observes — and matches what the component supports in production
    // (mobile users tap to focus, which fires focusin -> tooltip open).
    await waveHeight.locator("span.border-dotted").first().hover();

    const tooltip = uncalibratedTooltip(page);
    // Mobile portal latency is higher than desktop hover; use medium timeout.
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test("calibrated beach path renders an honesty label on hover", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, CALIBRATED_BLACKS_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    await waveHeight.hover();

    await expect(faceHeightLabel(page)).toBeVisible();
    await expect(uncalibratedTooltip(page)).not.toBeVisible();
  });

  test("second calibrated beach (La Jolla Shores) sanity check on desktop", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await openForecastTab(page, SECOND_CALIBRATED_DISPLAY_PATH);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.veryLong });

    await expect(faceHeightLabel(page)).toBeVisible();
    await expect(forecastHeightLabel(page)).not.toBeVisible();
  });
});
