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

const mockEnableFavoriteAlerts = jest.fn();
jest.mock("@/actions/beach/beach-favorite-actions", () => ({
  enableFavoriteAlerts: (...args: any[]) => mockEnableFavoriteAlerts(...args),
}));

const mockToast = jest.fn();
jest.mock("@/components/ui/use-toast", () => ({
  toast: (...args: any[]) => mockToast(...args),
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
    mockPendingAction = null;
  });

  describe("renders Bell icon and Get Alerts text", () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue(unauthenticatedAuth);
    });

    it("renders a button with Get Alerts text", () => {
      render(<BeachAlertCta {...defaultProps} />);
      expect(
        screen.getByRole("button", { name: /get alerts/i })
      ).toBeInTheDocument();
    });

    it("renders a Bell icon inside the button", () => {
      const { container } = render(<BeachAlertCta {...defaultProps} />);
      const icon = container.querySelector(".lucide-bell");
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

    it("calls enableFavoriteAlerts with beachId when button is clicked", async () => {
      mockEnableFavoriteAlerts.mockResolvedValue({
        success: true,
        data: { alerts_enabled: true, was_already_favorited: false },
      });

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(mockEnableFavoriteAlerts).toHaveBeenCalledWith(defaultProps.beachId);
    });

    it("shows success message after enableFavoriteAlerts resolves", async () => {
      mockEnableFavoriteAlerts.mockResolvedValue({
        success: true,
        data: { alerts_enabled: true, was_already_favorited: false },
      });

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(
          screen.getByText(/alerts enabled for Blacks Beach/i)
        ).toBeInTheDocument();
      });
    });

    it("does not open auth modal for authenticated users", async () => {
      mockEnableFavoriteAlerts.mockResolvedValue({
        success: true,
        data: { alerts_enabled: true, was_already_favorited: false },
      });

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      expect(screen.queryByTestId("auth-modal")).not.toBeInTheDocument();
    });

    it("shows loading state (disabled button) while enableFavoriteAlerts is in progress", async () => {
      let resolveAction!: (value: any) => void;
      mockEnableFavoriteAlerts.mockReturnValue(
        new Promise((resolve) => {
          resolveAction = resolve;
        })
      );

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      act(() => {
        fireEvent.click(btn);
      });

      // Button should be disabled while the action is in flight
      await waitFor(() => {
        expect(screen.getByRole("button")).toBeDisabled();
      });

      // Resolve the action so cleanup is tidy
      await act(async () => {
        resolveAction({
          success: true,
          data: { alerts_enabled: true, was_already_favorited: false },
        });
      });
    });

    it("shows error toast when enableFavoriteAlerts returns success: false", async () => {
      mockEnableFavoriteAlerts.mockResolvedValue({
        success: false,
        error: "Network error",
      });

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to enable alerts",
            variant: "destructive",
          })
        );
      });
    });

    it("shows error toast when enableFavoriteAlerts throws", async () => {
      mockEnableFavoriteAlerts.mockRejectedValue(new Error("Unexpected failure"));

      render(<BeachAlertCta {...defaultProps} />);
      const btn = screen.getByRole("button", { name: /get alerts/i });

      await act(async () => {
        fireEvent.click(btn);
      });

      await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Failed to enable alerts",
            variant: "destructive",
          })
        );
      });
    });
  });

  describe("deferred action after sign-in", () => {
    it("auto-triggers enableFavoriteAlerts when user signs in with a matching pending alert", async () => {
      mockEnableFavoriteAlerts.mockResolvedValue({
        success: true,
        data: { alerts_enabled: true, was_already_favorited: false },
      });

      // Pending action for this exact beach is already stored
      mockPendingAction = {
        type: "alert",
        beachId: defaultProps.beachId,
        beachName: defaultProps.beachName,
        timestamp: Date.now(),
      };

      mockUseAuth.mockReturnValue(authenticatedAuth);

      await act(async () => {
        render(<BeachAlertCta {...defaultProps} />);
      });

      await waitFor(() => {
        expect(mockEnableFavoriteAlerts).toHaveBeenCalledWith(defaultProps.beachId);
      });
    });

    it("does NOT auto-trigger when pending action beachId differs", async () => {
      mockPendingAction = {
        type: "alert",
        beachId: "different-beach-999",
        beachName: "Other Beach",
        timestamp: Date.now(),
      };

      mockUseAuth.mockReturnValue(authenticatedAuth);

      await act(async () => {
        render(<BeachAlertCta {...defaultProps} />);
      });

      // Give React a tick to run any effects
      await waitFor(() => {
        expect(mockEnableFavoriteAlerts).not.toHaveBeenCalled();
      });
    });
  });
});
