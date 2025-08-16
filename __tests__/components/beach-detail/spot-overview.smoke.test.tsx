import React from "react";
import { render, screen } from "@testing-library/react";
import { SpotOverview } from "@/components/beach-detail/spot-overview";

jest.mock("@/actions/beach-media-actions", () => ({
  getBestBeachPhotosAction: jest.fn(async () => ({ success: true, data: [] })),
}));

jest.mock("@/actions/beach-calibration-actions", () => ({
  getLatestBeachCalibrationAction: jest.fn(async () => ({
    success: true,
    data: null,
  })),
}));

describe("SpotOverview (smoke)", () => {
  it("renders Spot Summary without throwing", () => {
    const beach = {
      id: "beach-uuid",
      name: "Test Beach",
      break_type: "Beach Break",
      best_swell_cardinals: ["SW"],
      swell_window_min_deg: null,
      swell_window_max_deg: null,
      wind_offshore_deg: null,
      wind_offshore_tol_deg: null,
      preferred_tide_ft_min: null,
      preferred_tide_ft_max: null,
    } as any;

    render(<SpotOverview beach={beach} />);

    expect(screen.getByText("Spot Summary")).toBeInTheDocument();
  });
});
