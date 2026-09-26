/**
 * @jest-environment node
 */
import { renderToStaticMarkup } from "react-dom/server";

import { AnimatedScoreGauge } from "@/components/forecast/animated-score-gauge";

describe("AnimatedScoreGauge server render", () => {
  it("renders the real score, a visible label and the finished arc", () => {
    const html = renderToStaticMarkup(
      <AnimatedScoreGauge score={86} size="xl" showLabel showAction={false} />,
    );

    expect(html).toMatch(/>86<\/span>/);
    expect(html).not.toMatch(/>0<\/span>/);
    expect(html).not.toContain("opacity-0");
    expect(html).toContain("motion-safe:animate-gauge-fill");
    // xl: size 128, stroke 8 -> radius 60; 86% filled leaves 14% of the circumference.
    const circumference = 2 * Math.PI * 60;
    expect(html).toContain(`stroke-dashoffset="${circumference * (1 - 86 / 100)}"`);
  });
});
