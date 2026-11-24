import React from "react";
import { act, cleanup, render } from "@testing-library/react";
import { useAuth } from "@/context/auth-context";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Beach } from "@/types/database";

const mockTrack = jest.fn();

jest.mock("@/components/beach-detail", () => ({
  BeachDetail: () => <div data-testid="beach-detail-client-child" />,
}));

jest.mock("@/actions/onboarding-actions", () => ({
  inferHomeBreakFromView: jest.fn(async () => undefined),
}));

// A fresh `track` per render mirrors identity churn from the auth context.
jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({
    track: (...args: unknown[]) => mockTrack(...args),
  }),
}));

jest.mock("@/lib/analytics", () => ({
  trackPublicPageView: jest.fn(),
}));

const beach = {
  id: "beach-1",
  name: "Test Beach",
  slug: "test-beach",
  lat: 32.7,
  lon: -117.2,
  city: "San Diego",
  state: "CA",
  country: "USA",
  break_type: "Beach Break",
  created_at: "2026-01-01T00:00:00Z",
  timezone: "America/Los_Angeles",
} as Beach;

const otherBeach = {
  ...beach,
  id: "beach-2",
  name: "Other Beach",
  slug: "other-beach",
} as Beach;

let now = 1_000_000;
let visibility: DocumentVisibilityState = "visible";

function advance(ms: number): void {
  now += ms;
}

function setVisibility(state: DocumentVisibilityState): void {
  visibility = state;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function signedInAs(id: string): void {
  // New object every call: auth events replace `user` even for the same person.
  (useAuth as jest.Mock).mockReturnValue({
    user: { id, created_at: "2026-07-01T00:00:00Z" },
    session: null,
    isLoading: false,
    isAuthenticated: true,
  });
}

function durationEvents(): Array<[string, { beachId: string; metadata: { duration_ms: number } }]> {
  return mockTrack.mock.calls.filter(
    ([type, options]) =>
      type === "beach_view" && options?.metadata?.duration_ms !== undefined,
  );
}

describe("BeachDetailClient duration beach_view", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    now = 1_000_000;
    visibility = "visible";
    jest.spyOn(Date, "now").mockImplementation(() => now);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => visibility,
    });
    global.fetch = jest.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    signedInAs("user-1");
  });

  afterEach(() => {
    cleanup();
    jest.restoreAllMocks();
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("does not fire when user and track change identity between renders", () => {
    const { rerender, unmount } = render(
      <BeachDetailClient beach={beach} slug="test-beach" />,
    );

    for (let i = 0; i < 5; i += 1) {
      advance(60_000);
      signedInAs("user-1");
      rerender(<BeachDetailClient beach={beach} slug="test-beach" />);
    }

    expect(durationEvents()).toHaveLength(0);

    unmount();

    expect(durationEvents()).toHaveLength(1);
    expect(durationEvents()[0][1]).toEqual(
      expect.objectContaining({
        beachId: "beach-1",
        debounceMs: 0,
        metadata: {
          duration_ms: 300_000,
          forecast_viewed: true,
          beach_name: "Test Beach",
        },
      }),
    );
  });

  it("fires once when the tab hides and counts only visible time", () => {
    const { unmount } = render(
      <BeachDetailClient beach={beach} slug="test-beach" />,
    );

    advance(10_000);
    setVisibility("hidden");
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(durationEvents()).toHaveLength(1);
    expect(durationEvents()[0][1].metadata.duration_ms).toBe(10_000);

    // Hours in the background must not count toward the next view.
    advance(6 * 60 * 60 * 1000);
    setVisibility("visible");
    advance(20_000);
    unmount();

    expect(durationEvents()).toHaveLength(2);
    expect(durationEvents()[1][1].metadata.duration_ms).toBe(20_000);
  });

  it("flushes the previous beach on slug change", () => {
    const { rerender, unmount } = render(
      <BeachDetailClient beach={beach} slug="test-beach" />,
    );

    advance(8_000);
    rerender(<BeachDetailClient beach={otherBeach} slug="other-beach" />);

    expect(durationEvents()).toHaveLength(1);
    expect(durationEvents()[0][1]).toEqual(
      expect.objectContaining({
        beachId: "beach-1",
        metadata: expect.objectContaining({ duration_ms: 8_000 }),
      }),
    );

    advance(5_000);
    unmount();

    expect(durationEvents()).toHaveLength(2);
    expect(durationEvents()[1][1]).toEqual(
      expect.objectContaining({
        beachId: "beach-2",
        metadata: expect.objectContaining({ duration_ms: 5_000 }),
      }),
    );
  });

  it("skips views of three seconds or less", () => {
    const { unmount } = render(
      <BeachDetailClient beach={beach} slug="test-beach" />,
    );

    advance(3_000);
    unmount();

    expect(durationEvents()).toHaveLength(0);
  });
});
