import { track } from "@/lib/analytics";
import { captureClientPostHogEvent } from "@/lib/posthog-client";

jest.mock("@/lib/attribution", () => ({
  getAttributionForAnalytics: () => ({
    utm_source: "newsletter",
    landing_page: "/",
  }),
}));

jest.mock("@/lib/posthog-client", () => ({
  captureClientPostHogEvent: jest.fn(),
}));

describe("analytics track", () => {
  const originalGaId = process.env.NEXT_PUBLIC_GA_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_GA_ID = "G-TEST";
    window.gtag = jest.fn();
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_GA_ID = originalGaId;
    delete window.gtag;
  });

  it("fires PostHog and GA with attribution", () => {
    track("signup_success", { source: "hero" });

    expect(captureClientPostHogEvent).toHaveBeenCalledWith("signup_success", {
      utm_source: "newsletter",
      landing_page: "/",
      source: "hero",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "signup_success", {
      utm_source: "newsletter",
      landing_page: "/",
      source: "hero",
    });
  });

  it("keeps PostHog working when GA is unavailable", () => {
    delete window.gtag;

    track("cta_click", { source: "map" });

    expect(captureClientPostHogEvent).toHaveBeenCalledWith("cta_click", {
      utm_source: "newsletter",
      landing_page: "/",
      source: "map",
    });
  });

  it("swallows PostHog failures", () => {
    (captureClientPostHogEvent as jest.Mock).mockImplementationOnce(() => {
      throw new Error("posthog unavailable");
    });

    expect(() => track("cta_click", { source: "map" })).not.toThrow();
  });
});
