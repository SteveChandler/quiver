import { z } from "zod";
import { withServerAction, withAuthenticatedAction, withDatabaseOperation, makeAuthenticatedAction, createServerAction, getUserById } from "@/lib/server-action-utils";

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
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  describe("withServerAction", () => {
    test("returns success on resolved action", async () => {
      const res = await withServerAction(async () => 42);
      expect(res.success).toBe(true);
      expect(res.data).toBe(42);
    });

    test("captures Error instances", async () => {
      const res = await withServerAction(async () => {
        throw new Error("boom");
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("boom");
    });

    test("captures string errors", async () => {
      const res = await withServerAction(async () => {
        throw "string error";
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("string error");
    });

    test("captures object errors with message", async () => {
      const res = await withServerAction(async () => {
        throw { message: "object error" };
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("object error");
    });

    test("handles unknown error types", async () => {
      const res = await withServerAction(async () => {
        throw 42;
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Unknown error occurred");
    });
  });

  describe("withAuthenticatedAction", () => {
    test("passes user and client on success", async () => {
      const ok = await withAuthenticatedAction(async (user) => user.id);
      expect(ok.success).toBe(true);
      expect(ok.data).toBe("u1");
    });

    test("fails when user is null", async () => {
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
      expect(fail.error).toBe("User not authenticated");
    });

    test("fails when auth.getUser returns error", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ 
              data: { user: null }, 
              error: { message: "Token expired" } 
            }),
          },
        }),
      }));
      const { withAuthenticatedAction: withAuthAgain } = await import(
        "@/lib/server-action-utils"
      );
      const fail = await withAuthAgain(async () => "x");
      expect(fail.success).toBe(false);
      expect(fail.error).toBe("Authentication error: Token expired");
    });

    test("handles action errors properly", async () => {
      const res = await withAuthenticatedAction(async (user, supabase) => {
        throw new Error("Action failed");
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("Action failed");
    });

    test("provides supabase client to action", async () => {
      let clientReceived: any = null;
      await withAuthenticatedAction(async (user, supabase) => {
        clientReceived = supabase;
        return "test";
      });
      expect(clientReceived).toBeTruthy();
      expect(typeof clientReceived.from).toBe("function");
    });
  });

  describe("makeAuthenticatedAction", () => {
    test("creates authenticated action that works with args", async () => {
      const action = makeAuthenticatedAction(async (user, supabase, name: string, age: number) => {
        return { userId: user.id, name, age };
      });

      const result = await action("John", 30);
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ userId: "u1", name: "John", age: 30 });
    });

    test("handles authentication errors in curried version", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
          },
        }),
      }));

      const { makeAuthenticatedAction: makeAuthAgain } = await import(
        "@/lib/server-action-utils"
      );

      const action = makeAuthAgain(async (user, supabase, arg: string) => {
        return arg;
      });

      const result = await action("test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not authenticated");
    });

    test("handles action errors in curried version", async () => {
      const action = makeAuthenticatedAction(async (user, supabase, shouldFail: boolean) => {
        if (shouldFail) {
          throw new Error("Curried action failed");
        }
        return "success";
      });

      const result = await action(true);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Curried action failed");
    });
  });

  describe("withDatabaseOperation", () => {
    test("returns data on success", async () => {
      const ok = await withDatabaseOperation(async () => ({
        data: { id: 1 },
        error: null,
      }));
      expect(ok.success).toBe(true);
      expect(ok.data).toEqual({ id: 1 });
    });

    test("handles database errors", async () => {
      const bad = await withDatabaseOperation(async () => ({
        data: null,
        error: { message: "db err" },
      }));
      expect(bad.success).toBe(false);
      expect(bad.error).toBe("db err");
    });

    test("handles missing error message", async () => {
      const bad = await withDatabaseOperation(async () => ({
        data: null,
        error: {},
      }));
      expect(bad.success).toBe(false);
      expect(bad.error).toBe("Database operation failed");
    });

    test("handles missing data", async () => {
      const bad = await withDatabaseOperation(async () => ({
        data: null,
        error: null,
      }));
      expect(bad.success).toBe(false);
      expect(bad.error).toBe("No data returned from operation");
    });

    test("allows null data when allowNull option is set", async () => {
      const ok = await withDatabaseOperation(async () => ({
        data: null,
        error: null,
      }), { allowNull: true });
      expect(ok.success).toBe(true);
      expect(ok.data).toBeNull();
    });

    test("still returns data normally with allowNull option", async () => {
      const ok = await withDatabaseOperation(async () => ({
        data: { id: 1 },
        error: null,
      }), { allowNull: true });
      expect(ok.success).toBe(true);
      expect(ok.data).toEqual({ id: 1 });
    });

    test("still throws on error even with allowNull option", async () => {
      const bad = await withDatabaseOperation(async () => ({
        data: null,
        error: { message: "db err" },
      }), { allowNull: true });
      expect(bad.success).toBe(false);
      expect(bad.error).toBe("db err");
    });

    test("provides supabase client to operation", async () => {
      let clientReceived: any = null;
      await withDatabaseOperation(async (supabase) => {
        clientReceived = supabase;
        return { data: { test: true }, error: null };
      });
      expect(clientReceived).toBeTruthy();
      expect(typeof clientReceived.from).toBe("function");
    });
  });

  describe("getUserById", () => {
    test("returns user profile by ID", async () => {
      const result = await getUserById("user-123");
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "1" });
    });

    test("handles database errors", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => ({
          from: () => ({
            select: () => ({
              eq: () => ({
                single: async () => ({ data: null, error: { message: "User not found" } }),
              }),
            }),
          }),
        }),
      }));

      const { getUserById: getUserAgain } = await import("@/lib/server-action-utils");
      const result = await getUserAgain("user-123");
      expect(result.success).toBe(false);
      expect(result.error).toBe("User not found");
    });
  });




  describe("error handling edge cases", () => {
    test("handles supabase client creation errors", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => {
          throw new Error("Client creation failed");
        },
      }));

      const { withAuthenticatedAction: withAuthAgain } = await import(
        "@/lib/server-action-utils"
      );

      const result = await withAuthAgain(async () => "test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Client creation failed");
    });

    test("handles null user with error", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ 
              data: { user: null }, 
              error: { message: "Invalid token" } 
            }),
          },
        }),
      }));

      const { withAuthenticatedAction: withAuthAgain } = await import(
        "@/lib/server-action-utils"
      );

      const result = await withAuthAgain(async () => "test");
      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication error: Invalid token");
    });

    test("handles action throwing non-Error objects", async () => {
      const result = await withAuthenticatedAction(async () => {
        throw { code: 401, message: "Unauthorized" };
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unauthorized");
    });

    test("handles action throwing primitives", async () => {
      const result = await withAuthenticatedAction(async () => {
        throw null;
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");
    });
  });


  describe("createServerAction", () => {
    test("creates action with validation only", async () => {
      const schema = z.object({ message: z.string() });
      const handler = jest.fn().mockResolvedValue({ sent: true });

      const action = createServerAction({
        schema,
        handler: async ({ input }) => handler(input),
      });

      const result = await action({ message: "Hello" });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith({ message: "Hello" });
    });

    test("creates action with auth required", async () => {
      const schema = z.object({ message: z.string() });
      const handler = jest.fn().mockResolvedValue({ sent: true });

      const action = createServerAction({
        schema,
        auth: true,
        handler: async ({ input, user }) => {
          expect(user).toBeDefined();
          expect(user?.id).toBe("u1");
          return handler(input);
        },
      });

      const result = await action({ message: "Hello" });
      expect(result.success).toBe(true);
    });

    test("rejects invalid input before calling handler", async () => {
      const schema = z.object({ message: z.string().min(5) });
      const handler = jest.fn();

      const action = createServerAction({
        schema,
        handler: async ({ input }) => handler(input),
      });

      const result = await action({ message: "Hi" });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Validation failed");
      expect(handler).not.toHaveBeenCalled();
    });

    test("creates action without schema (no validation)", async () => {
      const handler = jest.fn().mockResolvedValue({ done: true });

      const action = createServerAction({
        handler: async ({ input }) => handler(input),
      });

      const result = await action({ anything: "goes" });

      expect(result.success).toBe(true);
      expect(handler).toHaveBeenCalledWith({ anything: "goes" });
    });

    test("handles auth errors when auth is required", async () => {
      jest.doMock("@/lib/supabase/server", () => ({
        createSupabaseServerClient: async () => ({
          auth: {
            getUser: async () => ({ data: { user: null }, error: null }),
          },
        }),
      }));

      const { createServerAction: createServerActionAgain } = await import(
        "@/lib/server-action-utils"
      );

      const schema = z.object({ message: z.string() });
      const handler = jest.fn();

      const action = createServerActionAgain({
        schema,
        auth: true,
        handler: async ({ input }) => handler(input),
      });

      const result = await action({ message: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required");
      expect(handler).not.toHaveBeenCalled();
    });

    test("handles handler errors", async () => {
      const schema = z.object({ message: z.string() });

      const action = createServerAction({
        schema,
        handler: async () => {
          throw new Error("Handler failed");
        },
      });

      const result = await action({ message: "Hello" });

      expect(result.success).toBe(false);
      expect(result.error).toBe("Handler failed");
    });

    test("provides supabase client to handler", async () => {
      const schema = z.object({ message: z.string() });
      let receivedSupabase: any = null;

      const action = createServerAction({
        schema,
        handler: async ({ input, supabase }) => {
          receivedSupabase = supabase;
          return { received: true };
        },
      });

      await action({ message: "Hello" });

      expect(receivedSupabase).toBeTruthy();
      expect(typeof receivedSupabase.from).toBe("function");
    });
  });
});
