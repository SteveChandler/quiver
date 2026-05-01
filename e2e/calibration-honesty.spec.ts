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
 * - **Calibrated beach** (`beaches.shoaling_factors IS NOT NULL`): the
 *   "Face height" label appears on the page, and the uncalibrated tooltip
 *   copy never renders. Note: the hero (`unified-surf-card`) uses
 *   per-reading `surfCall.isCalibrated` (`source === 'cdip_sig' && shoaling_factors`),
 *   so on tiny-wave days when the source downgrades, the hero may still
 *   render the tilde even at calibrated beaches. The beach-level contract
 *   we assert on is the "Face height" label (rendered by forecast-tab from
 *   `beach.shoaling_factors != null`).
 * - **Uncalibrated beach**: tilde prefix, dotted underline, "Forecast height"
 *   label, and tooltip with the exact honesty copy.
 *
 * @project auth
 */

import { test, expect } from "@playwright/test";
import { dismissOnboardingWizard } from "./utils/test-helpers";
import {
  setupErrorDetection,
  assertNoErrors,
  type ErrorCapture,
} from "./utils/error-detection";
import { TIMEOUTS } from "./fixtures/test-data";

test.describe("calibration honesty layer", () => {
  // Exact copy from marketing spec (docs/marketing/calibration-launch-copy.md).
  // Any drift in the tooltip string should fail the assertion — this is
  // the whole point of the honesty layer.
  const UNCALIBRATED_TOOLTIP =
    "Buoy forecast. Haven't surfed this one enough to call face height.";

  // Beach fixtures: two calibrated anchors (shoaling_factors populated) and
  // two uncalibrated. Verified on production DB on the calibration-honesty
  // branch and re-verified 2026-04-30.
  const CALIBRATED_BLACKS = {
    slug: "blacks",
    city: "San Diego",
    state: "CA",
    country: "USA",
  };
  const CALIBRATED_LA_JOLLA_SHORES = {
    slug: "la-jolla-shores",
    city: "La Jolla",
    state: "CA",
    country: "USA",
  };
  const UNCALIBRATED_BOLINAS = {
    slug: "bolinas-bolinas-ca",
    city: "Bolinas",
    state: "CA",
    country: "USA",
  };
  const UNCALIBRATED_COCOA = {
    slug: "cocoa-beach-pier-cocoa-beach-fl",
    city: "Cocoa Beach",
    state: "FL",
    country: "USA",
  };

  const MOBILE_VIEWPORT = { width: 375, height: 667 };
  const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

  let errorCapture: ErrorCapture;

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
  const primaryWaveHeight = (page: import("@playwright/test").Page) =>
    page.locator('[data-testid="primary-wave-height"]').first();

  test("calibrated beach (Blacks) on desktop renders Face height label", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/ca/san-diego/${CALIBRATED_BLACKS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    // Beach-level calibration contract: forecast-tab renders the "Face height"
    // label from `beach.shoaling_factors != null`, regardless of per-reading
    // source. The hero may still show ~ on tiny-wave days when source
    // downgrades off cdip_sig — that's per-reading honesty, not a regression.
    await expect(page.getByText(/Face height/i).first()).toBeVisible();
  });

  test("calibrated beach (Blacks) on mobile renders Face height label", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`/ca/san-diego/${CALIBRATED_BLACKS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    await expect(page.getByText(/Face height/i).first()).toBeVisible();
  });

  test("uncalibrated beach (Bolinas) on desktop shows tilde and Forecast height label", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/ca/bolinas/${UNCALIBRATED_BOLINAS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    const text = (await waveHeight.innerText()).trim();
    expect(text).toContain("~");

    await expect(page.getByText(/Forecast height/i).first()).toBeVisible();
  });

  test("uncalibrated beach (Bolinas) on mobile shows tilde and Forecast height label", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`/ca/bolinas/${UNCALIBRATED_BOLINAS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    const text = (await waveHeight.innerText()).trim();
    expect(text).toContain("~");

    await expect(page.getByText(/Forecast height/i).first()).toBeVisible();
  });

  test("uncalibrated beach renders dotted-underline class on numeric span", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/ca/bolinas/${UNCALIBRATED_BOLINAS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

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
    await page.goto(`/ca/bolinas/${UNCALIBRATED_BOLINAS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    await waveHeight.hover();

    // Radix renders tooltip content in a portal with role="tooltip".
    const tooltip = page.getByRole("tooltip", {
      name: UNCALIBRATED_TOOLTIP,
    });
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.short });
  });

  test("tooltip content appears on tap at uncalibrated beach (mobile)", async ({
    page,
  }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`/ca/bolinas/${UNCALIBRATED_BOLINAS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    // Radix tooltip listens for hover/focus, not raw tap. On a mobile viewport
    // Playwright's .hover() still synthesizes the mouseover sequence that
    // Radix observes — and matches what the component supports in production
    // (mobile users tap to focus, which fires focusin -> tooltip open).
    await waveHeight.hover();

    const tooltip = page.getByRole("tooltip", {
      name: UNCALIBRATED_TOOLTIP,
    });
    // Mobile portal latency is higher than desktop hover; use medium timeout.
    await expect(tooltip).toBeVisible({ timeout: TIMEOUTS.medium });
  });

  test("calibrated beach does NOT show uncalibrated tooltip copy on hover", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/ca/san-diego/${CALIBRATED_BLACKS.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    await waveHeight.hover();

    // The uncalibrated tooltip string must NOT appear at a calibrated beach.
    // Any other tooltip (e.g. swell breakdown) is fine — we only assert on
    // the honesty-layer copy's absence.
    const uncalibratedTooltip = page.getByRole("tooltip", {
      name: UNCALIBRATED_TOOLTIP,
    });
    await expect(uncalibratedTooltip).toHaveCount(0);
  });

  test("second calibrated beach (La Jolla Shores) sanity check on desktop", async ({
    page,
  }) => {
    await page.setViewportSize(DESKTOP_VIEWPORT);
    await page.goto(`/ca/la-jolla/${CALIBRATED_LA_JOLLA_SHORES.slug}`);
    await page.waitForLoadState("load");
    await dismissOnboardingWizard(page);

    const waveHeight = primaryWaveHeight(page);
    await expect(waveHeight).toBeVisible({ timeout: TIMEOUTS.medium });

    await expect(page.getByText(/Face height/i).first()).toBeVisible();
  });
});
