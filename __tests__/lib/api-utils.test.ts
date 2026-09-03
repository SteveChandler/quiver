import {
  createAuthError,
  createSuccessResponse,
  createValidationError,
  handleApiError,
  validateRequiredParams,
  checkRequiredEnvVars,
  withSecurityHeaders,
  DEFAULT_SECURITY_HEADERS,
} from "@/lib/api-utils";

// Mock NextResponse.json to avoid environment-specific Response implementation
jest.mock("next/server", () => {
  return {
    NextResponse: {
      json: (body: any, init?: any) =>
        new (global as any).Response(JSON.stringify(body), {
          status: init?.status || 200,
          headers: init?.headers || {},
        }),
    },
  };
});

describe("api-utils", () => {
  test("createSuccessResponse returns standardized payload", async () => {
    const res = createSuccessResponse({ hello: "world" }, 201);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.data).toEqual({ hello: "world" });
  });

  test("createValidationError returns 400 with message", async () => {
    const res = createValidationError("Missing param", { field: "id" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("Missing param");
    expect(json.details.field).toBe("id");
  });

  test("createAuthError returns 401 with default message", async () => {
    const res = createAuthError();
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toBe("Authentication required");
  });

  test("handleApiError returns 500 and hides details by default", async () => {
    const res = handleApiError(new Error("boom"));
    // Testing handleApiError's default behavior - 500 is correct for unexpected errors
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.success).toBe(false);
    expect(json.error).toBe("boom");
    expect(json.details).toBeUndefined();
  });

  test("handleApiError includes details when requested", async () => {
    const res = handleApiError(new Error("boom"), undefined, true);
    const json = await res.json();
    expect(json.details.originalError).toBe("boom");
  });

  test("handleApiError never logs or returns credentials from exceptions", async () => {
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const error = new Error('Cannot create property user on string {"access_token":"synthetic-access","refresh_token":"synthetic-refresh"}');
      const response = handleApiError(error, undefined, true);
      const output = JSON.stringify({ body: await response.json(), logs: log.mock.calls });
      expect(response.status).toBe(500);
      expect(output).toContain("[REDACTED]");
      expect(output).not.toContain("synthetic-access");
      expect(output).not.toContain("synthetic-refresh");
    } finally {
      log.mockRestore();
    }
  });

  test("validateRequiredParams detects missing", () => {
    expect(validateRequiredParams({ a: 1 }, ["a"])).toBeNull();
    const msg = validateRequiredParams({ a: 1 }, ["a", "b"]);
    expect(msg).toContain("b");
  });

  test("checkRequiredEnvVars validates env presence", () => {
    const varName = "TEST_ENV_VAR_API_UTILS";
    delete (process.env as any)[varName];
    expect(checkRequiredEnvVars([varName])).toContain(varName);
    (process.env as any)[varName] = "1";
    expect(checkRequiredEnvVars([varName])).toBeNull();
  });

  test("withSecurityHeaders applies defaults", async () => {
    const res = createSuccessResponse({ ok: true });
    const withHeaders = withSecurityHeaders(res);
    Object.entries(DEFAULT_SECURITY_HEADERS).forEach(([k, v]) => {
      expect(withHeaders.headers.get(k)).toBe(v);
    });
  });
});
