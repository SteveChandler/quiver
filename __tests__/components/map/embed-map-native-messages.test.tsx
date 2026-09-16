import { act, render } from "@testing-library/react";
import { EmbedMapClient } from "@/app/embed/map/embed-map-client";

interface MapProps {
  swellTimelineIndex: number;
  swellLayerId: string;
  getAccessToken: () => string | null;
}
let mockMapProps: MapProps;
const mockSearchParams = new URLSearchParams("timeline=hourly");
jest.mock("next/navigation", () => ({ useSearchParams: () => mockSearchParams }));
jest.mock("next/dynamic", () => () => (props: MapProps) => {
  mockMapProps = props;
  return null;
});

function send(type: string, payload: object, source: MessageEventSource | null = null, target: Window | Document = window): void {
  act(() => { target.dispatchEvent(new MessageEvent("message", { data: JSON.stringify({ type, payload }), source })); });
}

describe("native map message delivery", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    window.ReactNativeWebView = { postMessage: jest.fn() };
    jest.spyOn(global, "fetch").mockResolvedValue({ ok: false, status: 503 } as Response);
  });
  afterEach(() => {
    delete window.ReactNativeWebView;
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  it.each(["ios", "android"])("applies %s native playback and layer commands", (platform) => {
    render(<EmbedMapClient />);
    const target = platform === "ios" ? window : document;
    send("setLayer", { layerId: "s2" }, null, target);
    expect(mockMapProps.swellLayerId).toBe("s2");
    send("setForecastTime", { index: 4 }, null, target);
    expect(mockMapProps.swellTimelineIndex).toBe(4);
    send("setForecastPlaying", { playing: true }, null, target);
    act(() => jest.advanceTimersByTime(800));
    expect(mockMapProps.swellTimelineIndex).toBeGreaterThan(4);
    send("setForecastPlaying", { playing: false }, null, target);
    const stopped = mockMapProps.swellTimelineIndex;
    act(() => jest.advanceTimersByTime(800));
    expect(mockMapProps.swellTimelineIndex).toBe(stopped);
  });

  it("rejects other frames and non-native auth messages", () => {
    render(<EmbedMapClient />);
    const frame = document.createElement("iframe");
    document.body.appendChild(frame);
    send("setLayer", { layerId: "wind" }, frame.contentWindow);
    expect(mockMapProps.swellLayerId).toBe("s1");
    send("auth_token", { accessToken: "aaa.bbb.ccc" }, window);
    expect(mockMapProps.getAccessToken()).toBeNull();
    send("auth_token", { accessToken: "aaa.bbb.ccc" });
    expect(mockMapProps.getAccessToken()).toBe("aaa.bbb.ccc");
    frame.remove();
  });

  it("rejects null-source window messages outside a native WebView", () => {
    delete window.ReactNativeWebView;
    render(<EmbedMapClient />);
    send("setLayer", { layerId: "wind" });
    expect(mockMapProps.swellLayerId).toBe("s1");
  });
});
