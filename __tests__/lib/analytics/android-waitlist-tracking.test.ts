import {
  ANDROID_WAITLIST_CTA_CLICK_EVENT,
  ANDROID_WAITLIST_CTA_VIEW_EVENT,
  trackAndroidWaitlistCtaClick,
  trackAndroidWaitlistCtaView,
} from "@/lib/analytics/android-waitlist-tracking";
import { track } from "@/lib/analytics";
import {
  ANDROID_WAITLIST_CTA,
  ANDROID_WAITLIST_DESTINATION_STATUS,
} from "@/lib/constants/android-waitlist";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/utils/visitor-id", () => ({
  getVisitorId: jest.fn(() => "test-visitor-id"),
}));

const mockFetch = jest.fn(() => Promise.resolve({ ok: true } as Response));
const mockTrack = track as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  Object.defineProperty(window, "innerWidth", { value: 390, writable: true });
});

describe("android-waitlist-tracking", () => {
  it("tracks Android waitlist CTA views to product analytics and internal CTA impressions", () => {
    trackAndroidWaitlistCtaView({
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
    });

    const expectedMetadata = {
      cta_family: "android_waitlist",
      platform: "android",
      destination_type: "profile_flag",
      destination_status: ANDROID_WAITLIST_DESTINATION_STATUS,
      cta_text: ANDROID_WAITLIST_CTA,
      source: "features-hero-android-waitlist",
      surface: "features-page",
      placement: "hero_secondary",
      auth_state: "anonymous",
    };

    expect(mockTrack).toHaveBeenCalledWith(
      ANDROID_WAITLIST_CTA_VIEW_EVENT,
      expectedMetadata,
    );

    const callArgs = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body).toMatchObject({
      eventType: "cta_impression",
      metadata: expectedMetadata,
      sessionId: "test-visitor-id",
      viewportWidth: 390,
    });
  });

  it("tracks Android waitlist CTA clicks to product analytics and internal CTA clicks", () => {
    trackAndroidWaitlistCtaClick({
      source: "features-final-android-waitlist",
      surface: "features-page",
      placement: "final_secondary",
      auth_state: "authenticated",
      profile_flag_requested: true,
    });

    const expectedMetadata = {
      cta_family: "android_waitlist",
      platform: "android",
      destination_type: "profile_flag",
      destination_status: ANDROID_WAITLIST_DESTINATION_STATUS,
      cta_text: ANDROID_WAITLIST_CTA,
      source: "features-final-android-waitlist",
      surface: "features-page",
      placement: "final_secondary",
      auth_state: "authenticated",
      profile_flag_requested: true,
    };

    expect(mockTrack).toHaveBeenCalledWith(
      ANDROID_WAITLIST_CTA_CLICK_EVENT,
      expectedMetadata,
    );

    const callArgs = mockFetch.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    const body = JSON.parse(callArgs[1].body as string);
    expect(body).toMatchObject({
      eventType: "cta_click",
      metadata: expectedMetadata,
      sessionId: "test-visitor-id",
      viewportWidth: 390,
    });
  });
});
