/**
 * @jest-environment node
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const mockGetAll = jest.fn();
const mockSet = jest.fn();
const mockSignInWithPassword = jest.fn();

jest.mock("next/headers", () => ({
  cookies: jest.fn(async () => ({
    getAll: mockGetAll,
    set: mockSet,
  })),
}));

jest.mock("@supabase/ssr", () => ({
  createServerClient: jest.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

import { createServerClient } from "@supabase/ssr";
import { GET } from "@/app/api/e2e-login/route";

const ORIGINAL_ENV = process.env;

describe("GET /api/e2e-login", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...ORIGINAL_ENV,
      E2E_SECRET: "test-secret",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      E2E_USER_EMAIL: "e2e@example.com",
      E2E_USER_PASSWORD: "password",
    };
    mockGetAll.mockReturnValue([{ name: "existing", value: "cookie" }]);
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("uses the shared API wrapper module for response helpers", () => {
    const source = readFileSync(
      join(process.cwd(), "app/api/e2e-login/route.ts"),
      "utf8"
    );

    expect(source).not.toMatch(/from\s+["']@\/lib\/api-utils["']/);
    expect(source).toMatch(/from\s+["']@\/lib\/middleware\/api-wrappers["']/);
  });

  it("rejects non-dev hosts before checking credentials", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/e2e-login?secret=test-secret")
    );
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(body).toEqual({ error: "host not allowed" });
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("rejects missing or incorrect secrets", async () => {
    const response = await GET(
      new Request("https://dev.quiversurf.app/api/e2e-login?secret=wrong")
    );
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(body).toEqual({ error: "unauthorized" });
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("reports missing required environment variables", async () => {
    delete process.env.E2E_USER_PASSWORD;

    const response = await GET(
      new Request("https://dev.quiversurf.app/api/e2e-login?secret=test-secret")
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(body).toEqual({ error: "missing env: E2E_USER_PASSWORD" });
    expect(createServerClient).not.toHaveBeenCalled();
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("signs in the configured E2E user and returns the success envelope", async () => {
    const response = await GET(
      new Request("https://dev.quiversurf.app/api/e2e-login?secret=test-secret")
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(createServerClient).toHaveBeenCalledWith(
      "https://example.supabase.co",
      "anon-key",
      expect.objectContaining({
        cookies: expect.any(Object),
      })
    );
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "e2e@example.com",
      password: "password",
    });
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ ok: true });
  });

  it("returns Supabase sign-in errors", async () => {
    mockSignInWithPassword.mockResolvedValue({
      error: { message: "Invalid login credentials" },
    });

    const response = await GET(
      new Request("https://dev.quiversurf.app/api/e2e-login?secret=test-secret")
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(body).toEqual({ error: "Invalid login credentials" });
  });
});
