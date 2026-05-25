import { render, screen } from "@testing-library/react";

import { FoundingOfferSurface } from "@/components/pricing/founding-offer-surface";

jest.mock("@/components/pricing/founding-access-cta", () => ({
  FoundingAccessCta: () => (
    <div data-testid="founding-access-cta">
      Join the founding access waitlist
    </div>
  ),
}));

const BLOCKED_PUBLIC_COPY = [
  /monthly/i,
  /annual/i,
  /checkout/i,
  /buy now/i,
  /\$\d+/,
] as const;

describe("FoundingOfferSurface", () => {
  it("renders the waitlist-safe founding access page", () => {
    const { container } = render(<FoundingOfferSurface />);

    expect(
      screen.getByRole("heading", {
        name: /join early and help the forecast learn from real sessions/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/check one clear surf call before you paddle out/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/for now, focus on logging sessions/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/log 5 surf sessions in quiver/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(/qualify for pro for lifetime/i).length,
    ).toBeGreaterThan(0);
    expect(screen.getByTestId("founding-access-cta")).toBeInTheDocument();

    const pageText = container.textContent ?? "";
    expect(pageText).not.toMatch(/release gate/i);
    for (const blockedCopy of BLOCKED_PUBLIC_COPY) {
      expect(pageText).not.toMatch(blockedCopy);
    }
  });

  it("teaches the forecast check log adjust loop", () => {
    render(<FoundingOfferSurface />);

    expect(screen.getByText("Forecast")).toBeInTheDocument();
    expect(screen.getByText("Check")).toBeInTheDocument();
    expect(screen.getByText("Log")).toBeInTheDocument();
    expect(screen.getByText("Adjust")).toBeInTheDocument();
    expect(
      screen.getByText(/the model uses that feedback to make the next call/i),
    ).toBeInTheDocument();
  });

  it("uses brand stickers and zine scraps without exposing purchase copy", () => {
    const { container } = render(<FoundingOfferSurface />);

    expect(
      screen.getByTestId("founding-offer-zine-surface"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("pricing-loop-card")).toHaveLength(4);

    for (const sticker of [
      "halftone-circle",
      "breaking-wave",
      "cream-coast-map",
      "forecast-wave-mark",
      "spot-wind-read",
      "surf-wax",
      "teal-curved-arrow",
    ]) {
      expect(
        container.querySelector(`[data-zine-sticker="${sticker}"]`),
      ).not.toBeNull();
    }

    const pageText = container.textContent ?? "";
    for (const blockedCopy of BLOCKED_PUBLIC_COPY) {
      expect(pageText).not.toMatch(blockedCopy);
    }
  });
});
