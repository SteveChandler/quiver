import { expect, test, type Page } from "@playwright/test";

import {
  assertNoErrors,
  type ErrorCapture,
  setupErrorDetection,
} from "./utils/error-detection";

const approvedBeachPath = process.env.SEO_APPROVED_BEACH_PATH;
const approvedEvidence = process.env.SEO_APPROVED_BEACH_EVIDENCE;

function requireApprovedBeachSetting(value: string | undefined, name: string): string {
  if (value) return value;
  throw new Error(`Not implemented: set ${name} for the reviewed beach batch.`);
}

test.describe("Guest beach server-rendered content", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }: { page: Page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }: { page: Page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "guest beach server-rendered content",
    });
  });

  test("includes the beach conditions summary in the initial HTML before hydration", async ({ page }) => {
    const path = requireApprovedBeachSetting(approvedBeachPath, "SEO_APPROVED_BEACH_PATH");
    const evidence = requireApprovedBeachSetting(approvedEvidence, "SEO_APPROVED_BEACH_EVIDENCE");

    const response = await page.request.get(path);
    expect(response.status()).toBe(200);

    const html = await response.text();
    expect(html).toMatch(/<meta name="robots" content="index, follow"\/?\s*>/i);
    expect(html).toContain("Surf report snapshot");
    expect(html).toContain("current conditions and local guidance");
    expect(html).toContain(evidence);
    expect(html).not.toContain("Loading beach details...");

    await page.goto(path, { waitUntil: "load" });
    await expect(page.getByText("Surf report snapshot")).toBeVisible();
  });
});
