/** @jest-environment node */

/**
 * Unit tests for buildConditionsLine in the surf report email template.
 *
 * The conditions row must use the same units and rounding as the live web
 * CURRENT CONDITIONS card so a recipient who taps through doesn't see
 * different numbers from the email summary.
 */

import {
  ConsolidatedAlertEmail,
  buildEmailBeachUrl,
  buildConditionsLine,
  formatEmailHeadingDate,
  formatEmailRuleName,
  formatWindow,
} from "@/lib/mailer/templates/ConsolidatedAlertEmail";
import type { MatchingWindow } from "@/lib/alerts/types";
import { renderToStaticMarkup } from "react-dom/server";

describe("buildConditionsLine", () => {
  it("matches the website's units for today's Mission Beach snapshot", () => {
    // The exact snapshot that produced the 2026-05-03 email the user flagged.
    // Note: 1.1ft renders as "1-2ft" because formatWaveHeightRange uses
    // floor/ceil — same as the website's WaveHeightDisplay component. The web
    // showed "1ft" for the current hour (a different, cleaner 1.0 value);
    // both numbers come from the same formatter applied to different hours.
    const snap = {
      wave_height: 1.1,
      wave_period: 5,
      wave_direction: "W",
      swell_1_period: 5,
      swell_1_direction: 270,
      wind_speed: 4.34488, // knots
      wind_direction_deg: 315, // NW
      tide_height: 1.2,
      tide_status: "Rising",
    };

    const line = buildConditionsLine(snap);

    expect(line).toBe("SWELL 1-2ft @ 5s W · WIND 5 mph NW · TIDE rising");
  });

  it("prefers wave_period + wave_direction over swell_1_* (matches the web Current Conditions card)", () => {
    // wave_* are the total-spectrum fields the website renders; swell_1_*
    // describe the primary swell train and can differ from the dominant total.
    const snap = {
      wave_height: 3.5,
      wave_period: 12,
      wave_direction: "WNW",
      swell_1_period: 8, // ignored — wave_period wins
      swell_1_direction: 270, // ignored — wave_direction wins
    };
    expect(buildConditionsLine(snap)).toContain("3-4ft @ 12s WNW");
  });

  it("falls back to swell_1_period / swell_1_direction when wave_* fields are absent", () => {
    const snap = {
      wave_height: 3.5,
      // no wave_period / wave_direction
      swell_1_period: 8,
      swell_1_direction: 270, // W
    };
    expect(buildConditionsLine(snap)).toContain("3-4ft @ 8s W");
  });

  it("collapses to single-value when wave_height is exactly an integer", () => {
    // What the website's current-hour card shows when wave_height is 1.0.
    const snap = { wave_height: 1.0, wave_period: 5 };
    expect(buildConditionsLine(snap)).toContain("1ft @ 5s");
    expect(buildConditionsLine(snap)).not.toContain("1-1ft");
  });

  it("omits cardinal direction when wind_direction_deg is missing", () => {
    const snap = {
      wave_height: 2,
      wind_speed: 10,
      tide_status: "Falling",
    };
    const line = buildConditionsLine(snap);

    expect(line).toContain("WIND 12 mph"); // 10kt → 11.5mph → rounds to 12
    expect(line).not.toMatch(/mph\s+(N|S|E|W)/);
    expect(line).toContain("TIDE falling");
  });

  it("omits the swell cardinal when neither wave_direction nor swell_1_direction is present", () => {
    const snap = {
      wave_height: 3.5,
      swell_1_period: 12,
      // no wave_direction, no swell_1_direction
    };
    const line = buildConditionsLine(snap);

    expect(line).toContain("3-4ft @ 12s");
    expect(line).not.toMatch(/12s\s+[A-Z]/);
  });

  it("renders 'Flat' when wave_height is 0 (combined surfability gate prevents this in practice)", () => {
    const snap = { wave_height: 0 };
    expect(buildConditionsLine(snap)).toContain("Flat");
  });

  it("returns an empty string when all snapshot fields are missing", () => {
    expect(buildConditionsLine({})).toBe("");
  });

  it("ignores non-finite wind_speed without crashing", () => {
    const snap = {
      wave_height: 2,
      wind_speed: NaN,
      tide_status: "Rising",
    };
    const line = buildConditionsLine(snap);
    expect(line).not.toContain("NaN");
    expect(line).not.toContain("mph");
    expect(line).toContain("TIDE rising");
  });

  it("lowercases tide_status regardless of input casing", () => {
    expect(buildConditionsLine({ tide_status: "RISING" })).toContain(
      "TIDE rising",
    );
    expect(buildConditionsLine({ tide_status: "rising" })).toContain(
      "TIDE rising",
    );
  });

  it("includes beginner alert rationale when the evaluator snapshots it", () => {
    expect(
      buildConditionsLine({
        wave_height: 1.5,
        wind_speed: 4,
        tide_status: "Rising",
        beginner_window_reason:
          "small waves, light wind, morning window, rising tide.",
      }),
    ).toContain("why: small waves, light wind, morning window, rising tide.");
  });
});

