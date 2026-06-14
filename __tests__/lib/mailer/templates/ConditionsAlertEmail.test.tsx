/**
 * Unit tests for ConditionsAlertEmail React component (Daily Surf Call rebuild).
 *
 * Test coverage:
 * - Score rendering on a 0-100 scale + verdict-colored chip
 * - Condition-character headline vs fallback
 * - Signal grid cells render when present, omitted when null
 * - New signals: rideable/hr, best window, confidence, rip risk
 * - whyText bullets + crowd warning
 * - Single orange CTA
 * - Masthead + footer provenance
 */

import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  ConditionsAlertEmail,
  ConditionsAlertEmailProps,
} from "@/lib/mailer/templates/ConditionsAlertEmail";

function makeProps(
  overrides: Partial<ConditionsAlertEmailProps> = {}
): ConditionsAlertEmailProps {
  return {
    beachName: "Ocean Beach",
    conditionsScore: 88,
    surfDescription: "Clean 3-4 ft",
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
      conditionCharacter: "Dialed — everything's lining up",
    },
    why: {
      whyText: [
        "Ocean Beach is hitting its optimal NW swell window.",
        "Conditions are perfect offshore winds, ideal for a session.",
      ],
      crowdWarning: "Expect crowds on a weekend with perfect conditions.",
    },
    ctaUrl: "https://quiversurf.app/surf/sf/ocean-beach",
    manageUrl: "https://quiversurf.app/settings",
    unsubscribeUrl: "https://quiversurf.app/settings",
    ...overrides,
  };
}

const EMPTY_SIGNALS: ConditionsAlertEmailProps["signals"] = {
  ripRisk: null,
  rideableWavesPerHour: null,
  setIntervalSeconds: null,
  waveFrequencyConfidence: null,
  forecastConfidence: null,
  conditionCharacter: null,
};

