/**
 * @jest-environment jsdom
 */

import React from "react";
import { act, render } from "@testing-library/react";
import { useAuth } from "@/context/auth-context";
import { useRecommendationImpression } from "@/hooks/use-recommendation-impression";
import type { RecommendationImpressionInput } from "@/lib/recommendations/impressions";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

type ObserverCallback = IntersectionObserverCallback;

let observerCallbacks: ObserverCallback[] = [];
const observeSpy = jest.fn();
const disconnectSpy = jest.fn();

class MockIntersectionObserver {
  constructor(callback: ObserverCallback) {
    observerCallbacks.push(callback);
  }

  observe = observeSpy;
  disconnect = disconnectSpy;
  unobserve = jest.fn();
  takeRecords = jest.fn(() => []);
  root = null;
  rootMargin = "";
  thresholds = [0, 0.5, 1];
}

function makeImpression(
  id: string,
  beachId: string,
  surface: RecommendationImpressionInput["surface"] = "home_hero"
): RecommendationImpressionInput {
  return {
    recommendationId: `beach:${id}:2026-07-09T14:00:00.000Z`,
    beachId,
    rank: 1,
    score: 88,
    windowStart: "2026-07-09T14:00:00.000Z",
    windowEnd: "2026-07-09T17:00:00.000Z",
    mode: "log",
    timeSlot: "dawn-patrol",
    surface,
  };
}

const impression: RecommendationImpressionInput = makeImpression(
  "beach-1",
  "22222222-2222-4222-8222-222222222222"
);
const batchImpressionA: RecommendationImpressionInput = makeImpression(
  "beach-batch-a",
  "33333333-3333-4333-8333-333333333333",
  "home_top_spots"
);
const batchImpressionB: RecommendationImpressionInput = makeImpression(
  "beach-batch-b",
  "44444444-4444-4444-8444-444444444444",
  "home_top_spots"
);

function ImpressionProbe({
  value = impression,
}: {
  value?: RecommendationImpressionInput;
}) {
  const ref = useRecommendationImpression<HTMLDivElement>(value);
  return <div ref={ref} data-testid="probe" />;
}

function visible(callback: ObserverCallback | undefined, ratio: number): void {
  callback?.(
    [{ isIntersecting: ratio > 0, intersectionRatio: ratio } as IntersectionObserverEntry],
    {} as IntersectionObserver
  );
}

function latestObserver(): ObserverCallback | undefined {
  return observerCallbacks[observerCallbacks.length - 1];
}

describe("useRecommendationImpression", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    observeSpy.mockClear();
    disconnectSpy.mockClear();
    observerCallbacks = [];
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
    (global as any).IntersectionObserver = MockIntersectionObserver;
    global.fetch = jest.fn(async () => new Response(JSON.stringify({ success: true }))) as any;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("logs after 50% visibility for 500ms and de-dupes remounts", async () => {
    const { unmount } = render(<ImpressionProbe />);

    expect(observeSpy).toHaveBeenCalled();
    act(() => {
      visible(latestObserver(), 0.49);
      jest.advanceTimersByTime(500);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    act(() => {
      visible(latestObserver(), 0.5);
      jest.advanceTimersByTime(500);
      jest.runOnlyPendingTimers();
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    unmount();
    render(<ImpressionProbe />);
    act(() => {
      visible(latestObserver(), 1);
      jest.advanceTimersByTime(500);
      jest.runOnlyPendingTimers();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("batches visible impressions into one request", () => {
    render(
      <>
        <ImpressionProbe value={batchImpressionA} />
        <ImpressionProbe value={batchImpressionB} />
      </>
    );

    act(() => {
      visible(observerCallbacks[0], 0.5);
      visible(observerCallbacks[1], 0.5);
      jest.advanceTimersByTime(500);
      jest.runOnlyPendingTimers();
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)).toEqual({
      impressions: [batchImpressionA, batchImpressionB],
    });
  });

  it("does not log impressions without an authenticated user", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null });

    render(<ImpressionProbe />);

    expect(observeSpy).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