function makeMatch(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "rule-1",
    rule_name: "Mellow session",
    beach_id: "beach-1",
    beach_name: "Mission Beach",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-05-06T15:00:00Z",
    window_end: "2026-05-06T16:00:00Z",
    best_hour: "2026-05-06T15:00:00Z",
    best_score: 10,
    conditions_snapshot: {},
    notify_email: true,
    notify_push: true,
    ...overrides,
  };
}

describe("surf report email copy", () => {
  it("uses one message UUID across every forecast CTA", () => {
    const messageInstanceId = "9d1498df-a14f-429a-833d-818bc4864064";
    const html = renderToStaticMarkup(ConsolidatedAlertEmail({
      displayName: "Surfer",
      alertDate: "Wednesday, May 6",
      matches: [
        makeMatch({ rule_id: "rule-1", beach_slug: "mission-beach" }),
        makeMatch({ rule_id: "rule-2", beach_slug: "ocean-beach" }),
      ],
      manageAlertsUrl: "https://www.quiversurf.app/settings",
      unsubscribeUrl: "https://www.quiversurf.app/unsubscribe",
      baseUrl: "https://www.quiversurf.app",
      messageInstanceId,
    }) as any);
    const ctaUrls = [...html.matchAll(/href="([^"]+\/app\/spot\/[^"]+)"/g)]
      .map((match) => new URL(match[1].replaceAll("&amp;", "&")));

    expect(ctaUrls).toHaveLength(2);
    expect(ctaUrls.map((url) => url.searchParams.get("message_instance_id")))
      .toEqual([messageInstanceId, messageInstanceId]);
  });

  it("builds a native-handled beach URL from the public slug", () => {
    const url = new URL(buildEmailBeachUrl(
      "https://www.quiversurf.app",
      makeMatch({ beach_slug: "mission-beach" }),
      "9d1498df-a14f-429a-833d-818bc4864064",
    ));

    expect(url.pathname).toBe("/app/spot/mission-beach");
    expect(url.searchParams.get("window")).toBe("2026-05-06T15:00:00Z");
    expect(url.searchParams.get("utm_source")).toBe("quiver");
    expect(url.searchParams.get("utm_medium")).toBe("email");
    expect(url.searchParams.get("utm_campaign")).toBe("conditions_alert");
    expect(url.searchParams.get("email_type")).toBe("conditions_alert");
    expect(url.searchParams.get("message_instance_id")).toBe(
      "9d1498df-a14f-429a-833d-818bc4864064",
    );
  });

  it("falls back to the beach id when a slug is unavailable", () => {
    expect(new URL(buildEmailBeachUrl(
      "https://www.quiversurf.app",
      makeMatch(),
      "9d1498df-a14f-429a-833d-818bc4864064",
    )).pathname).toBe(
      "/app/spot/beach-1",
    );
  });

  it("removes stale home-break wording from rule names in alert emails", () => {
    expect(formatEmailRuleName("Mellow session at your home break")).toBe(
      "Mellow session",
    );
  });

  it("shortens weekday copy in the heading date", () => {
    expect(formatEmailHeadingDate("Wednesday, May 6")).toBe("Wed, May 6");
  });

  it("renders a one-hour match as a best-around time instead of a short window", () => {
    expect(formatWindow(makeMatch())).toEqual({
      label: "Good Around",
      text: "8:00 AM PDT",
    });
  });

  it("renders longer surf-call matches as a best window with a compact peak note", () => {
    expect(
      formatWindow(
        makeMatch({
          window_end: "2026-05-06T18:00:00Z",
          best_hour: "2026-05-06T16:00:00Z",
        }),
      ),
    ).toEqual({
      label: "Good Window",
      text: "8:00 AM – 11:00 AM PDT · peak 9:00 AM",
    });
  });
});
