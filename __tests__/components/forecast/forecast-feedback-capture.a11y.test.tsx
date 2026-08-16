import { fireEvent, render, screen } from "@testing-library/react";
import { ForecastFeedbackCapture } from "@/components/forecast/forecast-feedback-capture";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: jest.fn() }),
}));

describe("ForecastFeedbackCapture accessibility", () => {
  it("puts a visible focus-within ring on the observed-height wrapper", () => {
    const beach = {
      id: "beach-1",
      name: "Test Beach",
      slug: "test-beach",
    } as unknown as Beach;
    const forecast = {
      forecast_at: "2026-08-13T08:00:00.000Z",
      wave_height: 3,
    } as unknown as EnhancedForecastEntity;

    render(
      <ForecastFeedbackCapture
        beach={beach}
        forecast={forecast}
        isCalibrated={false}
        isDisplayStaleForecast={false}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Too low" }));

    const input = screen.getByRole("spinbutton", {
      name: /what face height did you see/i,
    });
    const wrapper = input.parentElement;

    expect(wrapper).toHaveClass(
      "focus-within:ring-2",
      "focus-within:ring-[#0B3A75]",
    );
  });
});
