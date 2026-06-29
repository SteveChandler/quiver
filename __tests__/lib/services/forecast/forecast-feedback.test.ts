import {
  buildSeasideForecastFeedbackPayload,
  type ForecastFeedbackClientPayload,
} from "@/lib/services/forecast/forecast-feedback";

describe("forecast feedback payload builder", () => {
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
