import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, gotoWithErrorCheck } from "./utils/error-detection";
import { dismissPreferencesAnnouncementIfPresent } from "./utils/test-helpers";

/**
 * Authenticated HomeScreen Performance Baseline (Local Dev)
 *
 * Goals:
 * - Capture a repeatable baseline for initial HomeScreen load
 * - Identify slow/critical-path network requests during initial render
 *
 * Notes:
 * - This is intentionally lenient (dev servers are slow); tighten after improvements.
 * - Avoids `waitForLoadState("networkidle")` for timing assertions, since HomeScreen
 *   can include subscriptions/long-polling.
 *
 * @project auth
 */

type RequestMetric = {
  url: string;
  startMs: number;
  endMs: number;
  durationMs: number;
  status?: number;
};

function nowMs(): number {
  return Date.now();
}

function isTrackedUrl(url: string): boolean {
  return (
    url.includes("/api/forecasts/update-enhanced") ||
    url.includes("/api/surf/discover") ||
    url.includes("/api/surf/insights") ||
    url.includes("/api/intel") ||
    url.includes("/api/session-planner/invitations")
  );
}

test.describe("Authenticated HomeScreen - Performance Baseline", () => {
  test("should load authenticated home with reasonable initial timings", async ({ page }) => {
    const errorCapture = setupErrorDetection(page);

    const requestStarts = new Map<string, number>();
    const tracked: RequestMetric[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (!isTrackedUrl(url)) return;
      requestStarts.set(url, nowMs());
    });

    page.on("response", async (res) => {
      const url = res.url();
      if (!isTrackedUrl(url)) return;
      const startMs = requestStarts.get(url);
      if (!startMs) return;
      const endMs = nowMs();
      tracked.push({
        url,
        startMs,
        endMs,
        durationMs: endMs - startMs,
        status: res.status(),
      });
      requestStarts.delete(url);
    });

    const navStart = nowMs();
    await gotoWithErrorCheck(page, errorCapture, "/");

    // PreferencesAnnouncementDialog can block interaction; dismiss if present.
    await dismissPreferencesAnnouncementIfPresent(page).catch(() => {});

    // 1) Time to greeting (perceived app readiness)
    const greeting = page.getByRole("heading", { name: /hey,/i });
    await expect(greeting).toBeVisible({ timeout: 30_000 });
    const timeToGreeting = nowMs() - navStart;

    // 2) Forecast tab skeleton/container should be visible
    const forecastTab = page.getByTestId("forecast-tab");
    await expect(forecastTab).toBeVisible({ timeout: 30_000 });
    const timeToForecastTabVisible = nowMs() - navStart;

    // 3) Search input should be interactive quickly
    const searchInput = page.getByPlaceholder(/search by beach/i).first();
    await expect(searchInput).toBeVisible({ timeout: 30_000 });
    await searchInput.fill("O");
    await expect(searchInput).toHaveValue("O");
    const timeToSearchInteractive = nowMs() - navStart;

    // Log summary for baseline tracking
    const slowest = [...tracked]
      .sort((a, b) => b.durationMs - a.durationMs)
      .slice(0, 8);

    console.log("\n[HomeScreen Perf Baseline]");
    console.log(`timeToGreetingMs=${timeToGreeting}`);
    console.log(`timeToForecastTabVisibleMs=${timeToForecastTabVisible}`);
    console.log(`timeToSearchInteractiveMs=${timeToSearchInteractive}`);
    console.log(`trackedRequests=${tracked.length}`);
    console.log(
      `slowestRequests=${slowest
        .map((r) => `${r.durationMs}ms ${r.status ?? "?"} ${r.url}`)
        .join(" | ")}`
    );

    // Dev-realistic budgets (intentionally lenient)
    expect(timeToGreeting).toBeLessThan(15_000);
    expect(timeToSearchInteractive).toBeLessThan(20_000);

    await assertNoErrors(page, errorCapture, {
      context: "Authenticated HomeScreen perf baseline",
    });
  });
});


