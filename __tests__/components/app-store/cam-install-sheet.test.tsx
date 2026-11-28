import { act, fireEvent, render, screen } from "@testing-library/react";

import { CamInstallSheetMount } from "@/components/app-store/cam-install-sheet-mount";
import { StickyInstallAsk } from "@/components/app-store/sticky-install-ask";
import { track } from "@/lib/analytics";
import { trackIosAppCtaClick } from "@/lib/analytics/ios-app-cta-tracking";
import {
  CAM_INSTALL_SHEET_STORAGE_KEY,
  reportCamPlayback,
  resetCamSheetPageLoadForTests,
} from "@/lib/app-store/cam-install-sheet";
import {
  getInstallAskClaimState,
  resetInstallAskClaimForTests,
} from "@/lib/app-store/install-ask-claim";

let pathname = "/ca/san-diego/blacks";
jest.mock("next/navigation", () => ({ usePathname: () => pathname }));

let authState: { user: { id: string } | null; isLoading: boolean } | null = {
  user: null,
  isLoading: false,
};
jest.mock("@/context/auth-context", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
}));
jest.mock("@/hooks/use-reduced-motion", () => ({ useReducedMotion: () => false }));
jest.mock("@/hooks/use-search-referrer", () => ({
  useSearchReferrer: () => ({ isSearchReferral: false }),
}));
jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));
jest.mock("@/lib/analytics", () => ({ track: jest.fn() }));
jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
}));
jest.mock("@/lib/analytics/app-handoff-tracking", () => ({
  trackAppHandoffQrRendered: jest.fn(),
}));
jest.mock("@/components/auth/unified-auth-modal", () => ({ UnifiedAuthModal: () => null }));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: (loader: () => Promise<unknown>) => {
    const source = loader.toString();
    if (source.includes("cam-install-sheet")) {
      return require("@/components/app-store/cam-install-sheet").CamInstallSheet;
    }
    return require("@/components/app-store/install-bar").InstallBar;
  },
}));

const UAS = {
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
  desktop:
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
};

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

/** Plays `seconds` of cam in normal 0.25 s timeupdate steps. */
function play(seconds: number): void {
  act(() => {
    for (let played = 0; played < seconds; played += 0.25) reportCamPlayback(0.25);
  });
}

function sheet(tomorrowHeight: string | null = null, spotName = "Blacks Beach") {
  return (
    <CamInstallSheetMount
      spotName={spotName}
      tomorrowHeight={tomorrowHeight}
      source="beach-detail-blacks"
      target="beach:blacks"
    />
  );
}

const trackMock = track as jest.Mock;
const clickMock = trackIosAppCtaClick as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  pathname = "/ca/san-diego/blacks";
  authState = { user: null, isLoading: false };
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetInstallAskClaimForTests();
  resetCamSheetPageLoadForTests();
  delete process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET;
  setUserAgent(UAS.iphone);
  Object.defineProperty(window, "scrollY", { value: 900, configurable: true, writable: true });
});

