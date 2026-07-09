import { renderHook, waitFor } from "@testing-library/react";
import { useSessionConditionsPrefill } from "@/hooks/use-session-conditions-prefill";
import type { SessionFormState } from "@/hooks/use-session-form";

jest.mock("@/hooks/use-session-forecast", () => ({
  useSessionForecast: jest.fn(() => ({
    forecastData: {
      wave_height: 3.5,
      wind_speed: 8,
      wind_direction: "NW",
      water_temp: 64,
      tide_height: 2.4,
      tide_status: "rising",
      isNightSession: false,
    },
    loading: false,
    error: null,
  })),
}));

jest.mock("@/hooks/use-session-tide-snapshot", () => ({
  useSessionTideSnapshot: jest.fn(() => ({
    tideSnapshot: {
      tideStatus: "rising",
    },
  })),
}));

function makeFormState(overrides: Partial<SessionFormState> = {}): SessionFormState {
  return {
    selectedBeach: "Ocean Beach",
    selectedBeachId: "beach-1",
    selectedDate: "2026-06-10",
    selectedTime: "07:00",
    waveHeight: undefined,
    windSpeed: undefined,
    windDirection: "",
    waterTemp: "",
    tideHeight: undefined,
    tideStatus: "",
    waveQuality: "",
    crowdLevel: "",
    parkingEase: "",
    overallRating: "",
    notes: "",
    duration: "",
    boardId: "",
    selectedGoals: [],
    waveCharacteristics: [],
    waveTypes: [],
    skillRatings: {},
    isPublic: true,
    isMuted: false,
    sessionDecomposition: null,
    ...overrides,
  } as SessionFormState;
}

describe("useSessionConditionsPrefill", () => {
  it("prefills forecast conditions but leaves tide fields as preview-only", async () => {
    const updateField = jest.fn();

    renderHook(() =>
      useSessionConditionsPrefill("log", makeFormState(), updateField)
    );

    await waitFor(() => {
      expect(updateField).toHaveBeenCalledWith("waveHeight", 3.5);
      expect(updateField).toHaveBeenCalledWith("windSpeed", 8);
      expect(updateField).toHaveBeenCalledWith("windDirection", "NW");
      expect(updateField).toHaveBeenCalledWith("waterTemp", "64");
    });

    expect(updateField).not.toHaveBeenCalledWith("tideHeight", expect.anything());
    expect(updateField).not.toHaveBeenCalledWith("tideStatus", expect.anything());
  });

  it("stores forecast prefill values for recommendation-attributed logs", async () => {
    const updateField = jest.fn();

    renderHook(() =>
      useSessionConditionsPrefill(
        "log",
        makeFormState({
          recommendationId: "beach:beach-1:2026-06-10T14:00:00.000Z",
        }),
        updateField
      )
    );

    await waitFor(() => {
      expect(updateField).toHaveBeenCalledWith("forecastWaveHeightFt", 3.5);
      expect(updateField).toHaveBeenCalledWith("forecastTideStatus", "rising");
      expect(updateField).toHaveBeenCalledWith("tideStatus", "rising");
    });

    expect(updateField).not.toHaveBeenCalledWith("tideHeight", expect.anything());
  });
});
