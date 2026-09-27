/**
 * @jest-environment node
 *
 * Brand voice guard for alert, push and condition copy: chill, reliable,
 * smart. No hype words, no exclamation marks, no emoji. Stored ids, keys and
 * enum values (e.g. the epic_conditions preset type) are not copy and are not
 * checked. A surfer's own words (session ratings, report vibes) are theirs.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import titlePool from "@/lib/notifications/copy/surf-titles.v1.json";
import {
  renderTemplate,
  SWELL_TAG_PRIORITY,
  TITLE_MAX_CHARS,
} from "@/lib/notifications/copy/select-title";
import { PRESETS } from "@/lib/alerts/presets";
import { formatPushNotification, qualityWord } from "@/lib/alerts/push-formatter";
import { buildConsolidatedSubject } from "@/lib/alerts/consolidated-subject";
import { ConditionsAlertEmail } from "@/lib/mailer/templates/ConditionsAlertEmail";
import type { MatchingWindow } from "@/lib/alerts/types";
import { getOracleGreeting } from "@/lib/oracle/greeting";
import { swellMatchShareText } from "@/lib/analyzers/swell-analyzer";
import { AnonAlertCaptureForm } from "@/components/alerts/anon-alert-capture-form";

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null, isLoading: false }),
}));

const HYPE = /\b(?:epic|firing|pumping|sick|perfect|insane|stoked|dialed)\b|going off|don['’]t (?:miss|sleep on)|main-character/i;
const EMOJI = /\p{Extended_Pictographic}/u;

/** Every piece of copy that breaks the voice rule, so a failure names it. */
function loud(copies: string[]): string[] {
  return copies.filter((copy) => HYPE.test(copy) || copy.includes("!") || EMOJI.test(copy));
}

const VARS = {
  beach: "Blacks",
  window: "6–8 AM",
  lead: "",
  swell: "4–5 ft at 14s SW",
  wind: "offshore wind",
  limit: "Best before 8 AM.",
  beach1: "Blacks",
  beach2: "Scripps",
  beach3: "Osprey",
  dir: "SW",
  size: "4ft",
  period: "14s",
  peak_day: "Wed",
  peak_part: "AM",
  rarity: "Best in 30 days",
};

function match(overrides: Partial<MatchingWindow> = {}): MatchingWindow {
  return {
    rule_id: "r1",
    rule_name: "Glass-Off",
    beach_id: "b1",
    beach_name: "Blacks Beach",
    beach_timezone: "America/Los_Angeles",
    window_start: "2026-04-01T14:00:00Z",
    window_end: "2026-04-01T17:00:00Z",
    best_hour: "2026-04-01T15:30:00Z",
    best_score: 0.8,
    conditions_snapshot: { wave_height: 4, swell_1_period: 14, wind_speed: 5 },
    notify_email: true,
    notify_push: true,
    ...overrides,
  };
}

describe("push title pool voice", () => {
  const entries = [...titlePool.daily, ...titlePool.swell];

  it("has no hype, exclamation marks or emoji in any title or body", () => {
    expect(loud(entries.flatMap((entry) => [entry.title, entry.body]))).toEqual([]);
  });

  it("renders every title within the character limit for a short beach name", () => {
    for (const entry of entries) {
      expect([...renderTemplate(entry.title, VARS)].length).toBeLessThanOrEqual(TITLE_MAX_CHARS);
    }
  });

  it("keeps at least one title for every tag the selector ranks", () => {
    for (const tag of SWELL_TAG_PRIORITY) {
      expect(titlePool.swell.some((entry) => entry.tags.includes(tag))).toBe(true);
    }
    for (const tag of ["tide-driven", "wind-driven", "early", "afternoon", "home-beach", "not-home", "live", "generic"]) {
      expect(titlePool.daily.some((entry) => entry.tags.includes(tag))).toBe(true);
    }
  });
});

