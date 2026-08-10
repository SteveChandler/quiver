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
        screen.getByRole("heading", { name: "Check the surf in the app" })
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
        screen.getByRole("heading", { name: "Check the surf in the app" })
      ).toBeInTheDocument();
    });
  });

  it("renders a supplied real figure as the dominant element", () => {
    render(
      <InstallAppCtaSection
        platform="ios"
        source="s"
        surface="seo"
        placement="inline"
        beachName="La Jolla Shores"
        proof={{ value: "64°F", label: "Water temp now" }}
      />
    );

    expect(screen.getByText("64°F")).toBeInTheDocument();
    expect(screen.getByText("Water temp now")).toBeInTheDocument();
  });

  it("renders nothing extra when no real figure is available", () => {
    render(
      <InstallAppCtaSection
        platform="ios"
        source="s"
        surface="seo"
        placement="inline"
        beachName="La Jolla Shores"
      />
    );

    // Absent proof must degrade silently rather than render an empty slot or a
    // placeholder that reads as real data.
    expect(screen.queryByText(/Water temp now/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check the surf in the app" })
    ).toBeInTheDocument();
  });

  it("shows every beach name in the eyebrow, however long", () => {
    render(
      <InstallAppCtaSection
        platform="ios"
        source="s"
        surface="seo"
        placement="inline"
        beachName="Padre Island National Seashore - South Beach"
      />
    );

    // The old character cliff dropped the name for long spots; the eyebrow
    // truncates instead, so personalization survives at every width.
    expect(
      screen.getByText("Padre Island National Seashore - South Beach")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Check the surf in the app" })
    ).toBeInTheDocument();
  });

  it("omits the eyebrow entirely when there is no beach name", () => {
    render(
      <InstallAppCtaSection
        platform="ios"
        source="s"
        surface="seo"
        placement="inline"
      />
    );

    expect(
      screen.getByRole("heading", { name: "Check the surf in the app" })
    ).toBeInTheDocument();
    expect(screen.queryByText("Blacks")).not.toBeInTheDocument();
  });

  it("uses a supplied platform without client-side detection", () => {
    render(
      <InstallAppCtaSection
        platform="ios"
        source="s"
        surface="beach-subpage"
        placement="tides-blacks"
      />
    );

    expect(mockGetFirstTouchPlatform).not.toHaveBeenCalled();
    expect(funnelCtaProps).toHaveBeenCalledWith(
      expect.objectContaining({ platform: "ios" })
    );
    expect(
      screen.getByRole("heading", { name: "Check the surf in the app" })
    ).toBeInTheDocument();
  });
});
