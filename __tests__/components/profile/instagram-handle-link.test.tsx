import React from "react";
import { render, screen } from "@testing-library/react";
import { InstagramHandleLink } from "@/components/profile/instagram-handle-link";

describe("InstagramHandleLink", () => {
  it("renders @handle as an external link to instagram.com/<handle>", () => {
    render(<InstagramHandleLink handle="@kelly.s" />);

    const link = screen.getByRole("link", { name: "@kelly.s on Instagram (opens in a new tab)" });
    expect(link).toHaveAttribute("href", "https://instagram.com/kelly.s");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    expect(link).toHaveTextContent("@kelly.s");
  });

  it("renders nothing when the handle normalizes to empty", () => {
    const { container } = render(<InstagramHandleLink handle=" @ " />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing when there is no handle", () => {
    const { container } = render(<InstagramHandleLink handle={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
