import { render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

import { Navbar } from "@/components/landing-page/navbar";
import { IOS_APP_STORE_URL } from "@/lib/constants/app-store";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/",
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    priority: _priority,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: () => ({ user: null, isLoading: false, loading: false }),
}));

jest.mock("@/hooks/use-landing-location", () => ({
  useLandingLocation: () => ({ regionName: null, isLoading: false }),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: () => null,
}));

jest.mock("@/lib/analytics/auth-events", () => ({
  trackAuthModalOpened: jest.fn(),
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSigninCtaClick: jest.fn(),
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

jest.mock("@/components/app-store/ios-app-store-cta", () => ({
  IosAppStoreCta: ({
    children,
    source,
    surface,
    placement,
    className,
  }: {
    children: ReactNode;
    source: string;
    surface: string;
    placement: string;
    className?: string;
  }) => (
    <a
      href={IOS_APP_STORE_URL}
      data-testid="ios-app-store-cta"
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      className={className}
    >
      {children}
    </a>
  ),
}));

jest.mock("@/components/app-store/native-app-funnel-cta", () => ({
  NativeAppFunnelCta: ({
    platform,
    source,
    surface,
    placement,
    className,
    iosLabel,
    androidLabel,
  }: {
    platform: string;
    source: string;
    surface: string;
    placement: string;
    className?: string;
    iosLabel?: ReactNode;
    androidLabel?: ReactNode;
  }) => (
    <button
      type="button"
      data-testid="native-app-funnel-cta"
      data-platform={platform}
      data-source={source}
      data-surface={surface}
      data-placement={placement}
      className={className}
    >
      {platform === "android" ? androidLabel : iosLabel}
    </button>
  ),
}));

jest.mock("@/components/app-store/send-to-phone-cta", () => ({
  SendToPhoneCta: () => <div data-testid="send-to-phone" />,
}));

function setUserAgent(userAgent: string): void {
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value: userAgent,
  });
}

describe("Navbar native app CTA", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("routes iPhone visitors through the shared native CTA", async () => {
    setUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1",
    );

    render(<Navbar position="static" />);

    await waitFor(() => {
      expect(screen.getByTestId("native-app-funnel-cta")).toHaveAttribute(
        "data-platform",
        "ios",
      );
    });

    const cta = screen.getByTestId("native-app-funnel-cta");
    expect(cta).toHaveAttribute("data-source", "landing-navbar");
    expect(cta).toHaveAttribute("data-surface", "landing-page");
    expect(cta).toHaveAttribute("data-placement", "navbar_primary");
    expect(cta).toHaveTextContent("Get the app");
    expect(screen.queryByText(/get free alerts/i)).not.toBeInTheDocument();
  });

  it("routes Android visitors through the shared native CTA", async () => {
    setUserAgent(
      "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    );

    render(<Navbar position="static" />);

    await waitFor(() => {
      expect(screen.getByTestId("native-app-funnel-cta")).toHaveAttribute(
        "data-platform",
        "android",
      );
    });

    const cta = screen.getByTestId("native-app-funnel-cta");
    expect(cta).toHaveAttribute("data-source", "landing-navbar");
    expect(cta).toHaveAttribute("data-surface", "landing-page");
    expect(cta).toHaveAttribute("data-placement", "navbar_primary");
    expect(cta).toHaveTextContent("Get the app");
    expect(screen.queryByText(/get free alerts/i)).not.toBeInTheDocument();
  });

  it("keeps desktop visitors on an App Store navbar link, not the QR module", () => {
    setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    );

    render(<Navbar position="static" />);

    const cta = screen.getByTestId("ios-app-store-cta");
    expect(cta).toHaveAttribute("href", IOS_APP_STORE_URL);
    expect(cta).toHaveAttribute("data-source", "landing-navbar-app-store");
    expect(cta).toHaveAttribute("data-surface", "landing-page");
    expect(cta).toHaveAttribute("data-placement", "navbar_primary");
    expect(cta).toHaveTextContent("Get the app");
    expect(screen.queryByTestId("native-app-funnel-cta")).not.toBeInTheDocument();
    expect(screen.queryByTestId("send-to-phone")).not.toBeInTheDocument();
    expect(screen.queryByText(/get free alerts/i)).not.toBeInTheDocument();
  });

  it("shows the simplified landing links and removes navbar search", () => {
    render(<Navbar position="static" />);

    expect(screen.getByRole("link", { name: "Features" })).toHaveAttribute(
      "href",
      "#features",
    );
    expect(screen.getByTestId("ios-app-store-cta")).toHaveTextContent(
      "Get the app",
    );
    expect(screen.getByTestId("ios-app-store-cta")).toHaveClass(
      "bg-transparent",
    );
    expect(screen.queryByLabelText(/search by beach/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/search by beach/i),
    ).not.toBeInTheDocument();
  });
});
