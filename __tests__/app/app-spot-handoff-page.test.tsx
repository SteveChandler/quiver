import { render, screen } from "@testing-library/react";

import AppSpotHandoffPage, { generateMetadata } from "@/app/app/spot/[slug]/page";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";
import { track } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

function firstOpenGraphImageUrl(metadata: Awaited<ReturnType<typeof generateMetadata>>): string {
  const images = metadata.openGraph?.images;
  const image = Array.isArray(images) ? images[0] : images;
  if (typeof image === "string" || image instanceof URL) return image.toString();
  return image?.url?.toString() ?? "";
}

describe("/app/spot/[slug] handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("is noindexed so app-link fallback URLs do not create SEO canonicals", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({ window: "window-1" }),
    });

    expect(metadata.robots && typeof metadata.robots === "object").toBe(true);
    expect((metadata.robots as any).index).toBe(false);
    expect((metadata.robots as any).follow).toBe(false);
    expect(metadata.alternates).toBeUndefined();
  });

  it("returns selected-window social metadata for timestamp windows", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "la-jolla-shores" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
      }),
    });

    expect(metadata.title).not.toBe("Open Quiver Surf Window");
    expect(String(metadata.title)).toContain("is lining up");
    expect(metadata.openGraph?.title).toContain("is lining up");
    expect(firstOpenGraphImageUrl(metadata)).toContain("/api/og/forecast-window");
    expect(firstOpenGraphImageUrl(metadata)).not.toContain("utm_");
  });

  it("renders App Store and canonical web fallback links while preserving window context", async () => {
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({ window: "window-1" }),
    });

    render(page);

    expect(
      screen.getByRole("link", { name: /open in the app store/i })
    ).toHaveAttribute("href", IOS_APP_STORE_URL);
    expect(
      screen.getByRole("link", { name: /continue on web/i })
    ).toHaveAttribute("href", "/beach/ocean-beach");
    expect(screen.getByText(/window-1/i)).toBeInTheDocument();
  });

  it("renders a human-readable selected-window label and emits compact share-open attribution", async () => {
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "la-jolla-shores" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
      }),
    });

    render(page);

    expect(screen.getByText(/7:30 AM/i)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith(
      "share_link_opened",
      expect.objectContaining({
        campaign: "forecast_window",
        target_type: "forecast_window",
        target_id: "la-jolla-shores:2026-06-03T14:30:00.000Z",
        selected_forecast_at: "2026-06-03T14:30:00.000Z",
        link_path_format: "app_spot_window",
      }),
      { includeAttribution: false },
    );
  });
});
