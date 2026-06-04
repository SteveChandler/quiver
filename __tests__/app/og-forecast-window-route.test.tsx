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

  it("renders shared CTA preview copy instead of the fallback forecast-window card", async () => {
    await GET(
      new Request(
        "http://localhost:3000/api/og/forecast-window?slug=204s&window=2026-06-04T22%3A30%3A00.000Z&label=3%3A30-6%3A00+PM&conditions=2-3+ft+%C2%B7+18s+SSW+%C2%B7+7+mph+SW+%C2%B7+3+ft%2C+rising",
      ) as never,
    );

    const renderedText = collectText(mockCapturedImageElement).join(" ");
    expect(renderedText).toContain("204s 3:30-6:00 PM is lining up");
    expect(renderedText).toContain("2-3 ft");
    expect(renderedText).toContain("18s SSW · 7 mph SW · 3 ft, rising");
    expect(renderedText).not.toContain("Forecast window");
  });
});
