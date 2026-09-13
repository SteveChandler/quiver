/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET } from "@/app/api/me/profile/route";
import { getProfileWithHomeBeachById } from "@/lib/profile/fetchers";

jest.mock("@/lib/profile/fetchers", () => ({
  getProfileWithHomeBeachById: jest.fn(),
}));
jest.mock("@/lib/middleware/api-wrappers", () => ({
  ...jest.requireActual("@/lib/middleware/api-wrappers"),
  withAuth: (handler: unknown) => handler,
}));

const mockFetchProfile = jest.mocked(getProfileWithHomeBeachById);
const supabase = {};
const context = { user: { id: "u1" }, supabase, params: {} };
const request = new NextRequest("http://localhost/api/me/profile");

describe("GET /api/me/profile", () => {
  beforeEach(() => jest.resetAllMocks());

  it("returns 404 when the authenticated user's profile is missing", async () => {
    mockFetchProfile.mockResolvedValue({ profile: null as any, homeBeachName: null });
    const response = await GET(request, context as any);
    expect(mockFetchProfile).toHaveBeenCalledWith("u1", supabase);
    expect(response.status).toBe(404);
    expect((await response.json()).error).toBe("Profile not found");
  });

  it("returns the public profile fields and resolved home beach", async () => {
    mockFetchProfile.mockResolvedValue({
      profile: {
        id: "u1", home_beach_id: "beach-123", full_name: "Test User",
        bio: "hi", location: "SD", avatar_url: null,
      } as any,
      homeBeachName: "Blacks",
    });
    const response = await GET(request, context as any);
    expect(mockFetchProfile).toHaveBeenCalledWith("u1", supabase);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "u1", home_beach_id: "beach-123", full_name: "Test User",
      homeBeachName: "Blacks", bio: "hi", location: "SD", avatar_url: null,
    });
  });
});
