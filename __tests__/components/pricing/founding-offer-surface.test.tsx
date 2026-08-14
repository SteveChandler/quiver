import { render, screen } from "@testing-library/react";

import { FoundingOfferSurface } from "@/components/pricing/founding-offer-surface";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";

jest.mock("@/components/pricing/founding-access-cta", () => ({
  FoundingAccessCta: () => (
    <div data-testid="founding-access-cta">Get the Android beta</div>
  ),
}));

jest.mock("@/components/pricing/revenuecat-web-checkout-cta", () => ({
  RevenueCatWebCheckoutCta: () => null,
}));

const BLOCKED_PUBLIC_COPY = [
  /monthly/i,
  /annual/i,
  /checkout/i,
  /buy now/i,
  /pricing/i,
  /plan details/i,
  /web plan/i,
  /\$\d+/,
] as const;

describe("FoundingOfferSurface", () => {
  it("renders the App Store trial page", () => {
    const { container } = render(<FoundingOfferSurface />);

    expect(
      screen.getByRole("heading", {
        name: /get quiver/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/14 days free/i).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/app store shows the current plan/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/android beta is open through google play/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/beta open/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/android is coming soon|coming soon/i),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/get the android beta/i)).toBeInTheDocument();
    expect(screen.queryByText(/android waitlist/i)).not.toBeInTheDocument();
    const appStoreLinks = screen.getAllByRole("link", { name: /open app store/i });
    expect(appStoreLinks).toHaveLength(2);
    expect(
      appStoreLinks[0],
    ).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
    expect(screen.getByText("iPhone")).toBeInTheDocument();
    expect(screen.getByText("Available")).toBeInTheDocument();
    expect(screen.queryByText(/app store live/i)).not.toBeInTheDocument();
    const trialCard = screen
      .getByRole("heading", {
        name: /get surf essentials that keep learning from your sessions/i,
      })
      .closest("section");
    if (!trialCard) {
      throw new Error("Expected the plans trial card section");
    }
    expect(trialCard).toHaveClass("torn", "torn-tb");
    expect(trialCard).not.toHaveClass("rot-neg");
    expect(screen.getByTestId("founding-access-cta")).toBeInTheDocument();

    const pageText = container.textContent ?? "";
    expect(pageText).not.toMatch(/release gate/i);
    expect(pageText).not.toMatch(/plans open|plans are not open|lifetime pro/i);
    for (const blockedCopy of BLOCKED_PUBLIC_COPY) {
      expect(pageText).not.toMatch(blockedCopy);
    }
  });

  it("shows Pro benefits in the AllTrails-style membership layout", () => {
    render(<FoundingOfferSurface />);

    expect(screen.getByText(/pro membership includes/i)).toBeInTheDocument();
    expect(screen.getByText("Personal forecasting")).toBeInTheDocument();
    expect(screen.getByText("Best spot + paddle window")).toBeInTheDocument();
    expect(screen.getByText("Board-aware picks")).toBeInTheDocument();
    expect(screen.getByText("Similarity alerts")).toBeInTheDocument();
    expect(screen.getByText("Custom spots")).toBeInTheDocument();
    expect(screen.getByText("Unlimited favorites")).toBeInTheDocument();
    expect(screen.getByText("Offline session saving")).toBeInTheDocument();
    expect(screen.getAllByTestId("plans-pro-feature")).toHaveLength(7);
    expect(screen.queryByText("Offline maps")).not.toBeInTheDocument();
    expect(screen.getByText(/today:/i)).toBeInTheDocument();
    expect(screen.getByText(/day 12:/i)).toBeInTheDocument();
    expect(screen.getByText(/day 14:/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/forecast, check, log, adjust/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/the model uses that feedback to make the next call/i),
    ).not.toBeInTheDocument();
  });

  it("uses a section landmark inside the global main shell", () => {
    const { container } = render(<FoundingOfferSurface />);

    expect(container.querySelector("main")).not.toBeInTheDocument();
    expect(
      screen.getByTestId("founding-offer-zine-surface").querySelector("section"),
    ).toBeInTheDocument();
  });

  it("uses brand stickers and zine scraps with barrel-wave imagery", () => {
    const { container } = render(<FoundingOfferSurface />);

    expect(
      screen.getByTestId("founding-offer-zine-surface"),
    ).toBeInTheDocument();
    expect(screen.getAllByTestId("plans-pro-feature")).toHaveLength(7);
    expect(
      screen.getByRole("img", {
        name: /surfer in a bright pink rash guard carving through the wall/i,
      }),
    ).toHaveAttribute("src", expect.stringContaining("hero-2-barrel-wave"));

    for (const sticker of [
      "halftone-circle",
      "breaking-wave",
      "cream-torn-strip",
      "gold-tape",
      "teal-tape",
      "navy-lightning",
    ]) {
      expect(
        container.querySelector(`[data-zine-sticker="${sticker}"]`),
      ).not.toBeNull();
    }
  });
});
