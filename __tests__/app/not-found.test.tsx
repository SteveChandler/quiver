import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import NotFound from "@/app/not-found";

jest.mock("next/link", () => {
  return ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  );
});

describe("NotFound page", () => {
  it("renders the 'Caught inside.' headline", () => {
    render(<NotFound />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Caught inside."
    );
  });

  it("renders the body text about the page being worked", () => {
    render(<NotFound />);
    expect(
      screen.getByText("This page got worked. Let's paddle back out.")
    ).toBeInTheDocument();
  });

  it("renders a link back to the homepage with correct text", () => {
    render(<NotFound />);
    const link = screen.getByRole("link", { name: /back to the lineup/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/");
  });

  it("uses dark background class (Deep Twilight navy)", () => {
    const { container } = render(<NotFound />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("bg-[#252D6B]");
  });

  it("does not use light-mode bg-gray-50 class", () => {
    const { container } = render(<NotFound />);
    expect(container.innerHTML).not.toContain("bg-gray-50");
  });
});
