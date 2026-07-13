import React from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { useAuth } from "@/context/auth-context";
import { BeachDetailClient } from "@/app/beach/[slug]/beach-detail-client";
import type { Beach } from "@/types/database";

type PersonalizationRequest = (
  forecast: { id: string; forecast_at: string },
  baseScore: number,
) => void;

let mockBeachDetailProps: {
  onPersonalizationRequest?: PersonalizationRequest;
} | null = null;

jest.mock("@/components/beach-detail", () => {
  const React = require("react");

  return {
    BeachDetail: jest.fn(
      ({
        onPersonalizationRequest,
      }: {
        onPersonalizationRequest?: PersonalizationRequest;
      }) => {
        mockBeachDetailProps = { onPersonalizationRequest };
        return <div data-testid="beach-detail-client-child" />;
      },
    ),
  };
});

jest.mock("@/actions/onboarding-actions", () => ({
  inferHomeBreakFromView: jest.fn(async () => undefined),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

jest.mock("@/lib/analytics", () => ({
  trackPublicPageView: jest.fn(),
}));

type IdleGate = {
  readonly cancelIdleCallback: jest.Mock;
  readonly requestIdleCallback: jest.Mock;
  runIdleCallback: () => void;
};

function installIdleGate(): IdleGate {
  let idleCallback: IdleRequestCallback | null = null;
  const requestIdleCallback = jest.fn(
    (callback: IdleRequestCallback): number => {
      idleCallback = callback;
      return 17;
    },
  );
  const cancelIdleCallback = jest.fn();

  Object.defineProperty(window, "requestIdleCallback", {
    configurable: true,
    writable: true,
    value: requestIdleCallback,
  });
  Object.defineProperty(window, "cancelIdleCallback", {
    configurable: true,
    writable: true,
    value: cancelIdleCallback,
  });

  return {
    cancelIdleCallback,
    requestIdleCallback,
    runIdleCallback: () => {
      idleCallback?.({
        didTimeout: false,
        timeRemaining: () => 50,
      });
    },
  };
}

function jsonResponse(body: unknown): Response {
  return {
    ok: true,
    json: async () => body,
  } as Response;
}

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

describe("BeachDetailClient personalization", () => {
  const originalRequestIdleCallback = window.requestIdleCallback;
  const originalCancelIdleCallback = window.cancelIdleCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBeachDetailProps = null;
    (useAuth as jest.Mock).mockReturnValue({
      user: { id: "user-1", created_at: "2026-07-01T00:00:00Z" },
      session: null,
      isLoading: false,
      isAuthenticated: true,
    });

    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/surf/call")) {
        return jsonResponse({
          data: {
            report: { rating: "fair" },
            isTomorrow: false,
          },
        });
      }

      return jsonResponse({
        data: { score: 91 },
      });
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    cleanup();

    if (originalRequestIdleCallback) {
      Object.defineProperty(window, "requestIdleCallback", {
        configurable: true,
        writable: true,
        value: originalRequestIdleCallback,
      });
    } else {
      Reflect.deleteProperty(window, "requestIdleCallback");
    }

    if (originalCancelIdleCallback) {
      Object.defineProperty(window, "cancelIdleCallback", {
        configurable: true,
        writable: true,
        value: originalCancelIdleCallback,
      });
    } else {
      Reflect.deleteProperty(window, "cancelIdleCallback");
    }
  });

  it("waits until idle before fetching signed-in personalization", async () => {
    const idleGate = installIdleGate();
    const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;

    const { unmount } = render(
      <BeachDetailClient beach={beach} slug="test-beach" />,
    );

    expect(idleGate.requestIdleCallback).toHaveBeenCalledWith(
      expect.any(Function),
      { timeout: 1800 },
    );
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      mockBeachDetailProps?.onPersonalizationRequest?.(
        { id: "forecast-1", forecast_at: "2026-07-08T16:00:00Z" },
        82,
      );
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      idleGate.runIdleCallback();
    });
    act(() => {
      mockBeachDetailProps?.onPersonalizationRequest?.(
        { id: "forecast-1", forecast_at: "2026-07-08T16:00:00Z" },
        82,
      );
    });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/surf/call?beachId=beach-1",
        expect.objectContaining({
          cache: "no-store",
          signal: expect.any(AbortSignal),
        }),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/beach/personalized-score",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/user/beach-affinity?beachId=beach-1",
      undefined,
    );
    unmount();
    expect(idleGate.cancelIdleCallback).toHaveBeenCalledWith(17);
  });
});
