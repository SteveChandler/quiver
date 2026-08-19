import { render, screen } from "@testing-library/react";
import type { ImgHTMLAttributes } from "react";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: ImgHTMLAttributes<HTMLImageElement> & {
    fill?: boolean;
    priority?: boolean;
    sizes?: string;
  }) => <img {...props} alt={props.alt ?? ""} />,
}));

import { TopRankedBeachHero } from "@/components/forecast/top-ranked-beach-hero";
import type { BeachConditionSummary } from "@/lib/utils/regional-forecast-utils";
import { MAX_WINDOW_HOURS } from "@/lib/services/discovery/window-selector";

const beach: BeachConditionSummary = {
  beachId: "beach-1",
  beachName: "Imperial Beach",
  beachSlug: "imperial-beach",
  state: "CA",
  city: "Imperial Beach",
  country: "USA",
  currentScore: 83,
  currentWaveHeight: 4.2,
  currentWindowStart: "2026-08-12T06:00:00Z",
  currentWindowEnd: "2026-08-12T09:00:00Z",
  trend: "steady",
  bestDay: "Wednesday",
  bestDayScore: 83,
};

describe("TopRankedBeachHero", () => {
  it("uses one current qualifying window for the score call and window display", () => {
    const selectorWindow = {
      startIso: "2026-08-12T07:00:00Z",
      endIso: "2026-08-12T09:00:00Z",
      peakIso: "2026-08-12T08:00:00Z",
      timezone: "UTC",
      localTimeLabel: "7:00 AM-9:00 AM",
      score: 83,
      verdict: "Worth it" as const,
      confidence: {
        level: "high" as const,
        score: 84,
        summary: "High confidence",
        reasons: ["Forecast model row is present"],
      },
      positives: ["Good wave size"],
    };

    render(
      <TopRankedBeachHero
        beach={beach}
        regionName="San Diego"
        now={new Date("2026-08-12T08:00:00Z")}
        imageUrl="https://images.example/ocean-beach.webp"
        bestSurfWindow={selectorWindow}
      />
    );

    expect(screen.getByTestId("top-ranked-beach-hero")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Imperial Beach" })).toBeInTheDocument();
    expect(screen.getByText("Ranked first in San Diego")).toBeInTheDocument();
    expect(screen.queryByText("Ranked first in Imperial Beach")).not.toBeInTheDocument();
    expect(screen.getByText("EPIC")).toBeInTheDocument();
    expect(screen.getByText("Go now!")).toBeInTheDocument();
    expect(screen.getByText("7:00 AM-9:00 AM")).toBeInTheDocument();
    expect(screen.getByText("Peak 8:00 AM · High confidence")).toBeInTheDocument();
    expect(screen.getByText("Good wave size")).toBeInTheDocument();
    const durationHours =
      (Date.parse(selectorWindow.endIso) - Date.parse(selectorWindow.startIso)) /
      (60 * 60 * 1000);
    expect(durationHours).toBeLessThanOrEqual(MAX_WINDOW_HOURS);
    expect(screen.queryByText("6:00 AM–9:00 AM")).not.toBeInTheDocument();
    expect(screen.getByText("4.2ft")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Imperial Beach beach photo" })).toBeInTheDocument();
    expect(screen.queryByText("Approved beach photo")).not.toBeInTheDocument();
  });

  it("does not render an immediate action for a future qualifying window", () => {
    render(
      <TopRankedBeachHero
        beach={beach}
        regionName="San Diego"
        now={new Date("2026-08-12T08:00:00Z")}
        bestSurfWindow={{
          startIso: "2026-08-13T07:00:00Z",
          endIso: "2026-08-13T09:00:00Z",
          peakIso: "2026-08-13T08:00:00Z",
          timezone: "UTC",
          localTimeLabel: "7:00 AM-9:00 AM",
          score: 83,
          verdict: "Worth it",
          confidence: {
            level: "high",
            score: 84,
            summary: "High confidence",
            reasons: [],
          },
          positives: ["Good wave size"],
        }}
      />
    );

    expect(screen.getByText("Worth it · Thu, Aug 13")).toBeInTheDocument();
    expect(screen.getByText("7:00 AM-9:00 AM")).toBeInTheDocument();
    expect(screen.queryByText("Go now!")).not.toBeInTheDocument();

    // A window that has not started yet is signposted as the next call rather
    // than presented as a live one.
    expect(screen.getByText("Next window")).toBeInTheDocument();
    expect(screen.getByText("Next best call")).toBeInTheDocument();
    expect(
      screen.getByText("Best upcoming window in San Diego")
    ).toBeInTheDocument();
    expect(screen.queryByText("Top beach now")).not.toBeInTheDocument();
  });

  it("uses the supplied region name for other regions", () => {
    render(
      <TopRankedBeachHero
        beach={beach}
        regionName="Orange County"
        imageUrl="https://images.example/imperial-beach.webp"
      />
    );

    expect(screen.getByText("Ranked first in Orange County")).toBeInTheDocument();
    expect(screen.queryByText("Ranked first in Imperial Beach")).not.toBeInTheDocument();
  });

  it("does not fabricate a beach image when neither approved imagery nor satellite is available", () => {
    render(
      <TopRankedBeachHero
        beach={beach}
        regionName="San Diego"
        now={new Date("2026-08-12T08:00:00Z")}
      />
    );

    expect(screen.getByText("Surf window")).toBeInTheDocument();
    expect(
      screen.getByText("Nothing qualifying in the forecast horizon")
    ).toBeInTheDocument();
    expect(screen.queryByText("Go now!")).not.toBeInTheDocument();
    expect(screen.queryByText("Best window")).not.toBeInTheDocument();
    expect(screen.getByText("No approved image on file")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
