import { act, render, screen } from "@testing-library/react";

import { BeachFollowPilot } from "@/components/beach-follow/beach-follow-pilot";
import { LOCAL_BEACH_FOLLOW_STORAGE_KEY } from "@/lib/beach-follow/local-storage";
import { bfrHoldoutAssignment } from "@/lib/experiments/bfr-holdout";
import { FollowTopic } from "@/types/beach-follow";

const BEACH_ID = "11111111-1111-4111-8111-111111111111";
const mockTrack = jest.fn();
const mockGetVisitorId = jest.fn();
let intersectionCallback: IntersectionObserverCallback | null = null;

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: () => mockGetVisitorId(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: () => null,
}));

function subjectFor(arm: "holdout" | "treatment"): string {
  for (let index = 0; index < 100; index += 1) {
    const subject = `pilot-subject-${index}`;
    if (bfrHoldoutAssignment(subject, "2026-08-25T12:00:00.000Z").arm === arm) {
      return subject;
    }
  }
  throw new Error(`No ${arm} subject found`);
}

describe("BeachFollowPilot", () => {
  beforeEach(() => {
    window.localStorage.clear();
    mockTrack.mockReset();
    mockGetVisitorId.mockReset();
    intersectionCallback = null;
    global.IntersectionObserver = jest.fn((callback) => {
      intersectionCallback = callback;
      return {
        disconnect: jest.fn(),
        observe: jest.fn(),
        takeRecords: jest.fn(() => []),
        unobserve: jest.fn(),
        root: null,
        rootMargin: "0px",
        thresholds: [0],
      };
    });
  });

  it("renders the treatment control and emits exposure only after it is viewable", async () => {
    mockGetVisitorId.mockReturnValue(subjectFor("treatment"));
    render(
      <BeachFollowPilot
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );

    expect(await screen.findByRole("button", { name: "Follow Scripps" })).toBeVisible();
    expect(mockTrack).not.toHaveBeenCalledWith("beach_follow_started", expect.anything());

    act(() => {
      intersectionCallback?.(
        [{ isIntersecting: true, intersectionRatio: 1 } as IntersectionObserverEntry],
        {} as IntersectionObserver,
      );
    });

    expect(mockTrack).toHaveBeenCalledWith("beach_follow_started", {
      beachId: BEACH_ID,
      metadata: {
        audience_class: "general_utility",
        page_type: "beach_water_temp",
        experiment_key: "bfr-follow-holdout-v1",
        experiment_arm: "treatment",
        topic: FollowTopic.WaterTemp,
      },
      debounceMs: 0,
    });
  });

  it("keeps the holdout free of follow UI", async () => {
    mockGetVisitorId.mockReturnValue(subjectFor("holdout"));
    render(
      <BeachFollowPilot
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );

    expect(await screen.findByTestId("beach-follow-holdout")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /follow scripps/i })).not.toBeInTheDocument();
    expect(mockTrack).not.toHaveBeenCalled();
  });

  it("reuses the persisted assignment instead of recomputing it", async () => {
    const subject = subjectFor("treatment");
    const assignment = bfrHoldoutAssignment(subject, "2026-08-25T12:00:00.000Z");
    window.localStorage.setItem(
      LOCAL_BEACH_FOLLOW_STORAGE_KEY,
      JSON.stringify({
        version: 3,
        follows: [],
        tombstones: [],
        topicTombstones: [],
        bfrHoldoutAssignment: assignment,
      }),
    );
    mockGetVisitorId.mockReturnValue(subjectFor("holdout"));

    render(
      <BeachFollowPilot
        beachId={BEACH_ID}
        beachName="Scripps"
        defaultTopic={FollowTopic.WaterTemp}
        pageType="beach_water_temp"
      />,
    );

    expect(await screen.findByRole("button", { name: "Follow Scripps" })).toBeVisible();
    expect(
      JSON.parse(window.localStorage.getItem(LOCAL_BEACH_FOLLOW_STORAGE_KEY) ?? "{}")
        .bfrHoldoutAssignment,
    ).toEqual(assignment);
  });
});
