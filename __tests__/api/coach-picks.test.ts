/**
 * @jest-environment node
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

jest.mock("@/lib/supabase/api-server-client", () => ({
  createAPIServerClient: () => ({
    rpc: jest.fn(async (_fn: string, _args: any) => ({
      data: [
        {
          pick_rank: 1,
          beach_id: "beach-1",
          name: "First Beach",
          distance_km: 1.2,
          score: 88,
        },
        {
          pick_rank: 2,
          beach_id: "beach-2",
          name: "Second Beach",
          distance_km: 3.4,
          score: 72,
        },
      ],
      error: null,
    })),
  }),
}));

describe("GET /api/coach-picks", () => {
  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/coach-picks/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/@\/lib\/api-utils/);
    expect(source).toMatch(/@\/lib\/middleware\/api-wrappers/);
  });

  it("returns picks when beachId is provided", async () => {
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(
      new URL("http://localhost/api/coach-picks?beachId=test-beach&radiusKm=80")
    );
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    // Accept either { data: { picks } } or { picks }
    const picks = json?.data?.picks || json?.picks;
    expect(Array.isArray(picks)).toBe(true);
    expect(picks[0]).toMatchObject({ name: "First Beach", score: 88 });
  });

  it("returns empty picks when beachId is missing", async () => {
    const { GET } = await import("@/app/api/coach-picks/route");
    const { NextRequest } = await import("next/server");
    const req = new NextRequest(new URL("http://localhost/api/coach-picks"));
    const res = await GET(req as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    const picks = json?.data?.picks || json?.picks;
    expect(picks).toEqual([]);
  });
});

