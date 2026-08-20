import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";
import { getScoreCall } from "@/components/forecast/score-band-call";
import { getQualityLabel } from "@/lib/utils/score-color-utils";

describe("AnimatedScoreGauge score vocabulary", () => {
  it("uses the canonical score-band source instead of a local registry", () => {
    const gaugeSource = readFileSync(
      join(process.cwd(), "components/forecast/animated-score-gauge.tsx"),
      "utf8"
    );

    expect(gaugeSource).toContain("getScoreCall(score)");
    expect(gaugeSource).not.toContain("GAUGE_THRESHOLDS");
    expect(gaugeSource).not.toContain("SCORE_THRESHOLDS");
  });

  it.each([
    [73, "GOOD", "Go surf!"],
    [83, "EPIC", "Go now!"],
  ])("renders %s as %s with an action phrase", (score, label, action) => {
    render(<AnimatedScoreGauge score={score} showLabel />);

    expect(getQualityLabel(score)).toBe(label);
    expect(getScoreCall(score)).toEqual({ label, action });
    expect(screen.getByText(label)).toBeInTheDocument();
    expect(screen.getByText(action)).toBeInTheDocument();
  });

  it.each([
    [73, "GOOD", "Go surf!"],
    [83, "EPIC", "Go now!"],
  ])(
    "keeps the %s band label but drops the action phrase when showAction is false",
    (score, label, action) => {
      render(<AnimatedScoreGauge score={score} showLabel showAction={false} />);

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(action)).not.toBeInTheDocument();
      expect(
        screen.getByLabelText(`Score: ${score}, ${label}`)
      ).toBeInTheDocument();
    }
  );
});
