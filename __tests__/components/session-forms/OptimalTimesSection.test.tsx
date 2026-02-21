import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { OptimalTimesSection } from "@/components/session-forms/OptimalTimesSection";

// Attach a fetch mock to global for Jest environment
(global as any).fetch = jest.fn();

describe("OptimalTimesSection", () => {
  const baseFormState = {
    selectedBeach: "Pacific Beach",
    selectedBeachId: "beach-123",
    selectedDate: "2024-01-17",
    selectedTime: "16:42",
  } as any;

  const mockUpdateField = jest.fn();

  beforeEach(() => {
    (fetch as unknown as jest.Mock).mockReset();
  });

  test("fetches with beachId and includes selectedTime", async () => {
    (fetch as unknown as jest.Mock).mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          success: true,
          data: {
            forecastSource: "enhanced",
            optimalTimes: [
              {
                time: "16:42",
                startTime: "15:42",
                endTime: "17:42",
                score: 60,
                rating: "fair",
                reasons: [],
                conditions: {
                  waveHeight: 3,
                  waveQuality: "Fair",
                  windSpeed: 6,
                  windDirection: "NE",
                  confidence: 70,
                  weatherCondition: "",
                },
              },
            ],
          },
        }),
        { status: 200 }
      )
    );

    render(
      <OptimalTimesSection
        formState={baseFormState}
        updateField={mockUpdateField}
      />
    );

    // Allow effect to run
    await waitFor(() => {
      expect(fetch as unknown as jest.Mock).toHaveBeenCalled();
    });

    const url = (fetch as unknown as jest.Mock).mock.calls[0][0] as string;
    expect(url).toContain("/api/session-planner/optimal-times");
    expect(url).toContain("beachId=beach-123");
    expect(url).toContain("selectedTime=16%3A42");

    // UI label shows context-aware header
    expect(
      await screen.findByText(/Best for Your Session Time/i)
    ).toBeInTheDocument();
  });

  test("shows a loading placeholder anchored to selected time", async () => {
    // Keep fetch unresolved briefly to see loading UI
    (fetch as unknown as jest.Mock).mockImplementation(
      () => new Promise(() => {})
    );

    render(
      <OptimalTimesSection
        formState={baseFormState}
        updateField={mockUpdateField}
      />
    );

    // Loading state shows "Best for Your Session Time" header and "Loading Forecast" badge
    expect(await screen.findByText(/Best for Your Session Time/i)).toBeInTheDocument();
    expect(screen.getByText(/Loading Forecast/i)).toBeInTheDocument();
  });
});
