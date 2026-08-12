/**
 * @jest-environment jsdom
 */

import { act, renderHook } from "@testing-library/react";
import { expectConsoleErrors } from "@/__tests__/setup/test-utils";

const mockCreateLoggedSession = jest.fn();
const mockCreateActivity = jest.fn();
const mockTrack = jest.fn();
const mockTrackSupabase = jest.fn();
const mockSaveLastBeach = jest.fn();

jest.mock("@/actions/session-actions", () => ({
  createLoggedSession: (...args: unknown[]) => mockCreateLoggedSession(...args),
}));

jest.mock("@/actions/session-media-actions", () => ({
  uploadSessionPhotosAction: jest.fn(),
}));

jest.mock("@/actions/activity-actions", () => ({
  createActivity: (...args: unknown[]) => mockCreateActivity(...args),
}));

jest.mock("@/lib/analytics", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrackSupabase }),
}));

jest.mock("@/hooks/use-nearest-beach", () => ({
  saveLastBeach: (...args: unknown[]) => mockSaveLastBeach(...args),
}));

jest.mock("@/lib/share/build-share-card-url", () => ({
  buildSessionShareUrl: jest.fn(() => "/api/share/session-card?id=session-123"),
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

import { useSessionSubmission } from "@/app/sessions/new/useSessionSubmission";

const createSessionFormData = () => ({
  selectedBeach: "Ocean Beach",
  selectedBeachId: "beach-123",
  selectedDate: "2026-05-20",
  selectedTime: "07:00",
  waveQuality: "4",
  crowdLevel: "2",
  waterTemp: "63F",
  forecastAccuracy: "somewhat",
  photos: [],
});

describe("useSessionSubmission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as jest.Mock;
    mockCreateLoggedSession.mockResolvedValue({
      success: true,
      data: { id: "session-123" },
    });
    mockCreateActivity.mockResolvedValue({ success: true });
  });

  it("emits submit-funnel telemetry exactly once after a successful save", async () => {
    const { result } = renderHook(() =>
      useSessionSubmission({
        mode: "log",
        user: { id: "user-123" },
      })
    );

    await act(async () => {
      await result.current.handleSessionComplete({
        selectedBeach: "Ocean Beach",
        selectedBeachId: "beach-123",
        selectedDate: "2026-05-20",
        selectedTime: "07:00",
        waveQuality: "4",
        crowdLevel: "2",
        waterTemp: "63F",
        forecastAccuracy: "somewhat",
        photos: [],
      });
    });

    expect(mockCreateLoggedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        beach_id: "beach-123",
        forecast_accuracy: "somewhat",
        wave_quality: 4,
      })
    );
    const submitCalls = mockTrack.mock.calls.filter(
      ([eventName]) => eventName === "session_log_submit",
    );
    expect(submitCalls).toHaveLength(1);
    expect(submitCalls[0]?.[1]).toEqual(
      expect.objectContaining({
        beach_slug: "ocean-beach",
        wave_rating: 4,
      })
    );
    expect(mockTrackSupabase).toHaveBeenCalledWith(
      "session_log_submit",
      expect.objectContaining({
        beachId: "beach-123",
        debounceMs: 0,
        metadata: expect.objectContaining({
          flow_id: expect.any(String),
          schema_version: 1,
          client_stage_at: expect.any(String),
          event_id: "session:session-123:submit:web:v1",
          session_id: "session-123",
        }),
      })
    );
    expect(global.fetch).not.toHaveBeenCalled();
    expect(mockSaveLastBeach).toHaveBeenCalledWith({
      id: "beach-123",
      name: "Ocean Beach",
    });
  });

  it("does not emit submit telemetry when the session save fails", async () => {
    mockCreateLoggedSession.mockResolvedValueOnce({
      success: false,
      error: "Session creation failed",
    });
    const { result } = renderHook(() =>
      useSessionSubmission({
        mode: "log",
        user: { id: "user-123" },
      })
    );

    await act(async () => {
      await result.current.handleSessionComplete(createSessionFormData());
    });

    expectConsoleErrors([/error creating session/i]);
    expect(mockTrack).not.toHaveBeenCalledWith(
      "session_log_submit",
      expect.anything(),
    );
    expect(mockTrackSupabase).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("threads a forecast feedback id into the logged-session payload", async () => {
    const forecastFeedbackId = "123e4567-e89b-42d3-a456-426614174999";
    const { result } = renderHook(() =>
      useSessionSubmission({
        mode: "log",
        user: { id: "user-123" },
        forecastFeedbackId,
      })
    );

    await act(async () => {
      await result.current.handleSessionComplete(createSessionFormData());
    });

    expect(mockCreateLoggedSession).toHaveBeenCalledWith(
      expect.objectContaining({
        beach_id: "beach-123",
        forecast_feedback_context_id: forecastFeedbackId,
      })
    );
  });

  it("does not add a forecast feedback id when none was provided", async () => {
    const { result } = renderHook(() =>
      useSessionSubmission({
        mode: "log",
        user: { id: "user-123" },
      })
    );

    await act(async () => {
      await result.current.handleSessionComplete(createSessionFormData());
    });

    expect(mockCreateLoggedSession).toHaveBeenCalledTimes(1);
    expect(mockCreateLoggedSession.mock.calls[0][0]).not.toHaveProperty(
      "forecast_feedback_context_id",
    );
  });
});
