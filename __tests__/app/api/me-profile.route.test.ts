describe("GET /api/me/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    jest.doMock("@/lib/api-utils", () => ({
      createSuccessResponse: (data: any, status = 200) => ({ status, json: async () => ({ success: true, data }) }),
      handleApiError: (err: any) => ({ status: 500, json: async () => ({ success: false, error: String(err) }) }),
    }));
    const { GET } = await import("@/app/api/me/profile/route");
    const res = await GET({} as any, {
      getUserFn: async () => ({ user: null, error: { message: "No auth" } } as any),
    });
    expect(res.status).toBe(401);
    const json = await (res as any).json();
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when profile not found", async () => {
    jest.doMock("@/lib/api-utils", () => ({
      createSuccessResponse: (data: any, status = 200) => ({ status, json: async () => ({ success: true, data }) }),
      handleApiError: (err: any) => ({ status: 500, json: async () => ({ success: false, error: String(err) }) }),
    }));
    const { GET } = await import("@/app/api/me/profile/route");
    const res = await GET({} as any, {
      getUserFn: async () => ({ user: { id: "u1" }, error: null } as any),
      fetchProfileFn: async () => null as any,
    });
    expect(res.status).toBe(404);
    const json = await (res as any).json();
    expect(json.error).toBe("Profile not found");
  });

  it("returns 200 with success envelope and mapped fields", async () => {
    jest.doMock("@/lib/api-utils", () => ({
      createSuccessResponse: (data: any, status = 200) => ({ status, json: async () => ({ success: true, data }) }),
      handleApiError: (err: any) => ({ status: 500, json: async () => ({ success: false, error: String(err) }) }),
    }));
    const { GET } = await import("@/app/api/me/profile/route");
    const res = await GET({} as any, {
      getUserFn: async () => ({ user: { id: "u1" }, error: null } as any),
      fetchProfileFn: async () => ({
        id: "u1",
        home_beach_id: "beach-123",
        full_name: "Test User",
        bio: "hi",
        location: "SD",
        avatar_url: null,
      } as any),
    });
    expect(res.status).toBe(200);
    const json = await (res as any).json();
    expect(json.success).toBe(true);
    expect(json.data.id).toBe("u1");
    expect(json.data.home_beach_id).toBe("beach-123");
    // No legacy field in response anymore
    expect(json.data.default_beach_id).toBeUndefined();
  });
});
