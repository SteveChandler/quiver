import { isValidElement } from "react";

let capturedElement: unknown;
let capturedOptions: unknown;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown, options: unknown) => {
    capturedElement = element;
    capturedOptions = options;
    return new Response("mock-png", { headers: { "content-type": "image/png" } });
  }),
}));

function props(): Record<string, unknown> {
  if (!isValidElement(capturedElement)) throw new Error("Expected captured ImageResponse element");
  return capturedElement.props as Record<string, unknown>;
}

describe("/api/og/share-sticker", () => {
  beforeEach(() => {
    capturedElement = null;
    capturedOptions = null;
  });

  it("uses the sticker canvas and graceful query fallbacks", async () => {
    const { GET } = await import("@/app/api/og/share-sticker/route");
    const response = await GET(new Request("http://localhost:3000/api/og/share-sticker?beachName=Ocean+Beach&waveRange=3-5+ft&vibe=Clean+and+fun&date=Aug+10&handle=%40steven") as never);

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(capturedOptions).toEqual(expect.objectContaining({ width: 640, height: 480 }));
    expect(props().style).not.toHaveProperty("backgroundColor");
    expect(isValidElement(props().children)).toBe(true);
  });
});
