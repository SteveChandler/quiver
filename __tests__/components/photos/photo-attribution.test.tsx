import { render, screen } from "@testing-library/react";

import { PhotoAttribution } from "@/components/photos/photo-attribution";

describe("PhotoAttribution", () => {
  it("links structured profile attribution without interpreting display-name markup", () => {
    render(
      <PhotoAttribution
        attribution={{
          kind: "profile",
          displayName: "<img src=x onerror=alert(1)> Dawn Patrol",
          profileId: "profile-123",
        }}
      />,
    );

    const link = screen.getByRole("link", {
      name: "<img src=x onerror=alert(1)> Dawn Patrol",
    });
    expect(link).toHaveAttribute("href", "/profile/profile-123");
    expect(document.querySelector("img")).not.toBeInTheDocument();
  });

  it("renders community fallback attribution as text", () => {
    render(
      <PhotoAttribution
        attribution={{
          kind: "community",
          displayName: "Quiver community",
          profileId: null,
        }}
      />,
    );

    expect(screen.getByText("Quiver community")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("falls back to non-linked community attribution when no safe display name exists", () => {
    render(
      <PhotoAttribution
        attribution={{
          kind: "profile",
          displayName: "   ",
          profileId: "profile-123",
        }}
      />,
    );

    expect(screen.getByText("Quiver community")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("converts legacy curated HTML to inert text", () => {
    render(
      <PhotoAttribution
        attribution={null}
        attributionHtml={'Photo by <a href="https://example.com">Ari</a>'}
      />,
    );

    expect(screen.getByText("Photo by Ari")).toBeInTheDocument();
    expect(document.querySelector("a")).not.toBeInTheDocument();
  });

  it("drops public-domain wording from curated credits but keeps the creator", () => {
    render(
      <PhotoAttribution
        attribution={null}
        attributionHtml={'"Marshall Beach Sunset" by <a href="https://www.flickr.com/photos/x">romainguy</a> · <a href="https://creativecommons.org/publicdomain/zero/1.0/">CC0</a> via Openverse'}
      />,
    );
    expect(screen.getByText('"Marshall Beach Sunset" by romainguy via Openverse')).toBeInTheDocument();
  });

  it("keeps the licence on CC BY credits, which require it", () => {
    render(<PhotoAttribution attribution={null} attributionHtml="dpstyles™ / CC BY 2.0" />);
    expect(screen.getByText("dpstyles™ / CC BY 2.0")).toBeInTheDocument();
  });

  it("renders nothing when no useful attribution exists", () => {
    const { container } = render(
      <PhotoAttribution attribution={null} attributionHtml="   " />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
