jest.mock("next/server", () => require("@/__tests__/setup/mock-next-server"));

const mockLinkExperimentEligibility = jest.fn();

jest.mock("@/lib/experiments/assignments", () => ({
  linkExperimentEligibility: (...args: unknown[]) => mockLinkExperimentEligibility(...args),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const { NextResponse } = require("next/server");
  return {
    createSuccessResponse: (data: unknown) => NextResponse.json({ success: true, data }),
    createValidationError: (error: string) => NextResponse.json({ success: false, error }, { status: 400 }),
    createNotFoundError: (resource: string) =>
      NextResponse.json({ success: false, error: `${resource} not found` }, { status: 404 }),
    createErrorResponse: (error: string, _details: unknown, status: number) =>
      NextResponse.json({ success: false, error }, { status }),
    withAuth: (handler: Function) => async (request: unknown, context: { user?: unknown }) => {
      if (!context?.user) return NextResponse.json({ success: false }, { status: 401 });
      return handler(request, context);
    },
    withNoStore: (handler: Function) => async (request: unknown, context: unknown) => {
      const response = await handler(request, context);
      response.headers.set("Cache-Control", "private, no-store, no-cache, must-revalidate");
      return response;
    },
  };
});

import { POST } from "@/app/api/v1/experiments/link/route";

const USER = { id: "11111111-1111-4111-8111-111111111111" };

function request(body: unknown): never {
  return { json: async () => body } as never;
}

describe("POST /api/v1/experiments/link", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links the authenticated native user on the first call", async () => {
    mockLinkExperimentEligibility.mockResolvedValue({
      rowsLinked: 2,
      alreadyLinked: false,
      existingBuild: "12",
      existingSource: "native_app",
    });

    const response = await POST(request({ build: "12" }), { user: USER } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { linked: true } });
    expect(mockLinkExperimentEligibility).toHaveBeenCalledWith(USER.id, "12", "native_app");
  });

  it("accepts an idempotent retry with the existing native linkage", async () => {
    mockLinkExperimentEligibility.mockResolvedValue({
      rowsLinked: 0,
      alreadyLinked: true,
      existingBuild: "12",
      existingSource: "native_app",
    });

    const response = await POST(request({ build: "12" }), { user: USER } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { linked: false, already_linked: true },
    });
  });

  it("rejects a differing write-once linkage", async () => {
    mockLinkExperimentEligibility.mockResolvedValue({
      rowsLinked: 0,
      alreadyLinked: true,
      existingBuild: "web",
      existingSource: "web_oauth",
    });

    const response = await POST(request({ build: "12" }), { user: USER } as never);
    expect(response.status).toBe(409);
  });

  it("returns 404 when a pre-migration user has no assignment rows", async () => {
    mockLinkExperimentEligibility.mockResolvedValue({
      rowsLinked: 0,
      alreadyLinked: false,
      existingBuild: null,
      existingSource: null,
    });

    const response = await POST(request({ build: "12" }), { user: USER } as never);
    expect(response.status).toBe(404);
  });

  it("rejects malformed build numbers", async () => {
    const response = await POST(request({ build: "12.0" }), { user: USER } as never);
    expect(response.status).toBe(400);
    expect(mockLinkExperimentEligibility).not.toHaveBeenCalled();
  });

  it("ignores client-supplied source, user_id, and arm fields", async () => {
    mockLinkExperimentEligibility.mockResolvedValue({
      rowsLinked: 2,
      alreadyLinked: false,
      existingBuild: "12",
      existingSource: "native_app",
    });

    const response = await POST(
      request({ build: "12", source: "web_oauth", user_id: "other", arm: 1 }),
      { user: USER } as never
    );
    expect(response.status).toBe(200);
    expect(mockLinkExperimentEligibility).toHaveBeenCalledWith(USER.id, "12", "native_app");
  });
});
