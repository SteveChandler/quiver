import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SessionWavesSection } from "@/components/sessions/waves/session-waves-section";
import type { SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";

const mockTrack = jest.fn();
const mockRemove = jest.fn();
const mockAddSource = jest.fn();
const mockAddLayer = jest.fn();
const mockFitBounds = jest.fn();

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("mapbox-gl", () => ({
  __esModule: true,
  default: {
    accessToken: "",
    Map: jest.fn(() => ({
      on: jest.fn((event, callback) => {
        if (event === "load") callback();
      }),
      addSource: mockAddSource,
      addLayer: mockAddLayer,
      fitBounds: mockFitBounds,
      remove: mockRemove,
    })),
    LngLatBounds: jest.fn(() => ({ extend: jest.fn().mockReturnThis() })),
  },
}));

const fixture: SessionWavesResponse = {
  summary: {
    waveCount: 3,
    detectedWaveCount: 2,
    userWaveCount: 3,
    longestRideS: 24,
    longestRideM: 78,
    topSpeedMps: 4,
    gpsCoverage: 0.9,
    lowCoverage: false,
    speedReliable: true,
    detectionVersion: "wd-1.0.0",
  },
  waves: [{
    id: "w1",
    index: 1,
    startedAt: "2026-10-17T14:00:00.000Z",
    endedAt: "2026-10-17T14:00:24.000Z",
    durationS: 24,
    distanceM: 78,
    maxSpeedMps: 4,
    avgSpeedMps: 3,
    headingDeg: 180,
    confidence: 0.9,
    excluded: false,
    tideFt: 2.1,
    start: { lat: 32.7, lon: -117.2 },
    end: { lat: 32.701, lon: -117.201 },
  }],
  track: { type: "LineString", coordinates: [[-117.2, 32.7], [-117.201, 32.701]] },
  speedSeries: [
    { t: "2026-10-17T14:00:00.000Z", mps: 2 },
    { t: "2026-10-17T14:00:24.000Z", mps: 4 },
  ],
  recordedBy: "Watch",
};

const envelope = (data: unknown): Response => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true, data, timestamp: "2026-10-17T14:00:00.000Z" }),
} as Response);

describe("SessionWavesSection", () => {
  const originalToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = "pk.test";
    fetchMock = jest.fn().mockResolvedValue(envelope(fixture));
    global.fetch = fetchMock;
    mockTrack.mockClear();
    mockRemove.mockClear();
    mockAddSource.mockClear();
    mockAddLayer.mockClear();
    mockFitBounds.mockClear();
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalToken;
  });

  it("renders summary tiles and records the view once", async () => {
    render(<SessionWavesSection sessionId="s1" />);

    expect(await screen.findByText("You: 3 · Quiver found 2")).toBeInTheDocument();
    expect(screen.getByText("24 s · 78 m")).toBeInTheDocument();
    expect(screen.getByText("8.9 mph")).toBeInTheDocument();
    expect(screen.getByText(/2\.1 ft/)).toBeInTheDocument();
    expect(mockTrack).toHaveBeenCalledWith("session_waves_viewed", expect.objectContaining({
      metadata: expect.objectContaining({ session_id: "s1" }),
    }));
    expect(mockTrack).toHaveBeenCalledTimes(1);
  });

  it("hides unreliable speed measurements and timeline", async () => {
    fetchMock.mockResolvedValue(envelope({
      ...fixture,
      summary: { ...fixture.summary, speedReliable: false },
    }));
    render(<SessionWavesSection sessionId="s1" />);

    expect(await screen.findByText("You: 3 · Quiver found 2")).toBeInTheDocument();
    expect(screen.queryByText("Top speed")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Speed timeline")).not.toBeInTheDocument();
  });

  it("shows a low GPS coverage warning", async () => {
    fetchMock.mockResolvedValue(envelope({
      ...fixture,
      summary: { ...fixture.summary, lowCoverage: true },
    }));
    render(<SessionWavesSection sessionId="s1" />);

    expect(await screen.findByText("GPS dropped out for much of this surf, so the count may be low.")).toBeInTheDocument();
  });

  it("excludes a wave and updates the displayed count from the PATCH summary", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return Promise.resolve(envelope({
        summary: { ...fixture.summary, waveCount: 2, detectedWaveCount: 1 },
      }));
      return Promise.resolve(envelope(fixture));
    });
    render(<SessionWavesSection sessionId="s1" />);

    fireEvent.click(await screen.findByRole("button", { name: "Not a wave" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions/s1/waves/w1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ excluded: true }) }),
    ));
    expect(await screen.findByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByText("You: 3 · Quiver found 1")).toBeInTheDocument();
  });

  it("saves a corrected count on blur", async () => {
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method === "PATCH") return Promise.resolve(envelope({
        summary: { ...fixture.summary, waveCount: 5, userWaveCount: 5 },
      }));
      return Promise.resolve(envelope(fixture));
    });
    render(<SessionWavesSection sessionId="s1" />);

    const count = await screen.findByRole("spinbutton", { name: "How many did you catch?" });
    fireEvent.change(count, { target: { value: "5" } });
    fireEvent.blur(count);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      "/api/v1/sessions/s1/waves",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ userWaveCount: 5 }) }),
    ));
    expect(await screen.findByText("You: 5 · Quiver found 2")).toBeInTheDocument();
  });

  it("draws the track and non-excluded waves without map motion when requested", async () => {
    const oldMatchMedia = window.matchMedia;
    window.matchMedia = jest.fn().mockReturnValue({ matches: true });
    try {
      render(<SessionWavesSection sessionId="s1" />);
      expect(await screen.findByLabelText("Map of this surf and its rides")).toBeInTheDocument();
      expect(mockAddSource).toHaveBeenCalledWith("session-track", expect.objectContaining({
        data: expect.objectContaining({ geometry: fixture.track }),
      }));
      expect(mockAddSource).toHaveBeenCalledWith("session-waves", expect.objectContaining({
        data: expect.objectContaining({ features: [expect.objectContaining({
          geometry: expect.objectContaining({ coordinates: [[-117.2, 32.7], [-117.201, 32.701]] }),
        })] }),
      }));
      expect(mockFitBounds).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ duration: 0 }));
    } finally {
      window.matchMedia = oldMatchMedia;
    }
  });

  it("renders nothing when waves are unavailable", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: "not_found", timestamp: "2026-10-17T14:00:00.000Z" }),
    });
    const { container } = render(<SessionWavesSection sessionId="s1" />);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
