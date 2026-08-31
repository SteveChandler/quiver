/**
 * @jest-environment node
 */

import { NextRequest } from "next/server";
import { POST } from "@/app/api/forecast-feedback/route";

const mockUser = { id: "user-1" };
const mockSupabase = { from: jest.fn() };
const mockFeedbackMaybeSingle = jest.fn();
const mockFeedbackInsertSingle = jest.fn();
const mockFeedbackInsert = jest.fn((_payload: Record<string, unknown>) => ({
  select: jest.fn(() => ({ single: mockFeedbackInsertSingle })),
}));
const mockThirdEq = jest.fn(() => ({ maybeSingle: mockFeedbackMaybeSingle }));
const mockSecondEq = jest.fn(() => ({ eq: mockThirdEq }));
const mockFirstEq = jest.fn(() => ({ eq: mockSecondEq }));
const mockServiceFrom = jest.fn(() => ({
  select: jest.fn(() => ({ eq: mockFirstEq })),
  insert: mockFeedbackInsert,
}));
const MOCK_FORECAST_ID = "22222222-2222-4222-8222-222222222222";

jest.mock("@/lib/supabase", () => ({
  createServiceRoleClient: () => ({ from: mockServiceFrom }),
}));

jest.mock("@/lib/middleware/api-wrappers", () => {
  const actual = jest.requireActual("@/lib/api-utils");
  return {
    withAuth:
      (
        handler: (
          request: NextRequest,
          context: { user: typeof mockUser; supabase: typeof mockSupabase },
        ) => Promise<Response>,
      ) =>
      (request: NextRequest) =>
        handler(request, { user: mockUser, supabase: mockSupabase }),
    createErrorResponse: actual.createErrorResponse,
    createSuccessResponse: actual.createSuccessResponse,
    createValidationError: actual.createValidationError,
  };
});

const originalEnv = process.env;

function mockForecastAccuracyVotePersistence() {
  const enhancedMaybeSingle = jest.fn().mockResolvedValue({
    data: { id: MOCK_FORECAST_ID },
    error: null,
  });
  const enhancedForecastsTable = {
    select: jest.fn().mockReturnValue({
      eq: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          maybeSingle: enhancedMaybeSingle,
        }),
      }),
    }),
  };

  const voteSingle = jest.fn().mockResolvedValue({
    data: { id: "vote-row-1" },
    error: null,
  });
  const forecastVotesTable = {
    upsert: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        single: voteSingle,
      }),
    }),
  };

  mockSupabase.from.mockImplementation((table: string) => {
    if (table === "enhanced_forecasts") return enhancedForecastsTable;
    if (table === "forecast_accuracy_votes") return forecastVotesTable;
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    enhancedForecastsTable,
    forecastVotesTable,
  };
}

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
    mockSupabase.from.mockReset();
    mockForecastAccuracyVotePersistence();
    mockFeedbackMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockFeedbackInsertSingle.mockResolvedValue({
      data: {
        id: "feedback-row-1",
        contract_version: "forecast-feedback-context.v1",
        correlation_id: "corr-client",
      },
      error: null,
    });
    process.env = {
      ...originalEnv,
      VERCEL_GIT_COMMIT_SHA: "git-sha",
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("stores authenticated web/native feedback directly in Supabase", async () => {
    const response = await POST(
      requestWithBody(basePayload({ observedFaceHeightFt: 6 })),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({
      id: "feedback-row-1",
      contractVersion: "forecast-feedback-context.v1",
      correlationId: "corr-client",
    });
    expect(mockFeedbackInsert).toHaveBeenCalledTimes(1);
    const stored = mockFeedbackInsert.mock.calls[0][0];
    expect(stored).toMatchObject({
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
    const displayedContext = stored.displayed_context as Record<string, unknown>;
    const sourceModelContext = stored.source_model_context as Record<string, unknown>;
    expect(displayedContext.wave_height_ft).toBe("2-3 ft");
    expect(sourceModelContext.data_source).toBe("NOAA_NWS");
    expect(stored.audit_metadata).toMatchObject({
      surface: "forecast_tab",
      user_observation: { face_height_ft: 6 },
    });
  });

  it.each([
    [
      "about-right context",
      { feedbackValue: "about_right", observedFaceHeightFt: 6 },
    ],
    ["below range", { observedFaceHeightFt: 0 }],
    ["above range", { observedFaceHeightFt: 50.5 }],
    ["non-half increment", { observedFaceHeightFt: 6.2 }],
  ])("rejects invalid observed height: %s", async (_label, overrides) => {
    const response = await POST(requestWithBody(basePayload(overrides)));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Invalid feedback payload");
    expect(mockFeedbackInsert).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("persists forecast-accuracy feedback into forecast_accuracy_votes", async () => {
    const { forecastVotesTable } = mockForecastAccuracyVotePersistence();

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith("enhanced_forecasts");
    expect(mockSupabase.from).toHaveBeenCalledWith("forecast_accuracy_votes");
    expect(forecastVotesTable.upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        forecast_id: MOCK_FORECAST_ID,
        beach_id: "11111111-1111-4111-8111-111111111111",
        was_accurate: false,
        actual_conditions: { wave_height_ft: "2-3 ft" },
        notes: "Saw waist-high waves.",
        photo_url: null,
      },
      { onConflict: "user_id,forecast_id" },
    );
  });

  it("acknowledges an already-stored stable request without another insert", async () => {
    mockFeedbackMaybeSingle.mockResolvedValueOnce({
      data: {
        id: "feedback-existing",
        contract_version: "forecast-feedback-context.v1",
        correlation_id: "corr-original",
      },
      error: null,
    });

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toEqual({
      id: "feedback-existing",
      contractVersion: "forecast-feedback-context.v1",
      correlationId: "corr-original",
    });
    expect(mockFeedbackInsert).not.toHaveBeenCalled();
    expect(mockSupabase.from).not.toHaveBeenCalledWith("forecast_accuracy_votes");
    expect(mockThirdEq).toHaveBeenCalledWith(
      "ingest_path",
      "quiver-api/forecast-feedback",
    );
  });

  it("recovers a concurrent duplicate insert using the stable request", async () => {
    mockFeedbackMaybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({
        data: {
          id: "feedback-stored-before-error",
          contract_version: "forecast-feedback-context.v1",
          correlation_id: "corr-client",
        },
        error: null,
      });
    mockFeedbackInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data.id).toBe("feedback-stored-before-error");
    expect(mockFeedbackInsert).toHaveBeenCalledTimes(1);
    expect(mockFeedbackMaybeSingle).toHaveBeenCalledTimes(2);
  });

  it("adds explicit missing flags for empty context groups before storage", async () => {
    await POST(
      requestWithBody(
        basePayload({
          surfCallContext: {},
          missingFlags: {},
        }),
      ),
    );

    const stored = mockFeedbackInsert.mock.calls[0][0];
    expect(stored.surf_call_context).toEqual({});
    const missingFlags = stored.missing_flags as Record<string, unknown>;
    expect(missingFlags.surf_call_context).toBe(true);
  });

  it("masks direct Supabase storage failures", async () => {
    mockFeedbackInsertSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "permission denied" },
    });

    const response = await POST(requestWithBody(basePayload()));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe("Feedback storage failed");
    expect(JSON.stringify(body)).not.toContain("permission denied");
    expect(body.details).toEqual({ correlationId: "corr-client" });
  });
});