describe("ConditionsAlertEmail", () => {
  describe("Masthead + dateline", () => {
    it("renders the QUIVER wordmark and dateline", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("QUIVER");
      expect(container.textContent).toContain("FRI · JUN 13");
    });

    it("renders the eyebrow with beach name", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("TODAY'S SURF CALL");
      expect(container.textContent).toContain("Ocean Beach");
    });
  });

  describe("Hero headline", () => {
    it("uses the condition-character label when present", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain(
        "Dialed — everything's lining up"
      );
    });

    it("falls back to a sensible headline when character is null", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            conditionsScore: 88,
            signals: { ...EMPTY_SIGNALS },
          })}
        />
      );
      // No character → fallback headline for an 88 score.
      expect(container.textContent).toContain("It's firing");
      expect(container.textContent).not.toContain("undefined");
    });

    it("shows the NOW FIRING sticker only for score >= 85", () => {
      const high = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 90 })} />
      );
      expect(high.container.textContent).toContain("NOW FIRING");

      const low = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 72 })} />
      );
      expect(low.container.textContent).not.toContain("NOW FIRING");
    });
  });

  describe("Score block", () => {
    it.each([0, 42, 60, 72, 88, 100])(
      "renders the raw score %i on a 0-100 scale",
      (score) => {
        const { container } = render(
          <ConditionsAlertEmail {...makeProps({ conditionsScore: score })} />
        );
        expect(container.textContent).toContain(String(score));
      }
    );

    it("uses teal chip + Go surf for score >= 70", () => {
      const { container } = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 75 })} />
      );
      expect(container.textContent).toContain("Go surf!");
      const chip = Array.from(container.querySelectorAll("td")).find(
        (td) => td.style.backgroundColor === "rgb(0, 212, 170)"
      );
      expect(chip?.textContent).toContain("75");
    });

    it("uses gold chip + Might work for 55-69", () => {
      const { container } = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 60 })} />
      );
      expect(container.textContent).toContain("Might work");
      const chip = Array.from(container.querySelectorAll("td")).find(
        (td) => td.style.backgroundColor === "rgb(253, 184, 75)"
      );
      expect(chip?.textContent).toContain("60");
    });

    it("uses muted gray chip + Skip it for < 55", () => {
      const { container } = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 40 })} />
      );
      expect(container.textContent).toContain("Skip it");
      const chip = Array.from(container.querySelectorAll("td")).find(
        (td) => td.style.backgroundColor === "rgb(136, 135, 128)"
      );
      expect(chip?.textContent).toContain("40");
    });

    it("never renders the score chip in CTA orange", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      // Orange (#F78E42) should appear only on the CTA button cell, never on a
      // chip that also holds the big score number.
      const orangeCells = Array.from(container.querySelectorAll("td")).filter(
        (td) => td.style.backgroundColor === "rgb(247, 142, 66)"
      );
      orangeCells.forEach((cell) => {
        expect(cell.textContent).not.toMatch(/\b88\b/);
      });
    });

    it("renders the brand condition label from getConditionLabel", () => {
      const { container } = render(
        <ConditionsAlertEmail {...makeProps({ conditionsScore: 88 })} />
      );
      expect(container.textContent).toContain("EPIC");
    });
  });

  describe("Signal grid", () => {
    it("renders swell / wind / tide values when present", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("SWELL");
      expect(container.textContent).toContain("Clean 3-4 ft");
      expect(container.textContent).toContain("WIND");
      expect(container.textContent).toContain("Light offshore");
      expect(container.textContent).toContain("TIDE");
      expect(container.textContent).toContain("2.1 ft, incoming");
    });

    it("renders rideable/hr from rideableWavesPerHour + setIntervalSeconds", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("RIDEABLE / HR");
      expect(container.textContent).toContain("~18 · sets ~90s");
    });

    it("renders rideable/hr without set interval when null", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: {
              ...makeProps().signals,
              setIntervalSeconds: null,
            },
          })}
        />
      );
      expect(container.textContent).toContain("~18");
      expect(container.textContent).not.toContain("sets ~");
    });

    it("renders the best window", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("BEST WINDOW");
      expect(container.textContent).toContain("7:00 AM–9:00 AM");
    });

    it("renders confidence copy as 'two models agree' for high confidence", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("CONFIDENCE");
      expect(container.textContent).toContain("High · two models agree");
      // Never imply ML correction (Seaside v3 serving retired).
      expect(container.textContent).not.toMatch(/ML[- ]corrected/i);
    });

    it("omits each signal cell gracefully when its datum is null", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            surfDescription: null,
            windDescription: null,
            tideDescription: null,
            bestWindow: null,
            signals: { ...EMPTY_SIGNALS },
          })}
        />
      );
      expect(container.textContent).not.toContain("SWELL");
      expect(container.textContent).not.toContain("WIND");
      expect(container.textContent).not.toContain("TIDE");
      expect(container.textContent).not.toContain("RIDEABLE / HR");
      expect(container.textContent).not.toContain("BEST WINDOW");
      expect(container.textContent).not.toContain("CONFIDENCE");
      expect(container.textContent).not.toContain("undefined");
    });
  });

  describe("Safety strip", () => {
    it("renders rip risk when moderate", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("RIP RISK");
      expect(container.textContent).toContain("Moderate");
    });

    it("renders rip risk High in coral", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, ripRisk: "high" },
          })}
        />
      );
      expect(container.textContent).toContain("High");
    });

    it("omits rip risk when low or null", () => {
      const low = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, ripRisk: "low" },
          })}
        />
      );
      expect(low.container.textContent).not.toContain("RIP RISK");

      const none = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, ripRisk: null },
          })}
        />
      );
      expect(none.container.textContent).not.toContain("RIP RISK");
    });
  });

  describe("Why this matches your playbook", () => {
    it("renders the why bullets", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain(
        "WHY THIS MATCHES YOUR PLAYBOOK"
      );
      expect(container.textContent).toContain(
        "Ocean Beach is hitting its optimal NW swell window."
      );
      expect(container.textContent).toContain(
        "Conditions are perfect offshore winds, ideal for a session."
      );
    });

    it("omits the why section when there are no bullets", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({ why: { whyText: [], crowdWarning: null } })}
        />
      );
      expect(container.textContent).not.toContain(
        "WHY THIS MATCHES YOUR PLAYBOOK"
      );
    });

    it("renders the crowd warning when present", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("HEADS UP");
      expect(container.textContent).toContain(
        "Expect crowds on a weekend with perfect conditions."
      );
    });

    it("omits the crowd warning when null", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            why: { whyText: ["one bullet"], crowdWarning: null },
          })}
        />
      );
      expect(container.textContent).not.toContain("HEADS UP");
    });
  });

  describe("Single CTA", () => {
    it("renders exactly one button-style CTA to the beach page", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      const cta = container.querySelector(
        'a[href="https://quiversurf.app/surf/sf/ocean-beach"]'
      );
      expect(cta).toBeInTheDocument();
      expect(cta?.textContent).toContain("See the full forecast");
      // No competing log-session CTA.
      expect(container.textContent).not.toContain("Log Your Session");
    });

    it("does not render a second forecast button", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      const forecastButtons = Array.from(
        container.querySelectorAll("a")
      ).filter((a) => /full forecast/i.test(a.textContent ?? ""));
      expect(forecastButtons).toHaveLength(1);
    });
  });

  describe("Footer provenance", () => {
    it("explains why the user got the email", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain(
        "You set a daily alert for Ocean Beach"
      );
      expect(container.textContent).toContain(
        "One call a day, only when it's worth it."
      );
    });

    it("renders Manage alerts + Unsubscribe links", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).toContain("Manage alerts");
      expect(container.textContent).toContain("Unsubscribe");
    });
  });

  describe("Brand rules", () => {
    it("uses no emoji anywhere", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      const emojiRegex =
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F000}-\u{1F02F}]/u;
      expect(container.textContent ?? "").not.toMatch(emojiRegex);
    });
  });
});
