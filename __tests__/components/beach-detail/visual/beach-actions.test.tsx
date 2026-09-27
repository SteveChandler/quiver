import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockUser = { current: null as null | { id: string } };
jest.mock("@/context/auth-context", () => ({ useAuth: () => ({ user: mockUser.current }) }));
jest.mock("qrcode.react", () => ({ QRCodeSVG: ({ value }: { value: string }) => <svg data-testid="watch-qr" data-value={value} /> }));
jest.mock("sonner", () => ({ toast: { success: jest.fn(), error: jest.fn() } }));
jest.mock("@/lib/posthog-client", () => ({ captureClientPostHogEventAfterConsent: jest.fn() }));
jest.mock("@/lib/analytics/app-handoff-tracking", () => ({ trackAppHandoffView: jest.fn(), trackAppHandoffLinkOpened: jest.fn() }));
const mockNative = { ready: false };
jest.mock("@/lib/constants/app-capabilities", () => ({
  get NATIVE_SELECTED_WINDOW_WATCH() { return mockNative.ready; },
}));

import { BeachActions } from "@/components/beach-detail/visual/beach-actions";

const SHARE = { hasCamStill: false, waterTempF: null, call: { kind: "unknown" as const } };
const BEACH = { id: "3fa85f64-5717-4562-b3fc-2c963f66afa6", slug: "tourmaline", name: "Tourmaline" };
const WINDOW = { start: "2099-09-27T18:00:00.000Z", end: "2099-09-27T20:30:00.000Z", forecastAt: "2099-09-27T18:00:00.000Z", label: "today 11am–1:30pm" };

function setPointer(coarse: boolean) {
  window.matchMedia = jest.fn().mockReturnValue({ matches: coarse }) as unknown as typeof window.matchMedia;
}

beforeEach(() => {
  mockUser.current = null;
  mockNative.ready = false;
  setPointer(false);
  global.fetch = jest.fn();
});

describe("BeachActions", () => {
  it("says 'Open in the app' to signed-out visitors until the app can watch a window", () => {
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="https://www.quiversurf.app/ca/san-diego/tourmaline" />);
    expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Open in the app");
  });

  it("says Watch once the app supports it", () => {
    mockNative.ready = true;
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Watch today 11am–1:30pm");
  });

  it("shows a QR for the exact window on desktop", async () => {
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(screen.getByTestId("watch-qr").getAttribute("data-value")).toMatch(/\/app\/spot\/tourmaline\?window=/);
  });

  it("opens the app directly on a phone", async () => {
    setPointer(true);
    const assign = jest.fn();
    // eslint-disable-next-line no-restricted-properties -- test needs to mock window.location.assign
    Object.defineProperty(window, "location", { configurable: true, value: { ...window.location, assign } });
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(assign).toHaveBeenCalledWith(expect.stringMatching(/\/app\/spot\/tourmaline\?window=/));
  });

  it("creates the watch for signed-in users", async () => {
    mockUser.current = { id: "u1" };
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => ({ success: true }) });
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/alerts/rules");
    expect(JSON.parse(init.body)).toMatchObject({ preset_type: "watched_call", beach_id: BEACH.id });
    await waitFor(() => expect(screen.getByTestId("beach-watch-button")).toHaveTextContent("Watching"));
  });

  it("falls back to the app sheet with the server's reason when the watch is refused", async () => {
    mockUser.current = { id: "u1" };
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false, status: 403, json: async () => ({ success: false, error: "Watching other beaches is part of Pro", timestamp: "t" }),
    });
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={WINDOW} score={61} shareUrl="x" />);
    await userEvent.click(screen.getByTestId("beach-watch-button"));
    expect(await screen.findByText("Watching other beaches is part of Pro")).toBeInTheDocument();
    expect(screen.getByTestId("watch-qr")).toBeInTheDocument();
  });

  it("offers only Share when there is no window to watch", () => {
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={null} score={null} shareUrl="x" />);
    expect(screen.queryByTestId("beach-watch-button")).toBeNull();
    expect(screen.getByTestId("beach-share-button")).toHaveClass("md:col-span-2");
  });

  it("describes only facts present on the shared page", () => {
    const { rerender } = render(<BeachActions {...SHARE} beach={BEACH} watchWindow={null} score={null} shareUrl="x" waterTempF={68} />);
    expect(screen.getByTestId("beach-share-button")).toHaveTextContent("The water temp.");
    expect(screen.getByTestId("beach-share-button")).not.toHaveTextContent(/cam still|surf call/i);
    rerender(<BeachActions {...SHARE} beach={BEACH} watchWindow={null} score={null} shareUrl="x" />);
    expect(screen.getByTestId("beach-share-button")).toHaveTextContent("The beach page.");
    rerender(<BeachActions {...SHARE} beach={BEACH} watchWindow={null} score={null} shareUrl="x" hasCamStill call={{ kind: "call", label: "FAIR", action: "Check it" }} />);
    expect(screen.getByTestId("beach-share-button")).toHaveTextContent("The cam still, surf call.");
  });

  it("copies the link when the browser can't share", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    render(<BeachActions {...SHARE} beach={BEACH} watchWindow={null} score={null} shareUrl="https://www.quiversurf.app/ca/san-diego/tourmaline" />);
    await userEvent.click(screen.getByTestId("beach-share-button"));
    expect(writeText).toHaveBeenCalledWith("https://www.quiversurf.app/ca/san-diego/tourmaline");
  });
});
