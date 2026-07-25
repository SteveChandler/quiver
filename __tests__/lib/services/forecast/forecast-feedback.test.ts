import {
  buildSeasideForecastFeedbackPayload,
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";

describe("forecast feedback payload builder", () => {
  it("stores validated observed height separately from displayed context", () => {
    const payload = buildSeasideForecastFeedbackPayload(
      {
        beachId: "beach-1",
        forecastAt: "2026-05-24T14:00:00.000Z",
        feedbackKind: "forecast_accuracy",
        feedbackValue: "too_low",
        feedbackNote: "Looked overhead on the sets.",
        observedFaceHeightFt: 6,
        displayedContext: { wave_height_ft: "2-3 ft" },
        sourceModelContext: {},
        calibrationContext: {},
        surfCallContext: {},
        missingFlags: {},
        auditMetadata: {
          surface: "forecast_tab",
          user_observation: { face_height_ft: 99 },
        },
      },
      {
        userId: "user-1",
        ingestPath: "quiver-api/forecast-feedback",
        requestId: "request-1",
        correlationId: "correlation-1",
        clientSource: "quiver-web",
      },
    );

    expect(payload.displayed_context).toEqual({ wave_height_ft: "2-3 ft" });
    expect(payload.audit_metadata).toEqual({
      surface: "forecast_tab",
      user_observation: { face_height_ft: 6 },
    });
  });

  it("does not infer or accept observed height from notes or audit metadata", () => {
    const payload = buildSeasideForecastFeedbackPayload(
      {
        beachId: "beach-1",
        forecastAt: "2026-05-24T14:00:00.000Z",
        feedbackKind: "forecast_accuracy",
        feedbackValue: "too_high",
        feedbackNote: "It was 2 ft, not 6 ft.",
        displayedContext: { wave_height_ft: "6 ft" },
        sourceModelContext: {},
        calibrationContext: {},
        surfCallContext: {},
        missingFlags: {},
        auditMetadata: {
          user_observation: { face_height_ft: 2 },
        },
      },
      {
        userId: "user-1",
        ingestPath: "quiver-api/forecast-feedback",
        requestId: "request-1",
        correlationId: "correlation-1",
        clientSource: "quiver-web",
      },
    );

    expect(payload.audit_metadata).not.toHaveProperty("user_observation");
  });

  it("ignores non-string optional text fields from untyped callers", () => {
    const payload = buildSeasideForecastFeedbackPayload(
      {
        beachId: "beach-1",
        forecastAt: "2026-05-24T14:00:00.000Z",
        feedbackKind: "forecast_accuracy",
        feedbackValue: "too_low",
        feedbackNote: 42,
        displayedContext: {},
        sourceModelContext: {},
        calibrationContext: {},
        surfCallContext: {},
        missingFlags: {},
        auditMetadata: {},
        clientSource: 101,
        clientVersion: 102,
        sessionId: 103,
        anonymousClientId: 104,
        requestId: 105,
        correlationId: 106,
      } as unknown as ForecastFeedbackClientPayload,
      {
        userId: "user-1",
        ingestPath: "quiver-api/forecast-feedback",
        requestId: "generated-request-id",
        correlationId: "generated-correlation-id",
        clientSource: "quiver-web",
        clientVersion: "git-sha",
      },
    );

    expect(payload).toMatchObject({
      session_id: null,
      anonymous_client_id: null,
      feedback_note: null,
      client_source: "quiver-web",
      client_version: "git-sha",
      request_id: "generated-request-id",
      correlation_id: "generated-correlation-id",
    });
  });
});
