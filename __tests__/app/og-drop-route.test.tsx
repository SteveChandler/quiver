import { isValidElement } from "react";
import type { SurfDropRecord } from "@/lib/surf-drops/types";

let capturedElement: unknown = null;
const mockFindDropByShareSlug = jest.fn();

jest.mock("next/og", () => ({
  ImageResponse: jest.fn((element: unknown) => {
    capturedElement = element;
    return new Response("mock-png", {
      headers: { "content-type": "image/png" },
    });
  }),
}));

jest.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({ from: jest.fn() })),
}));

jest.mock("@/lib/surf-drops/repository", () => ({
  createSurfDropsRepository: jest.fn(() => ({
    findDropByShareSlug: mockFindDropByShareSlug,
  })),
}));

function textContent(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textContent).join(" ");
  if (isValidElement(node)) return textContent((node.props as { children?: unknown }).children);
  return "";
}

function activeDrop(overrides: Partial<SurfDropRecord> = {}): SurfDropRecord {
  return {
    id: "550e8400-e29b-41d4-a716-446655440001",
    user_id: "550e8400-e29b-41d4-a716-446655440002",
    share_slug: "ABC23456DE",
    location_type: "custom_pin",
    beach_id: null,
    custom_lat: 32.749,
    custom_lon: -117.253,
    general_area: "North County SD",
    exact_label: "Secret stairs",
    starts_at: "2099-07-02T14:00:00.000Z",
    ends_at: "2099-07-02T15:00:00.000Z",
    audience: "mutuals",
    note: "Meet at the hidden stairs",
    forecast_snapshot: null,
    created_at: "2026-07-02T12:00:00.000Z",
    updated_at: "2026-07-02T12:00:00.000Z",
    cancelled_at: null,
    deleted_at: null,
    beach: null,
    creator: { display_name: "Maya", full_name: null, avatar_url: null },
    participants_count: 2,
    ...overrides,
  };
}

describe("GET /api/og/drop/[slug]", () => {
  beforeEach(() => {
    jest.resetModules();
    capturedElement = null;
    mockFindDropByShareSlug.mockReset();
  });

  it("renders a slug-backed Surf Drop card without exact custom-pin details", async () => {
    mockFindDropByShareSlug.mockResolvedValue(activeDrop());
    const { GET } = await import("@/app/api/og/drop/[slug]/route");

    const response = await GET(
      new Request("http://localhost:3000/api/og/drop/ABC23456DE") as never,
      { params: Promise.resolve({ slug: "ABC23456DE" }) },
    );
    const renderedText = textContent(capturedElement);

    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("Cache-Control")).toBe("public, max-age=86400");
    expect(mockFindDropByShareSlug).toHaveBeenCalledWith("ABC23456DE");
    expect(renderedText).toContain("Surf Drop");
    expect(renderedText).toContain("North County SD");
    expect(renderedText).toContain("Full details unlock after sign in.");
    expect(renderedText).not.toContain("32.749");
    expect(renderedText).not.toContain("-117.253");
    expect(renderedText).not.toContain("Secret stairs");
    expect(renderedText).not.toContain("hidden stairs");
  });

  it("can show a known spot name because known Quiver spots are not custom-pin secrets", async () => {
    mockFindDropByShareSlug.mockResolvedValue(
      activeDrop({
        location_type: "known_spot",
        beach_id: "550e8400-e29b-41d4-a716-446655440003",
        custom_lat: null,
        custom_lon: null,
        exact_label: null,
        beach: {
          id: "550e8400-e29b-41d4-a716-446655440003",
          name: "Ocean Beach Pier",
          lat: 32.75,
          lon: -117.25,
        },
      }),
    );
    const { GET } = await import("@/app/api/og/drop/[slug]/route");

    await GET(
      new Request("http://localhost:3000/api/og/drop/ABC23456DE") as never,
      { params: { slug: "ABC23456DE" } },
    );

    expect(textContent(capturedElement)).toContain("Ocean Beach Pier");
  });
});
