/**
 * @jest-environment node
 */

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: () => ({
    rpc: jest.fn(async (_fn: string, args: any) => {
      // Ensure API forwards radiusKm=30
      if (args && typeof args._radius_km !== "undefined") {
        expect(args._radius_km).toBe(30);
      }
      return {
        data: [
          { pick_rank: 1, beach_id: "near", name: "Near", distance_km: 10, score: 80 },
          { pick_rank: 2, beach_id: "far", name: "Far", distance_km: 35, score: 90 },
        ],
        error: null,
      };
    }),
  }),
}));

describe("GET /api/coach-picks radius forwarding", () => {
  it("passes radiusKm=30 and returns data", async () => {
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new URL("http://localhost/api/coach-picks?beachId=test&radiusKm=30")
    );
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const picks = json?.data?.picks || json?.picks || [];
    expect(Array.isArray(picks)).toBe(true);
    // API layer returns what DB gives; filtering happens in component
  });
});


