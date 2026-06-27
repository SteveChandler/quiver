import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { BeachAlertCta } from "@/components/beach-detail/beach-alert-cta";
import { useAuth } from "@/context/auth-context";

jest.mock("@/context/auth-context");
jest.mock("next/navigation", () => ({ usePathname: () => "/ca/san-diego/blacks" }));
jest.mock("@/components/auth/unified-auth-modal", () => ({
  UnifiedAuthModal: (props: any) =>
    props.isOpen ? (
      <div data-testid="auth-modal" data-source={props.source} />
    ) : null,
}));

const mockSetPendingAction = jest.fn();
const mockClearPendingAction = jest.fn();
let mockPendingAction: any = null;

jest.mock("@/hooks/use-pending-action", () => ({
  usePendingAction: () => ({
    pendingAction: mockPendingAction,
    setPendingAction: mockSetPendingAction,
    clearPendingAction: mockClearPendingAction,
  }),
}));

// Mock useDataFetcher — control rule data per test
let mockRules: any[] = [];
const mockRefetch = jest.fn();
const mockInvalidateCache = jest.fn();
jest.mock("@/hooks/use-data-fetcher", () => ({
  useDataFetcher: (_fetchFn: any, _opts: any) => ({
    data: mockRules,
    loading: false,
    error: null,
    refetch: mockRefetch,
    invalidateCache: mockInvalidateCache,
  }),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

const defaultProps = {
  beachId: "beach-123",
  beachName: "Blacks Beach",
};

const unauthenticatedAuth = {
  user: null,
  session: null as any,
  isLoading: false,
  isAuthenticated: false,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
} as any;

const authenticatedAuth = {
  user: { id: "u1", email: "test@example.com" } as any,
  session: null as any,
  isLoading: false,
  isAuthenticated: true,
  signUp: jest.fn(),
  signIn: jest.fn(),
  signOut: jest.fn(),
  refreshSession: jest.fn(),
} as any;

describe("BeachAlertCta", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRefetch.mockClear();
    mockInvalidateCache.mockClear();
    mockPendingAction = null;
    mockRules = [];
  });

  describe("renders Waves icon and Get Alerts text", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth);
    });

    it("renders a button with Get Alerts text", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /get alerts/i })
      ).toBeInTheDocument();
    });

    it("does not show free-growth copy when the phase flag prop is off", () => {
      render(<BeachAlertCta {...defaultProps} />);

      expect(
        screen.queryByText(/track up to 3 breaks/i)
      ).not.toBeInTheDocument();
      expect(
        screen.getByText(/notify me when conditions are ideal/i)
      ).toBeInTheDocument();
    });

    it("shows locked free-growth copy when the phase flag prop is on", () => {
      render(<BeachAlertCta {...defaultProps} freeGrowthPhaseEnabled />);

      expect(
        screen.getByRole("button", { name: /watch this spot, free/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          "Watch this spot, free. Track up to 3 breaks and we'll call the window.",
        )
      ).toBeInTheDocument();
    });

    it("renders a Waves icon inside the button", () => {
      const { container } = render(<BeachAlertCta {...defaultProps} />);
      const icon = container.querySelector(".lucide-waves");
      expect(icon).toBeInTheDocument();
    });
  });

  describe("opens auth modal for non-authenticated users", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth);
    });

    it("auth modal is not visible before clicking", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("opens auth modal with source='beach-alert-cta' when button is clicked", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(screen.getByTestId("auth-modal")).toBeInTheDocument();
      expect(screen.getByTestId("auth-modal")).toHaveAttribute(
        "data-source",
        "beach-alert-cta"
      );
    });
  });

  describe("stores pending action before opening auth modal", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth);
    });

    it("calls setPendingAction with correct type, beachId, and beachName on click", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(mockSetPendingAction).toHaveBeenCalledWith({
        type: "alert",
        beachId: defaultProps.beachId,
        beachName: defaultProps.beachName,
      });
    });
  });

  describe("authenticated user click behaviour", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(authenticatedAuth);
    });

    it("calls onOpenAlerts when button is clicked", () => {
      const onOpenAlerts = jest.fn();
      render(<BeachAlertCta {...defaultProps} onOpenAlerts={onOpenAlerts} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(onOpenAlerts).toHaveBeenCalledTimes(1);
    });

    it("does not open auth modal for authenticated users", () => {
      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });
      fireEvent.click(btn);
      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });
  });

  describe("alert state display", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(authenticatedAuth);
    });

    it("shows Waves icon and badge when rules exist for this beach", () => {
      mockRules = [
        { id: "r1", beach_id: "beach-123" },
        { id: "r2", beach_id: "beach-123" },
      ];
      const { container } = render(<BeachAlertCta {...defaultProps} />);
      const waves = container.querySelector(".lucide-waves");
      expect(waves).toBeInTheDocument();
      // Count badge shows 2
      expect(screen.getByText("2")).toBeInTheDocument();
      // Button label shows active state via aria-label
      expect(
        screen.getByRole("button", { name: /manage alerts/i })
      ).toBeInTheDocument();
    });

    it("shows Waves icon when no rules exist for this beach", () => {
      mockRules = [{ id: "r1", beach_id: "other-beach-456" }];
      const { container } = render(<BeachAlertCta {...defaultProps} />);
      const waves = container.querySelector(".lucide-waves");
      expect(waves).toBeInTheDocument();
    });

    it("only counts rules matching the current beach_id", () => {
      mockRules = [
        { id: "r1", beach_id: "beach-123" },
        { id: "r2", beach_id: "other-beach" },
        { id: "r3", beach_id: "beach-123" },
      ];
      render(<BeachAlertCta {...defaultProps} />);
      expect(screen.getByText("2")).toBeInTheDocument();
    });

    it("does not count similarity alerts as active condition alerts", () => {
      mockRules = [
        { id: "r1", beach_id: "beach-123", preset_type: "similarity_match" },
      ];

      const { container } = render(<BeachAlertCta {...defaultProps} />);

      expect(container.querySelector(".lucide-waves")).toBeInTheDocument();
      expect(screen.queryByText("1")).not.toBeInTheDocument();
    });

    it("refreshes cached alert rules when the parent reports a new rule", () => {
      const { rerender } = render(
        <BeachAlertCta {...defaultProps} refreshKey={0} />,
      );

      rerender(<BeachAlertCta {...defaultProps} refreshKey={1} />);

      expect(mockInvalidateCache).toHaveBeenCalledTimes(1);
      expect(mockRefetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("deferred action after sign-in", () => {
    it("auto-triggers onOpenAlerts and clears pending action when user signs in with a matching pending alert", async () => {
      const onOpenAlerts = jest.fn();
      mockPendingAction = {
        type: "alert",
        beachId: defaultProps.beachId,
        beachName: defaultProps.beachName,
        timestamp: Date.now(),
      };

      mockUseAuth.mockReturnValue(authenticatedAuth);

      await act(async () => {
        render(<BeachAlertCta {...defaultProps} onOpenAlerts={onOpenAlerts} />);
      });

      await waitFor(() => {
        expect(mockClearPendingAction).toHaveBeenCalled();
        expect(onOpenAlerts).toHaveBeenCalledTimes(1);
      });
    });

    it("does NOT auto-trigger when pending action beachId differs", async () => {
      const onOpenAlerts = jest.fn();
      mockPendingAction = {
        type: "alert",
        beachId: "different-beach-999",
        beachName: "Other Beach",
        timestamp: Date.now(),
      };

      mockUseAuth.mockReturnValue(authenticatedAuth);

      await act(async () => {
        render(<BeachAlertCta {...defaultProps} onOpenAlerts={onOpenAlerts} />);
      });

      await waitFor(() => {
        expect(onOpenAlerts).not.toHaveBeenCalled();
        expect(mockClearPendingAction).not.toHaveBeenCalled();
      });
    });
  });

  describe("compact mode", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth);
    });

    it("renders in compact mode without full text", () => {
      render(<BeachAlertCta {...defaultProps} compact />);
      // compact mode shows aria-label not text
      expect(
        screen.getByRole("button", { name: /set up alerts/i })
      ).toBeInTheDocument();
      // Should not render the subtitle text
      expect(
        screen.queryByText(/notify me when conditions are ideal/i)
      ).not.toBeInTheDocument();
    });

    it("compact mode shows badge count when alerts are active", () => {
      mockUseAuth.mockReturnValue(authenticatedAuth);
      mockRules = [{ id: "r1", beach_id: "beach-123" }];
      render(<BeachAlertCta {...defaultProps} compact />);
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });
});