describe("CamInstallSheetMount", () => {
  it("renders nothing on the server pass and until 45 s of playback", () => {
    render(sheet());
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();

    play(44.75);
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();

    play(0.25);
    expect(screen.getByTestId("cam-install-sheet")).toHaveAttribute("data-platform", "iphone");
  });

  it("shows copy A with the approved text and tracks the view", () => {
    render(sheet());
    play(45);

    const el = screen.getByTestId("cam-install-sheet");
    expect(el).toHaveTextContent("Make Blacks Beach your home break");
    expect(el).toHaveTextContent("Alerts for your home break are free. We ping you when it turns on.");
    expect(screen.getByRole("link", { name: "Get free alerts" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not now" })).toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith(
      "cam_install_sheet_view",
      expect.objectContaining({ variant: "a", platform: "iphone", placement: "cam_sheet", surface: "beach_detail" }),
    );
  });

  it("shows copy B for anonymous visitors when tomorrow is bigger", () => {
    render(sheet("6-7 ft"));
    play(45);

    const el = screen.getByTestId("cam-install-sheet");
    expect(el).toHaveAttribute("data-variant", "b");
    expect(el).toHaveTextContent("6-7 ft at Blacks Beach tomorrow");
    expect(el).toHaveTextContent("Get a dawn ping with the best window before you drive.");
    expect(screen.getByRole("link", { name: "Ping me at dawn" })).toBeInTheDocument();
  });

  it("uses copy A for signed-in visitors, whose hero can show a personal value", () => {
    authState = { user: { id: "u1" }, isLoading: false };
    render(sheet("6-7 ft"));
    play(45);
    expect(screen.getByTestId("cam-install-sheet")).toHaveAttribute("data-variant", "a");
  });

  it("never shows a placeholder when the spot name is missing", () => {
    render(sheet("6-7 ft", ""));
    play(45);
    const el = screen.getByTestId("cam-install-sheet");
    expect(el).toHaveTextContent("Free alerts for your home break");
    expect(el.textContent).not.toMatch(/undefined|null|—|\{|\}/);
  });

  it("tracks a tap as an ios_app cta_click with a fresh handoff id and the variant", () => {
    render(sheet("6-7 ft"));
    play(45);

    const link = screen.getByRole("link", { name: "Ping me at dawn" });
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);

    const metadata = clickMock.mock.calls[0][0];
    expect(metadata).toMatchObject({
      source: "beach-detail-blacks",
      surface: "beach_detail",
      placement: "cam_sheet",
      variant: "b",
      cta_text: "Ping me at dawn",
      link_kind: "handoff",
    });
    expect(metadata.destination_url).toContain(`handoff_id=${metadata.handoff_id}`);
    expect(metadata.destination_url).toContain("placement=cam_sheet");
  });

  it("closes on Not now and on Escape, tracking the dismissal", () => {
    const { unmount } = render(sheet());
    play(45);
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith(
      "cam_install_sheet_dismiss",
      expect.objectContaining({ method: "not_now", variant: "a" }),
    );
    unmount();

    window.localStorage.clear();
    window.sessionStorage.clear();
    resetInstallAskClaimForTests();
    resetCamSheetPageLoadForTests();
    render(sheet());
    play(45);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledWith(
      "cam_install_sheet_dismiss",
      expect.objectContaining({ method: "escape" }),
    );
  });

  it("leaves Escape to fullscreen video and open modal dialogs", () => {
    render(sheet());
    play(45);
    const dialog = document.createElement("div");
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    document.body.appendChild(dialog);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.getByTestId("cam-install-sheet")).toBeInTheDocument();
    dialog.remove();
  });

  it("is not a modal: it never moves focus", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    button.focus();
    render(sheet());
    play(45);
    expect(document.activeElement).toBe(button);
    expect(screen.getByTestId("cam-install-sheet")).not.toHaveAttribute("aria-modal", "true");
    button.remove();
  });

  it("shows once per 7 days per browser", () => {
    const { unmount } = render(sheet());
    play(45);
    expect(screen.getByTestId("cam-install-sheet")).toBeInTheDocument();
    expect(window.localStorage.getItem(CAM_INSTALL_SHEET_STORAGE_KEY)).not.toBeNull();
    unmount();

    // A later visit inside the window: new tab session, new page load.
    window.sessionStorage.clear();
    resetInstallAskClaimForTests();
    resetCamSheetPageLoadForTests();
    render(sheet());
    play(120);
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
  });

  it("shows at most once per page load when storage fails", () => {
    const getItem = jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    const setItem = jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("denied", "SecurityError");
    });
    try {
      const first = render(sheet());
      play(45);
      expect(screen.getByTestId("cam-install-sheet")).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: "Not now" }));
      first.unmount();

      render(sheet());
      play(120);
      expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it("shows nothing on Android", () => {
    setUserAgent(UAS.android);
    render(sheet());
    play(120);
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
  });

  it("shows the desktop corner card with the handoff QR code", () => {
    setUserAgent(UAS.desktop);
    render(sheet());
    play(45);
    const el = screen.getByTestId("cam-install-sheet");
    expect(el).toHaveAttribute("data-platform", "desktop");
    const qr = screen.getByTestId("cam-install-sheet-qr");
    const url = new URL(qr.getAttribute("data-smart-url")!);
    expect(url.origin + url.pathname).toBe("https://go.quiversurf.app/app/handoff");
    expect(url.searchParams.get("placement")).toBe("cam_sheet");
    expect(url.searchParams.get("utm_medium")).toBe("desktop_handoff");
    expect(url.searchParams.get("handoff_id")).toEqual(expect.any(String));
  });

  it("does not claim the visit on desktop, so in-page asks stay in the page", () => {
    setUserAgent(UAS.desktop);
    render(sheet());
    play(45);
    expect(screen.getByTestId("cam-install-sheet")).toHaveAttribute("data-platform", "desktop");
    expect(getInstallAskClaimState()).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(getInstallAskClaimState()).toBe("none");
  });

  it("uses no bg-white class, which .theme-retro-dark repaints as a solid fill", () => {
    setUserAgent(UAS.iphone);
    render(sheet());
    play(45);
    const el = screen.getByTestId("cam-install-sheet");
    const painted = [el, ...Array.from(el.querySelectorAll("*"))].filter((node) =>
      (node.getAttribute("class") ?? "").includes("bg-white"),
    );
    expect(painted).toHaveLength(0);
  });

  it("stays off when NEXT_PUBLIC_CAM_INSTALL_SHEET is false", () => {
    process.env.NEXT_PUBLIC_CAM_INSTALL_SHEET = "false";
    render(sheet());
    play(120);
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
  });

  it("takes the install bar off screen when it opens and keeps it off after Not now", async () => {
    render(
      <>
        <StickyInstallAsk bar={{ placeName: "Blacks Beach", source: "beach-detail-blacks" }} />
        {sheet()}
      </>,
    );
    await act(async () => {});
    expect(screen.getByTestId("install-bar")).toBeInTheDocument();

    play(45);
    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("cam-install-sheet")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("cam-install-sheet")).not.toBeInTheDocument();
  });
});
