import { render, screen } from "@testing-library/react";

const mockLoadForecastWindowShareMetadata = jest.fn();
const mockGetBeachBySlugOrId = jest.fn();
const mockHeadersGet = jest.fn();

jest.mock("next/headers", () => ({
  headers: jest.fn(async () => ({ get: mockHeadersGet })),
}));

jest.mock("@/lib/utils/beach-lookup-utils", () => ({
  getBeachBySlugOrId: (...args: unknown[]) => mockGetBeachBySlugOrId(...args),
}));

jest.mock("@/lib/share/forecast-window-share", () => ({
  loadForecastWindowShareMetadata: (...args: unknown[]) =>
    mockLoadForecastWindowShareMetadata(...args),
}));

import AppSpotHandoffPage, {
  generateMetadata,
} from "@/app/app/spot/[slug]/page";
import * as handoffModule from "@/app/app/spot/[slug]/page";
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

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESKTOP_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15";
const SHARE_ID = "7c1d7f4e-2b6a-4a57-9a5e-3d8f0b2f6a11";

function requestAs(userAgent: string, host = "www.quiversurf.app"): void {
  mockHeadersGet.mockImplementation((key: string) =>
    key === "host" ? host : key === "user-agent" ? userAgent : null,
  );
}

describe("/app/spot/[slug] handoff page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadForecastWindowShareMetadata.mockResolvedValue(neutralMetadata());
    mockGetBeachBySlugOrId.mockResolvedValue(null);
    requestAs(DESKTOP_UA);
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
    ).toHaveAttribute(
      "href",
      expect.stringContaining("https://go.quiversurf.app/app/handoff"),
    );
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
  describe("share landing", () => {
    it("uses a non-temporal beach card when the link carries no resolvable window", async () => {
      mockGetBeachBySlugOrId.mockResolvedValue({
        name: "Blacks",
        slug: "blacks",
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "blacks" }),
        searchParams: Promise.resolve({ sid: SHARE_ID }),
      });

      expect(metadata.title).toBe("Blacks surf forecast on Quiver");
      expect(String(metadata.title)).not.toMatch(
        /current|now|today|live|call/i,
      );
      expect(firstOpenGraphImageUrl(metadata)).toMatch(
        /\/api\/og\/beach\?slug=blacks$/,
      );
    });

    it("keeps the generic card for an unknown beach", async () => {
      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "nowhere" }),
        searchParams: Promise.resolve({}),
      });

      expect(metadata.title).toBe("Open Quiver Surf Window");
      expect(firstOpenGraphImageUrl(metadata)).toContain(
        "/api/og/forecast-window",
      );
    });

    it("does not replace a resolved window card with the beach card", async () => {
      mockLoadForecastWindowShareMetadata.mockResolvedValue(positiveMetadata());
      mockGetBeachBySlugOrId.mockResolvedValue({
        name: "Server Beach",
        slug: "server-beach",
      });

      const metadata = await generateMetadata({
        params: Promise.resolve({ slug: "server-beach" }),
        searchParams: Promise.resolve({ window: "2026-06-03T14:30:00.000Z" }),
      });

      expect(metadata.title).toBe("Server Beach 7:30 AM is lining up");
      expect(mockGetBeachBySlugOrId).not.toHaveBeenCalled();
    });

    it("offers an Open in Quiver link to the go host on an iPhone at www", async () => {
      requestAs(IPHONE_UA);

      const page = await AppSpotHandoffPage({
        params: Promise.resolve({ slug: "blacks" }),
        searchParams: Promise.resolve({
          window: "2026-06-03T14:30:00.000Z",
          sid: SHARE_ID,
        }),
      });
      render(page);

      const link = screen.getByRole("link", { name: /^open in quiver$/i });
      const href = new URL(link.getAttribute("href")!);
      expect(href.origin).toBe("https://go.quiversurf.app");
      expect(href.pathname).toBe("/app/spot/blacks");
      expect(href.searchParams.get("window")).toBe("2026-06-03T14:30:00.000Z");
      expect(href.searchParams.get("sid")).toBe(SHARE_ID);
      expect(href.searchParams.get("o")).toBe("1");
      expect(
        screen.getByText(/after it installs, tap the message again/i),
      ).toBeInTheDocument();
      expect(screen.queryByText(/already installed/i)).not.toBeInTheDocument();
    });

    it("drops a malformed share id from the Open in Quiver link", async () => {
      requestAs(IPHONE_UA);

      const page = await AppSpotHandoffPage({
        params: Promise.resolve({ slug: "blacks" }),
        searchParams: Promise.resolve({ sid: "not-a-uuid" }),
      });
      render(page);

      const href = new URL(
        screen
          .getByRole("link", { name: /^open in quiver$/i })
          .getAttribute("href")!,
      );
      expect(href.searchParams.has("sid")).toBe(false);
    });

    it.each([
      ["the go host", IPHONE_UA, "go.quiversurf.app", {}],
      ["o=1 at www", IPHONE_UA, "www.quiversurf.app", { o: "1" }],
      ["an Android phone", ANDROID_UA, "www.quiversurf.app", {}],
      ["a desktop browser", DESKTOP_UA, "www.quiversurf.app", {}],
    ])(
      "hides Open in Quiver on %s",
      async (_label, userAgent, host, extraParams) => {
        requestAs(userAgent, host);

        const page = await AppSpotHandoffPage({
          params: Promise.resolve({ slug: "blacks" }),
          searchParams: Promise.resolve({ sid: SHARE_ID, ...extraParams }),
        });
        render(page);

        expect(
          screen.queryByRole("link", { name: /^open in quiver$/i }),
        ).not.toBeInTheDocument();
        expect(
          screen.getByRole("link", { name: /open in the app store/i }),
        ).toBeInTheDocument();
      },
    );

    it("tells a recipient on the go host to open the installed app themselves", async () => {
      requestAs(IPHONE_UA, "go.quiversurf.app");

      const page = await AppSpotHandoffPage({
        params: Promise.resolve({ slug: "blacks" }),
        searchParams: Promise.resolve({ sid: SHARE_ID, o: "1" }),
      });
      render(page);

      expect(
        screen.getByText(/already installed\? open quiver and search/i),
      ).toBeInTheDocument();
    });
  });
});
