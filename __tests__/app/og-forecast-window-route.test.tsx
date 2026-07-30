import { Children, isValidElement, type ReactNode } from "react";

let mockCapturedImageElement: unknown = null;
let mockCapturedImageOptions: Record<string, unknown> | null = null;
const mockLoadForecastWindowShareMetadata = jest.fn();
const mockFetch = jest.fn();
const originalFetch = global.fetch;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown, options: Record<string, unknown>) => {
    mockCapturedImageElement = element;
    mockCapturedImageOptions = options;
    return new Response("mock-png", {
      status: 200,
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

function collectImageProps(
  node: unknown,
  props: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
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

function collectStyles(
  node: unknown,
  styles: Record<string, unknown>[] = [],
): Record<string, unknown>[] {
  if (Array.isArray(node)) {
    node.forEach((child) => collectStyles(child, styles));
    return styles;
  }

  if (!isValidElement(node)) return styles;

  const style = (node.props as { style?: Record<string, unknown> }).style;
  if (style) styles.push(style);

  Children.forEach(
    (node.props as { children?: ReactNode }).children,
    (child) => collectStyles(child, styles),
  );

  return styles;
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
  beforeAll(() => {
    global.fetch = mockFetch as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedImageElement = null;
    mockCapturedImageOptions = null;
    mockFetch.mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { status: 200 }),
    );
    mockLoadForecastWindowShareMetadata.mockResolvedValue(neutralMetadata());
  });

  it("returns an uncached 1200x630 PNG with absolute poster assets and the brand font", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=204s&window=2026-06-04T17%3A00%3A00.000Z",
      ) as never,
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(route.runtime).toBe("nodejs");
    expect(route.dynamic).toBe("force-dynamic");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toBe(
      "http://localhost:3000/fonts/SpaceGrotesk/SpaceGrotesk-Bold.ttf",
    );
    expect(mockCapturedImageOptions).toEqual(
      expect.objectContaining({
        width: 1200,
        height: 630,
        fonts: [
          expect.objectContaining({
            name: "SpaceGrotesk",
            data: expect.any(ArrayBuffer),
            weight: 700,
            style: "normal",
          }),
        ],
      }),
    );
    expect(collectImageProps(mockCapturedImageElement)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "http://localhost:3000/share/forecast-poster-hero.jpg",
          alt: "",
          width: 1200,
          height: 630,
          style: expect.objectContaining({
            position: "absolute",
            width: "100%",
            height: "100%",
            objectFit: "cover",
          }),
        }),
        expect.objectContaining({
          src: "http://localhost:3000/quiver-app-icon-128.png",
          alt: "Quiver",
          width: 40,
          height: 40,
        }),
      ]),
    );
    expect(collectStyles(mockCapturedImageElement)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: "#0D1020",
          color: "#F5EEDC",
          fontFamily: "SpaceGrotesk",
        }),
        expect.objectContaining({
          height: "36%",
          background:
            "linear-gradient(180deg, rgba(13,16,32,0.94) 0%, rgba(13,16,32,0.55) 55%, rgba(13,16,32,0) 100%)",
        }),
        expect.objectContaining({
          height: "40%",
          background:
            "linear-gradient(0deg, rgba(13,16,32,0.94) 0%, rgba(13,16,32,0.55) 55%, rgba(13,16,32,0) 100%)",
        }),
        expect.objectContaining({
          color: "#F78E42",
          fontSize: 78,
          fontWeight: 700,
          letterSpacing: 2,
          lineHeight: 0.95,
        }),
        expect.objectContaining({
          color: "#FDB84B",
          fontSize: 40,
          fontWeight: 700,
          letterSpacing: 1.5,
        }),
        expect.objectContaining({
          color: "#F5EEDC",
          fontSize: 26,
          letterSpacing: 3,
        }),
        expect.objectContaining({
          color: "#00D4AA",
          fontSize: 24,
        }),
      ]),
    );
  });

  it.each([
    ["short", "PIPE", 92],
    ["medium", "SWAMIS REEF", 78],
    ["long", "HUNTINGTON PIER", 64],
  ])(
    "auto-sizes a %s beach headliner",
    async (_sizeLabel, beachName, expectedFontSize) => {
      mockLoadForecastWindowShareMetadata.mockResolvedValue({
        ...neutralMetadata(),
        beachName,
      });

      await route.GET(
        new Request(
          "http://localhost:3000/api/og/forecast-window?slug=test&window=fallback",
        ) as never,
      );

      expect(collectStyles(mockCapturedImageElement)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            color: "#F78E42",
            fontSize: expectedFontSize,
          }),
        ]),
      );
    },
  );

  it("keeps query-only preview copy neutral, dynamic, and uncached", async () => {
    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=fake-beach&window=2026-06-04T22%3A30%3A00.000Z&label=Ready+now&conditions=20+ft+%C2%B7+Go+now",
      ) as never,
    );

    const renderedText = collectText(mockCapturedImageElement).join(" ");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mockLoadForecastWindowShareMetadata).toHaveBeenCalledWith({
      slug: "fake-beach",
      window: "2026-06-04T22:30:00.000Z",
    });
    expect(renderedText).toContain("SURF FORECAST");
    expect(renderedText).toContain("THIS SPOT");
    expect(renderedText).toContain("FORECAST WINDOW");
    expect(renderedText).toContain("OPEN QUIVER SURF WINDOW");
    expect(renderedText).not.toContain("FORECAST WINDOW ·");
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
    expect(renderedText).toContain("LA JOLLA, CA");
    expect(renderedText).toContain("SERVER BEACH");
    expect(renderedText).toContain("SERVER BEACH 3:30 PM IS LINING UP");
    expect(renderedText).toContain("4.5 FT · 18S SSW · 7 MPH SW");
    expect(renderedText).not.toMatch(/Fake ready|99 ft/i);
  });

  it.each([
    ["only wave height", "4 ft", "", "4 FT"],
    ["only condition details", "", "18s SSW", "18S SSW"],
    ["no condition data", "", "", null],
  ])(
    "omits dangling separators with %s",
    async (_caseLabel, waveHeight, conditionRow, expectedConditionBill) => {
      mockLoadForecastWindowShareMetadata.mockResolvedValue({
        ...neutralMetadata(),
        title: "",
        waveHeight,
        conditionRow,
      });

      await route.GET(
        new Request(
          "http://localhost:3000/api/og/forecast-window?slug=test&window=fallback",
        ) as never,
      );

      const renderedTextNodes = collectText(mockCapturedImageElement);
      const joinedConditionNodes = renderedTextNodes.filter(
        (value) => value !== "·" && value.includes("·"),
      );
      const renderedConditionBills = renderedTextNodes.filter(
        (value) => value === "4 FT" || value === "18S SSW",
      );
      expect(joinedConditionNodes).toEqual([]);
      expect(renderedConditionBills).toEqual(
        expectedConditionBill ? [expectedConditionBill] : [],
      );
    },
  );

  it.each([
    [
      "rejected",
      () => mockFetch.mockRejectedValueOnce(new Error("font unavailable")),
    ],
    [
      "non-OK",
      () =>
        mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 })),
    ],
    [
      "unreadable",
      () =>
        mockFetch.mockResolvedValueOnce({
          ok: true,
          arrayBuffer: jest
            .fn()
            .mockRejectedValueOnce(new Error("font body unavailable")),
        }),
    ],
  ])(
    "returns an uncached PNG with the poster layout when the font request is %s",
    async (_failureType, arrangeFontFailure) => {
      arrangeFontFailure();

      const response = await route.GET(
        new Request(
          "http://localhost:3000/api/og/forecast-window?slug=test&window=fallback",
        ) as never,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toBe("image/png");
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(mockCapturedImageOptions).toEqual({
        width: 1200,
        height: 630,
      });
      expect(collectStyles(mockCapturedImageElement)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            fontFamily: "sans-serif",
          }),
        ]),
      );
    },
  );

  it("uses the shared poster fallback when metadata loading fails", async () => {
    mockLoadForecastWindowShareMetadata.mockRejectedValueOnce(
      new Error("metadata unavailable"),
    );

    const response = await route.GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=server-beach&window=2026-06-04T22%3A30%3A00.000Z",
      ) as never,
    );

    const renderedText = collectText(mockCapturedImageElement).join(" ");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(renderedText).toContain("SURF FORECAST");
    expect(renderedText).toContain("QUIVER");
    expect(renderedText).toContain("FORECAST WINDOW");
    expect(renderedText).toContain("OPEN QUIVER SURF WINDOW");
    expect(collectImageProps(mockCapturedImageElement)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "http://localhost:3000/share/forecast-poster-hero.jpg",
        }),
        expect.objectContaining({
          src: "http://localhost:3000/quiver-app-icon-128.png",
        }),
      ]),
    );
  });
});
