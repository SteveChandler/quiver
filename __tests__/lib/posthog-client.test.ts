jest.mock("posthog-js", () => ({
  init: jest.fn(),
  capture: jest.fn(),
  identify: jest.fn(),
  reset: jest.fn(),
  __quiverInitialized: false,
}));

import posthog from "posthog-js";
import { _resetPostHogClientForTesting, initPostHog } from "@/lib/posthog-client";

describe("posthog-client", () => {
  const originalToken = process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;

  beforeEach(() => {
    jest.clearAllMocks();
    _resetPostHogClientForTesting();
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = "phc_test";
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN = originalToken;
  });

  it("disables PostHog autocaptured pageviews so PageTracker owns page_view taxonomy", () => {
    expect(initPostHog()).toBe(true);

    expect(posthog.init).toHaveBeenCalledWith(
      "phc_test",
      expect.objectContaining({
        capture_pageview: false,
        autocapture: false,
      }),
    );
  });
});
