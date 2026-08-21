/** @jest-environment node */

import { renderToStaticMarkup } from "react-dom/server";

import {
  generateWelcomeEmail,
  WELCOME_EMAIL_SUBJECT,
} from "@/lib/mailer/welcome-email";

const BASE_URL = "https://quiversurf.app";
const CANONICAL_EMAIL_BASE_URL = "https://www.quiversurf.app";
const MESSAGE_ID = "welcome-msg-123";

function countMatches(value: string, pattern: RegExp): number {
  return value.match(pattern)?.length ?? 0;
}

describe("WelcomeEmail", () => {
  describe("onboarded user (has home beach)", () => {
    const email = generateWelcomeEmail({
      baseUrl: BASE_URL,
      homeBeachName: "Blacks",
      homeBeachSlug: "blacks",
      messageInstanceId: MESSAGE_ID,
    });
    const html = renderToStaticMarkup(email.react);

    it("uses the canonical subject and preserves the forecast-first body", () => {
      expect(email.subject).toBe(WELCOME_EMAIL_SUBJECT);
      expect(email.subject).toBe("Your forecast is live");
      expect(html).toContain("Your Blacks forecast is dialed");
      expect(html).toContain("Quiver lays out the window: size, wind, tide, and the red flags");
      expect(html).toContain(
        "Every session you log becomes a day you can compare the next call against."
      );
      expect(html).toContain("— Steven");
    });

    it("renders one attributed CTA to the app-first beach forecast", () => {
      expect(html).toContain("Check your Blacks forecast");
      expect(html).toContain(`${CANONICAL_EMAIL_BASE_URL}/app/spot/blacks?`);
      expect(html).toContain("utm_source=email");
      expect(html).toContain("utm_medium=email");
      expect(html).toContain("utm_campaign=home_beach_set");
      expect(html).toContain("email_type=welcome");
      expect(html).toContain(`message_instance_id=${MESSAGE_ID}`);
      expect(countMatches(html, /Check your Blacks forecast/g)).toBe(1);
      expect(countMatches(html, /<a\b/g)).toBe(1);
    });

    it("does not route an onboarded user to onboarding or a legacy beach path", () => {
      expect(html).not.toContain("onboarding=required");
      expect(html).not.toContain("Pick your home beach");
      expect(html).not.toContain(`${BASE_URL}/ca/san-diego/blacks`);
    });

    it("uses the shared email-safe table button with brand-orange fill and dark text", () => {
      expect(html).toContain('role="presentation"');
      expect(html).toContain('bgcolor="#F78E42"');
      expect(html).toContain("background-color:#F78E42");
      expect(html).toContain("color:#3A1C02");
      expect(html).not.toContain("color:#ffffff");
    });

    it("uses a font stack with sans-serif fallbacks", () => {
      expect(html).toContain("sans-serif");
    });

    it("provides matching attributed plain text", () => {
      expect(email.text).toContain("Your Blacks forecast is dialed");
      expect(email.text).toContain("Check your Blacks forecast:");
      expect(email.text).toContain(
        `${CANONICAL_EMAIL_BASE_URL}/app/spot/blacks?`
      );
      expect(email.text).toContain("utm_campaign=home_beach_set");
      expect(email.text).toContain("email_type=welcome");
      expect(email.text).toContain(`message_instance_id=${MESSAGE_ID}`);
      expect(email.text).toContain("— Steven");
    });
  });

  describe("non-onboarded user (no home beach)", () => {
    const email = generateWelcomeEmail({
      baseUrl: BASE_URL,
      homeBeachName: null,
      homeBeachSlug: null,
      messageInstanceId: MESSAGE_ID,
    });
    const html = renderToStaticMarkup(email.react);

    it("preserves the no-home-beach forecast-first body", () => {
      expect(email.subject).toBe("Your forecast is live");
      expect(html).toContain("Your forecast is live");
      expect(html).toContain(
        "One thing left — pick your home beach so we can dial the forecast to it."
      );
      expect(html).toContain(
        "Once your home break is set, Quiver lays out the window"
      );
      expect(html).toContain("— Steven");
    });

    it("renders one attributed CTA to covered app onboarding", () => {
      expect(html).toContain("Pick your home beach");
      expect(html).toContain(`${CANONICAL_EMAIL_BASE_URL}/app?`);
      expect(html).toContain("onboarding=required");
      expect(html).toContain("utm_source=email");
      expect(html).toContain("utm_medium=email");
      expect(html).toContain("utm_campaign=no_home_beach");
      expect(html).toContain("email_type=welcome");
      expect(html).toContain(`message_instance_id=${MESSAGE_ID}`);
      expect(countMatches(html, /Pick your home beach/g)).toBe(1);
      expect(countMatches(html, /<a\b/g)).toBe(1);
    });

    it("does not route a user without a home beach to a beach page", () => {
      expect(html).not.toContain("home_beach_set");
      expect(html).not.toContain("Check your");
    });

    it("uses the same email-safe brand-orange button with dark text", () => {
      expect(html).toContain('bgcolor="#F78E42"');
      expect(html).toContain("background-color:#F78E42");
      expect(html).toContain("color:#3A1C02");
    });

    it("provides matching attributed plain text", () => {
      expect(email.text).toContain("Your forecast is live");
      expect(email.text).toContain("Pick your home beach:");
      expect(email.text).toContain(`${CANONICAL_EMAIL_BASE_URL}/app?`);
      expect(email.text).toContain("onboarding=required");
      expect(email.text).toContain("utm_campaign=no_home_beach");
      expect(email.text).toContain("email_type=welcome");
      expect(email.text).toContain(`message_instance_id=${MESSAGE_ID}`);
      expect(email.text).toContain("— Steven");
    });
  });

  it("falls back to the no-home-beach variant when only the name is present", () => {
    const email = generateWelcomeEmail({
      baseUrl: BASE_URL,
      homeBeachName: "Blacks",
      homeBeachSlug: null,
      messageInstanceId: MESSAGE_ID,
    });
    const html = renderToStaticMarkup(email.react);

    expect(html).toContain("Pick your home beach");
    expect(html).toContain("onboarding=required");
    expect(html).toContain(`${CANONICAL_EMAIL_BASE_URL}/app?`);
    expect(html).toContain("utm_campaign=no_home_beach");
  });
});
