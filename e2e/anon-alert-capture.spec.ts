import { test, expect } from "@playwright/test";
import { setupErrorDetection, assertNoErrors, ErrorCapture } from "./utils/error-detection";

test.describe("Anonymous alert capture on beach detail", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);

    // Mock the anon-capture endpoint — local DB is unavailable on this branch
    // (mocked-Supabase pivot; see plan amendment).
    await page.route("**/api/alerts/anon-capture", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true }),
      });
    });

    // Swallow event tracking — fire-and-forget on the server, but the
    // client still POSTs view/error events.
    await page.route("**/api/events", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture);
  });

  test("anonymous user submits the form and sees the check-your-email confirmation", async ({ page }) => {
    // Spec runs in the [auth] project, but `AnonAlertCaptureForm` is
    // self-gated to `!user` in `components/beach-detail.tsx:1187`. Clear
    // cookies so the form actually mounts.
    await page.context().clearCookies();

    // Use a known beach in the seeded test DB. The anon form mounts at the
    // bottom of beach-detail.
    await page.goto("/ca/san-diego/blacks");
    await page.waitForLoadState("load");

    // The form's email input should be visible. Test-id from Task 19 form.
    const emailInput = page.getByTestId("anon-alert-capture-email");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });

    const email = `playwright-${Date.now()}@example.com`;
    await emailInput.fill(email);

    // Capture the network call to /api/alerts/anon-capture so we can assert
    // the body shape.
    const captureRequest = page.waitForRequest(
      (req) => req.url().endsWith("/api/alerts/anon-capture") && req.method() === "POST",
    );
    await page.getByTestId("anon-alert-capture-submit").click();
    const req = await captureRequest;

    const body = JSON.parse(req.postData() ?? "{}");
    expect(body).toEqual(
      expect.objectContaining({
        email,
        preset_type: expect.stringMatching(/^(glass_off|big_day|mellow_session)$/),
        return_path: expect.stringContaining("/ca/san-diego/blacks"),
        beach_id: expect.stringMatching(/^[0-9a-f]{8}-[0-9a-f]{4}/),
      }),
    );

    // Confirm the success state renders.
    const success = page.getByTestId("anon-alert-capture-success");
    await expect(success).toBeVisible();
    await expect(success).toContainText(email);
  });
});
