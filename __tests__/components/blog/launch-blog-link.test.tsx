import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LaunchBlogLink } from "@/components/blog/launch-blog-link";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("next/link", () => {
  return ({
    children,
    href,
    onClick,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    onClick?: React.MouseEventHandler<HTMLAnchorElement>;
  }) => (
    <a
      href={href}
      onClick={(event) => {
        onClick?.(event);
        event.preventDefault();
      }}
      {...props}
    >
      {children}
    </a>
  );
});

describe("LaunchBlogLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("tracks launch blog cross-link clicks through cta_click", async () => {
    const user = userEvent.setup();

    render(
      <LaunchBlogLink
        href="/pricing"
        trackingLabel="Founding Access Waitlist"
        sourceSlug="why-quiver-is-built-around-one-surf-call"
      >
        Founding Access Waitlist
      </LaunchBlogLink>
    );

    await user.click(
      screen.getByRole("link", { name: "Founding Access Waitlist" })
    );

    expect(mockTrack).toHaveBeenCalledWith("cta_click", {
      metadata: {
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
      },
      debounceMs: 0,
    });
  });

  it("respects prevented default clicks", async () => {
    const user = userEvent.setup();

    render(
      <LaunchBlogLink
        href="/pricing"
        trackingLabel="Founding Access Waitlist"
        sourceSlug="blog-index"
        onClick={(event) => event.preventDefault()}
      >
        Founding Access Waitlist
      </LaunchBlogLink>
    );

    await user.click(
      screen.getByRole("link", { name: "Founding Access Waitlist" })
    );

    expect(mockTrack).not.toHaveBeenCalled();
  });
});
