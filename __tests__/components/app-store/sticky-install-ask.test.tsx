import { act, render, screen, waitFor } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server.node";

import { StickyInstallAsk } from "@/components/app-store/sticky-install-ask";
import { StickySignupBar } from "@/components/ui/sticky-signup-bar";

let pathname = "/ca/san-diego/blacks";
jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

let authState: { user: { id: string } | null; isLoading: boolean } = {
  user: null,
  isLoading: false,
};
jest.mock("@/context/auth-context", () => ({
  useAuth: () => authState,
  useOptionalAuth: () => authState,
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: () => null,
}));
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () => {
    // Resolve the lazy bar synchronously; the real loader is exercised in the bar's own test.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("@/components/app-store/install-bar").InstallBar;
  },
}));

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1";
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", { configurable: true, value: userAgent });
}

const stickySignup = {
  source: "beach-detail-blacks",
  ctaText: "Save Blacks as your home break",
  supportingText: "Alerts when Blacks is firing — free",
};

function ask(withSignup = true) {
  return (
    <StickyInstallAsk
      stickySignup={withSignup ? stickySignup : undefined}
      bar={{ placeName: "Blacks", valueLabel: "2-3 ft", isTomorrow: false, source: "beach-detail-blacks" }}
    />
  );
}

const ORIGINAL_FLAG = process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;

beforeEach(() => {
  pathname = "/ca/san-diego/blacks";
  authState = { user: null, isLoading: false };
  window.localStorage.clear();
  Object.defineProperty(window, "scrollY", { value: 900, configurable: true, writable: true });
});

afterEach(() => {
  if (ORIGINAL_FLAG === undefined) delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;
  else process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = ORIGINAL_FLAG;
});

describe("StickyInstallAsk", () => {
  it("server-renders exactly what StickySignupBar renders alone, so CDN HTML is shared", () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_SAFARI_UA);

    expect(renderToStaticMarkup(ask())).toBe(
      renderToStaticMarkup(<StickySignupBar {...stickySignup} />),
    );
  });

  it("server-renders nothing when the page has no signup bar", () => {
    expect(renderToStaticMarkup(ask(false))).toBe("");
  });

  it.each([
    ["Safari", IPHONE_SAFARI_UA],
    ["Chrome on iPhone", IPHONE_CHROME_UA],
  ])("swaps the signup bar for the install bar on iPhone %s, never both", async (_name, userAgent) => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(userAgent);
    render(ask());

    await waitFor(() => expect(screen.getByTestId("install-bar")).toBeInTheDocument());
    expect(screen.queryByTestId("sticky-signup-bar")).not.toBeInTheDocument();
    expect(screen.getAllByRole("complementary")).toHaveLength(1);
  });

  it("is identical to today with the flag off, on every user agent", async () => {
    delete process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED;

    for (const userAgent of [IPHONE_SAFARI_UA, IPHONE_CHROME_UA, ANDROID_UA]) {
      setUserAgent(userAgent);
      const { unmount } = render(ask());
      await act(async () => {});

      expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
      expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
      unmount();
    }
  });

  it("keeps the signup bar for Android and desktop even with the flag on", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(ANDROID_UA);
    render(ask());
    await act(async () => {});

    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
  });

  it("does not run on pages that are not bar surfaces", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_SAFARI_UA);
    pathname = "/forecast";
    render(ask());
    await act(async () => {});

    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
  });

  it("falls back to the signup bar after the install bar is dismissed, and remembers it", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_SAFARI_UA);
    const { unmount } = render(ask());
    await waitFor(() => expect(screen.getByTestId("install-bar")).toBeInTheDocument());

    act(() => {
      screen.getByRole("button", { name: "Dismiss app install bar" }).click();
    });

    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
    expect(window.localStorage.getItem("quiver_dismissed_install_bar_v1")).not.toBeNull();

    unmount();
    render(ask());
    await act(async () => {});
    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("sticky-signup-bar")).toBeInTheDocument();
  });

  it("renders nothing for a bar-owned page with no signup bar once the bar is dismissed", async () => {
    process.env.NEXT_PUBLIC_INSTALL_BAR_ENABLED = "true";
    setUserAgent(IPHONE_CHROME_UA);
    pathname = "/beaches/usa/ca/san-diego";
    render(ask(false));
    await waitFor(() => expect(screen.getByTestId("install-bar")).toBeInTheDocument());

    act(() => {
      screen.getByRole("button", { name: "Dismiss app install bar" }).click();
    });

    expect(screen.queryByTestId("install-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sticky-signup-bar")).not.toBeInTheDocument();
  });
});
