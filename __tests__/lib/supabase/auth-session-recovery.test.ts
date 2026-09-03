/** @jest-environment node */
import { GoTrueClient } from "@supabase/auth-js";

const session = {
  access_token: "synthetic-access",
  refresh_token: "synthetic-refresh",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  expires_in: 3600,
  token_type: "bearer",
  user: { id: "synthetic-user" },
};

function createClient(stored: string) {
  const storage = {
    getItem: jest.fn(async (key: string) => key === "test-session" ? stored : null),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  };
  const fetch = jest.fn(async (input: RequestInfo | URL) => new Response(
    JSON.stringify(String(input).includes("/token") ? session : session.user),
    { status: 200 }
  ));
  const client = new GoTrueClient({
    url: "https://auth.example.test",
    storageKey: "test-session",
    storage,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    persistSession: true,
    fetch,
  });
  return { client, storage, fetch };
}

describe("SDK session recovery", () => {
  it.each([JSON.stringify(JSON.stringify(session)), "malformed synthetic-session", "42", "true"])(
    "rejects malformed stored sessions without logging their contents: %s",
    async (stored) => {
      const log = jest.spyOn(console, "error").mockImplementation(() => {});
      try {
        const { client, storage, fetch } = createClient(stored);
        await client.initialize();
        expect(storage.removeItem).toHaveBeenCalledWith("test-session");
        expect(log).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
      } finally {
        log.mockRestore();
      }
    }
  );

  it("still refreshes a valid expired session", async () => {
    const { client, storage, fetch } = createClient(JSON.stringify({ ...session, expires_at: 1 }));
    const result = await client.getSession();
    expect(result.error).toBeNull();
    expect(result.data.session?.access_token).toBe("synthetic-access");
    expect(fetch).toHaveBeenCalledWith("https://auth.example.test/token?grant_type=refresh_token", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ refresh_token: "synthetic-refresh" }),
    }));
    expect(storage.setItem).toHaveBeenCalledWith("test-session", expect.stringContaining('"access_token":"synthetic-access"'));
    expect(storage.removeItem).not.toHaveBeenCalledWith("test-session");
  });

  it("still verifies a valid session's user against the auth server", async () => {
    const { client, storage, fetch } = createClient(JSON.stringify(session));
    const result = await client.getUser();
    expect(result.error).toBeNull();
    expect(result.data.user?.id).toBe("synthetic-user");
    expect(fetch).toHaveBeenCalledWith("https://auth.example.test/user", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer synthetic-access" }),
    }));
    expect(storage.removeItem).not.toHaveBeenCalledWith("test-session");
  });
});
