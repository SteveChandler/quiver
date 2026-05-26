import { render, screen } from "@testing-library/react";

import { LandingPricingTeaser } from "@/components/pricing/landing-pricing-teaser";

const BLOCKED_PUBLIC_COPY = [
  /monthly/i,
  /annual/i,
  /checkout/i,
  /buy now/i,
  /\$\d+/,
] as const;

describe("LandingPricingTeaser", () => {
  it("links the landing page to native app availability without purchase copy", () => {
    const { container } = render(<LandingPricingTeaser />);

    const link = screen.getByRole("link", {
      name: /see app options/i,
    });

    expect(link).toHaveAttribute("href", "/plans");
    expect(
      screen.getByText(/iPhone is live\. Android is next\./i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/open quiver on the app store or join the android waitlist/i),
    ).toBeInTheDocument();

    const pageText = container.textContent ?? "";
    for (const blockedCopy of BLOCKED_PUBLIC_COPY) {
      expect(pageText).not.toMatch(blockedCopy);
    }
  });
});
