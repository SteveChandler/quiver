describe("handleGet /api/me/profile", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // 401 path is covered by withAuth's own tests — handleGet is only ever
  // invoked with an already-resolved AuthenticatedContext. These tests pin
  // the happy-path and the profile-not-found path.

  it("returns 404 when profile not found", async () => {
    jest.doMock("@/lib/middleware/api-wrappers", () => ({
      withAuth: (handler: any) => handler,
      createSuccessResponse: (data: any, status = 200) => ({ status, json: async () => ({ success: true, data }) }),
      createNotFoundError: (msg: string) => ({ status: 404, json: async () => ({ error: msg }) }),
    }));
    const { handleGet } = await import("@/app/api/me/profile/route");
    const ctx = {
      params: {},
      user: { id: "u1" } as any,
      supabase: {} as any,
    };
    const res = await handleGet({} as any, ctx as any, {
      fetchProfileFn: async () => null as any,
    });
    expect(res.status).toBe(404);
    const json = await (res as any).json();
    expect(json.error).toBe("Profile not found");
  });

  it("returns 200 with success envelope and mapped fields", async () => {
    jest.doMock("@/lib/middleware/api-wrappers", () => ({
      withAuth: (handler: any) => handler,
      createSuccessResponse: (data: any, status = 200) => ({ status, json: async () => ({ success: true, data }) }),
      createNotFoundError: (msg: string) => ({ status: 404, json: async () => ({ error: msg }) }),
    }));
    const { handleGet } = await import("@/app/api/me/profile/route");
    const ctx = {
      params: {},
      user: { id: "u1" } as any,
      supabase: {} as any,
    };
    const res = await handleGet({} as any, ctx as any, {
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
    expect(json.data.default_beach_id).toBeUndefined();
  });
});
