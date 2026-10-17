import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import mapboxgl from "mapbox-gl";
import { SessionDetailView } from "@/components/session-detail-view";
import { SessionRideMap } from "@/components/sessions/waves/session-ride-map";
import { SessionWavesSection } from "@/components/sessions/waves/session-waves-section";
import { SpeedTimeline } from "@/components/sessions/waves/speed-timeline";
import type { SessionWavesResponse } from "@/lib/sessions/waves/waves-api-types";

const mockTrack = jest.fn();
const mockRemove = jest.fn();
const mockAddSource = jest.fn();
const mockAddLayer = jest.fn();
const mockFitBounds = jest.fn();
const mockSetData = jest.fn();
const mockViewer = { id: "owner" };
let mockDelayMapLoad = false;
let mockLoadCallbacks: (() => void)[] = [];

jest.mock("next/dynamic", () => {
  const React = jest.requireActual("react");
  return jest.fn((loader) => {
    const Lazy = React.lazy(loader);
    return function DynamicComponent(props: Record<string, unknown>) {
      return React.createElement(React.Suspense, { fallback: null }, React.createElement(Lazy, props));
    };
  });
});

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: mockViewer, isLoading: false }),
}));
jest.mock("next/navigation", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/components/session-comments", () => ({ SessionComments: () => null }));
jest.mock("@/components/map-image", () => ({ MapImage: () => null }));
jest.mock("@/lib/utils/session-utils", () => ({ getSessionMapImageUrl: () => "/session-map.jpg" }));
jest.mock("@/components/share", () => ({ ShareSheet: () => null }));
jest.mock("@/components/media/session-photo-gallery", () => ({ __esModule: true, default: () => null }));

jest.mock("@/hooks/use-track-event", () => ({
  useTrackEvent: () => ({ track: mockTrack }),
}));

jest.mock("mapbox-gl", () => ({
  __esModule: true,
  default: {
    accessToken: "",
    Map: jest.fn(() => ({
      on: jest.fn((event, callback) => {
        if (event !== "load") return;
        if (mockDelayMapLoad) mockLoadCallbacks.push(callback);
        else callback();
      }),
      addSource: mockAddSource,
      addLayer: mockAddLayer,
      fitBounds: mockFitBounds,
      remove: mockRemove,
      getSource: jest.fn(() => mockAddSource.mock.calls.some(([id]) => id === "session-waves")
        ? { setData: mockSetData }
        : undefined),
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
    index: 0,
    startedAt: "2026-10-17T14:00:00.000Z",
    endedAt: "2026-10-17T14:00:24.000Z",
    durationS: 24,
    distanceM: 78,
    maxSpeedMps: 4,
    avgSpeedMps: 3,
    headingDeg: 180,
    confidence: 0.9,
    excluded: false,
    counted: true,
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
    mockSetData.mockClear();
    jest.mocked(mapboxgl.Map).mockClear();
    mockDelayMapLoad = false;
    mockLoadCallbacks = [];
  });

  afterAll(() => {
    if (originalToken === undefined) delete process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    else process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN = originalToken;
  });

  it("numbers counted rides and keeps low-confidence candidates read-only", async () => {
    const waves = [
      { ...fixture.waves[0], id: "maybe", index: 0, confidence: 0.4, counted: false },
      { ...fixture.waves[0], id: "first", index: 1 },
      { ...fixture.waves[0], id: "excluded", index: 2, counted: false, excluded: true },
      { ...fixture.waves[0], id: "second", index: 3 },
    ];
    fetchMock.mockResolvedValue(envelope({ ...fixture, waves }));
    render(<SessionWavesSection sessionId="s1" />);
    const maybe = await screen.findByText(/^Maybe a wave/);
    expect(within(maybe.closest("li")!).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText(/^Wave 1 ·/)).toBeInTheDocument();
    expect(screen.getByText(/^Wave 2 ·/)).toBeInTheDocument();
    expect(screen.queryByText(/^Wave [03] ·/)).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Not a wave" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("draws and shades only counted, non-excluded candidates", () => {
    const waves = [
      fixture.waves[0],
      { ...fixture.waves[0], id: "maybe", counted: false, confidence: 0.4 },
      { ...fixture.waves[0], id: "excluded", excluded: true },
    ];
    render(<SessionRideMap track={fixture.track} waves={waves} />);
    const source = mockAddSource.mock.calls.find(([id]) => id === "session-waves")![1];
    expect(source.data.features.map((feature: { properties: { id: string } }) => feature.properties.id)).toEqual(["w1"]);
    render(<SpeedTimeline speedSeries={fixture.speedSeries} waves={waves} />);
    expect(screen.getByLabelText("Speed timeline").querySelectorAll("rect")).toHaveLength(1);
  });

  it("restores a counted ride and its shading when undoing an exclusion", async () => {
    const excluded = { ...fixture, waves: [{ ...fixture.waves[0], excluded: true, counted: false }] };
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(envelope(
      options?.method === "PATCH" ? { summary: fixture.summary } : excluded,
    )));
    render(<SessionWavesSection sessionId="s1" />);
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    await screen.findByRole("button", { name: "Not a wave" });
    expect(screen.getByText(/^Wave 1 ·/)).toBeInTheDocument();
    expect(screen.getByLabelText("Speed timeline").querySelectorAll("rect")).toHaveLength(1);
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

  it("preserves a completed wave toggle when an earlier count save finishes last", async () => {
    let resolveCount!: (response: Response) => void;
    let resolveWave!: (response: Response) => void;
    fetchMock.mockImplementation((url: string, options?: RequestInit) => {
      if (options?.method !== "PATCH") return Promise.resolve(envelope(fixture));
      return new Promise<Response>((resolve) => {
        if (url.endsWith("/w1")) resolveWave = resolve;
        else resolveCount = resolve;
      });
    });
    render(<SessionWavesSection sessionId="s1" />);
    const count = await screen.findByRole("spinbutton", { name: "How many did you catch?" });
    fireEvent.change(count, { target: { value: "5" } });
    fireEvent.blur(count);
    fireEvent.click(screen.getByRole("button", { name: "Not a wave" }));

    await act(async () => resolveWave(envelope({ summary: { ...fixture.summary, detectedWaveCount: 1 } })));
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    await act(async () => resolveCount(envelope({ summary: { ...fixture.summary, waveCount: 5, userWaveCount: 5, detectedWaveCount: 1 } })));

    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
    expect(screen.getByText("You: 5 · Quiver found 1")).toBeInTheDocument();
  });

  it.each(["250", "5.5"])("reverts invalid count %s and explains the range", async (value) => {
    render(<SessionWavesSection sessionId="s1" />);
    const count = await screen.findByRole("spinbutton", { name: "How many did you catch?" });
    fireEvent.change(count, { target: { value } });
    fireEvent.blur(count);

    expect(count).toHaveValue(3);
    expect(screen.getByText("Enter a whole number from 0 to 200.")).toHaveAttribute("aria-live", "polite");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["count", "wave"])("reports a failed %s PATCH without changing saved values", async (kind) => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchMock.mockImplementation((_url: string, options?: RequestInit) => Promise.resolve(
      options?.method === "PATCH" ? { ok: false, status: 500 } : envelope(fixture),
    ));
    try {
      render(<SessionWavesSection sessionId="s1" />);
      const count = await screen.findByRole("spinbutton", { name: "How many did you catch?" });
      if (kind === "count") {
        fireEvent.change(count, { target: { value: "5" } });
        fireEvent.blur(count);
      } else {
        fireEvent.click(screen.getByRole("button", { name: "Not a wave" }));
      }

      expect(await screen.findByText("Couldn't save. Try again.")).toHaveAttribute("aria-live", "polite");
      expect(count).toHaveValue(3);
      expect(screen.getByRole("button", { name: "Not a wave" })).toBeInTheDocument();
    } finally {
      warn.mockRestore();
    }
  });

  it("updates the wave source without recreating or refitting the map", () => {
    const { rerender, unmount } = render(<SessionRideMap track={fixture.track} waves={fixture.waves} />);
    mockSetData.mockClear();
    rerender(<SessionRideMap track={fixture.track} waves={[{ ...fixture.waves[0], excluded: true }]} />);

    expect(mapboxgl.Map).toHaveBeenCalledTimes(1);
    expect(mockRemove).not.toHaveBeenCalled();
    expect(mockFitBounds).toHaveBeenCalledTimes(1);
    expect(mockSetData).toHaveBeenCalledWith({ type: "FeatureCollection", features: [] });
    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("uses the latest wave exclusions when the map finishes loading", () => {
    mockDelayMapLoad = true;
    const { rerender } = render(<SessionRideMap track={fixture.track} waves={fixture.waves} />);
    rerender(<SessionRideMap track={fixture.track} waves={[{ ...fixture.waves[0], excluded: true }]} />);
    act(() => mockLoadCallbacks.forEach((load) => load()));

    expect(mapboxgl.Map).toHaveBeenCalledTimes(1);
    expect(mockAddSource).toHaveBeenCalledWith("session-waves", {
      type: "geojson", data: { type: "FeatureCollection", features: [] },
    });
  });

  it("keeps long speed timelines compact with a fixed stroke width", () => {
    const speedSeries = Array.from({ length: 150_000 }, (_, index) => ({
      t: new Date(Date.parse(fixture.waves[0].startedAt) + index * 1000).toISOString(),
      mps: index % 5,
    }));
    render(<SpeedTimeline speedSeries={speedSeries} waves={fixture.waves} />);
    const chart = screen.getByRole("img", { name: "Speed timeline" });
    expect(chart).toHaveClass("h-24", "max-h-32");
    expect(chart).toHaveAttribute("preserveAspectRatio", "none");
    expect(chart.querySelector("path")).toHaveAttribute("vector-effect", "non-scaling-stroke");
  });

  it.each([
    { ownerId: "owner", expectedCount: 1 },
    { ownerId: "another-user", expectedCount: 0 },
  ])("loads waves on the session page only for its owner ($ownerId)", async ({ ownerId, expectedCount }) => {
    fetchMock.mockImplementation((url: string) => {
      if (url === "/api/sessions/s1") return Promise.resolve(envelope({ session: {
        id: "s1", user_id: ownerId, has_track: true, beach: null, beach_name: "Test Beach", rating: 4,
        arrival_time: fixture.waves[0].startedAt, forecast_snapshot: null,
      } }));
      if (url.endsWith("/photos")) return Promise.resolve(envelope([]));
      return Promise.resolve(envelope(fixture));
    });
    render(<SessionDetailView id="s1" />);
    expect(await screen.findByText("Session Details")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryAllByText("Your rides")).toHaveLength(expectedCount));
    const waveRequests = fetchMock.mock.calls.filter(([url]) => url === "/api/v1/sessions/s1/waves");
    expect(waveRequests).toHaveLength(expectedCount);
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
