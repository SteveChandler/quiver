import React from "react";
import { render, screen } from "@testing-library/react";

import {
  INTENT_APP_HANDOFF_PLACEMENT,
  IntentAppHandoffCta,
} from "@/components/intent/intent-app-handoff-cta";

jest.mock("@/components/app-store/install-bar-owned-slot", () => ({
  HideWhenInstallBarOwns: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="install-bar-slot">{children}</div>
  ),
}));

jest.mock("@/components/app-store/content-page-app-handoff-cta", () => ({
  ContentPageAppHandoffCta: (props: Record<string, string>) => (
    <div data-testid="handoff-cta" data-props={JSON.stringify(props)} />
  ),
}));

function renderedProps(): Record<string, string> {
  return JSON.parse(screen.getByTestId("handoff-cta").getAttribute("data-props") ?? "{}");
}

describe("IntentAppHandoffCta", () => {
  it("tags intent pages with the intent surface, source and shared placement", () => {
    render(<IntentAppHandoffCta intent="longboard" cityName="San Diego" citySlug="san-diego" />);

    expect(renderedProps()).toMatchObject({
      surface: "intent",
      source: "content-intent-longboard-san-diego",
      placement: INTENT_APP_HANDOFF_PLACEMENT,
      target: "longboard:san-diego",
      ctaLabel: "Find a longboard day in the app",
    });
    expect(screen.getByTestId("install-bar-slot")).toContainElement(screen.getByTestId("handoff-cta"));
  });

  it("keeps the water temp surface and source, and takes a page-specific description", () => {
    render(
      <IntentAppHandoffCta
        intent="water-temp"
        cityName="San Diego"
        citySlug="san-diego"
        description="Your 64°F answer is set."
      />,
    );

    expect(renderedProps()).toMatchObject({
      surface: "water_temp",
      source: "content-water-temp-san-diego",
      placement: INTENT_APP_HANDOFF_PLACEMENT,
      target: "water-temp:san-diego",
      description: "Your 64°F answer is set.",
    });
  });

  it.each(["tide", "sunset", "dawn-patrol", "beginner", "least-crowded"] as const)(
    "names the city in the %s copy",
    (intent) => {
      render(<IntentAppHandoffCta intent={intent} cityName="Santa Cruz" citySlug="santa-cruz" />);

      const props = renderedProps();
      expect(props.eyebrow).toContain("Santa Cruz");
      expect(props.description).toContain("Santa Cruz");
      expect(props.title).toMatch(/\S/);
      expect(props.ctaLabel).toMatch(/in the app$/);
    },
  );
});
