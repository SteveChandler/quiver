/**
 * Unit tests for ConditionsAlertEmail React component (Daily Surf Call rebuild).
 *
 * Test coverage:
 * - Canonical go/consider verdict rendering
 * - Condition-character headline vs fallback
 * - Signal grid cells render when present, omitted when null
 * - New signals: rideable/hr, best window, rip risk
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
    decisionVerdict: "go",
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
      waterQuality: "advisory",
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
  waterQuality: null,
};

describe("ConditionsAlertEmail", () => {
  describe("Masthead + dateline", () => {
    it("renders the Quiver lockup and dateline", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      // Icon plus wordmark: the text has to survive an image-blocking client,
      // and the icon src must be an asset that is actually deployed.
      expect(container.textContent).toContain("QUIVER");
      const icon = container.querySelector('img[src*="quiver-app-icon"]');
      expect(icon).not.toBeNull();
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
            decisionVerdict: "go",
            signals: { ...EMPTY_SIGNALS },
          })}
        />
      );
      expect(container.textContent).toContain(
        "Your best session window is lining up",
      );
      expect(container.textContent).not.toContain("undefined");
    });

    it("shows the NOW FIRING sticker only for a go decision", () => {
      const high = render(
        <ConditionsAlertEmail {...makeProps({ decisionVerdict: "go" })} />
      );
      expect(high.container.textContent).toContain("NOW FIRING");

      const low = render(
        <ConditionsAlertEmail
          {...makeProps({ decisionVerdict: "maybe" })}
        />
      );
      expect(low.container.textContent).not.toContain("NOW FIRING");
    });
  });

  describe("Decision block", () => {
    it("uses a teal GO chip for the canonical go verdict", () => {
      const { container } = render(
        <ConditionsAlertEmail {...makeProps({ decisionVerdict: "go" })} />
      );
      expect(container.textContent).toContain("Go surf!");
      const chip = Array.from(container.querySelectorAll("td")).find(
        (td) => td.style.backgroundColor === "rgb(0, 212, 170)"
      );
      expect(chip?.textContent).toContain("GO");
    });

    it("uses a gold CONSIDER chip for the canonical maybe verdict", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({ decisionVerdict: "maybe" })}
        />
      );
      expect(container.textContent).toContain("Worth considering");
      const chip = Array.from(container.querySelectorAll("td")).find(
        (td) => td.style.backgroundColor === "rgb(253, 184, 75)"
      );
      expect(chip?.textContent).toContain("CONSIDER");
    });

    it("does not expose a legacy numeric recommendation score", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).not.toMatch(/\b88\b/);
      expect(container.textContent).not.toContain("EPIC");
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

    it("does not expose confidence labels", () => {
      const { container } = render(<ConditionsAlertEmail {...makeProps()} />);
      expect(container.textContent).not.toContain("CONFIDENCE");
      expect(container.textContent).not.toContain("two models agree");
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

    it("renders WATER Advisory in amber", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, waterQuality: "advisory" },
          })}
        />
      );
      expect(container.textContent).toContain("WATER");
      const advisory = Array.from(container.querySelectorAll("span")).find(
        (s) => s.textContent === "Advisory"
      );
      expect(advisory?.textContent).toBe("Advisory");
      // Amber (GOLD #FDB84B).
      expect(advisory?.style.color).toBe("rgb(253, 184, 75)");
    });

    it("renders WATER Closed in coral with more urgent styling than advisory", () => {
      const closure = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, waterQuality: "closure" },
          })}
        />
      );
      const closedSpan = Array.from(
        closure.container.querySelectorAll("span")
      ).find((s) => s.textContent === "Closed");
      expect(closedSpan?.textContent).toBe("Closed");
      // Coral (CORAL #FF6B5C) — the high-urgency color.
      expect(closedSpan?.style.color).toBe("rgb(255, 107, 92)");
      // Closure is bolder/uppercased — more urgent than an advisory.
      expect(closedSpan?.style.textTransform).toBe("uppercase");

      const advisory = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, waterQuality: "advisory" },
          })}
        />
      );
      const advisorySpan = Array.from(
        advisory.container.querySelectorAll("span")
      ).find((s) => s.textContent === "Advisory");
      // Advisory is not uppercased — visually less urgent than a closure.
      expect(advisorySpan?.style.textTransform).toBe("none");
    });

    it("renders WATER Clean in teal for good status", () => {
      const { container } = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: { ...makeProps().signals, waterQuality: "good" },
          })}
        />
      );
      const clean = Array.from(container.querySelectorAll("span")).find(
        (s) => s.textContent === "Clean"
      );
      expect(clean?.textContent).toBe("Clean");
      // Teal (TEAL #00D4AA).
      expect(clean?.style.color).toBe("rgb(0, 212, 170)");
    });

    it("omits the WATER cell for unknown or null water quality", () => {
      const unknown = render(
        <ConditionsAlertEmail
          {...makeProps({
            // Clear rip risk so the strip is driven only by water quality.
            signals: {
              ...makeProps().signals,
              ripRisk: null,
              waterQuality: "unknown",
            },
          })}
        />
      );
      expect(unknown.container.textContent).not.toContain("WATER");

      const none = render(
        <ConditionsAlertEmail
          {...makeProps({
            signals: {
              ...makeProps().signals,
              ripRisk: null,
              waterQuality: null,
            },
          })}
        />
      );
      expect(none.container.textContent).not.toContain("WATER");
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
