import { render, screen, within } from "@testing-library/react";
import { TodaysIntentPlan } from "@/components/intent/todays-intent-plan";
import type { IntentForecastSummary } from "@/actions/forecast/intent-forecast-actions";

jest.mock("next/navigation", () => ({
  usePathname: () => "/longboard/san-diego",
}));

jest.mock("@/components/seo/seo-scene-panel", () => ({
  SeoScenePanel: () => <div data-testid="seo-scene-panel" />,
}));

const summary: IntentForecastSummary = {
  bestWindow: {
    start: "7:00 AM",
    end: "9:30 AM",
    reason: "incoming tide, light winds",
  },
  topPicks: [
    {
      name: "Tourmaline Surf Park",
      slug: "tourmaline-surf-park",
      waveHeight: "2-3 ft",
      windDirection: "W 4 mph",
      score: 82,
    },
  ],
  conditions: {
    tide: "Rising",
    wind: "W 4 mph",
    swell: "2-3 ft",
  },
  isTomorrow: false,
};

describe("TodaysIntentPlan", () => {
  it("shows the best-window time publicly without a sign-in blur", () => {
    render(
      <TodaysIntentPlan
        summary={summary}
        intentSlug="longboard"
        cityName="San Diego"
        stateSlug="ca"
        citySlug="san-diego"
        focusPoints={["mellow waves", "longboard-friendly"]}
      />
    );

    const plan = screen.getByRole("heading", {
      name: /today's longboard plan in san diego/i,
    }).closest("section");

    expect(plan).not.toBeNull();
    expect(within(plan!).getByText(/7:00 AM/i)).toBeVisible();
    expect(within(plan!).getByText(/9:30 AM/i)).toBeVisible();
    expect(within(plan!).getByText(/incoming tide, light winds/i)).toBeVisible();
    expect(screen.queryByText(/sign in to reveal exact windows/i)).not.toBeInTheDocument();
    expect(plan!.querySelector('[class*="blur-"]')).toBeNull();
  });
});
