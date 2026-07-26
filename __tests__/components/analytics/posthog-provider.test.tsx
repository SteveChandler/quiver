import React from "react";
import { act, render, waitFor } from "@testing-library/react";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { useAuth } from "@/context/auth-context";
import {
  applyClientPostHogTrackingStorageEvent,
  buildPostHogUserProperties,
  captureQueuedClientPostHogSignup,
  flushQueuedClientPostHogEvents,
  identifyPostHogUser,
  isClientPostHogTrackingRevisionCurrent,
  resetPostHog,
  setAnonymousClientPostHogTracking,
  setClientPostHogTrackingAllowed,
} from "@/lib/posthog-client";
import { getOwnAnalyticsTrackingAllowed } from "@/lib/analytics/consent";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

const mockSupabaseClient = { rpc: jest.fn() };
jest.mock("@/lib/supabase/client", () => ({
  createClient: () => mockSupabaseClient,
}));

jest.mock("@/lib/analytics/consent", () => ({
  getOwnAnalyticsTrackingAllowed: jest.fn(),
}));

jest.mock("@/lib/posthog-client", () => ({
  applyClientPostHogTrackingStorageEvent: jest.fn(),
  buildPostHogUserProperties: jest.fn((user) => ({
    email_domain: user.email?.split("@")[1],
    provider: user.app_metadata?.provider ?? "email",
  })),
  captureQueuedClientPostHogSignup: jest.fn(),
  flushQueuedClientPostHogEvents: jest.fn(),
  identifyPostHogUser: jest.fn(),
  isClientPostHogTrackingRevisionCurrent: jest.fn(() => true),
  resetPostHog: jest.fn(),
  setAnonymousClientPostHogTracking: jest.fn(),
  setClientPostHogTrackingAllowed: jest.fn(() => 1),
}));

