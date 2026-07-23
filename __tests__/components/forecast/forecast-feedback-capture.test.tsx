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
  return render(<ForecastFeedbackCapture {...feedbackCaptureProps(overrides)} />);
}

function feedbackCaptureProps(
  overrides: Partial<ComponentProps<typeof ForecastFeedbackCapture>> = {},
): ComponentProps<typeof ForecastFeedbackCapture> {
  return {
    beach,
    forecast: createForecast(),
    isCalibrated: false,
    isDisplayStaleForecast: false,
    forecastTimeLabel: "7 AM",
    freshnessLabel: "fresh",
    ...overrides,
  };
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
    expect(
      screen.queryByRole("spinbutton", {
        name: /what face height did you see/i,
      }),
    ).not.toBeInTheDocument();
  });

  it("captures optional mismatch height and carries it into the session log", async () => {
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^too low$/i }));

    const heightInput = screen.getByRole("spinbutton", {
      name: /what face height did you see/i,
    });
    expect(heightInput).toHaveAttribute("min", "0.5");
    expect(heightInput).toHaveAttribute("max", "50");
    expect(heightInput).toHaveAttribute("step", "0.5");

    await user.type(heightInput, "6");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const [, init] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(JSON.parse(String(init.body))).toMatchObject({
      feedbackValue: "too_low",
      observedFaceHeightFt: 6,
    });
    expect(getSessionLogParams().get("observedFaceHeightFt")).toBe("6");
  });

  it("blocks malformed mismatch height before submitting", async () => {
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^too high$/i }));
    await user.type(
      screen.getByRole("spinbutton", {
        name: /what face height did you see/i,
      }),
      "6.2",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      screen.getByText(/0\.5 to 50 ft in 0\.5 ft increments/i),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("reuses one draft request id on retry and locks after success", async () => {
    mockFeedbackResponse({ success: false }, { ok: false });
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^too high$/i }));
    await user.type(
      screen.getByRole("spinbutton", {
        name: /what face height did you see/i,
      }),
      "8",
    );
    await user.type(
      screen.getByPlaceholderText("Add a detail"),
      "Sets arrived late",
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText("Feedback could not be saved."),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledTimes(2);
    const requestBodies = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)),
    );
    expect(requestBodies[0].requestId).toEqual(expect.any(String));
    expect(requestBodies[1].requestId).toBe(requestBodies[0].requestId);

    const sendButton = screen.getByRole("button", { name: /send/i });
    expect(sendButton).toBeDisabled();
    expect(screen.getByRole("button", { name: /^too low$/i })).toBeDisabled();
    expect(screen.getByPlaceholderText("Add a detail")).toBeDisabled();
    expect(
      screen.getByRole("spinbutton", {
        name: /what face height did you see/i,
      }),
    ).toBeDisabled();

    await user.click(sendButton);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("uses a new request id and matching CTA after a failed height draft is edited", async () => {
    mockFeedbackResponse({ success: false }, { ok: false });
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^too low$/i }));
    const heightInput = screen.getByRole("spinbutton", {
      name: /what face height did you see/i,
    });
    await user.type(heightInput, "6");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText("Feedback could not be saved."),
    ).toBeInTheDocument();
    await user.clear(heightInput);
    await user.type(heightInput, "8");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const requestBodies = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)),
    );
    expect(requestBodies[1].requestId).not.toBe(requestBodies[0].requestId);
    expect(requestBodies[1].observedFaceHeightFt).toBe(8);
    expect(getSessionLogParams().get("observedFaceHeightFt")).toBe("8");
  });

  it("uses a new request id when a failed note draft is edited", async () => {
    mockFeedbackResponse({ success: false }, { ok: false });
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^right$/i }));
    const noteInput = screen.getByPlaceholderText("Add a detail");
    await user.type(noteInput, "First note");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText("Feedback could not be saved."),
    ).toBeInTheDocument();
    await user.clear(noteInput);
    await user.type(noteInput, "Corrected note");
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const requestBodies = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)),
    );
    expect(requestBodies[1].requestId).not.toBe(requestBodies[0].requestId);
    expect(requestBodies[1].feedbackNote).toBe("Corrected note");
  });

  it("uses a new request id when forecast context changes after failure", async () => {
    mockFeedbackResponse({ success: false }, { ok: false });
    mockFeedbackResponse({
      success: true,
      data: { id: FEEDBACK_ID },
    });
    const user = userEvent.setup();
    const initialForecastAt = "2026-07-15T06:00:00.000Z";
    const nextForecastAt = "2026-07-15T07:00:00.000Z";
    const sharedCreatedAt = "2026-07-15T05:00:00.000Z";
    const sharedUpdatedAt = "2026-07-15T05:30:00.000Z";

    const view = renderFeedbackCapture({
      forecast: createForecast({
        forecast_at: initialForecastAt,
        created_at: sharedCreatedAt,
        updated_at: sharedUpdatedAt,
      }),
    });
    await user.click(screen.getByRole("button", { name: /^right$/i }));
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(
      await screen.findByText("Feedback could not be saved."),
    ).toBeInTheDocument();
    view.rerender(
      <ForecastFeedbackCapture
        {...feedbackCaptureProps({
          forecast: createForecast({
            forecast_at: nextForecastAt,
            created_at: sharedCreatedAt,
            updated_at: sharedUpdatedAt,
          }),
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /send/i }));

    expect(await screen.findByText("Feedback saved.")).toBeInTheDocument();
    const requestBodies = (global.fetch as jest.Mock).mock.calls.map(
      ([, init]) => JSON.parse(String((init as RequestInit).body)),
    );
    expect(requestBodies[0].forecastAt).toBe(initialForecastAt);
    expect(requestBodies[1].forecastAt).toBe(nextForecastAt);
    expect(requestBodies[1].requestId).not.toBe(requestBodies[0].requestId);
  });

  it("locks submission synchronously while a request is pending", async () => {
    (global.fetch as jest.Mock).mockImplementationOnce(
      () => new Promise<Response>(() => undefined),
    );
    const user = userEvent.setup();

    renderFeedbackCapture();
    await user.click(screen.getByRole("button", { name: /^right$/i }));
    const sendButton = screen.getByRole("button", { name: /send/i });

    await user.click(sendButton);

    expect(sendButton).toBeDisabled();
    await user.click(sendButton);
    expect(global.fetch).toHaveBeenCalledTimes(1);
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
