/**
 * @jest-environment jsdom
 */

import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ConditionsSection } from "@/components/session-forms/ConditionsSection";
import type { SessionFormState } from "@/hooks/use-session-form";

jest.mock("@/hooks/use-session-forecast", () => ({
  useSessionForecast: jest.fn(() => ({
    forecastData: {
      wave_height: 4,
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

jest.mock("@/lib/services/session-tide-snapshot", () => ({
  formatSessionTideSnapshot: jest.fn(() => "Rising"),
}));

const baseState: SessionFormState = {
  selectedBeach: "HB Cliffs",
  selectedBeachId: "beach-1",
  selectedDate: "2026-07-09",
  selectedTime: "07:00",
  selectedBoard: "",
  duration: "60m",
  waveQuality: "",
  waterTemp: "",
  crowdLevel: "",
  parkingEase: "",
  overallRating: "",
  notes: "",
  photos: [],
  waveCharacteristics: [],
  waveTypes: [],
  isPublic: true,
  isMuted: false,
  selectedGoals: [],
  skillRatings: {},
  sessionDecomposition: null,
};

describe("ConditionsSection recommendation feedback", () => {
  it("hides tide height and marks wave height edited for suggested logs", () => {
    const updateField = jest.fn();

    render(
      <ConditionsSection
        formState={{
          ...baseState,
          recommendationId: "beach:beach-1:2026-07-09T14:00:00.000Z",
          waveHeight: 4,
          tideStatus: "rising",
        }}
        updateField={updateField}
      />
    );

    expect(screen.queryByLabelText("Tide Height (ft)")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Wave Height (ft)"), {
      target: { value: "3" },
    });

    expect(updateField).toHaveBeenCalledWith("waveHeight", 3);
    expect(updateField).toHaveBeenCalledWith("waveHeightEdited", true);
  });
});
