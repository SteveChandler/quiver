import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { ForecastSection } from "@/components/landing-page/forecast-section";
import { useAuth } from "@/context/auth-context";
import {
  trackIosAppCtaClick,
  trackIosAppCtaView,
} from "@/lib/analytics/ios-app-cta-tracking";
import { IOS_APP_STORE_CTA, IOS_APP_STORE_URL } from "@/lib/constants/app-store";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    alt = "",
    fill: _fill,
    sizes: _sizes,
    ...props
  }: Record<string, unknown>) => <img alt={String(alt)} {...props} />,
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  useInView: () => true,
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  track: jest.fn(),
}));

jest.mock("@/lib/analytics/ios-app-cta-tracking", () => ({
  trackIosAppCtaClick: jest.fn(),
  trackIosAppCtaView: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockTrackIosAppCtaClick = trackIosAppCtaClick as jest.Mock;
const mockTrackIosAppCtaView = trackIosAppCtaView as jest.Mock;

describe("ForecastSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuth.mockReturnValue({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      signIn: jest.fn(),
      signUp: jest.fn(),
      signOut: jest.fn(),
      refreshSession: jest.fn(),
    });
  });

  it("leads with one surf call copy", () => {
    render(<ForecastSection />);

    expect(
      screen.getByRole("heading", { name: /one call before you paddle out/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/swell, wind, tide, and beach context/i),
    ).toBeInTheDocument();
  });

  it("uses forecast, log, and check as the product loop tabs", async () => {
    const user = userEvent.setup();
    render(<ForecastSection />);

    expect(screen.getAllByRole("tab", { name: /forecast/i })).toHaveLength(2);
    expect(screen.getAllByRole("tab", { name: /log/i })).toHaveLength(2);
    expect(screen.getAllByRole("tab", { name: /check/i })).toHaveLength(2);

    await user.click(screen.getAllByRole("tab", { name: /log/i })[0]);

    expect(
      screen.getByRole("heading", { name: /log what actually happened/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/real surf signal/i)).toBeInTheDocument();

    await user.click(screen.getAllByRole("tab", { name: /check/i })[0]);

    expect(
      screen.getByRole("heading", { name: /check the beach before you commit/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ground-truth the call/i)).toBeInTheDocument();
  });

  it("tracks the App Store CTA without preorder wording", async () => {
    const user = userEvent.setup();
    render(<ForecastSection />);

    await waitFor(() => {
      expect(mockTrackIosAppCtaView).toHaveBeenCalledWith({
        source: "forecast-section",
        surface: "landing-page",
        placement: "forecast_section",
      });
    });

    const cta = screen.getByRole("link", { name: IOS_APP_STORE_CTA });
    cta.addEventListener("click", (event) => event.preventDefault());
    expect(cta).toHaveAttribute("href", IOS_APP_STORE_URL);

    await user.click(cta);

    expect(mockTrackIosAppCtaClick).toHaveBeenCalledWith({
      source: "forecast-section",
      surface: "landing-page",
      placement: "forecast_section",
      cta_text: IOS_APP_STORE_CTA,
      destination_url: IOS_APP_STORE_URL,
    });
  });
});
