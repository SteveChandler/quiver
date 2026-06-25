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

  it("renders session share cards with the install-card anatomy and QR attribution", async () => {
    const { GET } = await import("@/app/api/og/session/route");

    const response = await GET(
      new Request(
        "http://localhost:3000/api/og/session?beach=Ocean+Beach&rating=Epic&stars=5&size=Chest-Head&board=Fish&windLabel=Offshore&windSpeed=7+mph&tagline=Clean+morning+waves&shareUrl=https%3A%2F%2Fwww.quiversurf.app%2Fsessions%2Fsession-abc",
      ) as never,
    );

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(mockCapturedOptions).toEqual(expect.objectContaining({ width: 1080, height: 1920 }));
    expect(capturedProps()).toEqual(
      expect.objectContaining({
        baseUrl: "http://localhost:3000",
        title: "Get Quiver",
        subtitle: expect.stringContaining("Ocean Beach session"),
        footer: expect.stringContaining("quiversurf.app/sessions/session-abc"),
      }),
    );
    const qrValue = new URL(String(capturedProps().qrValue));
    expect(qrValue.pathname).toBe("/app");
    expect(qrValue.searchParams.get("surface")).toBe("og_session_card");
    expect(qrValue.searchParams.get("qr_id")).toBe("session_share_card");
    expect(qrValue.searchParams.get("utm_source")).toBe("qr");
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
