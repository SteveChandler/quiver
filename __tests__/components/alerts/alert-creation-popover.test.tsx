import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { AlertCreationPopover } from "@/components/alerts/alert-creation-popover";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

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
  beforeEach(() => {
    mockTrack.mockClear();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

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

  it("tracks alert creation and watched spot creation after preset save", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, data: { id: "rule-1" } }),
    });
    const onRuleCreated = jest.fn();

    render(
      <AlertCreationPopover
        beachId="beach-1"
        beachName="Swamis"
        beach={beach}
        open
        onOpenChange={jest.fn()}
        onRuleCreated={onRuleCreated}
        freeGrowthPhaseEnabled
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "Glassy: Light wind and clean waves. Smooth as glass.",
      }),
    );

    await waitFor(() => expect(onRuleCreated).toHaveBeenCalledTimes(1));
    expect(mockTrack).toHaveBeenCalledWith("alert_rule_created", {
      beachId: "beach-1",
      metadata: {
        surface: "alert_creation_popover",
        creation_flow: "preset",
        preset_type: "glass_off",
      },
    });
    expect(mockTrack).toHaveBeenCalledWith("watch_spot_tapped", {
      beachId: "beach-1",
      metadata: {
        surface: "alert_creation_popover",
        outcome: "created",
        creation_flow: "preset",
        preset_type: "glass_off",
      },
    });
  });
});
