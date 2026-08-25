import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { MyCoastClient } from "@/app/my-coast/my-coast-client";
import type { MyCoastBatch } from "@/lib/beach-follow/my-coast-loader";
import type { LocalBeachFollowSnapshot } from "@/lib/beach-follow/local-storage";
import { FollowTopic } from "@/types/beach-follow";

const BEACH_ID = "00000000-0000-4000-8000-000000000001";
const NOW = "2026-08-25T16:00:00.000Z";
let signedIn = false;
const mockTrack = jest.fn();

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: signedIn ? { id: "user-1" } : null }),
  useOptionalAuth: () => ({ user: signedIn ? { id: "user-1" } : null }),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

function localSnapshot(
  topics: FollowTopic[] = [FollowTopic.WaterTemp, FollowTopic.Tide],
): LocalBeachFollowSnapshot {
  return {
    status: "ready",
    persisted: true,
    state: {
      version: 3,
      follows: [{
        beachId: BEACH_ID,
        topics,
        topicAddedAt: Object.fromEntries(topics.map((topic) => [topic, NOW])),
        createdAt: NOW,
        updatedAt: NOW,
      }],
      tombstones: [],
      topicTombstones: [],
      bfrHoldoutAssignment: {
        subjectId: "visitor-1",
        experimentKey: "bfr-follow-holdout-v1",
        arm: "treatment",
        assignedAt: NOW,
        version: 1,
      },
    },
  };
}

function batch(updatedAt = NOW): MyCoastBatch {
  return {
    truncatedCount: 0,
    beaches: [{
      id: BEACH_ID,
      name: "Ocean Beach",
      slug: "ocean-beach",
      city: "San Diego",
      state: "CA",
      country: "USA",
      windOffshoreDeg: 270,
      windOffshoreToleranceDeg: 45,
      forecast: {
        beachId: BEACH_ID,
        forecastAt: NOW,
        updatedAt,
        waterTemp: "68°F",
        tideStatus: "Rising",
        nextTideAt: "2026-08-25T18:00:00.000Z",
        nextTideHeight: "4.2",
        nextTideType: "high",
        windSpeed: "8 mph",
        windDirection: "W",
        windDirectionDeg: 270,
        waveHeight: "3.1 ft",
        dataSource: "NOAA",
      },
      waterQuality: null,
      unavailableSources: ["water_quality"],
    }],
  };
}

describe("MyCoastClient", () => {
  beforeEach(() => {
    signedIn = false;
    mockTrack.mockClear();
    localStorage.clear();
  });

  it("routes an empty state back to discovery", () => {
    const empty = { ...localSnapshot(), state: { ...localSnapshot().state, follows: [] } };
    render(<MyCoastClient initialSnapshot={empty} now={() => new Date(NOW)} />);

    expect(screen.getByText(/follow a beach to build your coast/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /discover beaches/i })).toHaveAttribute("href", "/map");
  });

  it.each([
    [null, false],
    ["swimming" as const, false],
    ["surfing" as const, true],
  ])("gates surf comparison for intent %s", async (explicitChoice, showsSurf) => {
    render(
      <MyCoastClient
        explicitChoice={explicitChoice}
        initialData={batch()}
        initialSnapshot={localSnapshot([FollowTopic.WaterTemp, FollowTopic.Tide, FollowTopic.Surf])}
        now={() => new Date(NOW)}
      />,
    );

    expect(await screen.findByText("68°F / 20°C")).toBeInTheDocument();
    expect(Boolean(screen.queryByRole("heading", { name: /surf comparison/i }))).toBe(showsSurf);
    await waitFor(() => expect(mockTrack).toHaveBeenCalledWith(
      "my_coast_viewed",
      expect.objectContaining({ metadata: expect.any(Object) }),
    ));
  });

  it("shows surf comparison for defensibly inferred surf intent", async () => {
    render(
      <MyCoastClient
        explicitChoice={null}
        initialData={batch()}
        initialSnapshot={localSnapshot([FollowTopic.General])}
        intentSignals={{ utilityPageViewCount: 1, surfSpecificSignalCount: 2 }}
        now={() => new Date(NOW)}
      />,
    );

    expect(await screen.findByRole("heading", { name: /surf comparison/i })).toBeInTheDocument();
  });

  it("keeps general data visible when one source fails", async () => {
    render(
      <MyCoastClient
        initialData={batch()}
        initialSnapshot={localSnapshot([FollowTopic.WaterTemp, FollowTopic.WaterQuality])}
        now={() => new Date(NOW)}
      />,
    );

    expect(await screen.findByText("68°F / 20°C")).toBeInTheDocument();
    expect(screen.getByText(/water quality is unavailable/i)).toBeInTheDocument();
  });

  it("labels stale forecast data and avoids a change claim", async () => {
    render(
      <MyCoastClient
        initialData={batch("2026-08-25T06:00:00.000Z")}
        initialSnapshot={localSnapshot()}
        now={() => new Date(NOW)}
        previousViews={{
          [BEACH_ID]: {
            recordedAt: "2026-08-25T08:00:00.000Z",
            forecastUpdatedAt: "2026-08-25T07:00:00.000Z",
            waterTempF: 67,
            tideStatus: "Falling",
            windSpeedMph: 6,
            windDirection: "SW",
            waveHeightFt: 2,
            waterQualityStatus: null,
          },
        }}
      />,
    );

    expect(await screen.findAllByText(/forecast is stale/i)).toHaveLength(2);
    expect(screen.queryByText(/warmer|cooler|changed from/i)).not.toBeInTheDocument();
  });

  it("shows only defensible changes from a prior recorded view", async () => {
    render(
      <MyCoastClient
        initialData={batch()}
        initialSnapshot={localSnapshot()}
        now={() => new Date(NOW)}
        previousViews={{
          [BEACH_ID]: {
            recordedAt: "2026-08-25T14:00:00.000Z",
            forecastUpdatedAt: "2026-08-25T14:00:00.000Z",
            waterTempF: 66,
            tideStatus: "Falling",
            windSpeedMph: 8,
            windDirection: "W",
            waveHeightFt: null,
            waterQualityStatus: null,
          },
        }}
      />,
    );

    expect(await screen.findByText(/water temperature is 2°F warmer/i)).toBeInTheDocument();
    expect(screen.getByText(/forecast tide label changed from falling to rising/i)).toBeInTheDocument();
    expect(screen.queryByText(/surf/i)).not.toBeInTheDocument();
  });

  it("distinguishes anonymous local state from signed-in pending sync", () => {
    const { rerender } = render(
      <MyCoastClient initialData={batch()} initialSnapshot={localSnapshot()} now={() => new Date(NOW)} />,
    );
    expect(screen.getByText(/saved on this device/i)).toBeInTheDocument();

    signedIn = true;
    rerender(<MyCoastClient initialData={batch()} initialSnapshot={localSnapshot()} now={() => new Date(NOW)} />);
    expect(screen.getByText(/signed in.*local changes stay safe until sync confirms/i)).toBeInTheDocument();
  });

  it("opens a beach through its existing canonical route", async () => {
    render(<MyCoastClient initialData={batch()} initialSnapshot={localSnapshot()} now={() => new Date(NOW)} />);

    const beachLink = await screen.findByRole("link", { name: /open ocean beach/i });
    expect(beachLink).toHaveAttribute("href", "/ca/san-diego/ocean-beach");
    beachLink.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(beachLink);
    expect(mockTrack).toHaveBeenCalledWith(
      "my_coast_beach_opened",
      expect.objectContaining({ beachId: BEACH_ID, metadata: expect.any(Object) }),
    );
  });
});