describe("PostHogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockReset();
    (isClientPostHogTrackingRevisionCurrent as jest.Mock).mockReset();
    (setClientPostHogTrackingAllowed as jest.Mock).mockReset();
    (isClientPostHogTrackingRevisionCurrent as jest.Mock).mockReturnValue(true);
    (setClientPostHogTrackingAllowed as jest.Mock).mockReturnValue(1);
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
  });

  it("enables anonymous tracking only after auth resolves unauthenticated", () => {
    render(<PostHogProvider />);

    expect(setClientPostHogTrackingAllowed).toHaveBeenCalledWith(null);
    expect(setAnonymousClientPostHogTracking).toHaveBeenCalledTimes(1);
    expect(flushQueuedClientPostHogEvents).toHaveBeenCalledTimes(1);
    expect(identifyPostHogUser).not.toHaveBeenCalled();
  });

  it("listens for consent revocation from another browser tab", () => {
    const { unmount } = render(<PostHogProvider />);
    const event = new StorageEvent("storage", {
      key: "quiver_posthog_tracking_denied_v1",
      newValue: "true",
    });

    window.dispatchEvent(event);
    expect(applyClientPostHogTrackingStorageEvent).toHaveBeenCalledWith(event);

    unmount();
    (applyClientPostHogTrackingStorageEvent as jest.Mock).mockClear();
    window.dispatchEvent(event);
    expect(applyClientPostHogTrackingStorageEvent).not.toHaveBeenCalled();
  });

  it("keeps PostHog pending while authentication is unresolved", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });

    render(<PostHogProvider />);

    expect(setClientPostHogTrackingAllowed).toHaveBeenCalledWith(null);
    expect(setAnonymousClientPostHogTracking).not.toHaveBeenCalled();
    expect(getOwnAnalyticsTrackingAllowed).not.toHaveBeenCalled();
  });

  it("preserves anonymous tracking during a transient auth action", () => {
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    const { rerender } = render(<PostHogProvider />);

    expect(setAnonymousClientPostHogTracking).toHaveBeenCalledTimes(1);

    (setClientPostHogTrackingAllowed as jest.Mock).mockClear();
    (resetPostHog as jest.Mock).mockClear();
    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: true });
    rerender(<PostHogProvider />);

    expect(setClientPostHogTrackingAllowed).not.toHaveBeenCalled();
    expect(resetPostHog).not.toHaveBeenCalled();
  });

  it("identifies authenticated users only after owner consent resolves true", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockResolvedValueOnce(true);

    render(<PostHogProvider />);

    await waitFor(() => {
      expect(getOwnAnalyticsTrackingAllowed).toHaveBeenCalledWith(
        mockSupabaseClient,
        "user-123",
      );
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(true);
      expect(buildPostHogUserProperties).toHaveBeenCalledWith(user);
      expect(identifyPostHogUser).toHaveBeenCalledWith("user-123", {
        email_domain: "example.com",
        provider: "google",
      });
      expect(captureQueuedClientPostHogSignup).toHaveBeenCalledWith(
        "user-123",
      );
      expect(flushQueuedClientPostHogEvents).toHaveBeenCalledTimes(1);
    });
  });

  it("fails closed and revalidates authenticated consent when the tab becomes visible", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    render(<PostHogProvider />);
    await waitFor(() => {
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(true);
    });

    (setClientPostHogTrackingAllowed as jest.Mock).mockClear();
    (resetPostHog as jest.Mock).mockClear();
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    expect(setClientPostHogTrackingAllowed).toHaveBeenCalledWith(null);
    await waitFor(() => {
      expect(getOwnAnalyticsTrackingAllowed).toHaveBeenCalledTimes(2);
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(false);
      expect(resetPostHog).toHaveBeenCalledTimes(1);
    });
  });

  it("ignores an older foreground consent response after a newer recheck", async () => {
    let currentRevision = 0;
    let resolveOlderConsent: (allowed: boolean) => void = () => undefined;
    let resolveNewerConsent: (allowed: boolean) => void = () => undefined;
    const olderConsent = new Promise<boolean>((resolve) => {
      resolveOlderConsent = resolve;
    });
    const newerConsent = new Promise<boolean>((resolve) => {
      resolveNewerConsent = resolve;
    });
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (setClientPostHogTrackingAllowed as jest.Mock).mockImplementation(
      () => ++currentRevision,
    );
    (isClientPostHogTrackingRevisionCurrent as jest.Mock).mockImplementation(
      (revision: number) => revision === currentRevision,
    );
    (getOwnAnalyticsTrackingAllowed as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockReturnValueOnce(olderConsent)
      .mockReturnValueOnce(newerConsent);

    render(<PostHogProvider />);
    await waitFor(() => {
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(true);
    });

    (setClientPostHogTrackingAllowed as jest.Mock).mockClear();
    (identifyPostHogUser as jest.Mock).mockClear();
    act(() => {
      window.dispatchEvent(new Event("focus"));
      window.dispatchEvent(new Event("focus"));
    });
    expect(getOwnAnalyticsTrackingAllowed).toHaveBeenCalledTimes(3);

    resolveNewerConsent(false);
    await waitFor(() => {
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(false);
    });

    resolveOlderConsent(true);
    await act(async () => {
      await olderConsent;
    });
    expect(setClientPostHogTrackingAllowed).not.toHaveBeenCalledWith(true);
    expect(identifyPostHogUser).not.toHaveBeenCalled();
  });

  it("opts out and never identifies when owner consent resolves false", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockResolvedValueOnce(false);

    render(<PostHogProvider />);

    await waitFor(() => {
      expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(false);
    });
    expect(identifyPostHogUser).not.toHaveBeenCalled();
    expect(resetPostHog).toHaveBeenCalledTimes(1);
  });

  it("remains fail-closed when owner consent cannot be loaded", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockRejectedValueOnce(
      new Error("consent unavailable"),
    );

    render(<PostHogProvider />);

    await waitFor(() => {
      expect(getOwnAnalyticsTrackingAllowed).toHaveBeenCalled();
    });
    expect(setClientPostHogTrackingAllowed).toHaveBeenLastCalledWith(null);
    expect(identifyPostHogUser).not.toHaveBeenCalled();
  });

  it("does not let a stale consent lookup overwrite a newer gate decision", async () => {
    let resolveConsent: (allowed: boolean) => void = () => undefined;
    const consentResult = new Promise<boolean>((resolve) => {
      resolveConsent = resolve;
    });
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockReturnValueOnce(
      consentResult,
    );
    (isClientPostHogTrackingRevisionCurrent as jest.Mock).mockReturnValue(false);

    render(<PostHogProvider />);
    resolveConsent(true);

    await waitFor(() => expect(getOwnAnalyticsTrackingAllowed).toHaveBeenCalled());
    expect(setClientPostHogTrackingAllowed).not.toHaveBeenCalledWith(true);
    expect(identifyPostHogUser).not.toHaveBeenCalled();
  });

  it("resets identity after a previously identified user logs out", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user, isLoading: false });
    (getOwnAnalyticsTrackingAllowed as jest.Mock).mockResolvedValueOnce(true);

    const { rerender } = render(<PostHogProvider />);

    await waitFor(() => {
      expect(identifyPostHogUser).toHaveBeenCalledWith(
        "user-123",
        expect.any(Object)
      );
    });

    (useAuth as jest.Mock).mockReturnValue({ user: null, isLoading: false });
    rerender(<PostHogProvider />);

    await waitFor(() => {
      expect(resetPostHog).toHaveBeenCalledTimes(1);
    });
  });
});
