import { render, screen, within } from "@testing-library/react";
import {
  SeoFunnelNextSteps,
  type SeoFunnelNextStep,
} from "@/components/seo/seo-funnel-next-steps";

const steps: SeoFunnelNextStep[] = [
  {
    label: "Check live Huntington Beach spots",
    href: "/ca/huntington-beach",
    description: "Open the live surf hub before choosing a break.",
  },
  {
    label: "Find the best surf window",
    href: "/best-time-to-surf/huntington-beach",
    description: "Compare the seasonal window with current conditions.",
  },
  {
    label: "Watch the tide window",
    href: "/tide/huntington-beach",
    description: "Pair water temperature with the next tide shift.",
  },
];

describe("SeoFunnelNextSteps", () => {
  it("renders a labeled next-step region with crawlable links", () => {
    render(
      <SeoFunnelNextSteps
        title="Keep planning Huntington Beach"
        description="Use the live surf hub, best-window guide, and tide page to choose your next session."
        steps={steps}
      />
    );

    const region = screen.getByTestId("seo-funnel-next-steps");
    expect(region).toHaveAccessibleName("Keep planning Huntington Beach");
    expect(
      within(region).getByText(
        "Use the live surf hub, best-window guide, and tide page to choose your next session."
      )
    ).toBeInTheDocument();

    for (const step of steps) {
      const link = within(region).getByRole("link", { name: step.label });
      expect(link).toHaveAttribute("href", step.href);
      expect(within(region).getByText(step.description)).toBeInTheDocument();
    }
  });

  it("does not render without next steps", () => {
    const { container } = render(
      <SeoFunnelNextSteps
        title="Keep planning"
        description="Choose the next page."
        steps={[]}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});
