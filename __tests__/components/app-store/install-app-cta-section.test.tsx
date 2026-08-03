import { render, screen, waitFor } from "@testing-library/react";

import { InstallAppCtaSection } from "@/components/app-store/install-app-cta-section";

const mockGetFirstTouchPlatform = jest.fn();
jest.mock("@/lib/analytics/web-context", () => ({
  getFirstTouchPlatform: () => mockGetFirstTouchPlatform(),
}));

const funnelCtaProps = jest.fn();
jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: (props: Record<string, unknown>) => {
    funnelCtaProps(props);
    return <a href="https://example.test/funnel-cta">funnel-cta</a>;
  },
}));

describe("InstallAppCtaSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(["ios", "android", "desktop"] as const)(
    "renders the funnel CTA with attribution props on %s",
    async (platform) => {
      mockGetFirstTouchPlatform.mockReturnValue(platform);

      render(
        <InstallAppCtaSection
          source="beach-detail-blacks"
          surface="beach-detail"
          placement="after-tabs"
          beachName="Blacks"
        />
      );

      await waitFor(() => {
        expect(funnelCtaProps).toHaveBeenCalledWith(
          expect.objectContaining({
            platform,
            source: "beach-detail-blacks",
            surface: "beach-detail",
            placement: "after-tabs",
          })
        );
      });
      expect(
        screen.getByRole("heading", { name: "Check Blacks from the app" })
      ).toBeInTheDocument();
    }
  );

  it("uses the generic heading without a beach name", async () => {
    mockGetFirstTouchPlatform.mockReturnValue("desktop");

    render(
      <InstallAppCtaSection source="s" surface="seo" placement="inline" />
    );

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "Check the surf from the app" })
      ).toBeInTheDocument();
    });
  });
});
