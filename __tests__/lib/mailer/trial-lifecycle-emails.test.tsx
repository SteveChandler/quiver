/**
 * Trial-lifecycle email content.
 *
 * These assertions are canon guards as much as unit tests: the charge-date
 * email must always name the date and price, and no stage may reintroduce the
 * learning-loop claim the positioning doc forbids.
 */

import { render } from "@testing-library/react";

import {
  formatTrialDate,
  generateTrialEndedEmail,
  generateTrialEndingEmail,
  generateTrialStartedEmail,
} from "@/lib/mailer/trial-lifecycle-emails";

const BASE = {
  baseUrl: "https://www.quiversurf.app",
  displayName: "Kai",
  beachName: "Blacks Beach",
  beachSlug: "blacks-beach",
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

describe("formatTrialDate", () => {
  it("renders the date in the user's timezone", () => {
    // 2026-09-05T02:00:00Z is still Sept 4 in Los Angeles.
    expect(
      formatTrialDate("2026-09-05T02:00:00.000Z", "America/Los_Angeles")
    ).toBe("Friday, September 4");
  });

  it("falls back to UTC when the timezone is unknown", () => {
    expect(formatTrialDate("2026-09-05T02:00:00.000Z", null)).toBe(
      "Saturday, September 5"
    );
  });

  it("falls back to UTC rather than throwing on a malformed timezone", () => {
    expect(formatTrialDate("2026-09-05T02:00:00.000Z", "Not/AZone")).toBe(
      "Saturday, September 5"
    );
  });
});

describe("generateTrialStartedEmail", () => {
  it("names the beach in the subject and points at the call layer", () => {
    const email = generateTrialStartedEmail(BASE);
    expect(email.subject).toBe("Your first Pro call at Blacks Beach");
    const body = html(email.react);
    expect(body).toContain("Blacks Beach");
    expect(body).toContain("red flags");
  });

  it("keeps the forecast-is-free positioning so the trial is judged on the call", () => {
    const email = generateTrialStartedEmail(BASE);
    expect(email.text).toContain("Other apps charge for the forecast");
    expect(email.text).toContain("Ours is free");
    // Beach-by-beach interpretation is the canon differentiator as of
    // 2026-08-21 — see the honest product promise in the 0-to-100 plan.
    expect(email.text).toContain("beach by beach");
  });

  it("falls back to a generic spot when no home beach is set", () => {
    const email = generateTrialStartedEmail({ ...BASE, beachName: null, beachSlug: null });
    expect(email.subject).toBe("Your first Pro call at your home break");
  });

  it("carries email attribution on the CTA", () => {
    const email = generateTrialStartedEmail(BASE);
    expect(email.text).toContain("utm_campaign=trial_started");
    expect(email.text).toContain("message_instance_id=msg-123");
  });
});

describe("generateTrialEndingEmail", () => {
  const ENDING = {
    ...BASE,
    trialEndsOn: "Friday, September 4",
    chargeOn: "Friday, September 4",
    price: "$4.99/mo",
    manageUrl: "https://www.quiversurf.app/settings",
  };

  it("states the end date, the charge date, and the price", () => {
    const email = generateTrialEndingEmail(ENDING);
    expect(email.subject).toBe("Your trial ends Friday, September 4");
    const body = html(email.react);
    expect(body).toContain("Friday, September 4");
    expect(body).toContain("$4.99/mo");
    expect(body).toMatch(/cancel/i);
  });

  it("states what free actually loses, matching the verified free-tier gate", () => {
    const body = html(generateTrialEndingEmail(ENDING).react);
    // quiver-native/src/lib/free-tier-gate.ts: 2 ranked spots, 2 Week Scout days.
    expect(body).toContain("two ranked spots");
    expect(body).toContain("two days of the week");
  });

  it("does not claim the forecast itself is lost on cancel", () => {
    const body = html(generateTrialEndingEmail(ENDING).react);
    expect(body).toContain("keep the full forecast");
  });
});

describe("generateTrialEndedEmail", () => {
  it("asks the objection question and offers no win-back CTA", () => {
    const email = generateTrialEndedEmail(BASE);
    expect(email.subject).toBe("What would make it worth it?");
    const body = html(email.react);
    expect(body).toMatch(/need to get right for you to keep it/i);
    // The action is a reply. A CTA button here would trade the learning for a
    // discount conversion we cannot learn from.
    expect(body).not.toMatch(/href="[^"]*utm_campaign=trial_ended/);
  });

  it("reassures that the free forecast and session log are intact", () => {
    const body = html(generateTrialEndedEmail(BASE).react);
    expect(body).toContain("session log is untouched");
  });
});

describe("forbidden claims", () => {
  const emails = [
    generateTrialStartedEmail(BASE),
    generateTrialEndingEmail({
      ...BASE,
      trialEndsOn: "Friday, September 4",
      chargeOn: "Friday, September 4",
      price: "$4.99/mo",
      manageUrl: "https://www.quiversurf.app/settings",
    }),
    generateTrialEndedEmail(BASE),
  ];

  it.each(emails.map((e) => [e.subject, e] as const))(
    "%s contains no learning-loop claim",
    (_subject, email) => {
      const surfaces = [email.subject, email.text, html(email.react)];
      for (const surface of surfaces) {
        for (const pattern of FORBIDDEN) {
          expect(surface).not.toMatch(pattern);
        }
      }
    }
  );

  it.each(emails.map((e) => [e.subject, e] as const))(
    "%s uses no emoji in the subject",
    (_subject, email) => {
      expect(email.subject).toMatch(/^[\x20-\x7E]*$/);
    }
  );
});
