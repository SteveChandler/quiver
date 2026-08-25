import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { BeachFollowControl } from "@/components/beach-follow/beach-follow-control";
import { LOCAL_BEACH_FOLLOW_STORAGE_KEY } from "@/lib/beach-follow/local-storage";
import { FollowTopic } from "@/types/beach-follow";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog" aria-label="Sync beach follows" /> : null,
}));

describe("BeachFollowControl", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockTrack.mockReset();
  });

  it("follows locally with water temperature selected and surf opt-in", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );

    expect(screen.getByRole("checkbox", { name: "Water temperature" })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Surf" })).not.toBeChecked();
    expect(screen.queryByText(/what brings you/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));

    expect(
      screen.getByRole("button", { name: "Unfollow Scripps" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(screen.getByText(/what brings you to the beach/i)).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY)).toContain(
      '"water_temp"',
    );
    expect(window.localStorage.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY)).not.toContain(
      '"surf"',
    );
  });

  it("restores followed state after a reload", async () => {
    const user = userEvent.setup();
    const first = render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    first.unmount();

    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );

    expect(
      await screen.findByRole("button", { name: "Unfollow Scripps" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("edits bounded topics after follow without blocking state on analytics failure", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    mockTrack.mockImplementation(() => {
      throw new Error("analytics unavailable");
    });
    await user.click(screen.getByRole("checkbox", { name: "Tides" }));

    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
    expect(window.localStorage.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY)).toContain(
      '"tide"',
    );
  });

  it("falls back safely from corrupt storage", async () => {
    window.localStorage.setItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY, "{broken");
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.General}
        pageType="beach_water_temp"
      />,
    );

    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });

  it("keeps the control usable when localStorage is disabled", async () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("disabled");
    });
    const user = userEvent.setup();

    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.General}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));

    expect(screen.getByText("Saved for this visit")).toBeInTheDocument();
    getItem.mockRestore();
    setItem.mockRestore();
  });

  it("supports keyboard activation and communicates state without color alone", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.General}
        pageType="beach_water_temp"
      />,
    );

    await user.tab();
    while (document.activeElement?.getAttribute("aria-label") !== "Follow Scripps") {
      await user.tab();
    }
    await user.keyboard(" ");

    expect(screen.getByRole("button", { name: "Unfollow Scripps" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByTestId("beach-follow-control")).toHaveClass(
      "motion-reduce:transition-none",
    );
  });

  it("offers an explicit unknown/dismiss path after value is saved", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.General}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    await user.click(screen.getByRole("button", { name: "Not sure yet" }));

    expect(screen.queryByText(/what brings you to the beach/i)).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalledWith(
      "visitor_intent_selected",
      expect.anything(),
    );
  });

  it("saves explicit non-surf intent with the closed event metadata", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    await user.click(screen.getByRole("button", { name: "Swimming" }));

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("visitor_intent_selected", {
        beachId: BEACH_ID,
        metadata: {
          audience_class: "general_utility",
          page_type: "beach_water_temp",
          experiment_key: "bfr-follow-holdout-v1",
          experiment_arm: expect.stringMatching(/^(holdout|treatment)$/),
          intent_state: "explicit",
          intent_reason: "explicit_non_surf",
        },
        debounceMs: 0,
      });
    });
  });

  it("emits the closed qualification event for an explicit surfing choice", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    await user.click(screen.getByRole("button", { name: "Surfing" }));

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("surf_intent_qualified", {
        beachId: BEACH_ID,
        metadata: {
          audience_class: "surf_qualified",
          page_type: "beach_water_temp",
          experiment_key: "bfr-follow-holdout-v1",
          experiment_arm: expect.stringMatching(/^(holdout|treatment)$/),
          intent_state: "explicit",
          intent_reason: "explicit_surfing",
        },
        debounceMs: 0,
      });
    });
  });

  it("unfollows without requiring auth", async () => {
    const user = userEvent.setup();
    render(
      <BeachFollowControl
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.General}
        pageType="beach_water_temp"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Follow Scripps" }));
    fireEvent.click(screen.getByRole("button", { name: "Unfollow Scripps" }));

    expect(screen.getByRole("button", { name: "Follow Scripps" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
