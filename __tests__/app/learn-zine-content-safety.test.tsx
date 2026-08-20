import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";

import LearnHubPage from "@/app/learn/page";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    priority: _priority,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

jest.mock("@/components/ui/scroll-reveal", () => ({
  ScrollReveal: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/ui/sticky-signup-bar", () => ({
  StickySignupBar: () => null,
}));

describe("learn zine content safety", () => {
  it.each([
    ["/learn/how-to-read-surf-conditions", "How to Read a Surf Report"],
    ["/learn/how-do-tides-work", "How Tides Work for Surfing"],
  ])("keeps the guide CTA outside a torn mask for %s", (href, title) => {
    const { container } = render(<LearnHubPage />);
    const card = container.querySelector<HTMLAnchorElement>(`a[href="${href}"]`);

    expect(card).not.toBeNull();
    expect(card).toHaveClass("torn");
    expect(card).not.toHaveClass("torn-tb");
    expect(within(card!).getByText(/open note/i)).toBeInTheDocument();
    expect(
      within(card!).getByRole("heading", { name: new RegExp(title, "i") }),
    ).toBeInTheDocument();
  });

  it("keeps cross-link CTAs outside torn masks", () => {
    const { container } = render(<LearnHubPage />);
    const card = container.querySelector<HTMLAnchorElement>(
      'a[href="/guides"]',
    );

    expect(card).toHaveClass("torn");
    expect(card).not.toHaveClass("torn-tb");
    expect(within(card!).getByText(/visit/i)).toBeInTheDocument();
  });
});
