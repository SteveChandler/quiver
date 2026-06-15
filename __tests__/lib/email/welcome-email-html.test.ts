/** @jest-environment node */

import {
  generateWelcomeEmailHtml,
  generateWelcomeEmailText,
} from "@/lib/email/templates/welcome-email-html";

const BASE_URL = "https://quiversurf.app";

describe("welcome-email-html — activation CTA", () => {
  describe("onboarded user (has home beach)", () => {
    const html = generateWelcomeEmailHtml({
      baseUrl: BASE_URL,
      homeBeachName: "Blacks",
      homeBeachUrl: "/ca/san-diego/blacks",
    });

    it("renders a single primary CTA pointing at the beach forecast page", () => {
      expect(html).toContain("Check your Blacks forecast");
      expect(html).toContain(
        `${BASE_URL}/ca/san-diego/blacks?utm_source=email&utm_medium=welcome&utm_campaign=home_beach_set`
      );
      // Exactly one primary button (not duplicated).
      const buttonCount = (html.match(/Check your Blacks forecast/g) ?? []).length;
      expect(buttonCount).toBe(1);
    });

    it("does NOT route to onboarding for an onboarded user", () => {
      expect(html).not.toContain("onboarding=required");
      expect(html).not.toContain("Pick your home beach");
    });

    it("is email-client-safe: table + bgcolor button on brand orange with dark text", () => {
      expect(html).toContain('role="presentation"');
      expect(html).toContain('bgcolor="#F78E42"');
      expect(html).toContain("background-color: #F78E42");
      // Dark (Twilight Navy) button text — not white-on-orange.
      expect(html).toContain("color: #252D6B");
      expect(html).not.toContain("color: #ffffff;");
    });

    it("uses a font stack with sans-serif fallbacks (no bare webfont)", () => {
      expect(html).toContain("sans-serif");
    });
  });

  describe("non-onboarded user (no home beach)", () => {
    const html = generateWelcomeEmailHtml({
      baseUrl: BASE_URL,
      homeBeachName: null,
      homeBeachUrl: null,
    });

    it("renders a single primary CTA pointing at onboarding", () => {
      expect(html).toContain("Pick your home beach");
      expect(html).toContain(
        `${BASE_URL}/?onboarding=required&utm_source=email&utm_medium=welcome&utm_campaign=no_home_beach`
      );
      const buttonCount = (html.match(/Pick your home beach/g) ?? []).length;
      expect(buttonCount).toBe(1);
    });

    it("does NOT route to a beach page for a user without a home beach", () => {
      expect(html).not.toContain("home_beach_set");
      expect(html).not.toContain("Check your");
    });

    it("uses the same bulletproof table button shell", () => {
      expect(html).toContain('bgcolor="#F78E42"');
      expect(html).toContain("color: #252D6B");
    });
  });

  it("falls back to the no-home-beach CTA when only the name is present", () => {
    const html = generateWelcomeEmailHtml({
      baseUrl: BASE_URL,
      homeBeachName: "Blacks",
      homeBeachUrl: null,
    });
    expect(html).toContain("Pick your home beach");
    expect(html).toContain("onboarding=required");
  });

  describe("plain-text variant keeps a matching CTA href", () => {
    it("onboarded text links to the beach page", () => {
      const text = generateWelcomeEmailText({
        baseUrl: BASE_URL,
        homeBeachName: "Blacks",
        homeBeachUrl: "/ca/san-diego/blacks",
      });
      expect(text).toContain("Check your Blacks forecast:");
      expect(text).toContain(`${BASE_URL}/ca/san-diego/blacks?`);
    });

    it("non-onboarded text links to onboarding", () => {
      const text = generateWelcomeEmailText({
        baseUrl: BASE_URL,
        homeBeachName: null,
        homeBeachUrl: null,
      });
      expect(text).toContain("Pick your home beach:");
      expect(text).toContain("onboarding=required");
    });
  });
});
