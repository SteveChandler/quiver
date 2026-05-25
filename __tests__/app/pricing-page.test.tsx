import { render, screen } from "@testing-library/react";
import { permanentRedirect } from "next/navigation";

import PlansPage, { metadata } from "@/app/plans/page";
import PricingRedirectPage from "@/app/pricing/page";

jest.mock("next/navigation", () => ({
  permanentRedirect: jest.fn(),
}));

jest.mock("@/components/pricing/founding-offer-surface", () => ({
  FoundingOfferSurface: () => <div data-testid="plans-surface" />,
}));

describe("PlansPage", () => {
  it("exports App Store trial metadata without web prices", () => {
    expect(metadata.title).toBe(
      "Quiver Pro Plans | 14 Days Free on iPhone",
    );
    expect(metadata.description).toMatch(/14 days free/i);
    expect(metadata.description).toMatch(/personal forecasting/i);
    expect(metadata.description).toMatch(/board-aware picks/i);
    expect(metadata.description).toMatch(/similarity alerts/i);
    expect(metadata.description).toMatch(/custom spots/i);
    expect(metadata.description).toMatch(/offline session saving/i);
    expect(metadata.description).not.toMatch(/pro for lifetime|plans open/i);
    expect(metadata.description).not.toMatch(/monthly|annual|\$/i);
  });

  it("renders web page schema without offer schema", () => {
    const { container } = render(<PlansPage />);

    expect(screen.getByTestId("plans-surface")).toBeInTheDocument();

    const schema = container.querySelector(
      'script[type="application/ld+json"]',
    );
    expect(schema?.textContent).toContain('"@type":"WebPage"');
    expect(schema?.textContent).not.toContain('"@type":"Offer"');
    expect(schema?.textContent).not.toContain('"offers"');
  });
});

describe("PricingRedirectPage", () => {
  it("permanently redirects the old pricing route to plans", () => {
    PricingRedirectPage();

    expect(permanentRedirect).toHaveBeenCalledWith("/plans");
  });
});