describe("alert copy voice", () => {
  it("keeps preset names, descriptions and summaries calm", () => {
    expect(loud(PRESETS.flatMap((preset) => [preset.name, preset.description, preset.conditionsSummary])))
      .toEqual([]);
  });

  it("keeps push titles and email subjects calm at every quality and verdict", () => {
    const copies = [0.1, 0.35, 0.5, 0.75, 0.92, Number.NaN].flatMap((score) => [
      qualityWord(score),
      ...([undefined, "go", "maybe", "no"] as const).map((decision) => (
        formatPushNotification([match({ best_score: score })], decision).title
      )),
      buildConsolidatedSubject([match({ best_score: score })], "Saturday, April 4"),
    ]);
    copies.push(buildConsolidatedSubject(
      [match(), match({ beach_name: "Swamis", best_score: 0.9 })],
      "Saturday, April 4",
    ));
    expect(loud(copies)).toEqual([]);
  });

  it.each(["go", "maybe"] as const)("keeps the %s conditions alert email calm", (decisionVerdict) => {
    const html = renderToStaticMarkup(ConditionsAlertEmail({
      beachName: "Ocean Beach",
      decisionVerdict,
      surfDescription: "3-4 ft",
      windDescription: "Light offshore",
      tideDescription: "2.1 ft, incoming",
      bestWindow: { start: "7:00 AM", end: "9:00 AM" },
      dateline: "FRI · JUN 13",
      signals: {
        ripRisk: "moderate",
        rideableWavesPerHour: 18,
        setIntervalSeconds: 90,
        waveFrequencyConfidence: "high",
        forecastConfidence: 82,
        conditionCharacter: null,
        waterQuality: "advisory",
      },
      why: { whyText: ["NW swell inside this spot's window."], crowdWarning: null },
      ctaUrl: "https://quiversurf.app/surf/sf/ocean-beach",
      manageUrl: "https://quiversurf.app/settings",
      unsubscribeUrl: "https://quiversurf.app/settings",
    }) as Parameters<typeof renderToStaticMarkup>[0]);
    const text = html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ");

    expect(loud([text])).toEqual([]);
  });
});

describe("condition and greeting copy voice", () => {
  it("keeps every condition-character label calm", () => {
    const source = readFileSync(
      path.join(process.cwd(), "lib/domains/scoring/condition-character.ts"),
      "utf8",
    );
    const labels = [...source.matchAll(/label:\s*(['"])(.*?)\1/g)].map((found) => found[2]);

    expect(labels.length).toBeGreaterThanOrEqual(10);
    expect(loud(labels)).toEqual([]);
  });

  it("keeps every Oracle greeting branch calm", () => {
    const greetings: string[] = [];
    for (const score of [null, 1, 5, 8]) {
      for (const hour of [4, 6, 9, 14, 20]) {
        for (const swellPeriod of [null, 10, 14]) {
          for (const windCondition of [null, "onshore", "offshore"]) {
            for (const beachName of [null, "Blacks"]) {
              for (const daysAbsent of [0, 5]) {
                greetings.push(getOracleGreeting({
                  score, hour, swellPeriod, windCondition, userName: "Alex", beachName, daysAbsent,
                }));
              }
            }
          }
        }
      }
    }

    expect(loud([...new Set(greetings)])).toEqual([]);
  });

  it("keeps the swell analyzer share text calm", () => {
    expect(loud((["optimal", "acceptable", "poor"] as const).map((status) => (
      swellMatchShareText(status, "Blacks")
    )))).toEqual([]);
  });

  it("keeps the alert signup form calm", () => {
    const html = renderToStaticMarkup(createElement(AnonAlertCaptureForm, {
      beachId: "b1",
      beachName: "Ocean Beach",
      returnPath: "/beaches/ocean-beach",
    }));

    expect(html).toContain("Email me when Ocean Beach is worth a surf");
    expect(loud([html.replace(/<[^>]+>/g, " ")])).toEqual([]);
  });
});
