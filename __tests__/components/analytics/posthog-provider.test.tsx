import React from "react";
import { render, waitFor } from "@testing-library/react";
import { PostHogProvider } from "@/components/analytics/posthog-provider";
import { useAuth } from "@/context/auth-context";
import {
  buildPostHogUserProperties,
  identifyPostHogUser,
  initPostHog,
  resetPostHog,
} from "@/lib/posthog-client";

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/posthog-client", () => ({
  buildPostHogUserProperties: jest.fn((user) => ({
    email_domain: user.email?.split("@")[1],
    provider: user.app_metadata?.provider ?? "email",
  })),
  identifyPostHogUser: jest.fn(),
  initPostHog: jest.fn(),
  resetPostHog: jest.fn(),
}));

describe("PostHogProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: null });
  });

  it("initializes PostHog on mount", () => {
    render(<PostHogProvider />);

    expect(initPostHog).toHaveBeenCalledTimes(1);
  });

  it("identifies authenticated users with privacy-safe properties", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user });

    render(<PostHogProvider />);

    await waitFor(() => {
      expect(buildPostHogUserProperties).toHaveBeenCalledWith(user);
      expect(identifyPostHogUser).toHaveBeenCalledWith("user-123", {
        email_domain: "example.com",
        provider: "google",
      });
    });
  });

  it("resets identity after a previously identified user logs out", async () => {
    const user = {
      id: "user-123",
      email: "steven@example.com",
      app_metadata: { provider: "google" },
    };
    (useAuth as jest.Mock).mockReturnValue({ user });

    const { rerender } = render(<PostHogProvider />);

    await waitFor(() => {
      expect(identifyPostHogUser).toHaveBeenCalledWith(
        "user-123",
        expect.any(Object)
      );
    });

    (useAuth as jest.Mock).mockReturnValue({ user: null });
    rerender(<PostHogProvider />);

    await waitFor(() => {
      expect(resetPostHog).toHaveBeenCalledTimes(1);
    });
  });
});
