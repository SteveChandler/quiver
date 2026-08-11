import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import { IOS_APP_STORE_CTA } from "@/lib/constants/app-store";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

describe("IosAppStoreCta", () => {
  it("uses the campaign-tagged App Store URL for href and click analytics", async () => {
    const user = userEvent.setup();
    const destinationUrl = IOS_APP_STORE_WEB_REDIRECT_PATH;

    render(
      <IosAppStoreCta
        source="landing_hero"
        surface="landing-page"
        placement="hero_primary"
      />,
    );

    const link = screen.getByRole("link", { name: IOS_APP_STORE_CTA });
    expect(link).toHaveAttribute("href", destinationUrl);

    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);

    expect(trackIosAppCtaClick).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "landing_hero",
        surface: "landing-page",
        placement: "hero_primary",
        destination_url: destinationUrl,
      }),
    );
  });
});
