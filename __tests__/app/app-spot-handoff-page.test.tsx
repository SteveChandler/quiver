import { render, screen } from "@testing-library/react";

const mockLoadForecastWindowShareMetadata = jest.fn();

jest.mock("@/lib/share/forecast-window-share", () => ({
  loadForecastWindowShareMetadata: (...args: unknown[]) =>
    mockLoadForecastWindowShareMetadata(...args),
}));

import AppSpotHandoffPage, {
  generateMetadata,
} from "@/app/app/spot/[slug]/page";
import * as handoffModule from "@/app/app/spot/[slug]/page";
import { IOS_APP_STORE_WEB_REDIRECT_PATH } from "@/lib/constants/app-store";
import { track } from "@/lib/analytics";

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

function neutralMetadata(overrides: Record<string, unknown> = {}) {
  return {
    title: "Open Quiver Surf Window",
    description: "Open this surf window in Quiver.",
    beachName: "This spot",
    slug: "fake-beach",
    forecastAt: null,
    windowLabel: null,
    waveHeight: "Forecast window",
    conditionRow: "",
    locationLabel: null,
    ogImagePath: "/api/og/forecast-window?slug=fake-beach&window=fallback",
    appSpotPath: "/app/spot/fake-beach",
    isFallback: true,
    ...overrides,
  };
}

function positiveMetadata(overrides: Record<string, unknown> = {}) {
  return neutralMetadata({
    title: "Server Beach 7:30 AM is lining up",
    description: "Server Beach 7:30 AM is lining up: 4.5 ft.",
    beachName: "Server Beach",
    slug: "server-beach",
    forecastAt: "2026-06-03T14:30:00.000Z",
    windowLabel: "7:30 AM",
    waveHeight: "4.5 ft",
    conditionRow: "18s SW · 5 mph E",
    locationLabel: "La Jolla, CA",
    ogImagePath:
      "/api/og/forecast-window?slug=server-beach&window=2026-06-03T14%3A30%3A00.000Z",
    appSpotPath: "/app/spot/server-beach?window=2026-06-03T14%3A30%3A00.000Z",
    isFallback: false,
    ...overrides,
  });
}

function firstOpenGraphImageUrl(
  metadata: Awaited<ReturnType<typeof generateMetadata>>,
): string {
  const images = metadata.openGraph?.images;
  const image = Array.isArray(images) ? images[0] : images;
  if (typeof image === "string" || image instanceof URL)
    return image.toString();
  return image?.url?.toString() ?? "";
}

