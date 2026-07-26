/**
 * Android beta landing page validation.
 *
 * @project guest
 */

import { expect, test, type Page, type Route } from "@playwright/test";
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

function requireAndroidBetaPlayUrl(): string {
  if (!ANDROID_BETA_PLAY_URL) {
    throw new Error("Android beta Play URL is required for the handoff test");
  }

  return ANDROID_BETA_PLAY_URL;
}

const REQUIRED_ANDROID_BETA_PLAY_URL = requireAndroidBetaPlayUrl();

async function clickOutboundLinkAndClosePopup(
  page: Page,
  name: RegExp,
): Promise<void> {
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("link", { name }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await popup.close();
}

async function fulfillOutboundDestination(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: "text/html",
    body: "<!doctype html><title>Outbound destination</title>",
  });
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

  test("keeps email optional while preserving the tester and install handoff", async ({
    page,
  }) => {
    const opaqueToken = "A".repeat(43);
    const attributedStoreUrl = `https://play.google.com/store/apps/details?id=app.quiversurf.surf&referrer=${opaqueToken}`;
    const capturedLeadEmails: string[] = [];
    let capturedBrowserSessionId: string | null = null;
    let groupClickTracked = false;
    let playClickTracked = false;
    let installClickTracked = false;
    let issueRequestCount = 0;

    await page.route("**/api/install-attribution/issue", async (route) => {
      const body = route.request().postDataJSON() as Record<string, unknown>;
      expect(body).toEqual({
        source: "android_beta_page",
        surface: "android_beta",
        placement: "direct",
        campaign: "app_first_v1",
      });
      expect(JSON.stringify(body)).not.toMatch(
        /email|user_id|google|native_install_id|latitude|longitude/i,
      );
      issueRequestCount += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          storeUrl: attributedStoreUrl,
          expiresOn: "2026-08-24",
        }),
      });
    });

    await page.route("**/api/android-beta/leads", async (route) => {
      const body = route.request().postDataJSON() as {
        email?: string;
        sessionId?: string;
        source?: string;
        surface?: string;
        placement?: string;
      };
      expect(body.email).toBe("surfer@example.com");
      expect(body.sessionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
      if (!body.sessionId) {
        throw new Error("Android beta lead is missing a browser session ID");
      }
      if (capturedBrowserSessionId) {
        expect(body.sessionId).toBe(capturedBrowserSessionId);
      } else {
        capturedBrowserSessionId = body.sessionId;
      }
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
        sessionId?: string;
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
        expect(body.sessionId).toBe(capturedBrowserSessionId);
        if (body.metadata.destination_type === "google_group") {
          groupClickTracked = true;
        }
        if (body.metadata.destination_type === "google_play") {
          playClickTracked = true;
        }
      }
      if (
        body.eventType === "cta_click" &&
        body.metadata?.cta_family === "android_install"
      ) {
        installClickTracked = true;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
    await page
      .context()
      .route(ANDROID_BETA_GROUP_URL, fulfillOutboundDestination);
    await page
      .context()
      .route(REQUIRED_ANDROID_BETA_PLAY_URL, fulfillOutboundDestination);
    await page.context().route(attributedStoreUrl, fulfillOutboundDestination);

    await page.goto("/android-beta");
    await page.waitForLoadState("load");

    await expect(
      page.getByRole("heading", { name: /join the quiver android beta/i }),
    ).toBeVisible();
    await expect(page.getByText(/personalized surf decisions/i)).toBeVisible();
    await expect(page.getByText(/279\+ beaches/i)).toBeVisible();
    await expect(page.getByText(/shape android quality/i)).toBeVisible();
    await expect(page.getByText(/free year|year of quiver pro/i)).toHaveCount(
      0,
    );
    await expect(
      page.getByRole("link", { name: /join the tester group/i }),
    ).toHaveAttribute("href", ANDROID_BETA_GROUP_URL);
    await expect(
      page.getByRole("link", { name: /2 · opt in on google play/i }),
    ).toHaveAttribute("href", ANDROID_BETA_PLAY_URL ?? "");
    await expect(page.getByTestId("android-beta-qr")).toBeVisible();
    await expect(page.getByTestId("android-beta-qr-locked")).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: /install from google play/i }),
    ).toHaveCount(0);
    expect(issueRequestCount).toBe(0);
    await page
      .getByLabel(/google account email.*optional/i)
      .fill("SURFER@example.com");
    await page
      .getByRole("button", { name: /email me beta instructions/i })
      .click();

    await expect(page.getByRole("status")).toContainText(
      /saved surfer@example\.com/i,
    );
    expect(issueRequestCount).toBe(0);
    await page
      .getByRole("button", { name: /3 · prepare play install link/i })
      .click();
    const installLink = page.getByRole("link", {
      name: /3 · install from google play/i,
    });
    await expect(installLink).toHaveAttribute("href", attributedStoreUrl);
    await clickOutboundLinkAndClosePopup(page, /join the tester group/i);
    await clickOutboundLinkAndClosePopup(
      page,
      /2 · opt in on google play/i,
    );
    await clickOutboundLinkAndClosePopup(page, /3 · install from google play/i);
    await expect(
      page.getByRole("link", {
        name: new RegExp(`email ${ANDROID_BETA_CONTACT_EMAIL}`, "i"),
      }),
    ).toHaveAttribute("href", ANDROID_BETA_CONTACT_MAILTO);
    const qr = page.getByTestId("android-beta-qr");
    await expect(qr).toBeVisible();
    const decodedUrl = new URL((await qr.getAttribute("data-smart-url")) ?? "");
    expect(decodedUrl.pathname).toBe("/app/handoff");
    expect(decodedUrl.searchParams.get("source")).toBe("android_beta_page");
    expect(decodedUrl.searchParams.get("surface")).toBe("android_beta");
    expect(decodedUrl.searchParams.get("qr_id")).toBe(
      "android_beta_instructions",
    );
    expect(decodedUrl.searchParams.get("target")).toBe("android_beta");
    expect(decodedUrl.searchParams.get("utm_source")).toBe("qr");

    await expect(page.getByText(/testflight/i)).toHaveCount(0);
    await expect(page.getByText(/join the ios beta/i)).toHaveCount(0);
    expect(capturedLeadEmails).toEqual(["surfer@example.com"]);
    await expect.poll(() => groupClickTracked).toBe(true);
    await expect.poll(() => playClickTracked).toBe(true);
    await expect.poll(() => installClickTracked).toBe(true);
    expect(issueRequestCount).toBe(1);
  });
});
