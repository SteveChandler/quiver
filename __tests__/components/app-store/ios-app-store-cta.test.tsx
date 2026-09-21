import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { IosAppStoreCta } from "@/components/app-store/ios-app-store-cta";
import { IOS_APP_STORE_CTA } from "@/lib/constants/app-store";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

describe("IosAppStoreCta", () => {
  it("uses the go host and adds a per-click handoff ID", async () => {
    const user = userEvent.setup();

    render(
      <IosAppStoreCta
        source="landing_hero"
        surface="landing-page"
        placement="hero_primary"
      />,
    );

    const link = screen.getByRole("link", { name: IOS_APP_STORE_CTA });
    expect(link).toHaveAttribute(
      "href",
      expect.stringContaining("https://go.quiversurf.app/app/handoff"),
    );

    link.addEventListener("click", (event) => event.preventDefault());
    await user.click(link);

    expect(trackIosAppCtaClick).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "landing_hero",
        surface: "landing-page",
        placement: "hero_primary",
        destination_url: expect.stringContaining(
          "https://go.quiversurf.app/app/handoff?",
        ),
        handoff_id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        ),
      }),
    );
  });
});
