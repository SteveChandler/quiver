import { Children, isValidElement, type ReactNode } from "react";

let mockCapturedImageElement: unknown = null;

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown) => {
    mockCapturedImageElement = element;
    return new Response("mock-png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

import { GET } from "@/app/api/og/forecast-window/route";

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

describe("/api/og/forecast-window route", () => {
  beforeEach(() => {
    mockCapturedImageElement = null;
  });

  it("renders the real Quiver app icon in the forecast preview brand lockup", async () => {
    await GET(
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
});
