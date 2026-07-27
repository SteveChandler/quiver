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

  it("renders nothing when no useful attribution exists", () => {
    const { container } = render(
      <PhotoAttribution attribution={null} attributionHtml="   " />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
