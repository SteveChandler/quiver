import {
  buildLaunchBlogLinkMetadata,
  getLaunchDestinationType,
  getLaunchPageMetadata,
} from "@/lib/analytics/launch-campaign";

describe("launch campaign analytics helpers", () => {
  it("returns launch metadata for campaign page views", () => {
    expect(getLaunchPageMetadata("/")).toEqual({
      launch_campaign: "go_live_2026_05",
      launch_surface: "landing",
    });

    expect(getLaunchPageMetadata("/plans")).toEqual({
      launch_campaign: "go_live_2026_05",
      launch_surface: "plans",
      monetization_status: "native_app_store_live_web_checkout_unavailable",
      purchase_path_status: "ios_app_store_android_waitlist",
    });

    expect(getLaunchPageMetadata("/features")).toEqual({
      launch_campaign: "go_live_2026_05",
      launch_surface: "features",
      monetization_status: "native_app_store_live_web_checkout_unavailable",
      purchase_path_status: "ios_app_store_android_waitlist",
    });

    expect(getLaunchPageMetadata("/blog/fun-observation-session-logs")).toEqual(
      {
        launch_campaign: "go_live_2026_05",
        launch_surface: "blog_post",
        launch_content_group: "launch_blog",
        blog_slug: "fun-observation-session-logs",
      }
    );
  });

  it("classifies downstream launch destinations coarsely", () => {
    expect(getLaunchDestinationType("/plans")).toBe("plans");
    expect(getLaunchDestinationType("/pricing")).toBe("plans");
    expect(getLaunchDestinationType("/forecast-accuracy")).toBe("forecast");
    expect(getLaunchDestinationType("/ca/san-diego/ocean-beach")).toBe("beach");
    expect(getLaunchDestinationType("/sessions/new")).toBe("session_log");
    expect(getLaunchDestinationType("/learn/how-surf-forecasts-work")).toBe(
      "learn"
    );
    expect(
      getLaunchDestinationType(
        "https://apps.apple.com/us/app/surf-forecast-quiver/id6759300320"
      )
    ).toBe("app_store");
  });

  it("builds click metadata that stays on existing cta_click events", () => {
    expect(
      buildLaunchBlogLinkMetadata({
        href: "/plans",
        label: "Get Quiver",
        sourceSlug: "why-quiver-is-built-around-one-surf-call",
      })
    ).toEqual({
      cta: "other",
      location: "related-links",
      cta_family: "launch_blog_cross_link",
      launch_campaign: "go_live_2026_05",
      launch_content_group: "launch_blog",
      source: "launch_blog",
      surface: "blog-post",
      placement: "related-links",
      blog_slug: "why-quiver-is-built-around-one-surf-call",
      cta_text: "Get Quiver",
      destination_url: "/plans",
      destination_path: "/plans",
      destination_type: "plans",
    });
  });
});