describe("/app/spot/[slug] handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadForecastWindowShareMetadata.mockResolvedValue(neutralMetadata());
  });

  it("is noindexed, dynamic, and no-store", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({ window: "window-1" }),
    });

    expect(metadata.robots && typeof metadata.robots === "object").toBe(true);
    expect((metadata.robots as any).index).toBe(false);
    expect((metadata.robots as any).follow).toBe(false);
    expect(metadata.alternates).toBeUndefined();
    expect((handoffModule as any).dynamic).toBe("force-dynamic");
    expect((handoffModule as any).revalidate).toBe(0);
    expect((handoffModule as any).fetchCache).toBe("force-no-store");
  });

  it("does not let query-only label or conditions authorize positive metadata", async () => {
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "fake-beach" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
        label: "Ready now",
        conditions: "20 ft · Go now",
      }),
    });

    expect(mockLoadForecastWindowShareMetadata).toHaveBeenCalledWith({
      slug: "fake-beach",
      window: "2026-06-03T14:30:00.000Z",
    });
    expect(metadata.title).toBe("Open Quiver Surf Window");
    expect(String(metadata.description)).not.toMatch(
      /lining up|ready now|20 ft|go now/i,
    );
  });

  it("returns positive social metadata only from resolved share metadata", async () => {
    mockLoadForecastWindowShareMetadata.mockResolvedValue(positiveMetadata());

    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: "server-beach" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
        label: "Fake ready",
        conditions: "99 ft",
      }),
    });

    expect(metadata.title).toBe("Server Beach 7:30 AM is lining up");
    expect(metadata.description).toContain("4.5 ft");
    expect(firstOpenGraphImageUrl(metadata)).toContain(
      "/api/og/forecast-window",
    );
    expect(firstOpenGraphImageUrl(metadata)).not.toMatch(
      /label=|conditions=|utm_/,
    );
    expect(JSON.stringify(metadata)).not.toMatch(/Fake ready|99 ft/i);
  });

  it("renders neutral handoff copy without a query-derived ready state or window", async () => {
    mockLoadForecastWindowShareMetadata.mockResolvedValue(
      neutralMetadata({
        title: "Current surf conditions at Server Beach",
        description:
          "Wave, wind, and tide conditions can change quickly. Check the latest forecast and official advisories.",
        beachName: "Server Beach",
        slug: "server-beach",
        forecastAt: "2026-06-03T14:30:00.000Z",
        waveHeight: "4.5 ft",
        conditionRow: "18s SW · 5 mph E",
      }),
    );

    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "fake-ready-beach" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
        label: "Ready now",
      }),
    });

    render(page);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Check current surf conditions in Quiver.",
    );
    expect(screen.queryByText(/is ready/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/window:/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready now|7:30 AM/i)).not.toBeInTheDocument();
  });

  it("renders a resolved positive server beach and window", async () => {
    mockLoadForecastWindowShareMetadata.mockResolvedValue(positiveMetadata());

    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "fake-beach" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
        label: "Fake ready",
      }),
    });

    render(page);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Server Beach is ready in Quiver.",
    );
    expect(screen.getByText(/7:30 AM/i)).toBeInTheDocument();
    expect(screen.queryByText(/Fake ready/i)).not.toBeInTheDocument();
  });

  it("renders App Store and canonical web fallback links", async () => {
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({ window: "window-1" }),
    });

    render(page);

    expect(
      screen.getByRole("link", { name: /open in the app store/i }),
    ).toHaveAttribute("href", IOS_APP_STORE_WEB_REDIRECT_PATH);
    expect(
      screen.getByRole("link", { name: /continue on web/i }),
    ).toHaveAttribute("href", "/beach/ocean-beach");
    expect(screen.queryByText(/window-1/i)).not.toBeInTheDocument();
  });

  it("preserves exact context on the installed-app retry without changing the web fallback", async () => {
    const context = JSON.stringify({
      v: 1,
      beachId: "11111111-1111-4111-8111-111111111111",
      slug: "ocean-beach",
      windowId: "2026-08-25T14:00:00.000Z",
      sourceSurface: "surf_comparison",
      generatedAt: "2026-08-25T12:00:00.000Z",
      expiresAt: "2026-08-25T12:30:00.000Z",
      priorRecommendation: {
        recommendationId:
          "beach:11111111-1111-4111-8111-111111111111:2026-08-25T14:00:00.000Z",
        mode: "best",
        verdict: "go",
      },
    });
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "ocean-beach" }),
      searchParams: Promise.resolve({
        window: "2026-08-25T14:00:00.000Z",
        handoff_id: "33333333-3333-4333-8333-333333333333",
        source: "exact_call",
        surface: "beach_detail",
        placement: "exact_call",
        handoff_context: "exact_call",
        context,
      }),
    });

    render(page);

    const retry = screen.getByRole("link", { name: /open this exact call/i });
    const retryUrl = new URL(
      retry.getAttribute("href")!,
      "https://www.quiversurf.app",
    );
    expect(retryUrl.pathname).toBe("/app/spot/ocean-beach");
    expect(retryUrl.searchParams.get("context")).toBe(context);
    expect(retryUrl.searchParams.get("handoff_id")).toBe(
      "33333333-3333-4333-8333-333333333333",
    );
    expect(screen.getByRole("link", { name: /continue on web/i })).toHaveAttribute(
      "href",
      "/beach/ocean-beach",
    );
  });

  it("retains compact share-open attribution without rendering raw window copy", async () => {
    const page = await AppSpotHandoffPage({
      params: Promise.resolve({ slug: "la-jolla-shores" }),
      searchParams: Promise.resolve({
        window: "2026-06-03T14:30:00.000Z",
      }),
    });

    render(page);

    expect(screen.queryByText(/7:30 AM/i)).not.toBeInTheDocument();
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
