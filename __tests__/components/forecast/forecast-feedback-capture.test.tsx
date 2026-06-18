/**
 * @jest-environment jsdom
 */

import type { ComponentProps, ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ForecastFeedbackCapture } from "@/components/forecast/forecast-feedback-capture";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { SurfCallResult } from "@/lib/utils/surf-call-logic";
import { createMockEnhancedForecastEntity } from "@/__tests__/setup/forecast-test-utils";

const mockTrack = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("next/link", () => {
  return function MockLink({
    children,
    href,
    ...props
  }: {
    children: ReactNode;
    href: string;
  }) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    );
  };
});

const BEACH_ID = "123e4567-e89b-42d3-a456-426614174001";
const FEEDBACK_ID = "123e4567-e89b-42d3-a456-426614174999";

const beach = {
  id: BEACH_ID,
  name: "Ocean Beach",
  slug: "ocean-beach",
} as Beach;

function createForecast(
  overrides: Partial<EnhancedForecastEntity> = {},
): EnhancedForecastEntity {
  const forecastAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return createMockEnhancedForecastEntity({
    beach_id: BEACH_ID,
    forecast_at: forecastAt,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updated_at: forecastAt,
    ...overrides,
  });
}

function createSurfCall(
  overrides: Partial<SurfCallResult> = {},
): SurfCallResult {
  return {
    verdict: "YES",
    bestWindowStart: null,
    bestWindowEnd: null,
    windowMinutes: null,
    shortWindow: false,
    waveHeight: "3-4 ft",
    windDescription: "light offshore",
    windSpeed: "6 mph",
    windCompass: "E",
    windType: "offshore",
    tideDescription: "mid tide",
    tidePhase: "rising",
    tideHeight: "2.1 ft",
    nextTideType: "High",
    nextTideAt: null,
    whySentence: "Clean enough for a quick paddle.",
    forecastConfidence: 82,
    lowForecastConfidence: false,
    score: 78,
    peakTime: null,
    trendTags: [],
    updatedAt: new Date().toISOString(),
    isCalibrated: false,
    rideableWavesPerHour: 12,
    dominantBeatIntervalS: 20,
    ...overrides,
  };
}

function mockFeedbackResponse(
  body: unknown,
  options: { ok?: boolean } = {},
): void {
  const fetchMock = global.fetch as jest.MockedFunction<typeof fetch>;
  fetchMock.mockResolvedValueOnce({
    ok: options.ok ?? true,
    json: async () => body,
  } as Response);
}

function renderFeedbackCapture(
  overrides: Partial<ComponentProps<typeof ForecastFeedbackCapture>> = {},
) {
  return render(
    <ForecastFeedbackCapture
      beach={beach}
      forecast={createForecast()}
      isCalibrated={false}
      isDisplayStaleForecast={false}
      forecastTimeLabel="7 AM"
      freshnessLabel="fresh"
      {...overrides}
    />,
  );
}

async function submitFeedback(label: RegExp): Promise<void> {
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: label }));
  await user.click(screen.getByRole("button", { name: /send/i }));
}

function getSessionLogParams(): URLSearchParams {
  const link = screen.getByRole("link", { name: /log the session/i });
  const href = link.getAttribute("href") ?? "";
  const query = href.split("?")[1] ?? "";
  return new URLSearchParams(query);
}

describe("ForecastFeedbackCapture", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn() as unknown as typeof fetch;
  });

  it("builds a session-log CTA with the forecast feedback id and value", async () => {
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });

    renderFeedbackCapture();
    await submitFeedback(/^right$/i);

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const params = getSessionLogParams();
    expect(params.get("forecastFeedbackId")).toBe(FEEDBACK_ID);
    expect(params.get("forecastFeedbackValue")).toBe("about_right");
  });

  it("keeps the CTA when the saved feedback response has no id", async () => {
    mockFeedbackResponse({
      success: true,
      data: { id: null },
    });

    renderFeedbackCapture();
    await submitFeedback(/^too high$/i);

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const params = getSessionLogParams();
    expect(params.has("forecastFeedbackId")).toBe(false);
    expect(params.get("forecastFeedbackValue")).toBe("too_high");
  });

  it("shows an error and no CTA when feedback save fails", async () => {
    mockFeedbackResponse(
      {
        success: false,
      },
      { ok: false },
    );

    renderFeedbackCapture();
    await submitFeedback(/^too low$/i);

    expect(
      await screen.findByText("Feedback could not be saved."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /log the session/i }),
    ).not.toBeInTheDocument();
  });

  it("does not carry a future surf window into the session-log CTA", async () => {
    const futureStart = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const futureEnd = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });

    renderFeedbackCapture({
      surfCall: createSurfCall({
        bestWindowStart: futureStart,
        bestWindowEnd: futureEnd,
      }),
    });
    await submitFeedback(/^right$/i);

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const params = getSessionLogParams();
    expect(params.has("startTime")).toBe(false);
    expect(params.has("endTime")).toBe(false);
    expect(params.get("forecastFeedbackId")).toBe(FEEDBACK_ID);
  });
});
