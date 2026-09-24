import { render, within } from "@testing-library/react";
import type { ReactNode } from "react";

import LearnHubPage from "@/app/learn/page";
import { SITE_URL } from "@/lib/constants/seo";

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
  it("emits absolute URLs in the Learn page structured data", () => {
    const { container } = render(<LearnHubPage />);
    const schemas: Array<Record<string, unknown>> = Array.from(
      container.querySelectorAll('script[type="application/ld+json"]'),
    ).map((script) =>
      JSON.parse(script.textContent ?? "{}") as Record<string, unknown>,
    );
    const breadcrumb = schemas.find(
      (schema) => schema["@type"] === "BreadcrumbList",
    );
    const breadcrumbItems = breadcrumb?.itemListElement as
      | Array<{ item: string }>
      | undefined;
    const webPage = schemas.find((schema) => schema["@type"] === "WebPage");

    expect(breadcrumbItems?.map(({ item }) => item)).toEqual([
      SITE_URL,
      `${SITE_URL}/learn`,
    ]);
    expect(webPage?.url).toBe(`${SITE_URL}/learn`);
  });

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
