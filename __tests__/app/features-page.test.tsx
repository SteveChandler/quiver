import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import FeaturesPage, { metadata } from "@/app/features/page";
import {
  APP_FIRST_CAMPAIGN,
  IOS_APP_STORE_CTA,
  iosAppStoreUrlWithCampaign,
} from "@/lib/constants/app-store";

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

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

jest.mock("@/components/pricing/android-waitlist-cta", () => ({
  AndroidWaitlistCta: ({
    children,
    source,
    surface,
    placement,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
  }) => (
    <button
      type="button"
      data-testid="android-waitlist-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
    >
      {children}
    </button>
  ),
}));

describe("FeaturesPage", () => {
  it("exports native app conversion metadata", () => {
    expect(metadata.title).toBe(
      "Quiver App Features | Personal Surf Forecasts",
    );
    expect(metadata.description).toMatch(/personal forecasts/i);
    expect(metadata.description).toMatch(/custom spots/i);
    expect(metadata.description).toMatch(/custom surf alerts/i);
  });

  it("leads with native app conversion copy and App Store CTAs", () => {
    render(<FeaturesPage />);

    expect(
      screen.getByRole("heading", {
        name: /a surf app that gets personal/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /every session you log dials in the next call/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /not a report\. a forecast that knows your breaks/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /this is why quiver isn't another surf report you check and forget/i,
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /personal forecasting and the loop/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /custom spots/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /custom alerts/i }),
    ).toBeInTheDocument();

    const appStoreLinks = screen.getAllByRole("link", {
      name: new RegExp(IOS_APP_STORE_CTA, "i"),
    });
    expect(appStoreLinks).toHaveLength(2);
    const expectedAppStoreUrl = iosAppStoreUrlWithCampaign(APP_FIRST_CAMPAIGN);
    appStoreLinks.forEach((link) => {
      expect(link).toHaveAttribute("href", expectedAppStoreUrl);
    });

    const androidWaitlistButtons = screen.getAllByTestId(
      "android-waitlist-cta",
    );
    expect(androidWaitlistButtons).toHaveLength(2);
    androidWaitlistButtons.forEach((button) => {
      expect(button).toHaveTextContent(/get the android beta/i);
      expect(button).not.toHaveTextContent(/waitlist/i);
    });
    expect(androidWaitlistButtons[0]).toHaveAttribute(
      "data-source",
      "features-hero-android-waitlist",
    );
    expect(androidWaitlistButtons[1]).toHaveAttribute(
      "data-source",
      "features-final-android-waitlist",
    );

    expect(
      screen.getByAltText(/home screen showing a session logging prompt/i),
    ).toBeInTheDocument();
    expect(
      screen.getByAltText(/custom spot editor/i),
    ).toBeInTheDocument();
    expect(
      screen.getAllByAltText(/alerts screen/i).length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByRole("link", { name: /read how free surf reports work/i }),
    ).toHaveAttribute("href", "/free-surf-reports");
  });

  it("removes the old beach-directory experience from the features route", () => {
    render(<FeaturesPage />);

    expect(screen.queryByText(/home-break finder/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/browse by state/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/search blacks/i),
    ).not.toBeInTheDocument();
  });
});
