import { render, screen } from "@testing-library/react";

import { getBeginnerConditionsData } from "@/actions/beginner/beginner-actions";
import UsOpenOfSurfingForecastPage, {
  metadata,
  US_OPEN_FORECAST_FALLBACK_COPY,
} from "@/app/us-open-of-surfing-forecast/page";
import type { RightNowConditions } from "@/types/beginner";

jest.mock("@/actions/beginner/beginner-actions", () => ({
  getBeginnerConditionsData: jest.fn(),
}));

const rightNow: RightNowConditions = {
  spotId: "bolsa-chica-id",
  spotName: "Bolsa Chica",
  spotSlug: "bolsa-chica",
  metrics: {
    waveHeight: { value: "1-2 ft", label: "gentle", status: "good" },
    wind: { value: "W 4 mph", label: "light wind", status: "good" },
    waterTemp: {
      value: "64°F",
      label: "spring suit",
      status: "good",
      icon: "thermometer",
    },
    tide: { value: "Rising", label: "low-to-mid tide fit", status: "good" },
    crowd: { value: "Moderate", label: "room varies", status: "caution" },
  },
  beginnerVerdict: {
    rating: "ideal",
    reasons: [
      { factor: "Wave size", detail: "Ideal 1-2 ft learner surf" },
      { factor: "Wind", detail: "Light wind" },
      { factor: "Tide", detail: "Low-to-mid tide fit" },
      { factor: "Time window", detail: "Best morning glass window" },
    ],
  },
  summary: "Small waves with light wind and a rising tide.",
  lastUpdated: "2026-07-23T18:00:00.000Z",
};

describe("US Open of Surfing forecast page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders Huntington Beach utility data and internal planning links", async () => {
    (getBeginnerConditionsData as jest.Mock).mockResolvedValue({
      badge: {
        status: "great",
        statusLabel: "Great for Beginners Today",
        waveHeight: "1-2 ft",
        wind: "4 mph W",
        waterTemp: "64°F",
        spotName: "Bolsa Chica",
        spotSlug: "bolsa-chica",
      },
      rightNow,
    });

    render(await UsOpenOfSurfingForecastPage());

    expect(
      screen.getByRole("heading", {
        name: "US Open of Surfing Forecast",
        level: 1,
      }),
    ).toBeVisible();
    expect(screen.getByText("1-2 ft")).toBeVisible();
    expect(screen.getByText("W 4 mph")).toBeVisible();
    expect(screen.getByText("Rising")).toBeVisible();
    expect(screen.getByText("64°F")).toBeVisible();
    expect(screen.getByText("Best morning glass window")).toBeVisible();
    expect(
      screen.getByRole("link", { name: /check beginner conditions/i }),
    ).toHaveAttribute("href", "/beginner/huntington-beach");
    expect(
      screen.getByRole("link", { name: /check huntington beach tide/i }),
    ).toHaveAttribute("href", "/tide/huntington-beach");
  });

  it("renders explicit fallback copy when live forecast data is unavailable", async () => {
    (getBeginnerConditionsData as jest.Mock).mockResolvedValue({
      badge: null,
      rightNow: null,
    });

    render(await UsOpenOfSurfingForecastPage());

    expect(screen.getByRole("status")).toHaveTextContent(
      US_OPEN_FORECAST_FALLBACK_COPY,
    );
    expect(screen.getAllByText("Check live forecast").length).toBeGreaterThan(0);
  });

  it("uses the canonical metadata pattern for the finite event utility route", () => {
    expect(String(metadata.alternates?.canonical)).toContain(
      "/us-open-of-surfing-forecast",
    );
    expect(metadata.description).toMatch(/waves, wind, tide, water temperature/i);
  });
});
