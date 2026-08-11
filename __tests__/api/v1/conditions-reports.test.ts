/** @jest-environment node */

import { NextRequest } from "next/server";

let authenticated = true;

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/middleware/api-wrappers");
  return {
    ...actual,
    withAuth: (handler: any) => async (request: any) => {
      if (!authenticated) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        });
      }
      return handler(request, {
        user: { id: "user-1" },
        supabase: {},
        params: {},
      });
    },
  };
});

jest.mock("@/lib/conditions-report/submit-conditions-report", () => ({
  submitConditionsReportCore: jest.fn(),
}));

import { submitConditionsReportCore as mockSubmitConditionsReportCore } from "@/lib/conditions-report/submit-conditions-report";
import { GET, POST } from "@/app/api/v1/conditions-reports/route";

const coreMock = mockSubmitConditionsReportCore as unknown as jest.Mock;

const validBody = {
  beachId: "beach-1",
  waveSizeMin: 3,
  waveSizeMax: 4,
  vibe: "firing",
  note: "Clean lines",
};

function request(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/conditions-reports", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  authenticated = true;
  coreMock.mockReset();
});

describe("POST /api/v1/conditions-reports", () => {
  it("returns 201 with report identifiers and expiry", async () => {
    coreMock.mockResolvedValue({
      success: true,
      data: {
        intelPostId: "intel-1",
        sessionId: "session-1",
        expiresAt: "2026-08-11T00:00:00.000Z",
      },
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      reportId: "intel-1",
      intelPostId: "intel-1",
      sessionId: "session-1",
      expiresAt: "2026-08-11T00:00:00.000Z",
    });
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(coreMock).toHaveBeenCalledWith(
      expect.objectContaining({ beachId: "beach-1", waveSizeRange: "3-4ft" }),
      { id: "user-1" },
      {},
    );
  });

  it("preserves the core result when its non-fatal feedback forward is handled there", async () => {
    coreMock.mockResolvedValue({
      success: true,
      data: {
        intelPostId: "intel-2",
        sessionId: null,
        expiresAt: "2026-08-11T00:00:00.000Z",
      },
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      reportId: "intel-2",
    });
    expect(body).toHaveProperty("sessionId", null);
  });

  it("returns 409 when the user already reported today", async () => {
    coreMock.mockResolvedValue({
      success: false,
      error: "ALREADY_REPORTED_TODAY",
    });

    const response = await POST(request(validBody));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "already_reported_today" });
  });

  it.each([
    [{ ...validBody, vibe: "epic" }, "invalid vibe"],
    [{ ...validBody, waveSizeMin: 2, waveSizeMax: 5 }, "invalid wave size range"],
  ])("returns 422 for %s", async (body, reason) => {
    const response = await POST(request(body));

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: "validation_failed",
      reason,
    });
    expect(coreMock).not.toHaveBeenCalled();
  });
});

it("returns 401 for an unauthenticated request", async () => {
  authenticated = false;

  const response = await POST(request(validBody));

  expect(response.status).toBe(401);
});

it("returns 405 for non-POST requests", async () => {
  const response = await GET({} as NextRequest);

  expect(response.status).toBe(405);
  expect(response.headers.get("allow")).toBe("POST");
});
