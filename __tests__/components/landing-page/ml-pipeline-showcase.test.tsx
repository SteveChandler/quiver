import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MLPipelineShowcase } from "@/components/landing-page/ml-pipeline-showcase";
import { useAuth } from "@/context/auth-context";
import {
  trackSignupCtaClick,
  trackSignupCtaView,
} from "@/lib/analytics/signup-conversion-tracking";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  useInView: () => true,
  useReducedMotion: () => false,
}));

jest.mock("@/context/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: ({
    isOpen,
    source,
  }: {
    isOpen: boolean;
    source: string;
  }) =>
    isOpen ? <div data-testid="auth-modal" data-source={source} /> : null,
}));

jest.mock("@/components/landing-page/match-score-ring", () => ({
  MatchScoreRing: ({ score }: { score: number }) => (
    <div data-testid="match-score-ring">{score}</div>
  ),
}));

jest.mock("@/lib/analytics/signup-conversion-tracking", () => ({
  trackSignupCtaClick: jest.fn(),
  trackSignupCtaView: jest.fn(),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockTrackSignupCtaClick = trackSignupCtaClick as jest.Mock;
const mockTrackSignupCtaView = trackSignupCtaView as jest.Mock;

describe("MLPipelineShowcase", () => {
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

  it("explains the forecast check log improve loop", async () => {
    render(<MLPipelineShowcase />);

    expect(
      screen.getByRole("heading", {
        name: /the loop behind one clear surf call/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText(/forecast, check, log, improve/i)).toBeInTheDocument();
    expect(screen.getByText("Quiver makes the call.")).toBeInTheDocument();
    expect(screen.getByText("You check the beach.")).toBeInTheDocument();
    expect(screen.getByText("You log the session.")).toBeInTheDocument();
    expect(screen.getByText("Quiver compares the next one.")).toBeInTheDocument();
    expect(
      screen.getByText(/your logged days sit next to the next call/i),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(mockTrackSignupCtaView).toHaveBeenCalledWith({
        source: "ml-pipeline-showcase",
        surface: "landing-page",
      });
    });
  });

  it("uses oversized zine sticker artwork for the loop cards", () => {
    const { container } = render(<MLPipelineShowcase />);

    const stickers = Array.from(
      container.querySelectorAll("[data-zine-sticker]")
    );

    expect(stickers.map((sticker) => sticker.getAttribute("data-zine-sticker"))).toEqual([
      "spot-best-season",
      "spot-location",
      "spot-gallery",
      "spot-swell-match",
    ]);
    stickers.forEach((sticker) => {
      expect(sticker).toHaveClass("w-[clamp(7rem,9vw,9.5rem)]");
    });
  });

  it("opens signup from the loop CTA with source attribution", async () => {
    const user = userEvent.setup();

    render(<MLPipelineShowcase />);

    await user.click(screen.getByRole("button", { name: /get my surf call/i }));

    expect(mockTrackSignupCtaClick).toHaveBeenCalledWith({
      source: "ml-pipeline-showcase",
      surface: "landing-page",
    });
    expect(screen.getByTestId("auth-modal")).toHaveAttribute(
      "data-source",
      "ml-pipeline-showcase",
    );
  });
});
