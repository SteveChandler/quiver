import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import ToolsIndexPage from "@/app/tools/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    preload: _preload,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe("tools page zine layout", () => {
  it("renders every tool card without a rotation helper", () => {
    render(<ToolsIndexPage />);

    const toolCards = [
      "Tide Clock",
      "Wave Height Converter",
      "Offshore Wind Checker",
      "Dawn Patrol Calculator",
      "Surfboard Volume Calculator",
      "Swell Quality Analyzer",
      "Water Quality Check",
      "Best Month to Surf",
    ].map((name) => screen.getByRole("link", { name: new RegExp(name, "i") }));

    expect(toolCards).toHaveLength(8);
    toolCards.forEach((card) => {
      expect(card.className).not.toMatch(/(?:^|\s)rot-(?:1|2|3|4|neg)(?:\s|$)/);
    });

    const quickCheckPanel = screen
      .getByRole("heading", { name: /surf tools that connect/i })
      .closest("section");
    expect(quickCheckPanel).toHaveClass("torn", "torn-tb", "rot-neg");
  });
});
