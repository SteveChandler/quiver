/**
 * Android beta landing page validation.
 *
 * @project guest
 */

import { expect, test, type Page } from "@playwright/test";
import {
  ANDROID_BETA_CONTACT_EMAIL,
  ANDROID_BETA_CONTACT_MAILTO,
  ANDROID_BETA_GROUP_URL,
  ANDROID_BETA_PLAY_URL,
} from "@/lib/constants/app-store";
import {
  assertNoErrors,
  setupErrorDetection,
  type ErrorCapture,
} from "./utils/error-detection";

test.use({ storageState: { cookies: [], origins: [] } });

async function clickOutboundLinkAndClosePopup(
  page: Page,
  name: RegExp,
): Promise<void> {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name }).click();
  const popup = await popupPromise;
  await popup.close();
}

test.describe("Android beta page", () => {
  let errorCapture: ErrorCapture;

  test.beforeEach(async ({ page }) => {
    errorCapture = setupErrorDetection(page);
  });

  test.afterEach(async ({ page }) => {
    await assertNoErrors(page, errorCapture, {
      context: "android beta page",
    });
  });

  test("keeps beta access ungated and confirms optional email capture", async ({
    page,
  }) => {
    const capturedLeadEmails: string[] = [];
    let groupClickTracked = false;
    let playClickTracked = false;

    await page.route("**/api/android-beta/leads", async (route) => {
      const body = route.request().postDataJSON() as {
        email?: string;
        source?: string;
        surface?: string;
        placement?: string;
      };
      expect(body.email).toMatch(/^(surfer|corrected)@example\.com$/);
      expect(body.source).toBe("android_beta_page");
      expect(body.surface).toBe("android_beta");
      expect(body.placement).toBe("hero_email_capture");
      capturedLeadEmails.push(body.email ?? "");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ success: true, emailSent: true }),
      });
    });
    await page.route("**/api/events", async (route) => {
      const body = route.request().postDataJSON() as {
        eventType?: string;
        metadata?: {
          cta_family?: string;
          destination_type?: string;
          source?: string;
        };
      };
      if (
        body.eventType === "cta_click" &&
        body.metadata?.cta_family === "android_waitlist" &&
        body.metadata.source === "android_beta_page"
      ) {
        if (body.metadata.destination_type === "google_group") {
          groupClickTracked = true;
        }
        if (body.metadata.destination_type === "google_play") {
          playClickTracked = true;
        }
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto("/android-beta");
    await page.waitForLoadState("load");

    await expect(
      page.getByRole("heading", { name: /join the quiver android beta/i }),
    ).toBeVisible();
    await expect(page.getByText(/personalized surf decisions/i)).toBeVisible();
    await expect(page.getByText(/279\+ beaches/i)).toBeVisible();
    await expect(page.getByText(/shape android quality/i)).toBeVisible();
    await expect(page.getByText(/free year|year of quiver pro/i)).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /join the tester group/i }),
    ).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    await expect(
      page.getByRole("link", { name: /already joined.*open google play/i }),
    ).toHaveAttribute("href", ANDROID_BETA_PLAY_URL ?? "");
    await clickOutboundLinkAndClosePopup(page, /join the tester group/i);
    await clickOutboundLinkAndClosePopup(
      page,
      /already joined.*open google play/i,
    );
    await page
      .getByLabel(/email is optional/i)
      .fill("SURFER@example.com");
    await page.getByRole("button", { name: /send me beta updates/i }).click();

    await expect(page.getByRole("status")).toContainText(
      /saved surfer@example\.com/i,
    );
    await page.getByRole("button", { name: /use a different email/i }).click();
    await expect(
      page.getByRole("link", { name: /join the tester group/i }),
    ).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    await page
      .getByLabel(/email is optional/i)
      .fill("corrected@example.com");
    await page.getByRole("button", { name: /send me beta updates/i }).click();
    await expect(page.getByRole("status")).toContainText(
      /saved corrected@example\.com/i,
    );
    await expect(
      page.getByRole("link", { name: /join the tester group/i }),
    ).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    await expect(
      page.getByRole("link", { name: /already joined.*open google play/i }),
    ).toHaveAttribute("href", ANDROID_BETA_PLAY_URL ?? "");
    await expect(
      page.getByRole("link", {
        name: new RegExp(`email ${ANDROID_BETA_CONTACT_EMAIL}`, "i"),
      }),
    ).toHaveAttribute("href", ANDROID_BETA_CONTACT_MAILTO);
    const qr = page.getByTestId("android-beta-qr");
    await expect(qr).toBeVisible();
    const decodedUrl = new URL((await qr.getAttribute("data-smart-url")) ?? "");
    expect(decodedUrl.pathname).toBe("/app");
    expect(decodedUrl.searchParams.get("source")).toBe("android_beta_page");
    expect(decodedUrl.searchParams.get("surface")).toBe("android_beta");
    expect(decodedUrl.searchParams.get("qr_id")).toBe(
      "android_beta_instructions",
    );
    expect(decodedUrl.searchParams.get("target")).toBe("android_beta");
    expect(decodedUrl.searchParams.get("utm_source")).toBe("qr");

    await expect(page.getByText(/testflight/i)).toHaveCount(0);
    await expect(page.getByText(/join the ios beta/i)).toHaveCount(0);
    expect(capturedLeadEmails).toEqual([
      "surfer@example.com",
      "corrected@example.com",
    ]);
    await expect.poll(() => groupClickTracked).toBe(true);
    await expect.poll(() => playClickTracked).toBe(true);
  });
});
