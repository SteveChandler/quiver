import {
  withServerAction,
  withAuthenticatedAction,
  withDatabaseOperation,
} from "@/lib/server-action-utils";

// Mock supabase server client and its usage inside the utils
jest.mock("@/lib/supabase/server", () => {
  return {
    createSupabaseServerClient: async () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "u1" } }, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: "1" }, error: null }),
          }),
        }),
      }),
      storage: {
        from: () => ({
          upload: async () => ({ data: { path: "p" }, error: null }),
          getPublicUrl: () => ({ data: { publicUrl: "http://example.com" } }),
          remove: async () => ({ error: null }),
        }),
      },
    }),
    createSupabaseServiceRoleClient: async () => ({
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: "1" }, error: null }),
          }),
        }),
      }),
    }),
  };
});

describe("server-action-utils", () => {
  test("withServerAction returns success on resolved action", async () => {
    const res = await withServerAction(async () => 42);
    expect(res.success).toBe(true);
    expect(res.data).toBe(42);
  });

  test("withServerAction captures errors", async () => {
    const res = await withServerAction(async () => {
      throw new Error("boom");
    });
    expect(res.success).toBe(false);
    expect(res.error).toBe("boom");
  });

  test("withAuthenticatedAction passes user and client, fails when unauthenticated", async () => {
    // Success path via default mock
    const ok = await withAuthenticatedAction(async (user) => user.id);
    expect(ok.success).toBe(true);
    expect(ok.data).toBe("u1");

    // Override mock to simulate unauthenticated
    jest.resetModules();
    jest.doMock("@/lib/supabase/server", () => ({
      createSupabaseServerClient: async () => ({
        auth: {
          getUser: async () => ({ data: { user: null }, error: null }),
        },
      }),
    }));
    const { withAuthenticatedAction: withAuthAgain } = await import(
      "@/lib/server-action-utils"
    );
    const fail = await withAuthAgain(async () => "x");
    expect(fail.success).toBe(false);
    expect(fail.error).toMatch(/not authenticated/i);
  });

  test("withDatabaseOperation returns data and captures errors", async () => {
    const ok = await withDatabaseOperation(async () => ({
      data: { id: 1 },
      error: null,
    }));
    expect(ok.success).toBe(true);
    expect(ok.data).toEqual({ id: 1 });

    const bad = await withDatabaseOperation(async () => ({
      data: null,
      error: { message: "db err" },
    }));
    expect(bad.success).toBe(false);
    expect(bad.error).toMatch(/db err|failed/i);
  });
});
