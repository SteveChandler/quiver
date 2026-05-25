import { render, screen } from "@testing-library/react";

import PricingPage, { metadata } from "@/app/pricing/page";

jest.mock("@/components/pricing/founding-offer-surface", () => ({
  FoundingOfferSurface: () => <div data-testid="pricing-surface" />,
}));

describe("PricingPage", () => {
  it("exports waitlist-safe metadata", () => {
    expect(metadata.title).toBe("Founding Access Waitlist | Quiver");
    expect(metadata.description).toMatch(/founding access waitlist/i);
    expect(metadata.description).toMatch(/log 5 surf sessions/i);
    expect(metadata.description).toMatch(/pro for lifetime/i);
    expect(metadata.description).not.toMatch(/monthly|annual|\$/i);
  });

  it("renders web page schema without offer schema", () => {
    const { container } = render(<PricingPage />);

    expect(screen.getByTestId("pricing-surface")).toBeInTheDocument();

    const schema = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(schema?.textContent).toContain('"@type":"WebPage"');
    expect(schema?.textContent).not.toContain('"@type":"Offer"');
    expect(schema?.textContent).not.toContain('"offers"');
  });
});
