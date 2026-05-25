/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/forecast-feedback/route";

const mockUser = { id: "user-1" };

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth:
      (
        handler: (
          request: NextRequest,
          context: { user: typeof mockUser; supabase: Record<string, never> },
        ) => Promise<Response>,
      ) =>
      (request: NextRequest) =>
        handler(request, { user: mockUser, supabase: {} }),
    createErrorResponse: actual.createErrorResponse,
    createSuccessResponse: actual.createSuccessResponse,
    createValidationError: actual.createValidationError,
  };
});

const originalEnv = process.env;

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    beachId: "11111111-1111-4111-8111-111111111111",
    forecastAt: "2026-05-24T14:00:00.000Z",
    windowStart: "2026-05-24T14:00:00.000Z",
    windowEnd: null,
    issuedAt: "2026-05-24T10:00:00.000Z",
    predictedAt: "2026-05-24T10:15:00.000Z",
    forecastHorizonHours: 4,
    feedbackKind: "forecast_accuracy",
    feedbackValue: "too_low",
    feedbackNote: "Saw waist-high waves.",
    displayedContext: { wave_height_ft: "2-3 ft" },
    sourceModelContext: { data_source: "NOAA_NWS" },
    calibrationContext: { beach_is_calibrated: true },
    surfCallContext: { verdict: "YES", score: 82 },
    missingFlags: {},
    auditMetadata: { surface: "forecast_tab" },
    clientSource: "quiver-web",
    clientVersion: "test-client",
    correlationId: "corr-client",
    requestId: "req-client",
    ...overrides,
  };
}

function requestWithBody(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/forecast-feedback", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/forecast-feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      ML_INTERNAL_SECRET: "test-secret",
      ML_SERVICE_URL: "https://ml.example.test/",
      VERCEL_GIT_COMMIT_SHA: "git-sha",
    };
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          id: "feedback-row-1",
          contract_version: "forecast-feedback-context.v1",
          correlation_id: "corr-client",
        }),
        { status: 200 },
      ),
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("forwards authenticated web/native feedback to Seaside with the internal secret", async () => {
    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "feedback-row-1",
      contractVersion: "forecast-feedback-context.v1",
      correlationId: "corr-client",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(url).toBe(
      "https://ml.example.test/internal/forecast-feedback",
    );
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "X-Internal-Secret": "test-secret",
    });

    const forwarded = JSON.parse(String(init.body));
    expect(forwarded).toMatchObject({
      user_id: "user-1",
      beach_id: "11111111-1111-4111-8111-111111111111",
      forecast_at: "2026-05-24T14:00:00.000Z",
      feedback_kind: "forecast_accuracy",
      feedback_value: "too_low",
      ingest_path: "quiver-api/forecast-feedback",
      request_id: "req-client",
      correlation_id: "corr-client",
      client_source: "quiver-web",
      client_version: "test-client",
      schema_version: 1,
      contract_version: "forecast-feedback-context.v1",
    });
    expect(forwarded.displayed_context.wave_height_ft).toBe("2-3 ft");
    expect(forwarded.source_model_context.data_source).toBe("NOAA_NWS");
  });

  it("adds explicit missing flags for empty context groups before calling Seaside", async () => {
    await POST(
      requestWithBody(
        basePayload({
          surfCallContext: {},
          missingFlags: {},
        }),
      ),
    );

    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    const forwarded = JSON.parse(String(init.body));
    expect(forwarded.surf_call_context).toEqual({});
    expect(forwarded.missing_flags.surf_call_context).toBe(true);
  });

  it("returns a configuration error without calling Seaside when the secret is missing", async () => {
    delete process.env.ML_INTERNAL_SECRET;
    delete process.env.INTERNAL_SECRET;

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Feedback service not configured");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("masks Seaside storage failures behind the bridge error contract", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          detail: { message: "permission denied", correlation_id: "corr-client" },
        }),
        { status: 500 },
      ),
    );

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toBe("Feedback storage failed");
    expect(JSON.stringify(body)).not.toContain("permission denied");
    expect(body.details).toEqual({
      correlationId: "corr-client",
      service: "seaside",
      status: 500,
    });
  });
});
