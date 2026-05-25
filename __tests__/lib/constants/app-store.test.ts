import {
  IOS_APP_STORE_APP_ID,
  IOS_APP_STORE_CTA,
  IOS_APP_STORE_DESTINATION_STATUS,
  IOS_APP_STORE_SMART_BANNER_ARGUMENT,
  IOS_APP_STORE_URL,
  IOS_TESTFLIGHT_BETA_CTA,
  IOS_TESTFLIGHT_BETA_URL,
} from "@/lib/constants/app-store";

describe("app-store constants", () => {
  it("keeps iOS App Store destination copy in one conservative source of truth", () => {
    expect(IOS_APP_STORE_APP_ID).toBe("6759300320");
    expect(IOS_APP_STORE_URL).toBe(
      "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320",
    );
    expect(IOS_APP_STORE_CTA).toBe("Open App Store");
    expect(IOS_APP_STORE_DESTINATION_STATUS).toBe("app_store_preorder");
    expect(IOS_APP_STORE_CTA).not.toMatch(/download|pre[- ]?order/i);
  });

  it("keeps smart banner and TestFlight destinations separate", () => {
    expect(IOS_APP_STORE_SMART_BANNER_ARGUMENT).toBe(
      "https://www.quiversurf.app",
    );
    expect(IOS_TESTFLIGHT_BETA_URL).toBe(
      "https://testflight.apple.com/join/G31D4XW6",
    );
    expect(IOS_TESTFLIGHT_BETA_CTA).toBe("Join the Quiver iOS beta");
  });
});
