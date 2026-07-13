import { isValidElement } from "react";

let mockCapturedImageElement: unknown = null;
let mockCapturedOptions: unknown = null;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown, options: unknown) => {
    mockCapturedImageElement = element;
    mockCapturedOptions = options;
    return new Response("mock-png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

function capturedProps(): Record<string, unknown> {
  if (!isValidElement(mockCapturedImageElement)) {
    throw new Error("Expected captured ImageResponse element");
  }
  return mockCapturedImageElement.props as Record<string, unknown>;
}

describe("install-style OG share cards", () => {
  beforeEach(() => {
    mockCapturedImageElement = null;
    mockCapturedOptions = null;
  });

  it("renders session share cards with the session-card anatomy and share footer", async () => {
    const { GET } = await import("@/app/api/og/session/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/og/session?beach=Ocean+Beach&rating=Epic&stars=5&size=Chest-Head&board=Fish&windLabel=Offshore&windSpeed=7+mph&tagline=Clean+morning+waves&bg=https%3A%2F%2Fcdn.quiversurf.app%2Fsession.jpg&shareUrl=https%3A%2F%2Fwww.quiversurf.app%2Fsessions%2Fsession-abc",
      ) as never,
    );

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(mockCapturedOptions).toEqual(expect.objectContaining({ width: 1080, height: 1920 }));
    expect(capturedProps()).toEqual(
      expect.objectContaining({
        beach: "Ocean Beach",
        rating: "Epic",
        stars: 5,
        size: "Chest-Head",
        board: "Fish",
        windLabel: "Offshore",
        windSpeed: "7 mph",
        tagline: "Clean morning waves",
        bg: "https://cdn.quiversurf.app/session.jpg",
        footer: expect.stringContaining("quiversurf.app/sessions/session-abc"),
        qrImageSrc: expect.stringContaining("data:image/svg+xml"),
      }),
    );
  });

  it("drops untrusted session background image URLs", async () => {
    const { GET } = await import("@/app/api/og/session/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/og/session?beach=Ocean+Beach&rating=Epic&stars=5&size=Chest-Head&board=Fish&bg=http%3A%2F%2F127.0.0.1%3A54321%2Fprivate.png",
      ) as never,
    );

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(capturedProps()).toEqual(
      expect.objectContaining({
        bg: "",
      }),
    );
  });

  it("drops same-site app URLs from session background images", async () => {
    const { GET } = await import("@/app/api/og/session/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/og/session?beach=Ocean+Beach&rating=Epic&bg=https%3A%2F%2Fwww.quiversurf.app%2Fapi%2Fprivate",
      ) as never,
    );

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(capturedProps()).toEqual(
      expect.objectContaining({
        bg: "",
      }),
    );
  });

  it("renders surf-call share cards with the install-card anatomy and QR attribution", async () => {
    const { GET } = await import("@/app/api/og/surf-call/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/og/surf-call?beach=Big+Jetty&score=85&window=7-10am&waveHeight=3-5ft&conditionLabel=Great+Conditions&timeContext=Tomorrow+Morning&message=Good+wave+size",
      ) as never,
    );

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(mockCapturedOptions).toEqual(expect.objectContaining({ width: 1200, height: 630 }));
    expect(capturedProps()).toEqual(
      expect.objectContaining({
        baseUrl: "http://localhost:3000",
        title: "Big Jetty is lining up",
        subtitle: expect.stringContaining("8.5/10"),
        footer: "Free surf forecasts and condition alerts by Quiver",
      }),
    );
    const qrValue = new URL(String(capturedProps().qrValue));
    expect(qrValue.pathname).toBe("/app");
    expect(qrValue.searchParams.get("surface")).toBe("og_surf_call_card");
    expect(qrValue.searchParams.get("qr_id")).toBe("surf_call_share_card");
    expect(qrValue.searchParams.get("utm_source")).toBe("qr");
  });
});
