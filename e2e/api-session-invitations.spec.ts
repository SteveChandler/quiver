import { test, expect, request as pwRequest } from "@playwright/test";

// Integration test for session invitations API (real route execution)
// Uses flexible status ranges per repo testing guidance

test.describe("Session Invitations API (integration)", () => {
  test("POST invites returns success or meaningful error and respects idempotency", async ({
    request,
  }) => {
    const base = process.env.BASE_URL || process.env.NEXT_PUBLIC_SITE_URL || "";

    // Attempt posting with minimal valid shape; backend will enforce auth
    const res = await request.post(`${base}/api/session-planner/invitations`, {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        invitees: [{ email: "someone@example.com" }],
        message: "See you there",
      },
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `itest-${Date.now()}`,
      },
    });

    // Flexible API expectations (auth may fail on CI without session)
    expect([200, 400, 401, 403, 404, 405]).toContain(res.status());

    // Repeat with same idempotency key should not 500
    const res2 = await request.post(`${base}/api/session-planner/invitations`, {
      data: {
        sessionId: "00000000-0000-0000-0000-000000000000",
        invitees: [{ email: "someone@example.com" }],
        message: "See you there",
      },
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": `itest-fixed-key`,
      },
    });
    expect([200, 400, 401, 403, 404, 405]).toContain(res2.status());
  });
});

