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

    expect(getLaunchPageMetadata("/pricing")).toEqual({
      launch_campaign: "go_live_2026_05",
      launch_surface: "pricing",
      monetization_status: "waitlist_until_checkout_verified",
      purchase_path_status: "waitlist",
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
    expect(getLaunchDestinationType("/pricing")).toBe("pricing");
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
        href: "/pricing",
        label: "Founding Access Waitlist",
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
      cta_text: "Founding Access Waitlist",
      destination_url: "/pricing",
      destination_path: "/pricing",
      destination_type: "pricing",
    });
  });
});
