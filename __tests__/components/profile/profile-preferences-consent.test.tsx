import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockGetOwnAnalyticsTrackingAllowed = jest.fn();
const mockSetClientPostHogTrackingAllowed = jest.fn();
const mockIdentifyPostHogUser = jest.fn();
const mockResetPostHog = jest.fn();
const mockCaptureQueuedClientPostHogSignup = jest.fn();
const mockFlushQueuedClientPostHogEvents = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), refresh: jest.fn() }),
}));

jest.mock("@/lib/server-action-utils", () => ({
  withAuthenticatedAction: jest.fn().mockResolvedValue({
    success: true,
    data: {},
  }),
}));

jest.mock("@/lib/analytics/consent", () => {
  const actual = jest.requireActual("@/lib/analytics/consent");
  return {
    ...actual,
    getOwnAnalyticsTrackingAllowed: (...args: unknown[]) =>
      mockGetOwnAnalyticsTrackingAllowed(...args),
  };
});

jest.mock("@/lib/posthog-client", () => ({
  captureQueuedClientPostHogSignup: (...args: unknown[]) =>
    mockCaptureQueuedClientPostHogSignup(...args),
  flushQueuedClientPostHogEvents: (...args: unknown[]) =>
    mockFlushQueuedClientPostHogEvents(...args),
  identifyPostHogUser: (...args: unknown[]) => mockIdentifyPostHogUser(...args),
  resetPostHog: (...args: unknown[]) => mockResetPostHog(...args),
  setClientPostHogTrackingAllowed: (...args: unknown[]) =>
    mockSetClientPostHogTrackingAllowed(...args),
}));

jest.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ rpc: jest.fn() }),
}));

jest.mock("@/components/BeachSelector", () => ({
  BeachSelector: () => null,
}));

jest.mock("@/components/profile/shared/preference-fields", () => ({
  ExperienceLevelField: () => null,
  SurfStylesField: () => null,
}));

jest.mock("@/components/ui/use-toast", () => ({
  toast: jest.fn(),
}));

const { ProfilePreferences } = require("@/components/profile/profile-preferences");

describe("ProfilePreferences analytics consent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(true);
  });

  it("updates the client PostHog gate immediately after saving an opt-out", async () => {
    render(
      <ProfilePreferences
        userId="user-123"
        profile={null}
        beaches={[]}
        onSaveComplete={jest.fn()}
      />,
    );

    const trackingSwitch = await screen.findByRole("switch", {
      name: "Improve recommendations with my activity",
    });
    await waitFor(() => expect(trackingSwitch).toBeEnabled());

    fireEvent.click(trackingSwitch);
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() =>
      expect(mockSetClientPostHogTrackingAllowed).toHaveBeenCalledWith(false),
    );
    expect(mockResetPostHog).toHaveBeenCalledTimes(1);
    expect(mockIdentifyPostHogUser).not.toHaveBeenCalled();
  });

  it("re-identifies the current user after saving an opt-in", async () => {
    mockGetOwnAnalyticsTrackingAllowed.mockResolvedValue(false);

    render(
      <ProfilePreferences
        userId="user-123"
        profile={null}
        beaches={[]}
        onSaveComplete={jest.fn()}
      />,
    );

    const trackingSwitch = await screen.findByRole("switch", {
      name: "Improve recommendations with my activity",
    });
    await waitFor(() => expect(trackingSwitch).toBeEnabled());

    fireEvent.click(trackingSwitch);
    fireEvent.click(screen.getByRole("button", { name: "Save Preferences" }));

    await waitFor(() =>
      expect(mockSetClientPostHogTrackingAllowed).toHaveBeenCalledWith(true),
    );
    expect(mockIdentifyPostHogUser).toHaveBeenCalledWith("user-123");
    expect(mockCaptureQueuedClientPostHogSignup).toHaveBeenCalledWith(
      "user-123",
    );
    expect(mockFlushQueuedClientPostHogEvents).toHaveBeenCalledTimes(1);
    expect(mockResetPostHog).not.toHaveBeenCalled();
  });
});
