/**
 * @jest-environment node
 */

jest.mock("@/lib/posthog-server", () => ({
  capturePostHogEvent: jest.fn(),
}));

import { capturePostHogEvent } from "@/lib/posthog-server";
import { withCommunityPhotoRouteObservability } from "@/lib/community-photos/observability";
import { NextRequest, NextResponse } from "next/server";
import type { RouteHandler } from "@/lib/middleware/api-wrappers/types";

const mockCapturePostHogEvent = capturePostHogEvent as jest.Mock;

describe("community photo route observability", () => {
  const originalSha = process.env.VERCEL_GIT_COMMIT_SHA;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.VERCEL_GIT_COMMIT_SHA =
      "0123456789abcdef0123456789abcdef01234567";
    mockCapturePostHogEvent.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env.VERCEL_GIT_COMMIT_SHA = originalSha;
  });

  it("captures the normalized upload outcome without request or identity data", async () => {
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(1_042);
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/community-photos/upload",
        surface: "write",
        successResultClass: "upload_success",
      },
      async () => Response.json({ id: "must-not-be-captured" }, { status: 201 }),
    );
    const request = new Request(
      "https://example.com/api/community-photos/upload?photoId=secret",
      {
        method: "POST",
        headers: {
          authorization: "Bearer secret",
          "x-quiver-platform": "ios",
          "x-quiver-build-number": "123",
        },
      },
    );

    const response = await handler(request);

    expect(response.status).toBe(201);
    expect(mockCapturePostHogEvent).toHaveBeenCalledWith({
      distinctId: "community-photo-route",
      event: "community_photo_route_outcome",
      properties: {
        route: "/api/community-photos/upload",
        method: "POST",
        status: 201,
        duration_ms: 42,
        platform_build: "ios:123",
        result_class: "upload_success",
        rollout_eligibility: "eligible",
        deployment_sha: "0123456789abcdef0123456789abcdef01234567",
      },
    });
    expect(JSON.stringify(mockCapturePostHogEvent.mock.calls)).not.toContain(
      "secret",
    );
    expect(JSON.stringify(mockCapturePostHogEvent.mock.calls)).not.toContain(
      "must-not-be-captured",
    );
    now.mockRestore();
  });

  it("preserves overloaded route context signatures and forwards context unchanged", async () => {
    const response = NextResponse.json({ ok: true });
    const calls = jest.fn();
    const original: RouteHandler = async (request, context) => {
      calls(request, context);
      return response;
    };
    const wrapped: RouteHandler = withCommunityPhotoRouteObservability(
      { route: "/api/community-photos/:photoId", surface: "write" },
      original,
    );
    const request = new NextRequest("https://example.com/api/community-photos/photo");
    const plain = { params: { photoId: "photo" } };
    const promised = { params: Promise.resolve({ photoId: "photo" }) };

    expect(await wrapped(request)).toBe(response);
    expect(await wrapped(request, plain)).toBe(response);
    expect(await wrapped(request, promised)).toBe(response);
    expect(calls.mock.calls).toEqual([
      [request, undefined], [request, plain], [request, promised],
    ]);
    expect(calls.mock.calls[1][1]).toBe(plain);
    expect(calls.mock.calls[2][1]).toBe(promised);
  });

  it.each([
    { status: 400, resultClass: "client_error", eligibility: "unknown" },
    { status: 401, resultClass: "unauthorized", eligibility: "ineligible" },
    { status: 403, resultClass: "forbidden", eligibility: "ineligible" },
    { status: 404, resultClass: "not_found", eligibility: "unknown" },
    { status: 409, resultClass: "conflict", eligibility: "unknown" },
    { status: 413, resultClass: "media_rejected", eligibility: "unknown" },
    { status: 415, resultClass: "media_rejected", eligibility: "unknown" },
    { status: 429, resultClass: "rate_limited", eligibility: "unknown" },
    { status: 503, resultClass: "server_error", eligibility: "unknown" },
  ])(
    "classifies status $status as $resultClass",
    async ({ status, resultClass, eligibility }) => {
      const handler = withCommunityPhotoRouteObservability(
        {
          route: "/api/community-photos/upload",
          surface: "write",
          successResultClass: "upload_success",
        },
        async () => new Response(null, { status }),
      );

      await handler(
        new Request("https://example.com/api/community-photos/upload", {
          method: "POST",
        }),
      );

      expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          properties: expect.objectContaining({
            result_class: resultClass,
            rollout_eligibility: eligibility,
          }),
        }),
      );
    },
  );

  it("normalizes missing or malformed platform/build and deployment SHA", async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "not-a-sha";
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/community-photos",
        surface: "read",
      },
      async () => Response.json({ photos: [] }),
    );

    await handler(
      new Request("https://example.com/api/community-photos", {
        headers: {
          "x-quiver-platform": "ios/user-id",
          "x-quiver-build-number": "a path with spaces",
        },
      }),
    );

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          platform_build: "unknown",
          deployment_sha: "unknown",
        }),
      }),
    );
  });

  it("marks admin and retention success as not rollout-applicable", async () => {
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/admin/community-photos",
        surface: "admin",
      },
      async () => Response.json({ photos: [] }),
    );

    await handler(
      new Request("https://example.com/api/admin/community-photos"),
    );

    expect(mockCapturePostHogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        properties: expect.objectContaining({
          rollout_eligibility: "not_applicable",
        }),
      }),
    );
  });

  it("returns the completed auth/audit response when metrics capture fails", async () => {
    mockCapturePostHogEvent.mockRejectedValueOnce(
      new Error("metrics unavailable"),
    );
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/admin/community-photos/:photoId/image",
        surface: "admin",
        successResultClass: "admin_audited_media_served",
      },
      async () => new Response("image", { status: 200 }),
    );

    const response = await handler(
      new Request(
        "https://example.com/api/admin/community-photos/private-id/image",
      ),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("image");
  });

  it("returns the completed response when metrics throws synchronously", async () => {
    mockCapturePostHogEvent.mockImplementationOnce(() => {
      throw new Error("metrics unavailable");
    });
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/admin/community-photos",
        surface: "admin",
      },
      async () => Response.json({ audited: true }),
    );

    const response = await handler(
      new Request("https://example.com/api/admin/community-photos"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ audited: true });
  });

  it("preserves the original route failure when metrics capture also fails", async () => {
    const routeFailure = new Error("mandatory audit failed");
    mockCapturePostHogEvent.mockRejectedValueOnce(
      new Error("metrics unavailable"),
    );
    const handler = withCommunityPhotoRouteObservability(
      {
        route: "/api/admin/community-photos/:photoId/image",
        surface: "admin",
      },
      async () => {
        throw routeFailure;
      },
    );

    await expect(
      handler(
        new Request(
          "https://example.com/api/admin/community-photos/private-id/image",
        ),
      ),
    ).rejects.toBe(routeFailure);
  });

  it("rejects route templates that could leak IDs, paths, or query strings", () => {
    expect(() =>
      withCommunityPhotoRouteObservability(
        {
          route:
            "/api/community-photos/40000000-0000-4000-8000-000000000001/image",
          surface: "read",
        },
        async () => new Response(null),
      ),
    ).toThrow("invalid community photo route template");
  });
});
