import { render } from "@testing-library/react";

import { generateTrialInvitationEmail } from "@/lib/mailer/trial-invitation-email";

const BASE = {
  baseUrl: "https://www.quiversurf.app",
  displayName: "Kai",
  beachName: "Blacks Beach",
  unsubscribeUrl: "https://www.quiversurf.app/unsub",
  messageInstanceId: "msg-123",
};

/** Every phrasing the forbidden-phrase table bans for forecast learning. */
const FORBIDDEN = [
  /sharpen/i,
  /\blearns\b/i,
  /gets smarter/i,
  /trains the forecast/i,
  /calibrat/i,
  /improve our forecast/i,
  /AI-powered/i,
];

function html(react: React.ReactElement): string {
  return render(react).container.innerHTML;
}

describe("generateTrialInvitationEmail", () => {
  it("uses beach-specific and fallback ASCII-only subjects", () => {
    const beachSubject = generateTrialInvitationEmail(BASE).subject;
    const fallbackSubject = generateTrialInvitationEmail({
      ...BASE,
      beachName: null,
    }).subject;

    expect(beachSubject).toBe(
      "Two weeks of Pro at Blacks Beach. Free."
    );
    expect(fallbackSubject).toBe(
      "Two weeks of Pro. Free."
    );
    expect(beachSubject).toMatch(/^[\x20-\x7E]*$/);
    expect(fallbackSubject).toMatch(/^[\x20-\x7E]*$/);
  });

  it("states the price and cancellation timing in the rendered email", () => {
    const body = html(generateTrialInvitationEmail(BASE).react);

    expect(body).toContain("$4.99/mo or $39.99/yr after the trial");
    expect(body).toMatch(/cancel any time/i);
  });

  it("carries the exact campaign CTA sentence and attribution in text", () => {
    const email = generateTrialInvitationEmail(BASE);

    expect(email.text).toContain(
      "Start your free 14-day Quiver Pro trial and find the best window for your next surf:\nhttps://www.quiversurf.app/app?"
    );
    expect(email.text).toContain("utm_campaign=trial_invitation");
  });

  it("uses the app handoff for its only CTA", () => {
    const { container } = render(generateTrialInvitationEmail(BASE).react);
    const cta = Array.from(container.querySelectorAll("a")).find((link) =>
      link.textContent?.includes("Start your free 14-day trial")
    );

    const href = cta?.getAttribute("href");
    expect(href).toMatch(/^https:\/\/www\.quiversurf\.app\/app\?/);
    const url = new URL(href ?? "");
    expect(url.pathname).toBe("/app");
    expect(url.pathname).not.toContain("/spot/");
  });

  it("contains no forbidden product claims", () => {
    const email = generateTrialInvitationEmail(BASE);
    const surfaces = [email.subject, email.text, html(email.react)];

    for (const surface of surfaces) {
      for (const pattern of FORBIDDEN) {
        expect(surface).not.toMatch(pattern);
      }
    }
  });
});
