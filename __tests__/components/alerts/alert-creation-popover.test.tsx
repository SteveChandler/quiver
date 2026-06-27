import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AlertCreationPopover } from "@/components/alerts/alert-creation-popover";

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

const beach = {
  id: "beach-1",
  name: "Swamis",
  slug: "swamis",
  lat: 33.036,
  lon: -117.292,
  timezone: "America/Los_Angeles",
  wind_offshore_deg: null,
  wind_offshore_tol_deg: null,
  aspect_deg: null,
  preferred_tide_ft_min: null,
  preferred_tide_ft_max: null,
  preferred_tide_direction: null,
  swell_window_center_deg: null,
  swell_window_halfwidth_deg: null,
  break_type: null,
  skill_level: null,
  features: null,
  preference_model: null,
  max_wind_any_mph: null,
  max_wind_onshore_mph: null,
};

function renderPopover(freeGrowthPhaseEnabled: boolean) {
  return render(
    <AlertCreationPopover
      beachId="beach-1"
      beachName="Swamis"
      beach={beach}
      open
      onOpenChange={jest.fn()}
      freeGrowthPhaseEnabled={freeGrowthPhaseEnabled}
    />,
  );
}

describe("AlertCreationPopover", () => {
  it("shows free-growth copy only when the phase flag prop is on", () => {
    const { rerender } = renderPopover(false);

    expect(
      screen.queryByText(
        "Watch this spot, free. Track up to 3 breaks and we'll call the window.",
      ),
    ).not.toBeInTheDocument();

    rerender(
      <AlertCreationPopover
        beachId="beach-1"
        beachName="Swamis"
        beach={beach}
        open
        onOpenChange={jest.fn()}
        freeGrowthPhaseEnabled
      />,
    );

    expect(
      screen.getByText(
        "Watch this spot, free. Track up to 3 breaks and we'll call the window.",
      ),
    ).toBeInTheDocument();
  });
});
