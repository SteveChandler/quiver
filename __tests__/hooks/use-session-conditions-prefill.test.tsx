/**
 * @jest-environment jsdom
 *
 * Verifies that wave/wind/tide auto-prefill from forecast data fires at the
 * form level, even when the conditions UI itself is not mounted (e.g., when
 * QuickLog hides it behind a collapsed details accordion).
 */

import React from "react";
import { render, act } from "@testing-library/react";
import type { SessionFormState } from "@/hooks/use-session-form";

let mockForecast: {
  forecastData:
    | {
        wave_height?: number;
        wind_speed?: number;
        wind_direction?: string;
        water_temp?: number;
        tide_height: number | null;
        tide_status: string | null;
        isNightSession: boolean;
      }
    | null;
  loading: boolean;
  error: string | null;
} = {
  forecastData: null,
  loading: false,
  error: null,
};

jest.mock("@/hooks/use-session-forecast", () => ({
  useSessionForecast: () => mockForecast,
}));

import { useSessionConditionsPrefill } from "@/hooks/use-session-conditions-prefill";

const baseFormState: SessionFormState = {
  selectedBeach: "Ocean Beach",
  selectedBeachId: "beach-abc",
  selectedDate: "2026-04-21",
  selectedTime: "06:00",
  selectedBoard: "",
  boardId: undefined,
  duration: "60m",
  waveQuality: "",
  waterTemp: "",
  crowdLevel: "",
  parkingEase: "",
  overallRating: "",
  notes: "",
  photos: [],
  waveTypes: [],
  isPublic: true,
  isMuted: false,
  selectedGoals: [],
  skillRatings: {},
  sessionDecomposition: null,
};

function Harness({
  formState,
  onUpdate,
  mode = "log" as const,
}: {
  formState: SessionFormState;
  onUpdate: (field: string, value: unknown) => void;
  mode?: "log";
}) {
  useSessionConditionsPrefill(mode, formState, onUpdate as never);
  return null;
}

describe("useSessionConditionsPrefill", () => {
  beforeEach(() => {
    mockForecast = { forecastData: null, loading: false, error: null };
  });

  it("prefills wave_height, wind_speed, wind_direction, tide_height, tide_status when fields are empty", () => {
    mockForecast = {
      forecastData: {
        wave_height: 1.5,
        wind_speed: 4,
        wind_direction: "E",
        water_temp: 60,
        tide_height: 2.1,
        tide_status: "Rising",
        isNightSession: false,
      },
      loading: false,
      error: null,
    };

    const updates: Array<[string, unknown]> = [];
    const onUpdate = (field: string, value: unknown) => {
      updates.push([field, value]);
    };

    render(<Harness formState={baseFormState} onUpdate={onUpdate} />);

    expect(updates).toEqual(
      expect.arrayContaining([
        ["waveHeight", 1.5],
        ["windSpeed", 4],
        ["windDirection", "E"],
        ["waterTemp", "60"],
        ["tideHeight", 2.1],
        ["tideStatus", "rising"],
      ])
    );
  });

  it("lowercases tide_status from forecast (Rising -> rising) for cron consistency", () => {
    mockForecast = {
      forecastData: {
        wave_height: 1,
        tide_height: 2,
        tide_status: "Falling",
        isNightSession: false,
      },
      loading: false,
      error: null,
    };

    const updates: Array<[string, unknown]> = [];
    render(
      <Harness
        formState={baseFormState}
        onUpdate={(f, v) => updates.push([f, v])}
      />
    );

    const tideStatus = updates.find(([f]) => f === "tideStatus");
    expect(tideStatus?.[1]).toBe("falling");
  });

  it("does not overwrite a field the user already filled", () => {
    mockForecast = {
      forecastData: {
        wave_height: 1.5,
        tide_height: 2,
        tide_status: "Rising",
        isNightSession: false,
      },
      loading: false,
      error: null,
    };

    const userTouchedState: SessionFormState = {
      ...baseFormState,
      waveHeight: 4, // user already entered 4 ft
      tideStatus: "high",
    };

    const updates: Array<[string, unknown]> = [];
    render(
      <Harness
        formState={userTouchedState}
        onUpdate={(f, v) => updates.push([f, v])}
      />
    );

    expect(updates.find(([f]) => f === "waveHeight")).toBeUndefined();
    expect(updates.find(([f]) => f === "tideStatus")).toBeUndefined();
  });

  it("re-arms prefill when beach/date/time changes and the new field is empty", () => {
    mockForecast = {
      forecastData: {
        wave_height: 1.5,
        tide_height: 2,
        tide_status: "Rising",
        isNightSession: false,
      },
      loading: false,
      error: null,
    };

    const updates: Array<[string, unknown]> = [];
    const onUpdate = (f: string, v: unknown) => updates.push([f, v]);

    const { rerender } = render(
      <Harness formState={baseFormState} onUpdate={onUpdate} />
    );

    const initialCount = updates.length;
    expect(initialCount).toBeGreaterThan(0);

    // Switch to a new beach and clear fields — prefill should re-arm.
    mockForecast = {
      forecastData: {
        wave_height: 3.5,
        tide_height: 1,
        tide_status: "Falling",
        isNightSession: false,
      },
      loading: false,
      error: null,
    };

    act(() => {
      rerender(
        <Harness
          formState={{ ...baseFormState, selectedBeachId: "beach-xyz" }}
          onUpdate={onUpdate}
        />
      );
    });

    expect(updates.length).toBeGreaterThan(initialCount);
    const lastWave = [...updates].reverse().find(([f]) => f === "waveHeight");
    expect(lastWave?.[1]).toBe(3.5);
  });

  it("waits for forecast data — no calls while loading", () => {
    mockForecast = {
      forecastData: null,
      loading: true,
      error: null,
    };

    const updates: Array<[string, unknown]> = [];
    render(
      <Harness
        formState={baseFormState}
        onUpdate={(f, v) => updates.push([f, v])}
      />
    );

    expect(updates).toHaveLength(0);
  });
});
