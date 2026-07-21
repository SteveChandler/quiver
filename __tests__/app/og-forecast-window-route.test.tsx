import { Children, isValidElement, type ReactNode } from "react";

let mockCapturedImageElement: unknown = null;
const mockLoadForecastWindowShareMetadata = jest.fn();

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown) => {
    mockCapturedImageElement = element;
    return new Response("mock-png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

jest.mock("@/lib/share/forecast-window-share", () => {
  const actual = jest.requireActual("@/lib/share/forecast-window-share");
  return {
    ...actual,
    loadForecastWindowShareMetadata: (...args: unknown[]) =>
      mockLoadForecastWindowShareMetadata(...args),
  };
});

import * as route from "@/app/api/og/forecast-window/route";

function neutralMetadata() {
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
  };
}

function collectImageProps(node: unknown, props: Record<string, unknown>[] = []) {
  if (Array.isArray(node)) {
    node.forEach((child) => collectImageProps(child, props));
    return props;
  }

  if (!isValidElement(node)) return props;

  if (node.type === "img") {
    props.push(node.props as Record<string, unknown>);
  }

  Children.forEach(
    (node.props as { children?: ReactNode }).children,
    (child) => collectImageProps(child, props),
  );

  return props;
}

function collectText(node: unknown, text: string[] = []): string[] {
  if (typeof node === "string" || typeof node === "number") {
    text.push(String(node));
    return text;
  }

  if (Array.isArray(node)) {
    node.forEach((child) => collectText(child, text));
    return text;
  }

  if (!isValidElement(node)) return text;

  Children.forEach(
    (node.props as { children?: ReactNode }).children,
    (child) => collectText(child, text),
  );

  return text;
}

describe("/api/og/forecast-window route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedImageElement = null;
    mockLoadForecastWindowShareMetadata.mockResolvedValue(neutralMetadata());
  });

  it("renders the real Quiver app icon in the forecast preview brand lockup", async () => {
    await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=204s&window=2026-06-04T17%3A00%3A00.000Z",
      ) as never,
    );

    expect(collectImageProps(mockCapturedImageElement)).toContainEqual(
      expect.objectContaining({
        src: "http://localhost:3000/quiver-app-icon-128.png",
        alt: "Quiver",
      }),
    );
  });

  it("keeps query-only preview copy neutral, dynamic, and uncached", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=fake-beach&window=2026-06-04T22%3A30%3A00.000Z&label=Ready+now&conditions=20+ft+%C2%B7+Go+now",
      ) as never,
    );

    const renderedText = collectText(mockCapturedImageElement).join(" ");
    expect((route as any).dynamic).toBe("force-dynamic");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockLoadForecastWindowShareMetadata).toHaveBeenCalledWith({
      slug: "fake-beach",
      window: "2026-06-04T22:30:00.000Z",
    });
    expect(renderedText).toContain("Quiver surf window");
    expect(renderedText).not.toMatch(/lining up|ready now|20 ft|go now/i);
  });

  it("renders positive window copy and objective data only from resolved metadata", async () => {
    mockLoadForecastWindowShareMetadata.mockResolvedValue({
      ...neutralMetadata(),
      title: "Server Beach 3:30 PM is lining up",
      description: "Server Beach 3:30 PM is lining up: 4.5 ft.",
      beachName: "Server Beach",
      slug: "server-beach",
      forecastAt: "2026-06-04T22:30:00.000Z",
      windowLabel: "3:30 PM",
      waveHeight: "4.5 ft",
      conditionRow: "18s SSW · 7 mph SW",
      locationLabel: "La Jolla, CA",
      isFallback: false,
    });

    await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=server-beach&window=2026-06-04T22%3A30%3A00.000Z&label=Fake+ready&conditions=99+ft",
      ) as never,
    );

    const renderedText = collectText(mockCapturedImageElement).join(" ");
    expect(renderedText).toContain("Server Beach 3:30 PM is lining up");
    expect(renderedText).toContain("4.5 ft");
    expect(renderedText).toContain("18s SSW · 7 mph SW");
    expect(renderedText).not.toMatch(/Fake ready|99 ft/i);
  });
});
